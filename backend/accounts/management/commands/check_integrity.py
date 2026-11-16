"""Data integrity check for GroupHub."""

from django.core.management.base import BaseCommand
from django.db import connection

from accounts.models import (
    Course,
    Group,
    GroupMembership,
    LecturerRoster,
    Semester,
    StudentEnrollment,
    Task,
    Unit,
    UnitAssignment,
    User,
)


class Command(BaseCommand):
    help = 'Check data integrity across the GroupHub system.'

    def handle(self, *args, **options):
        issues = []

        issues.extend(self._check_students_without_enrolment())
        issues.extend(self._check_group_members_not_enrolled())
        issues.extend(self._check_units_without_lecturer())
        issues.extend(self._check_lecturers_without_assignment())
        issues.extend(self._check_lecturers_without_roster())
        issues.extend(self._check_tasks_assigned_to_non_members())
        issues.extend(self._check_tasks_without_due_dates())
        issues.extend(self._check_orphaned_records())
        issues.extend(self._check_migration_drift())

        if issues:
            self.stdout.write(self.style.ERROR(f'Found {len(issues)} integrity issue(s):'))
            for issue in issues:
                self.stdout.write(f'  - {issue}')
        else:
            self.stdout.write(self.style.SUCCESS('All integrity checks passed.'))

    def _check_students_without_enrolment(self):
        issues = []
        students = User.objects.filter(user_type='student')
        current_term = Semester.objects.filter(is_current=True).first()

        for student in students:
            has_enrolment = False
            if current_term:
                has_enrolment = StudentEnrollment.objects.filter(student=student, semester=current_term).exists()
            if not has_enrolment:
                # Fallback: check if they match any unit by course/year/semester
                if student.year_of_study and student.semester:
                    try:
                        year_val = int(student.year_of_study)
                        sem_val = int(student.semester)
                        units = Unit.objects.filter(
                            course__name=student.course,
                            year_of_study=year_val,
                            semester=sem_val,
                        )
                        if not units.exists():
                            issues.append(f'Student {student.username} ({student.email}) has no enrolment and no matching unit by course/year/semester.')
                    except (ValueError, TypeError):
                        issues.append(f'Student {student.username} ({student.email}) has invalid year_of_study or semester values.')
                else:
                    issues.append(f'Student {student.username} ({student.email}) has no enrolment and missing year_of_study/semester.')
        return issues

    def _check_group_members_not_enrolled(self):
        issues = []
        current_term = Semester.objects.filter(is_current=True).first()

        for membership in GroupMembership.objects.select_related('student', 'group__unit'):
            student = membership.student
            group = membership.group
            unit = group.unit

            if not unit:
                issues.append(f'Group {group.name} (ID: {group.id}) has no unit assigned; member {student.username} cannot be validated.')
                continue

            enrolled = False
            if current_term:
                enrolled = StudentEnrollment.objects.filter(student=student, unit=unit, semester=current_term).exists()
            if not enrolled:
                # Fallback check
                enrolled = (
                    student.course == unit.course.name
                    and str(student.year_of_study) == str(unit.year_of_study)
                    and str(student.semester) == str(unit.semester)
                )
            if not enrolled:
                issues.append(f'Group {group.name} member {student.username} is not enrolled in unit {unit.code}.')
        return issues

    def _check_units_without_lecturer(self):
        issues = []
        units = Unit.objects.filter(assigned_lecturer__isnull=True).select_related('course')
        for unit in units:
            issues.append(f'Unit {unit.code} ({unit.name}) has no assigned lecturer.')
        return issues

    def _check_lecturers_without_assignment(self):
        issues = []
        current_term = Semester.objects.filter(is_current=True).first()

        lecturers = User.objects.filter(user_type='lecturer')
        for lecturer in lecturers:
            has_assignment = False
            if current_term:
                has_assignment = UnitAssignment.objects.filter(lecturer=lecturer, term=current_term).exists()
            if not has_assignment:
                issues.append(f'Lecturer {lecturer.username} ({lecturer.email}) has no active unit assignment for the current term.')
        return issues

    def _check_lecturers_without_roster(self):
        issues = []
        lecturers = User.objects.filter(user_type='lecturer')
        roster_emails = set(LecturerRoster.objects.values_list('email', flat=True))
        for lecturer in lecturers:
            if lecturer.email.lower() not in {e.lower() for e in roster_emails}:
                issues.append(f'Lecturer user {lecturer.username} ({lecturer.email}) has no matching LecturerRoster entry by email.')
        return issues

    def _check_tasks_assigned_to_non_members(self):
        issues = []
        tasks = Task.objects.filter(assigned_to__isnull=False).select_related('assigned_to', 'project__group')
        for task in tasks:
            group = task.project.group
            if not GroupMembership.objects.filter(group=group, student=task.assigned_to).exists():
                issues.append(f'Task "{task.title}" (ID: {task.id}) is assigned to {task.assigned_to.username} who is not a member of group {group.name}.')
        return issues

    def _check_tasks_without_due_dates(self):
        issues = []
        tasks = Task.objects.filter(due_date__isnull=True).select_related('project__group')
        for task in tasks:
            issues.append(f'Task "{task.title}" (ID: {task.id}) in group {task.project.group.name} has no due date.')
        return issues

    def _check_orphaned_records(self):
        issues = []

        # Groups without members
        for group in Group.objects.all():
            if not GroupMembership.objects.filter(group=group).exists():
                issues.append(f'Group {group.name} (ID: {group.id}) has no members.')

        # Projects without tasks
        from accounts.models import Project
        for project in Project.objects.all():
            if not Task.objects.filter(project=project).exists():
                issues.append(f'Project "{project.title}" (ID: {project.id}) in group {project.group.name} has no tasks.')

        # ChatRooms without groups or users
        from accounts.models import ChatRoom
        for room in ChatRoom.objects.all():
            if room.chat_type == 'group' and not room.group_id:
                issues.append(f'Group chat room (ID: {room.id}) has no associated group.')
            if room.chat_type == 'direct' and (not room.user1_id or not room.user2_id):
                issues.append(f'Direct chat room (ID: {room.id}) is missing user1 or user2.')

        # Messages in non-existent rooms
        from accounts.models import Message
        for message in Message.objects.filter(chat_room__isnull=True):
            issues.append(f'Message (ID: {message.id}) has no associated chat room.')

        # Submissions without project
        from accounts.models import Submission
        for sub in Submission.objects.filter(project__isnull=True):
            issues.append(f'Submission (ID: {sub.id}) has no associated project.')

        return issues

    def _check_migration_drift(self):
        issues = []
        # Check if all migrations are applied
        from django.db.migrations.recorder import MigrationRecorder
        from django.db.migrations.loader import MigrationLoader

        connection.ensure_connection()
        recorder = MigrationRecorder(connection)
        loader = MigrationLoader(connection, ignore_no_migrations=True)

        applied = set(recorder.applied_migrations())
        missing = []
        for app_name, migration_name in loader.graph.nodes:
            if (app_name, migration_name) not in applied:
                missing.append(f'{app_name}.{migration_name}')

        if missing:
            issues.append(f'Unapplied migrations: {", ".join(missing)}')

        return issues
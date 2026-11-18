"""Create or refresh the GroupHub demonstration data."""

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.balance import calculate_group_balance
from accounts.models import (
    ChatRoom,
    Course,
    Group,
    GroupMembership,
    LecturerRoster,
    Message,
    Poll,
    PollOption,
    Project,
    Semester,
    StudentEnrollment,
    Submission,
    Task,
    TaskActivity,
    TaskComment,
    Unit,
    UnitAssignment,
    User,
)


SMALL_WORDS = {'and', 'of', 'the', 'in', 'to', 'for', 'with'}
ACRONYMS = {'ICT', 'IT', 'HIV', 'AIDS', 'CCNA', 'SQL', 'UI', 'UX', 'HR', 'GIS', 'OOP', 'CAD'}


def normalise_unit_name(name):
    """Normalise a unit display name.

    - Acronyms are always uppercase (ICT, IT, SQL, etc.)
    - Small words (and, of, the, in, to, for, with) are lowercase
      unless they are the first word.
    - All other words are title-cased.
    """
    words = str(name).split()
    out = []
    for i, word in enumerate(words):
        upper = word.upper()
        if upper in ACRONYMS:
            out.append(upper)
        elif i == 0 or word.lower() not in SMALL_WORDS:
            out.append(word[:1].upper() + word[1:].lower())
        else:
            out.append(word.lower())
    return ' '.join(out)


DEMO_STUDENTS = (
    # Programme 1: BSc Computer Science
    ('demo_student_amina', 'Amina', 'Otieno', 'BSc Computer Science', '2', '1'),
    ('demo_student_brian', 'Brian', 'Mwangi', 'BSc Computer Science', '2', '1'),
    ('demo_student_wanjiku', 'Wanjiku', 'Kamau', 'BSc Computer Science', '2', '1'),
    ('demo_student_kev', 'Kev', 'Mutua', 'BSc Computer Science', '2', '1'),
    # Programme 2: BSc Software Engineering
    ('demo_student_leila', 'Leila', 'Hassan', 'BSc Software Engineering', '2', '1'),
    ('demo_student_omar', 'Omar', 'Ali', 'BSc Software Engineering', '2', '1'),
    ('demo_student_fatuma', 'Fatuma', 'Ahmed', 'BSc Software Engineering', '2', '1'),
    ('demo_student_yusuf', 'Yusuf', 'Mohamed', 'BSc Software Engineering', '2', '1'),
)

DEMO_LECTURERS = (
    ('demo_lecturer_karis', 'Dr. Karis', 'Njoroge', 'School of Computing', 'CS1234'),
    ('demo_lecturer_mwangi', 'Prof. Mwangi', 'Waweru', 'School of Computing', 'SE5678'),
)

DEMO_ADMIN = ('demo_admin', 'Admin', 'User')

DEMO_GROUPS = (
    # (join_code, name, scenario, programme, unit_code)
    ('DEMO01', 'Healthy Demo Group', 'healthy', 'BSc Computer Science', 'CS201'),
    ('DEMO02', 'Overloaded Demo Group', 'overloaded', 'BSc Computer Science', 'CS201'),
    ('DEMO03', 'Quiet Demo Group', 'quiet', 'BSc Software Engineering', 'SE201'),
)

DEMO_GROUP_DESCRIPTION = 'GroupHub demo data managed by seed_demo.'
TASK_TITLES = (
    'Confirm project requirements',
    'Prepare research notes',
    'Draft the interface',
    'Build the data model',
    'Implement core workflow',
    'Review accessibility',
    'Write test coverage',
    'Prepare final presentation',
    'Refactor legacy components',
    'Deploy to staging environment',
)


class Command(BaseCommand):
    help = 'Create or refresh the GroupHub demonstration groups and activity.'

    @transaction.atomic
    def handle(self, *args, **options):
        # Ensure courses exist
        self._ensure_courses()

        # Ensure semester exists
        term = self._ensure_current_term()

        # Create units and assign lecturers
        self._ensure_units_and_lecturers(term)

        # Create admin
        admin = self._create_admin()

        # Create lecturers
        lecturers = self._create_lecturers(term)

        # Create students
        students = self._create_students(term)

        # Enroll students in units
        self._enroll_students(students, term)

        # Create groups
        seeded_groups = self._create_groups(students, lecturers, term)

        self.stdout.write(self.style.SUCCESS(
            f'\n=== Demo Data Ready ===\n'
            f'Admin: demo_admin@zetech.ac.ke / DemoPass123\n'
            f'Lecturer 1: demo_lecturer_karis@zetech.ac.ke / DemoPass123\n'
            f'Lecturer 2: demo_lecturer_mwangi@zetech.ac.ke / DemoPass123\n'
            f'Students (8 total):\n'
            f'  CS: amina, brian, wanjiku, kev @zetech.ac.ke / DemoPass123\n'
            f'  SE: leila, omar, fatuma, yusuf @zetech.ac.ke / DemoPass123\n'
            f'Groups: {len(seeded_groups)} (healthy, overloaded, quiet)\n'
        ))

    def _ensure_courses(self):
        courses_data = [
            ('CS', 'BSc Computer Science', 'School of Computing'),
            ('SE', 'BSc Software Engineering', 'School of Computing'),
        ]
        for code, name, dept in courses_data:
            Course.objects.update_or_create(
                code=code,
                defaults={'name': name, 'department': dept},
            )

    def _ensure_current_term(self):
        # Find existing semester with year=2, semester=1
        term = Semester.objects.filter(year=2, semester=1).first()
        if term:
            term.is_current = True
            term.name = 'Y2S1'
            term.start_date = timezone.now().date() - timedelta(days=30)
            term.end_date = timezone.now().date() + timedelta(days=90)
            term.save()
        else:
            term = Semester.objects.create(
                name='Y2S1',
                year=2,
                semester=1,
                is_current=True,
                start_date=timezone.now().date() - timedelta(days=30),
                end_date=timezone.now().date() + timedelta(days=90),
            )
        # Ensure only one current term
        Semester.objects.exclude(pk=term.pk).update(is_current=False)
        return term

    def _ensure_units_and_lecturers(self, term):
        # Get or create lecturers first
        lecturer1 = User.objects.filter(username='demo_lecturer_karis').first()
        lecturer2 = User.objects.filter(username='demo_lecturer_mwangi').first()

        # Units for CS
        cs_course = Course.objects.get(code='CS')
        cs_unit, _ = Unit.objects.update_or_create(
            code='CS201',
            course=cs_course,
            defaults={
                'name': normalise_unit_name('Software Engineering Fundamentals'),
                'year_of_study': 2,
                'semester': 1,
                'academic_level': 'undergraduate',
                'assigned_lecturer': lecturer1,
            },
        )

        # Units for SE
        se_course = Course.objects.get(code='SE')
        se_unit, _ = Unit.objects.update_or_create(
            code='SE201',
            course=se_course,
            defaults={
                'name': normalise_unit_name('Advanced Software Architecture'),
                'year_of_study': 2,
                'semester': 1,
                'academic_level': 'undergraduate',
                'assigned_lecturer': lecturer2,
            },
        )

    def _create_admin(self):
        username, first_name, last_name = DEMO_ADMIN
        email = f'{username}@zetech.ac.ke'
        user = User.objects.filter(username=username).first()
        if user and user.email.casefold() != email.casefold():
            raise CommandError(f'Username {username} belongs to a non-demo account.')
        if user is None:
            email_owner = User.objects.filter(email__iexact=email).first()
            if email_owner:
                raise CommandError(f'Email {email} belongs to a non-demo account.')
            user = User(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                user_type='student',  # admin uses student type with is_staff/is_superuser
                is_staff=True,
                is_superuser=True,
            )
        user.email = email
        user.first_name = first_name
        user.last_name = last_name
        user.user_type = 'student'
        user.is_staff = True
        user.is_superuser = True
        user.set_password('DemoPass123')
        user.save()
        return user

    def _create_lecturers(self, term):
        lecturers = []
        for username, first_name, last_name, dept, staff_id in DEMO_LECTURERS:
            email = f'{username}@zetech.ac.ke'
            # Create or update LecturerRoster as the source of truth
            roster, _ = LecturerRoster.objects.update_or_create(
                email=email,
                defaults={
                    'full_name': f'{first_name} {last_name}',
                    'department': dept,
                    'staff_id': staff_id,
                    'status': 'active',
                },
            )
            # Link the User to the roster by email
            user = User.objects.filter(username=username).first()
            if user and user.email.casefold() != email.casefold():
                raise CommandError(f'Username {username} belongs to a non-demo account.')
            if user is None:
                email_owner = User.objects.filter(email__iexact=email).first()
                if email_owner:
                    raise CommandError(f'Email {email} belongs to a non-demo account.')
                user = User(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    user_type='lecturer',
                    department=dept,
                    staff_id=staff_id,
                )
            user.email = email
            user.first_name = first_name
            user.last_name = last_name
            user.user_type = 'lecturer'
            user.department = dept
            user.staff_id = staff_id
            user.set_password('DemoPass123')
            user.save()
            lecturers.append(user)

        # Assign units
        cs_unit = Unit.objects.get(code='CS201')
        se_unit = Unit.objects.get(code='SE201')
        UnitAssignment.objects.update_or_create(lecturer=lecturers[0], unit=cs_unit, term=term, defaults={'status': 'active'})
        UnitAssignment.objects.update_or_create(lecturer=lecturers[1], unit=se_unit, term=term, defaults={'status': 'active'})
        cs_unit.assigned_lecturer = lecturers[0]
        se_unit.assigned_lecturer = lecturers[1]
        cs_unit.save()
        se_unit.save()

        return lecturers

    def _create_students(self, term):
        students = []
        for username, first_name, last_name, course_name, year, sem in DEMO_STUDENTS:
            email = f'{username}@zetech.ac.ke'
            user = User.objects.filter(username=username).first()
            if user and user.email.casefold() != email.casefold():
                raise CommandError(f'Username {username} belongs to a non-demo account.')
            if user is None:
                email_owner = User.objects.filter(email__iexact=email).first()
                if email_owner:
                    raise CommandError(f'Email {email} belongs to a non-demo account.')
                user = User(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    user_type='student',
                )
            user.email = email
            user.first_name = first_name
            user.last_name = last_name
            user.user_type = 'student'
            user.course = course_name
            user.year_of_study = year
            user.semester = int(sem)
            user.set_password('DemoPass123')
            user.save()
            students.append(user)
        return students

    def _enroll_students(self, students, term):
        cs_unit = Unit.objects.get(code='CS201')
        se_unit = Unit.objects.get(code='SE201')

        for student in students:
            if student.course == 'BSc Computer Science':
                StudentEnrollment.objects.update_or_create(student=student, unit=cs_unit, semester=term)
            else:
                StudentEnrollment.objects.update_or_create(student=student, unit=se_unit, semester=term)

    def _create_groups(self, students, lecturers, term):
        seeded_groups = []
        cs_students = [s for s in students if s.course == 'BSc Computer Science']
        se_students = [s for s in students if s.course == 'BSc Software Engineering']

        for join_code, group_name, scenario, programme, unit_code in DEMO_GROUPS:
            unit = Unit.objects.get(code=unit_code)
            lecturer = lecturers[0] if programme == 'BSc Computer Science' else lecturers[1]
            group_students = cs_students if programme == 'BSc Computer Science' else se_students

            group = Group.objects.filter(join_code=join_code).first()
            if group and (group.description != DEMO_GROUP_DESCRIPTION):
                raise CommandError(f'Join code {join_code} belongs to a non-demo group.')
            if group is None:
                group = Group.objects.create(
                    name=group_name,
                    course=programme,
                    year_of_study='2',
                    description=DEMO_GROUP_DESCRIPTION,
                    join_code=join_code,
                    lecturer=lecturer,
                    unit=unit,
                    max_members=4,
                    is_locked=False,
                    is_archived=False,
                )
            else:
                group.name = group_name
                group.course = programme
                group.year_of_study = '2'
                group.description = DEMO_GROUP_DESCRIPTION
                group.lecturer = lecturer
                group.unit = unit
                group.max_members = 4
                group.is_locked = False
                group.is_archived = False
                group.save()

            # Create memberships - clear existing first for demo groups
            GroupMembership.objects.filter(group=group).delete()
            for student in group_students:
                GroupMembership.objects.create(group=group, student=student, role='member')

            # Create project
            project, _ = Project.objects.update_or_create(
                group=group,
                title=f'{group_name} Project',
                defaults={
                    'description': f'Demonstration project for the {scenario} workload scenario.',
                    'status': 'active',
                    'deadline': timezone.now() + timedelta(days=14),
                },
            )

            self._refresh_scenario(group, project, group_students, scenario)
            seeded_groups.append(group)

        return seeded_groups

    def _refresh_scenario(self, group, project, students, scenario):
        from accounts.models import Poll, PollOption, PollVote
        Task.objects.filter(project=project).delete()
        Submission.objects.filter(project=project).delete()
        room, _ = ChatRoom.objects.get_or_create(group=group, defaults={'chat_type': 'group'})
        Message.objects.filter(chat_room=room).delete()
        Poll.objects.filter(group=group).delete()
        PollOption.objects.filter(poll__group=group).delete()
        PollVote.objects.filter(poll__group=group).delete()

        now = timezone.now()
        quiet = scenario == 'quiet'
        overloaded = scenario == 'overloaded'
        activity_base = now - timedelta(days=14) if quiet else now - timedelta(days=3)
        task_due_base = now - timedelta(days=11) if quiet else now + timedelta(days=1)
        tasks = []

        for index, title in enumerate(TASK_TITLES):
            if overloaded:
                assignee = students[0] if index < 8 else students[1]
                weight = 4 if index < 8 else 2
            elif scenario == 'healthy':
                # Distribute evenly across 4 students
                assignee = students[index % 4]
                weight = (index % 3) + 1
            else:
                assignee = students[index % len(students)]
                weight = (index % 3) + 1

            completed = scenario == 'healthy' and index < 7
            if overloaded:
                completed = index in (0, 3, 6)
            if quiet:
                completed = index < 3

            due_date = task_due_base + timedelta(days=index)
            task = Task.objects.create(
                project=project,
                title=title,
                description=f'Demo task {index + 1} for the {scenario} scenario.',
                assigned_to=assignee,
                status='completed' if completed else ('in_progress' if index == 0 else 'pending'),
                progress_percentage=100 if completed else (35 if index == 0 else 0),
                weight=weight,
                due_date=due_date,
                completed_at=(activity_base + timedelta(days=index % 3)) if completed else None,
                proposal_status='approved',
                assignment_mode='assigned',
            )
            timestamp = activity_base + timedelta(days=index % 4)
            Task.objects.filter(pk=task.pk).update(created_at=timestamp, updated_at=timestamp)
            tasks.append(task)

            TaskActivity.objects.create(
                task=task,
                actor=students[0],
                action='created',
                note='Demo task created.',
                to_user=assignee,
            )
            if completed:
                TaskActivity.objects.create(
                    task=task,
                    actor=assignee,
                    action='completed',
                    note='Demo task completed.',
                    to_user=assignee,
                )
            TaskComment.objects.create(
                task=task,
                author=students[(index + 1) % len(students)],
                content=f'Demo review note for {title.lower()}.',
            )
            TaskActivity.objects.filter(task=task).update(created_at=timestamp)
            TaskComment.objects.filter(task=task).update(created_at=timestamp)

        # Subtasks
        for parent_index in (1, 4, 7):
            if parent_index < len(tasks):
                parent = tasks[parent_index]
                subtask = Task.objects.create(
                    project=project,
                    parent_task=parent,
                    title=f'{parent.title}: review checkpoint',
                    description='A smaller step within the parent task.',
                    assigned_to=students[2] if scenario == 'healthy' else parent.assigned_to,
                    status='completed' if parent.status == 'completed' else 'pending',
                    progress_percentage=100 if parent.status == 'completed' else 0,
                    weight=1,
                    due_date=parent.due_date,
                    completed_at=parent.completed_at,
                    proposal_status='approved',
                    assignment_mode='assigned',
                )
                timestamp = activity_base + timedelta(days=parent_index % 4)
                Task.objects.filter(pk=subtask.pk).update(created_at=timestamp, updated_at=timestamp)
                TaskActivity.objects.create(
                    task=subtask,
                    actor=students[0],
                    action='created',
                    note='Demo subtask created.',
                    to_user=parent.assigned_to,
                )
                TaskActivity.objects.filter(task=subtask).update(created_at=timestamp)
                TaskComment.objects.create(
                    task=subtask,
                    author=students[2],
                    content='Checkpoint details are ready for review.',
                )
                TaskComment.objects.filter(task=subtask).update(created_at=timestamp)

        # Chat messages
        messages = [
            ('Let\'s check the project plan and divide the next steps.', students[0]),
            ('I have added my update to the shared task list.', students[1]),
            ('The latest notes are ready for everyone to review.', students[2]),
        ]
        for index, (content, sender) in enumerate(messages):
            message = Message.objects.create(chat_room=room, sender=sender, content=content)
            Message.objects.filter(pk=message.pk).update(
                timestamp=activity_base + timedelta(days=index)
            )

        # Poll for healthy and overloaded groups
        if scenario in ('healthy', 'overloaded'):
            from accounts.models import Poll, PollOption
            poll = Poll.objects.create(
                group=group,
                question=f'Preferred meeting time for {group.name}?',
                created_by=students[0],
                status='open',
                allow_new_options=True,
            )
            for opt_text in ['Monday 10am', 'Wednesday 2pm', 'Friday 11am']:
                PollOption.objects.create(poll=poll, text=opt_text, pitch='', added_by=students[0])

        # Submission for healthy group
        if scenario == 'healthy':
            Submission.objects.create(
                project=project,
                submitted_by=students[0],
                status='submitted',
                proof_text='The team completed the initial research, interface draft, and test plan.',
                github_url='https://github.com/grouphub-demo/healthy-project',
            )

        # Validation for overloaded
        if overloaded:
            balance = calculate_group_balance(group)
            if not any(member['warning_level'] in ('warning', 'critical') for member in balance['members']):
                raise CommandError('Demo overloaded group did not produce an imbalance warning.')

        # Validation for quiet: ensure no activity in last 5 days
        if quiet:
            recent = Task.objects.filter(project=project, updated_at__gte=now - timedelta(days=5)).exists()
            if recent:
                self.stdout.write(self.style.WARNING(f'Quiet group {group.name} has recent activity; check test expectations.'))
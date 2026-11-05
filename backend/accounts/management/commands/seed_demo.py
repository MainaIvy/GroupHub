from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.balance import calculate_group_balance
from accounts.models import (
    ChatRoom,
    Group,
    GroupMembership,
    Message,
    Project,
    Submission,
    Task,
    TaskActivity,
    TaskComment,
    User,
)


DEMO_STUDENTS = (
    ('demo_student_amina', 'Amina', 'Otieno'),
    ('demo_student_brian', 'Brian', 'Mwangi'),
    ('demo_student_wanjiku', 'Wanjiku', 'Kamau'),
)
DEMO_GROUPS = (
    ('DEMO01', 'Healthy Demo Group', 'healthy'),
    ('DEMO02', 'Overloaded Demo Group', 'overloaded'),
    ('DEMO03', 'Quiet Demo Group', 'quiet'),
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
)


class Command(BaseCommand):
    help = 'Create or refresh the GroupHub demonstration groups and activity.'

    @transaction.atomic
    def handle(self, *args, **options):
        students = []
        for username, first_name, last_name in DEMO_STUDENTS:
            email = f'{username}@zetech.ac.ke'
            student = User.objects.filter(username=username).first()
            if student and student.email.casefold() != email.casefold():
                raise CommandError(
                    f'Username {username} belongs to a non-demo account; refusing to modify it.'
                )
            if student is None:
                email_owner = User.objects.filter(email__iexact=email).first()
                if email_owner:
                    raise CommandError(
                        f'Email {email} belongs to a non-demo account; refusing to modify it.'
                    )
                student = User(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    user_type='student',
                    course='BSc Computer Science',
                    year_of_study='2',
                    password='!unusable-demo-password',
                )
            student.email = f'{username}@zetech.ac.ke'
            student.first_name = first_name
            student.last_name = last_name
            student.user_type = 'student'
            student.course = 'BSc Computer Science'
            student.year_of_study = '2'
            student.set_unusable_password()
            student.save()
            students.append(student)

        seeded_groups = []
        for join_code, group_name, scenario in DEMO_GROUPS:
            group = Group.objects.filter(join_code=join_code).first()
            if group and (
                group.lecturer_id not in {student.id for student in students}
                or group.description != DEMO_GROUP_DESCRIPTION
            ):
                raise CommandError(
                    f'Join code {join_code} belongs to a non-demo group; refusing to modify it.'
                )
            if group is None:
                group = Group.objects.create(
                    name=group_name,
                    course='BSc Computer Science',
                    year_of_study='2',
                    description=DEMO_GROUP_DESCRIPTION,
                    join_code=join_code,
                    lecturer=students[0],
                    max_members=3,
                )
            else:
                group.name = group_name
                group.course = 'BSc Computer Science'
                group.year_of_study = '2'
                group.description = DEMO_GROUP_DESCRIPTION
                group.lecturer = students[0]
                group.max_members = 3
                group.save()

            for student in students:
                GroupMembership.objects.get_or_create(group=group, student=student)

            project, _ = Project.objects.update_or_create(
                group=group,
                title=f'{group_name} Project',
                defaults={
                    'description': f'Demonstration project for the {scenario} workload scenario.',
                    'status': 'active',
                    'deadline': timezone.now() + timedelta(days=14),
                },
            )
            self._refresh_scenario(group, project, students, scenario)
            seeded_groups.append(group)

        self.stdout.write(self.style.SUCCESS(
            f'Demo data ready: {len(seeded_groups)} groups, '
            f'{len(students)} demo student accounts.'
        ))

    def _refresh_scenario(self, group, project, students, scenario):
        Task.objects.filter(project=project).delete()
        Submission.objects.filter(project=project).delete()
        room, _ = ChatRoom.objects.get_or_create(group=group, defaults={'chat_type': 'group'})
        Message.objects.filter(chat_room=room).delete()

        now = timezone.now()
        quiet = scenario == 'quiet'
        activity_base = now - timedelta(days=14) if quiet else now - timedelta(days=3)
        task_due_base = now - timedelta(days=11) if quiet else now + timedelta(days=1)
        tasks = []

        for index, title in enumerate(TASK_TITLES):
            if scenario == 'overloaded':
                assignee = students[0] if index < 7 else students[1]
                weight = 4 if index < 7 else 2
            elif scenario == 'healthy':
                assignee = students[(1, 2, 0, 2, 0, 1, 0, 2)[index]]
                weight = (index % 3) + 1
            else:
                assignee = students[index % len(students)]
                weight = (index % 3) + 1

            completed = scenario == 'healthy' and index < 7
            if scenario == 'overloaded':
                completed = index in (0, 3, 6)
            due_date = task_due_base + timedelta(days=index)
            task = Task.objects.create(
                project=project,
                title=title,
                description=f'Demo task {index + 1} for the {scenario} scenario.',
                assigned_to=assignee,
                status='completed' if completed else ('in_progress' if index == 0 else 'pending'),
                progress_percentage=100 if completed else (35 if index == 0 else 0),
                weight=weight,
                task_weight=weight,
                due_date=due_date,
                completed_at=(activity_base + timedelta(days=index % 3)) if completed else None,
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

        for parent_index in (1, 4):
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
                task_weight=1,
                due_date=parent.due_date,
                completed_at=parent.completed_at,
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

        messages = [
            ('Let’s check the project plan and divide the next steps.', students[0]),
            ('I have added my update to the shared task list.', students[1]),
            ('The latest notes are ready for everyone to review.', students[2]),
        ]
        for index, (content, sender) in enumerate(messages):
            message = Message.objects.create(chat_room=room, sender=sender, content=content)
            Message.objects.filter(pk=message.pk).update(
                timestamp=activity_base + timedelta(days=index)
            )

        if scenario == 'healthy':
            Submission.objects.create(
                project=project,
                submitted_by=students[0],
                status='submitted',
                proof_text='The team completed the initial research, interface draft, and test plan.',
                github_url='https://github.com/grouphub-demo/healthy-project',
            )

        if scenario == 'overloaded':
            balance = calculate_group_balance(group)
            if not any(member['warning_level'] in ('warning', 'critical') for member in balance['members']):
                raise CommandError('Demo overloaded group did not produce an imbalance warning.')

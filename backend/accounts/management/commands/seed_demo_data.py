from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import (
    ChatRoom,
    Group,
    GroupMembership,
    Message,
    Notification,
    Project,
    Submission,
    Task,
    TaskComment,
    User,
)


DEMO_PASSWORD = "DemoPass123"


class Command(BaseCommand):
    help = "Create or update realistic GroupHub demo data for student, lecturer, and admin dashboards."

    def create_user(self, email, first_name, last_name, user_type, **extra):
        try:
            user = User.objects.get(email=email)
            created = False
        except User.DoesNotExist:
            user = User(email=email, username=email)
            created = True
        user.username = email
        user.first_name = first_name
        user.last_name = last_name
        user.user_type = user_type
        user.university = "Zetech University"
        user.is_active = True
        user.email_verified = True
        for field, value in extra.items():
            setattr(user, field, value)
        user.set_password(DEMO_PASSWORD)
        user.save()
        return user, created

    def handle(self, *args, **options):
        lecturer, lecturer_created = self.create_user(
            "lecturer.demo@zetech.ac.ke",
            "Grace",
            "Wanjiku",
            "lecturer",
            staff_id="CS2024",
            department="Computer Science",
            salutation="Dr.",
        )
        admin, admin_created = self.create_user(
            "admin.demo@zetech.ac.ke",
            "System",
            "Administrator",
            "student",
            is_staff=True,
            is_superuser=True,
        )
        students = []
        for email, first_name, last_name, admission in [
            ("amina.demo@zetech.ac.ke", "Amina", "Hassan", "BSC/001/24"),
            ("brian.demo@zetech.ac.ke", "Brian", "Otieno", "BSC/002/24"),
            ("claire.demo@zetech.ac.ke", "Claire", "Njeri", "BSC/003/24"),
        ]:
            student, _ = self.create_user(
                email,
                first_name,
                last_name,
                "student",
                course="BSc Computer Science",
                year_of_study="2",
                staff_id="",
            )
            students.append(student)

        group_one, _ = Group.objects.get_or_create(
            name="Alpha Innovators",
            lecturer=lecturer,
            defaults={"course": "BSc Computer Science", "year_of_study": "2"},
        )
        group_two, _ = Group.objects.get_or_create(
            name="Digital Pioneers",
            lecturer=lecturer,
            defaults={"course": "BSc Computer Science", "year_of_study": "2"},
        )

        memberships = [
            (group_one, students[0], "admin"),
            (group_one, students[1], "member"),
            (group_two, students[2], "admin"),
        ]
        for group, student, role in memberships:
            GroupMembership.objects.update_or_create(
                group=group, student=student, defaults={"role": role}
            )

        now = timezone.now()
        project_one, _ = Project.objects.get_or_create(
            title="Campus Event Management System",
            group=group_one,
            defaults={
                "description": "Design and prototype a system for managing university events.",
                "status": "active",
                "deadline": now + timedelta(days=14),
            },
        )
        project_two, _ = Project.objects.get_or_create(
            title="Student Resource Portal",
            group=group_two,
            defaults={
                "description": "Build a searchable portal for student learning resources.",
                "status": "active",
                "deadline": now + timedelta(days=21),
            },
        )

        task_one, _ = Task.objects.get_or_create(
            title="Submit requirements document",
            project=project_one,
            assigned_to=students[0],
            defaults={
                "description": "Document the system users, scope, and functional requirements.",
                "status": "completed",
                "progress_percentage": 100,
                "due_date": now - timedelta(days=2),
            },
        )
        task_two, _ = Task.objects.get_or_create(
            title="Create database ER diagram",
            project=project_one,
            assigned_to=students[1],
            defaults={
                "description": "Prepare the first database design and upload it for review.",
                "status": "in_progress",
                "progress_percentage": 60,
                "due_date": now + timedelta(days=5),
            },
        )
        task_three, _ = Task.objects.get_or_create(
            title="Prepare resource search prototype",
            project=project_two,
            assigned_to=students[2],
            defaults={
                "description": "Build a low-fidelity searchable resource catalogue.",
                "status": "pending",
                "progress_percentage": 0,
                "due_date": now + timedelta(days=9),
            },
        )

        Submission.objects.get_or_create(
            project=project_one,
            submitted_by=students[0],
            defaults={
                "content": "Requirements document submitted for lecturer review.",
                "status": "reviewed",
                "feedback": "Good scope definition. Add one more non-functional requirement.",
                "reviewed_at": now - timedelta(days=1),
            },
        )
        TaskComment.objects.get_or_create(
            task=task_one,
            author=lecturer,
            defaults={
                "content": "Good work. Please add the security requirements before the next sprint."
            },
        )

        room_one, _ = ChatRoom.objects.get_or_create(
            group=group_one,
            defaults={"chat_type": "group"},
        )
        room_two, _ = ChatRoom.objects.get_or_create(
            group=group_two,
            defaults={"chat_type": "group"},
        )
        Message.objects.get_or_create(
            chat_room=room_one,
            sender=students[0],
            content="Hi team, I have uploaded the requirements document.",
        )
        Message.objects.get_or_create(
            chat_room=room_one,
            sender=lecturer,
            content="I will review it today. Please start the ER diagram next.",
        )
        Message.objects.get_or_create(
            chat_room=room_two,
            sender=students[2],
            content="I am starting the resource search prototype.",
        )

        Notification.objects.get_or_create(
            user=students[0],
            notification_type="task_assigned",
            title="New task assigned",
            defaults={
                "message": "You have been assigned to the requirements document task.",
                "related_task": task_one,
            },
        )
        Notification.objects.get_or_create(
            user=students[1],
            notification_type="task_due",
            title="Task deadline approaching",
            defaults={
                "message": "The database ER diagram is due in five days.",
                "related_task": task_two,
            },
        )
        Notification.objects.get_or_create(
            user=lecturer,
            notification_type="submission_reviewed",
            title="Submission ready for review",
            defaults={
                "message": "Alpha Innovators submitted a requirements document.",
                "related_project": project_one,
            },
        )

        self.stdout.write(self.style.SUCCESS("Demo data is ready."))
        self.stdout.write("Demo password for all accounts: DemoPass123")
        self.stdout.write("Admin:    admin.demo@zetech.ac.ke")
        self.stdout.write("Lecturer: lecturer.demo@zetech.ac.ke")
        self.stdout.write("Students: amina.demo@zetech.ac.ke, brian.demo@zetech.ac.ke, claire.demo@zetech.ac.ke")
        self.stdout.write(
            f"Created accounts: admin={admin_created}, lecturer={lecturer_created}; "
            f"groups={Group.objects.filter(lecturer=lecturer).count()}, "
            f"tasks={Task.objects.filter(project__group__lecturer=lecturer).count()}"
        )

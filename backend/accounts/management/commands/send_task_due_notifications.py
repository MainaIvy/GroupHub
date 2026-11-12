"""Send task due soon notifications."""
import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Notification, Task, GroupMembership, User

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Send notifications for tasks due within 24 hours'

    def handle(self, *args, **options):
        now = timezone.now()
        soon = now + timedelta(hours=24)
        
        # Find tasks due within 24 hours that aren't completed
        tasks = Task.objects.filter(
            due_date__gte=now,
            due_date__lte=soon,
        ).exclude(status='completed').select_related('assigned_to', 'project__group')
        
        sent = 0
        for task in tasks:
            if not task.assigned_to:
                continue
            
            # Check if notification already sent for this task recently
            existing = Notification.objects.filter(
                user=task.assigned_to,
                notification_type='task_due',
                related_task=task,
                created_at__gte=now - timedelta(hours=12),
            ).exists()
            
            if existing:
                continue
            
            hours_until_due = round((task.due_date - now).total_seconds() / 3600, 1)
            if hours_until_due <= 0:
                continue
            
            Notification.objects.create(
                user=task.assigned_to,
                notification_type='task_due',
                title='Task due soon',
                message=f'"{task.title}" is due in {hours_until_due} hours.',
                related_task=task,
                related_group=task.project.group,
            )
            sent += 1
        
        self.stdout.write(self.style.SUCCESS(f'Sent {sent} task due notifications'))
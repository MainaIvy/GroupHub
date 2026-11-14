"""Group health status calculation.

Single source of truth for health on the backend. All endpoints that need
health (student dashboard, group workspace, lecturer dashboard, admin)
should call :func:`compute_group_health` and/or :func:`get_health_details`
and return the resulting object verbatim.
"""
from django.utils import timezone
from datetime import timedelta
from .models import Task, TaskActivity
from .balance import calculate_group_balance
from .health_thresholds import (
    get_minimum_points, get_overdue_count, get_quiet_days,
)


def compute_group_health(group):
    """
    Compute group health status.

    Returns one of: 'too_early', 'quiet', 'at_risk', 'on_track'
    - Too early: under the configured minimum total points
    - Quiet: no activity for the configured quiet days
    - At risk: someone critical, configured+ overdue tasks, or progress < 30% with deadline within 3 days
    - Otherwise: On track
    """
    now = timezone.now()

    # Check total points (too early)
    balance = calculate_group_balance(group)
    minimum_points = get_minimum_points()
    if balance['total_points'] < minimum_points:
        return 'too_early'

    # Check for quiet (no activity for the configured quiet days)
    quiet_days = get_quiet_days()
    last_activity = TaskActivity.objects.filter(task__project__group=group).order_by('-created_at').first()
    if not last_activity or (now - last_activity.created_at) > timedelta(days=quiet_days):
        return 'quiet'

    # Check for at risk conditions
    # 1. Someone critical
    if any(member['warning_level'] == 'critical' for member in balance['members']):
        return 'at_risk'

    # 2. Configured number or more overdue tasks
    overdue_threshold = get_overdue_count()
    overdue_count = Task.objects.filter(
        project__group=group,
        due_date__lt=now,
    ).exclude(status='completed').count()
    if overdue_count >= overdue_threshold:
        return 'at_risk'

    # 3. Progress under 30% with a deadline within 3 days
    projects = list(group.projects.all())
    if projects:
        total_progress = 0
        project_count = 0
        has_upcoming_deadline = False

        for project in projects:
            root_tasks = Task.objects.filter(project=project, parent_task=None)
            if root_tasks.exists():
                project_weight = sum(max(1, task.weight) for task in root_tasks)
                if project_weight:
                    completed_weight = sum(
                        max(1, task.weight) for task in root_tasks
                        if task.status == 'completed'
                    )
                    project_progress = round(completed_weight / project_weight * 100)
                    total_progress += project_progress
                    project_count += 1

            if project.deadline and project.deadline <= now + timedelta(days=3):
                has_upcoming_deadline = True

        if project_count > 0:
            avg_progress = total_progress / project_count
            if avg_progress < 30 and has_upcoming_deadline:
                return 'at_risk'

    return 'on_track'


def get_health_details(group):
    """Get detailed health information for a group."""
    status = compute_group_health(group)
    balance = calculate_group_balance(group)
    now = timezone.now()

    minimum_points = get_minimum_points()
    quiet_days = get_quiet_days()
    overdue_threshold = get_overdue_count()

    reasons = []
    if balance['total_points'] < minimum_points:
        reasons.append(f"Too early to judge (only {balance['total_points']} points assigned)")

    last_activity = TaskActivity.objects.filter(task__project__group=group).order_by('-created_at').first()
    if not last_activity:
        reasons.append("No activity yet")
    elif (now - last_activity.created_at) > timedelta(days=quiet_days):
        reasons.append(f"Quiet for {(now - last_activity.created_at).days} days")

    if any(member['warning_level'] == 'critical' for member in balance['members']):
        critical_members = [m['name'] for m in balance['members'] if m['warning_level'] == 'critical']
        reasons.append(f"Critical workload: {', '.join(critical_members)}")

    overdue_count = Task.objects.filter(
        project__group=group,
        due_date__lt=now,
    ).exclude(status='completed').count()
    if overdue_count >= overdue_threshold:
        reasons.append(f"{overdue_count} overdue tasks")

    projects = list(group.projects.all())
    if projects:
        total_progress = 0
        project_count = 0
        has_upcoming_deadline = False
        for project in projects:
            root_tasks = Task.objects.filter(project=project, parent_task=None)
            if root_tasks.exists():
                project_weight = sum(max(1, task.weight) for task in root_tasks)
                if project_weight:
                    completed_weight = sum(
                        max(1, task.weight) for task in root_tasks
                        if task.status == 'completed'
                    )
                    project_progress = round(completed_weight / project_weight * 100)
                    total_progress += project_progress
                    project_count += 1
            if project.deadline and project.deadline <= now + timedelta(days=3):
                has_upcoming_deadline = True

        if project_count > 0:
            avg_progress = total_progress / project_count
            if avg_progress < 30 and has_upcoming_deadline:
                reasons.append(f"Low progress ({avg_progress}%) with upcoming deadline")

    return {
        'status': status,
        'reasons': reasons,
        'balance': balance,
    }
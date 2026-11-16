"""Single source of truth for derived group insights.

All endpoints (student, lecturer, admin) must call functions from this module
to ensure identical numbers are returned for the same group.
"""
from django.db.models import Exists, OuterRef, Sum
from django.utils import timezone
from datetime import timedelta

from ..models import Group, GroupMembership, Project, Task, TaskActivity
from ..balance import calculate_group_balance
from ..health_thresholds import (
    get_minimum_points,
    get_quiet_days,
    get_overdue_count,
    get_balance_thresholds,
)


def _display_name(user):
    return f'{user.first_name} {user.last_name}'.strip() or user.username


def compute_group_insights(group: Group) -> dict:
    """
    Compute all derived insights for a group.

    Returns a dict containing:
    - balance: group balance data (from calculate_group_balance)
    - health: health status and reasons
    - contributions: per-student contribution data
    - progress: overall progress percentage
    - overdue_count: number of overdue tasks
    - next_deadline: ISO string of the next upcoming deadline (task or project)
    """
    now = timezone.now()

    # Balance (single source of truth for workload distribution)
    balance = calculate_group_balance(group)

    # Health status
    health_status = _compute_health_status(group, balance, now)
    health_reasons = _compute_health_reasons(group, balance, now)

    # Per-student contributions
    contributions = _compute_contributions(group, balance)

    # Overall progress
    progress = _compute_progress(group)

    # Overdue count
    overdue_count = _compute_overdue_count(group, now)

    # Next deadline
    next_deadline = _compute_next_deadline(group, now)

    return {
        'balance': balance,
        'health': {
            'status': health_status,
            'reasons': health_reasons,
        },
        'contributions': contributions,
        'progress': progress,
        'overdue_count': overdue_count,
        'next_deadline': next_deadline,
    }


def _compute_health_status(group: Group, balance: dict, now) -> str:
    """
    Compute group health status.

    Returns one of: 'too_early', 'quiet', 'at_risk', 'on_track'
    - Too early: under the configured minimum total points (default 6)
    - Quiet: no activity for the configured quiet days (default 5)
    - At risk: someone critical, configured+ overdue tasks, or progress < 30% with deadline within 3 days
    - Otherwise: On track
    """
    minimum_points = get_minimum_points()
    if balance['total_points'] < minimum_points:
        return 'too_early'

    quiet_days = get_quiet_days()
    last_activity = TaskActivity.objects.filter(
        task__project__group=group
    ).order_by('-created_at').first()
    if not last_activity or (now - last_activity.created_at) > timedelta(days=quiet_days):
        return 'quiet'

    # At risk conditions
    if any(member['warning_level'] == 'critical' for member in balance['members']):
        return 'at_risk'

    overdue_threshold = get_overdue_count()
    overdue = Task.objects.filter(
        project__group=group,
        due_date__lt=now,
    ).exclude(status='completed').count()
    if overdue >= overdue_threshold:
        return 'at_risk'

    # Progress under 30% with a deadline within 3 days
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


def _compute_health_reasons(group: Group, balance: dict, now) -> list:
    """Get detailed reasons for the health status."""
    reasons = []
    minimum_points = get_minimum_points()
    quiet_days = get_quiet_days()
    overdue_threshold = get_overdue_count()

    if balance['total_points'] < minimum_points:
        reasons.append(f"Too early to judge (only {balance['total_points']} points assigned)")

    last_activity = TaskActivity.objects.filter(
        task__project__group=group
    ).order_by('-created_at').first()
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

    return reasons


def _compute_contributions(group: Group, balance: dict) -> list:
    """
    Compute per-student contribution data.

    Returns list of dicts with:
    - user_id
    - name
    - points_assigned
    - points_completed
    - tasks_completed
    - on_time_rate (percentage)
    """
    contributions = []
    for member in balance['members']:
        contributions.append({
            'user_id': member['user_id'],
            'name': member['name'],
            'points_assigned': member['points_assigned'],
            'points_completed': member['points_completed'],
            'tasks_completed': member['tasks_completed'],
            'on_time_rate': member['on_time_rate'],
        })
    return contributions


def _compute_progress(group: Group) -> int:
    """Compute overall group progress as weighted average across projects."""
    projects = list(group.projects.all())
    if not projects:
        return 0

    total_progress = 0
    project_count = 0

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

    if project_count == 0:
        return 0

    return round(total_progress / project_count)


def _compute_overdue_count(group: Group, now) -> int:
    """Count overdue tasks (not completed, due date passed)."""
    return Task.objects.filter(
        project__group=group,
        due_date__lt=now,
    ).exclude(status='completed').count()


def _compute_next_deadline(group: Group, now) -> str | None:
    """Get the next upcoming deadline (task or project) as ISO string."""
    deadlines = [
        *Task.objects.filter(
            project__group=group, due_date__gte=now
        ).values_list('due_date', flat=True),
        *Project.objects.filter(
            group=group, deadline__gte=now
        ).values_list('deadline', flat=True),
    ]
    if not deadlines:
        return None
    return min(deadlines).isoformat()


def get_group_insights_for_user(user, group: Group) -> dict:
    """
    Get group insights for a specific user, adding user-specific fields.

    Returns the base insights plus:
    - is_leader: whether the user is the group leader
    - user_role: the user's role in the group
    - user_balance: the specific balance entry for this user
    """
    insights = compute_group_insights(group)

    membership = GroupMembership.objects.filter(group=group, student=user).first()
    is_leader = group.leader_id == user.id
    user_role = membership.role if membership else None

    user_balance = next(
        (m for m in insights['balance']['members'] if m['user_id'] == user.id),
        None
    )

    return {
        **insights,
        'is_leader': is_leader,
        'user_role': user_role,
        'user_balance': user_balance,
    }
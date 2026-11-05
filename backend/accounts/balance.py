from django.db.models import Exists, OuterRef

from .models import GroupMembership, Task


def _display_name(user):
    return f'{user.first_name} {user.last_name}'.strip() or user.username


def calculate_group_balance(group, *, exclude_task_id=None, task_weight_to_add=0, assignee_id=None):
    memberships = GroupMembership.objects.filter(group=group).select_related('student')
    members = list(memberships)
    points_by_member = {membership.student_id: 0 for membership in members}
    completed_points_by_member = {membership.student_id: 0 for membership in members}
    completed_tasks_by_member = {membership.student_id: 0 for membership in members}
    completed_with_due_by_member = {membership.student_id: 0 for membership in members}
    on_time_tasks_by_member = {membership.student_id: 0 for membership in members}

    tasks = Task.objects.filter(project__group=group).annotate(
        has_subtasks=Exists(Task.objects.filter(parent_task_id=OuterRef('pk')))
    ).filter(has_subtasks=False).select_related('assigned_to')
    if exclude_task_id is not None:
        tasks = tasks.exclude(id=exclude_task_id)

    total_points = 0
    for task in tasks:
        total_points += task.weight
        if task.assigned_to_id in points_by_member:
            points_by_member[task.assigned_to_id] += task.weight
            if task.status == 'completed':
                member_id = task.assigned_to_id
                completed_points_by_member[member_id] += task.weight
                completed_tasks_by_member[member_id] += 1
                if task.due_date:
                    completed_with_due_by_member[member_id] += 1
                    completed_at = task.completed_at or task.updated_at
                    if completed_at <= task.due_date:
                        on_time_tasks_by_member[member_id] += 1

    if task_weight_to_add:
        total_points += task_weight_to_add
        if assignee_id in points_by_member:
            points_by_member[assignee_id] += task_weight_to_add

    member_count = len(members)
    fair_share = 100 / member_count if member_count else 0
    balance_members = []
    for membership in members:
        points = points_by_member[membership.student_id]
        share_percent = round(points / total_points * 100, 2) if total_points else 0
        if total_points < 6:
            warning_level = 'too_early'
        elif share_percent > fair_share + 25:
            warning_level = 'critical'
        elif share_percent > fair_share + 15:
            warning_level = 'warning'
        else:
            warning_level = 'ok'

        balance_members.append({
            'user_id': membership.student_id,
            'name': _display_name(membership.student),
            'points_assigned': points,
            'points_completed': completed_points_by_member[membership.student_id],
            'tasks_completed': completed_tasks_by_member[membership.student_id],
            'on_time_rate': round(
                on_time_tasks_by_member[membership.student_id]
                / completed_with_due_by_member[membership.student_id] * 100,
                2,
            ) if completed_with_due_by_member[membership.student_id] else 0,
            'share_percent': share_percent,
            'fair_share': round(fair_share, 2),
            'warning_level': warning_level,
        })

    overloaded = [member for member in balance_members if member['warning_level'] in ('warning', 'critical')]
    suggestion = ''
    if overloaded and len(balance_members) > 1:
        most_loaded = max(overloaded, key=lambda member: member['share_percent'])
        least_loaded = min(balance_members, key=lambda member: member['share_percent'])
        suggestion = (
            f"{most_loaded['name']} has {most_loaded['share_percent']:g}% of the points. "
            f"Consider moving a task to {least_loaded['name']} ({least_loaded['share_percent']:g}%)."
        )

    return {
        'total_points': total_points,
        'fair_share': round(fair_share, 2),
        'members': balance_members,
        'suggestion': suggestion,
    }
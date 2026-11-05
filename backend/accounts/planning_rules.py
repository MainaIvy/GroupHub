"""Permission rules shared by the project-planning views and the task workspace payload."""
from .models import GroupMembership

BOARD_STATUSES = ('proposed', 'open_to_claim', 'assigned', 'in_progress', 'done')


def avatar_url(user):
    return '/api/accounts/profile/avatar/' if user.avatar else None


def is_leader(user, group):
    # The group creator (Group.lecturer) is the leader.
    return group.lecturer_id == user.id


def is_group_lecturer(user, group):
    if user.user_type != 'lecturer':
        return False
    if group.lecturer_id == user.id:
        return True
    return bool(group.unit_id and group.unit.assigned_lecturer_id == user.id)


def is_member(user, group):
    return GroupMembership.objects.filter(group=group, student=user).exists()


def is_participant(user, group):
    return is_leader(user, group) or is_member(user, group) or is_group_lecturer(user, group)


def workflow_enforced(group):
    """Groups created by a student use the propose/approve workflow; lecturer-owned groups keep direct assignment."""
    return group.lecturer.user_type == 'student'


def weight_confirm_block(user, group, task):
    """Return why `user` may not confirm this task's weight, or None if they may."""
    if task.weight_confirmed:
        return 'This weight has already been confirmed.'
    if is_group_lecturer(user, group):
        return None
    if not is_member(user, group):
        return 'Only group members can confirm a weight.'
    leader_owns = group.lecturer_id in (task.proposed_by_id, task.assigned_to_id)
    if user.id == group.lecturer_id:
        if leader_owns:
            return 'You cannot confirm the weight of your own task. Another member needs to confirm it.'
        return None
    if leader_owns:
        return None
    return 'Only the group leader can confirm this weight.'


def weight_change_block(user, group, task):
    """Return why `user` may not change this task's weight, or None."""
    if is_group_lecturer(user, group) or is_leader(user, group):
        return None
    if not workflow_enforced(group):
        return None if is_participant(user, group) else 'Access denied'
    if user.id in (task.proposed_by_id, task.assigned_to_id):
        return None
    return 'Only the proposer, the assignee, the group leader or the lecturer can change this weight.'


def board_status(task, rolled_up_status):
    if task.proposal_status == 'proposed':
        return 'proposed'
    if rolled_up_status == 'completed':
        return 'done'
    if rolled_up_status == 'in_progress':
        return 'in_progress'
    if task.assignment_mode == 'open_to_claim' and task.assigned_to_id is None:
        return 'open_to_claim'
    return 'assigned'

"""Permission rules shared by the project-planning views and the task workspace payload."""
from .access import is_supervising_lecturer
from .models import GroupMembership

BOARD_STATUSES = ('proposed', 'open_to_claim', 'assigned', 'in_progress', 'done')

# Single source of truth for task weight range
WEIGHT_MIN = 1
WEIGHT_MAX = 5
WEIGHT_CHOICES = tuple(range(WEIGHT_MIN, WEIGHT_MAX + 1))


def avatar_url(user):
    return '/api/accounts/profile/avatar/' if user.avatar else None


def is_leader(user, group):
    # The recorded group leader (Group.leader) is the leader.
    return group.leader_id == user.id


def is_group_lecturer(user, group):
    # Group.lecturer is never used for permission decisions; authority comes
    # from an active UnitAssignment for the group's unit and term.
    return is_supervising_lecturer(user, group)


def is_member(user, group):
    return GroupMembership.objects.filter(group=group, student=user).exists()


def is_participant(user, group):
    return is_leader(user, group) or is_member(user, group) or is_group_lecturer(user, group)


def workflow_enforced(group):
    """Groups led by a student use the propose/approve workflow;
    lecturer-led groups keep direct assignment."""
    leader = group.leader
    return bool(leader and leader.user_type == 'student')


def weight_confirm_block(user, group, task):
    """Return why `user` may not confirm this task's weight, or None if they may."""
    if task.weight_confirmed:
        return 'This weight has already been confirmed.'
    if is_group_lecturer(user, group):
        return None
    if not is_member(user, group):
        return 'Only group members can confirm a weight.'
    leader_owns = group.leader_id in (task.proposed_by_id, task.assigned_to_id)
    if user.id == group.leader_id:
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

"""Project planning: projects, task proposals, leader approval, claiming and weight confirmation."""
from datetime import datetime, time

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Group, Project, Task, TaskActivity, User
from .planning_rules import is_leader, is_member, is_participant, weight_change_block, weight_confirm_block
from .views import _parse_required_task_due_date, _task_balance_warning
from .weights import WEIGHT_MAX, WEIGHT_MIN, WEIGHT_RANGE


def _error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def _name(user):
    return f'{user.first_name} {user.last_name}'.strip() or 'Student'


def _load_group(group_id):
    return Group.objects.select_related('lecturer', 'unit').filter(pk=group_id).first()


def _parse_deadline(value):
    if not value:
        return None, None
    parsed = parse_datetime(str(value))
    if parsed is None:
        parsed_date = parse_date(str(value))
        if parsed_date is None:
            return None, 'Enter a valid deadline.'
        parsed = datetime.combine(parsed_date, time(23, 59))
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    if parsed <= timezone.now():
        return None, 'Choose a deadline in the future.'
    return parsed, None


def _project_payload(project):
    return {
        'id': project.id,
        'title': project.title,
        'description': project.description,
        'deadline': project.deadline.isoformat() if project.deadline else None,
        'status': project.status,
        'created_at': project.created_at.isoformat(),
        'task_count': project.tasks.count(),
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def group_projects(request, group_id):
    group = _load_group(group_id)
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    user = request.user
    if not is_participant(user, group):
        return _error('Only group members can use projects.', status.HTTP_403_FORBIDDEN)
    if request.method == 'GET':
        return Response([_project_payload(project) for project in group.projects.all()])

    if user.user_type != 'student' or not (is_member(user, group) or is_leader(user, group)):
        return _error('Only group members can create projects.', status.HTTP_403_FORBIDDEN)
    title = str(request.data.get('title') or '').strip()
    if not title:
        return _error('Enter a project title.')
    if len(title) > 200:
        return _error('Keep the project title under 200 characters.')
    deadline, message = _parse_deadline(request.data.get('deadline'))
    if message:
        return _error(message)
    project = Project.objects.create(
        group=group, title=title, description=str(request.data.get('description') or '').strip(), deadline=deadline,
    )
    return Response(_project_payload(project), status=status.HTTP_201_CREATED)


def _resolve_project(group, project_id):
    if project_id:
        project = Project.objects.filter(pk=project_id, group=group).first()
        if project is None:
            return None, _error('Choose a project in this group.')
        return project, None
    project = Project.objects.filter(group=group).order_by('created_at').first()
    return project or Project.objects.create(group=group, title=group.name, description='Group task workspace'), None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def propose_task(request, group_id):
    group = _load_group(group_id)
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    user = request.user
    if user.user_type != 'student' or not (is_member(user, group) or is_leader(user, group)):
        return _error('Only group members can propose tasks.', status.HTTP_403_FORBIDDEN)
    title = str(request.data.get('title') or '').strip()
    if not title:
        return _error('Enter a task title.')
    try:
        weight = int(request.data.get('weight', 1))
        if weight not in WEIGHT_RANGE:
            raise ValueError
    except (TypeError, ValueError):
        return _error(f'Suggest a weight from {WEIGHT_MIN} to {WEIGHT_MAX}.')
    due_date = _parse_required_task_due_date(request.data.get('due_date'))
    if due_date is None:
        return _error('A due date is required.' if not request.data.get('due_date') else 'Enter a valid due date.')
    project, error = _resolve_project(group, request.data.get('project_id'))
    if error:
        return error
    parent = None
    if request.data.get('parent_task_id'):
        parent = Task.objects.filter(pk=request.data.get('parent_task_id'), project=project).first()
        if parent is None:
            return _error('The parent task must belong to this project.')
        if parent.parent_task_id:
            return _error('Subtasks cannot have their own subtasks. Add this under the primary task.')

    with transaction.atomic():
        task = Task.objects.create(
            project=project, title=title, description=str(request.data.get('description') or '').strip(),
            weight=weight, task_weight=weight, due_date=due_date, parent_task=parent,
            assigned_to=None, proposal_status='proposed', proposed_by=user, weight_confirmed=False,
        )
        TaskActivity.objects.create(
            task=task, actor=user, action='proposed', new_weight=weight,
            note=f'Proposed with a suggested weight of {weight}.',
        )
    return Response({'task': {
        'id': task.id, 'title': task.title, 'proposal_status': task.proposal_status,
        'weight': task.weight, 'parent_task_id': task.parent_task_id, 'project_id': project.id,
    }}, status=status.HTTP_201_CREATED)


def _balance_confirmation(group, assignee_id, task, request):
    """Return a 'needs confirmation' response if this assignment would unbalance the group."""
    projection = _task_balance_warning(group, assignee_id, task.weight, exclude_task_id=task.id)
    if projection['level'] in ('warning', 'critical') and request.data.get('confirm_override') is not True:
        return Response({
            'balance_warning': projection['suggestion'],
            'projection': projection,
            'requires_confirmation': True,
        }, status=status.HTTP_200_OK)
    return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_task(request, group_id, task_id):
    group = _load_group(group_id)
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    user = request.user
    if not is_leader(user, group):
        return _error('Only the group leader can approve tasks.', status.HTTP_403_FORBIDDEN)
    task = Task.objects.filter(pk=task_id, project__group=group).first()
    if task is None:
        return _error('Task not found', status.HTTP_404_NOT_FOUND)
    if task.proposal_status != 'proposed':
        return _error('This task has already been approved.')
    mode = request.data.get('assignment_mode')
    if mode not in ('assigned', 'open_to_claim'):
        return _error('Choose whether the task is assigned to someone or open to claim.')
    has_subtasks = task.subtasks.exists()
    assignee = None
    if mode == 'assigned' and not has_subtasks:
        assignee = User.objects.filter(pk=request.data.get('assigned_to_id') or 0, group_memberships__group=group).first()
        if assignee is None:
            return _error('Choose a group member to assign this task to.')
        needs_confirm = _balance_confirmation(group, assignee.id, task, request)
        if needs_confirm:
            return needs_confirm
    if mode == 'open_to_claim' and has_subtasks:
        return _error('A task with subtasks is worked on through its subtasks. Make the subtasks open to claim instead.')

    with transaction.atomic():
        task.proposal_status = 'approved'
        task.assignment_mode = mode
        task.assigned_to = assignee
        task.save(update_fields=['proposal_status', 'assignment_mode', 'assigned_to', 'updated_at'])
        TaskActivity.objects.create(
            task=task, actor=user, action='approved', to_user=assignee,
            note='Approved and open to claim.' if mode == 'open_to_claim' else (
                f'Approved and assigned to {_name(assignee)}.' if assignee else 'Approved.'
            ),
        )
    return Response({'task': {
        'id': task.id, 'proposal_status': task.proposal_status, 'assignment_mode': task.assignment_mode,
        'assigned_to_id': task.assigned_to_id,
    }})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def claim_task(request, group_id, task_id):
    group = _load_group(group_id)
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    user = request.user
    if user.user_type != 'student' or not is_member(user, group):
        return _error('Only group members can claim tasks.', status.HTTP_403_FORBIDDEN)
    with transaction.atomic():
        task = Task.objects.select_for_update().filter(pk=task_id, project__group=group).first()
        if task is None:
            return _error('Task not found', status.HTTP_404_NOT_FOUND)
        if task.proposal_status != 'approved':
            return _error('This task has not been approved by the leader yet.')
        if task.assigned_to_id is not None:
            return _error('Someone has already claimed this task.')
        if task.assignment_mode != 'open_to_claim':
            return _error('This task is not open to claim.')
        if task.subtasks.exists():
            return _error('Claim one of this task\'s subtasks instead.')
        needs_confirm = _balance_confirmation(group, user.id, task, request)
        if needs_confirm:
            return needs_confirm
        task.assigned_to = user
        task.assignment_mode = 'assigned'
        task.save(update_fields=['assigned_to', 'assignment_mode', 'updated_at'])
        TaskActivity.objects.create(task=task, actor=user, action='claimed', to_user=user, note=f'{_name(user)} claimed this task.')
    return Response({'task': {'id': task.id, 'assigned_to_id': user.id, 'assigned_to_name': _name(user)}})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_task_weight(request, group_id, task_id):
    group = _load_group(group_id)
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    task = Task.objects.filter(pk=task_id, project__group=group).first()
    if task is None:
        return _error('Task not found', status.HTTP_404_NOT_FOUND)
    message = weight_confirm_block(request.user, group, task)
    if message:
        code = status.HTTP_400_BAD_REQUEST if 'already' in message else status.HTTP_403_FORBIDDEN
        return _error(message, code)
    with transaction.atomic():
        task.weight_confirmed = True
        task.weight_confirmed_by = request.user
        task.save(update_fields=['weight_confirmed', 'weight_confirmed_by', 'updated_at'])
        TaskActivity.objects.create(
            task=task, actor=request.user, action='weight_confirmed',
            old_weight=task.weight, new_weight=task.weight,
            note=f'{_name(request.user)} confirmed a weight of {task.weight}.',
        )
    return Response({'task': {'id': task.id, 'weight': task.weight, 'weight_confirmed': True}})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_task_weight(request, group_id, task_id):
    group = _load_group(group_id)
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    task = Task.objects.filter(pk=task_id, project__group=group).first()
    if task is None:
        return _error('Task not found', status.HTTP_404_NOT_FOUND)
    message = weight_change_block(request.user, group, task)
    if message:
        return _error(message, status.HTTP_403_FORBIDDEN if message == 'Access denied' or message.startswith('Only ') else status.HTTP_400_BAD_REQUEST)
    try:
        new_weight = int(request.data.get('weight'))
        if new_weight not in WEIGHT_RANGE:
            raise ValueError
    except (TypeError, ValueError):
        return _error(f'Choose a weight from {WEIGHT_MIN} to {WEIGHT_MAX}.')
    old_weight = task.weight
    if new_weight == old_weight:
        return Response({'task': {'id': task.id, 'weight': task.weight}})
    with transaction.atomic():
        task.weight = new_weight
        task.task_weight = new_weight
        task.weight_confirmed = False
        task.weight_confirmed_by = None
        task.save(update_fields=['weight', 'task_weight', 'weight_confirmed', 'weight_confirmed_by', 'updated_at'])
        TaskActivity.objects.create(
            task=task,
            actor=request.user,
            action='weight_changed',
            old_weight=old_weight,
            new_weight=new_weight,
            note=f'Weight changed from {old_weight} to {new_weight}.',
        )
    return Response({'task': {'id': task.id, 'weight': new_weight, 'weight_confirmed': False}})

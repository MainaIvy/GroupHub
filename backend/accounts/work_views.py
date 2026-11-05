"""Work attached to subtasks, protected file downloads and profile pictures."""
import os
import secrets

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import transaction
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Group, Submission, SubmissionAttachment, Task, TaskActivity, TaskSubmission
from .planning_rules import avatar_url, is_leader, is_member
from .views import _sync_parent_task_rollups

BLOCKED_EXTENSIONS = {'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'ps1', 'vbs', 'dll', 'jar', 'apk', 'app', 'sh'}
MAX_FILE_BYTES = 15 * 1024 * 1024
MAX_FILES = 10
AVATAR_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'gif'}
MAX_AVATAR_BYTES = 2 * 1024 * 1024


def _error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def _name(user):
    return f'{user.first_name} {user.last_name}'.strip() or 'Student'


def check_uploads(files):
    """Return an error message for the first unsafe or oversized upload, else None."""
    if len(files) > MAX_FILES:
        return f'Add no more than {MAX_FILES} files at a time.'
    for uploaded in files:
        extension = uploaded.name.rsplit('.', 1)[-1].lower() if '.' in uploaded.name else ''
        if extension in BLOCKED_EXTENSIONS:
            return f'“{uploaded.name}” is an executable file type and cannot be uploaded.'
        if uploaded.size > MAX_FILE_BYTES:
            return f'“{uploaded.name}” is over 15 MB. Choose a smaller file.'
    return None


def check_url(value):
    if not value:
        return None
    if not value.lower().startswith(('http://', 'https://')):
        return 'Links must start with http:// or https://.'
    try:
        URLValidator()(value)
    except ValidationError:
        return 'Enter a valid link.'
    return None


def serialize_work_item(item):
    return {
        'id': item.id,
        'task_id': item.task_id,
        'author_id': item.submitted_by_id,
        'author_name': _name(item.submitted_by),
        'note': item.note,
        'url': item.url,
        'file_name': os.path.basename(item.file.name) if item.file else '',
        'file_url': f'/api/accounts/work-items/{item.id}/file/' if item.file else '',
        'marks_complete': item.marks_complete,
        'created_at': item.created_at.isoformat(),
    }


def _auto_status(task, user, completes):
    """Task status follows submitted work: first work starts it; work marked final completes it."""
    if task.assigned_to_id != user.id:
        return
    previous = task.status
    if completes:
        task.status = 'completed'
        task.progress_percentage = 100
        task.completed_at = task.completed_at or timezone.now()
    elif previous == 'pending':
        task.status = 'in_progress'
        task.progress_percentage = max(task.progress_percentage, 10)
    else:
        return
    task.save()
    _sync_parent_task_rollups(task)
    if task.status != previous:
        TaskActivity.objects.create(
            task=task, actor=user, action='completed' if task.status == 'completed' else 'started',
            note=f'{previous} -> {task.status} (from submitted work)',
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_work_item(request, group_id, task_id):
    group = Group.objects.filter(pk=group_id).first()
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    user = request.user
    if user.user_type != 'student' or not (is_member(user, group) or is_leader(user, group)):
        return _error('Only group members can add work.', status.HTTP_403_FORBIDDEN)
    task = Task.objects.filter(pk=task_id, project__group=group).first()
    if task is None:
        return _error('Task not found', status.HTTP_404_NOT_FOUND)
    if task.proposal_status != 'approved':
        return _error('This task is still a proposal. The group leader must approve it before work is added.')
    if not task.parent_task_id:
        return _error('Create a subtask under this primary task before adding work.')

    note = str(request.data.get('note') or '').strip()
    url = str(request.data.get('url') or '').strip()
    files = request.FILES.getlist('files')
    if not (note or url or files):
        return _error('Add a link, a note or at least one file.')
    message = check_url(url) or check_uploads(files)
    if message:
        return _error(message)
    completes = str(request.data.get('marks_complete') or '').lower() in ('true', '1', 'on')

    with transaction.atomic():
        created = []
        if note or url:
            created.append(TaskSubmission.objects.create(task=task, submitted_by=user, note=note, url=url, marks_complete=completes))
        for uploaded in files:
            created.append(TaskSubmission.objects.create(task=task, submitted_by=user, file=uploaded, marks_complete=completes and not created))
        _auto_status(task, user, completes)
    task.refresh_from_db()
    return Response({'items': [serialize_work_item(item) for item in created], 'task_status': task.status}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_work_item(request, group_id, task_id, item_id):
    item = TaskSubmission.objects.select_related('task__project__group').filter(
        pk=item_id, task_id=task_id, task__project__group_id=group_id
    ).first()
    if item is None:
        return _error('Work item not found', status.HTTP_404_NOT_FOUND)
    if request.user.id != item.submitted_by_id and not is_leader(request.user, item.task.project.group):
        return _error('Only the person who added this or the group leader can remove it.', status.HTTP_403_FORBIDDEN)
    if item.file:
        item.file.delete(save=False)
    item.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_work_items(request, group_id):
    group = Group.objects.filter(pk=group_id).first()
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    if not (is_member(request.user, group) or is_leader(request.user, group)):
        return _error('Access denied', status.HTTP_403_FORBIDDEN)
    items = TaskSubmission.objects.filter(task__project__group=group).select_related(
        'submitted_by', 'task', 'task__parent_task'
    )
    return Response([{
        **serialize_work_item(item),
        'task_title': item.task.title,
        'parent_title': item.task.parent_task.title if item.task.parent_task_id else '',
    } for item in items])


def _file_response(stored_file):
    if not stored_file or not os.path.exists(stored_file.path):
        raise Http404('File not found')
    return FileResponse(open(stored_file.path, 'rb'), as_attachment=True, filename=os.path.basename(stored_file.name))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def work_item_file(request, item_id):
    item = TaskSubmission.objects.select_related('task__project__group').filter(pk=item_id).first()
    if item is None or not item.file:
        raise Http404('File not found')
    group = item.task.project.group
    if not (is_member(request.user, group) or is_leader(request.user, group)):
        return _error('Access denied', status.HTTP_403_FORBIDDEN)
    return _file_response(item.file)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def submission_file(request, attachment_id):
    attachment = SubmissionAttachment.objects.select_related('submission__project__group').filter(pk=attachment_id).first()
    if attachment is None:
        raise Http404('File not found')
    group = attachment.submission.project.group
    if not (is_member(request.user, group) or is_leader(request.user, group)):
        return _error('Access denied', status.HTTP_403_FORBIDDEN)
    return _file_response(attachment.file)


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def profile_avatar(request):
    user = request.user
    if request.method == 'GET':
        if not user.avatar:
            raise Http404('Profile picture not found')
        return _file_response(user.avatar)
    if request.method == 'DELETE':
        if user.avatar:
            user.avatar.delete(save=False)
        user.avatar = None
        user.save(update_fields=['avatar'])
        return Response({'avatar_url': None})

    uploaded = request.FILES.get('avatar')
    if uploaded is None:
        return _error('Choose a picture to upload.')
    extension = uploaded.name.rsplit('.', 1)[-1].lower() if '.' in uploaded.name else ''
    if extension not in AVATAR_EXTENSIONS:
        return _error('Use a JPG, PNG, WebP or GIF picture.')
    if uploaded.size > MAX_AVATAR_BYTES:
        return _error('Profile pictures must be 2 MB or smaller.')
    try:
        from PIL import Image
        Image.open(uploaded).verify()
        uploaded.seek(0)
    except Exception:
        return _error('That file is not a valid image.')
    if user.avatar:
        user.avatar.delete(save=False)
    uploaded.name = f'{user.id}_{secrets.token_hex(6)}.{extension}'
    user.avatar = uploaded
    user.save(update_fields=['avatar'])
    return Response({'avatar_url': avatar_url(user)})

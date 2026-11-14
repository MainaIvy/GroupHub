"""Finding and joining groups: classmates, invites, join requests and group settings."""
import logging

from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .academic import current_term, is_supervising_lecturer, supervising_lecturers
from .academic_links import effective_course, relink_group_units, relink_groups_for_unit
from .models import Group, GroupInvite, GroupMembership, JoinRequest, Notification, StudentEnrollment, Unit, User

logger = logging.getLogger(__name__)

LOCKED_MESSAGE = 'This group is locked and is not accepting new members.'
FULL_MESSAGE = 'This group is full.'
CLOSED_MESSAGE = 'This group is closed and cannot accept new members.'


def _display_name(user):
    return f'{user.first_name} {user.last_name}'.strip() or 'Student'


def _error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def _student_year(user):
    try:
        return int(user.year_of_study)
    except (TypeError, ValueError):
        return None


def _is_enrolled_in_unit(user, unit):
    term = current_term()
    if term is not None:
        if StudentEnrollment.objects.filter(student=user, unit=unit, semester=term).exists():
            return True
        # Once enrolments are in use for a term, the cohort fallback must not apply.
        if StudentEnrollment.objects.filter(semester=term).exists():
            return False
    course = effective_course(user)
    return (
        course is not None
        and course.id == unit.course_id
        and _student_year(user) == unit.year_of_study
        and _student_semester(user) == unit.semester
    )


def _student_semester(user):
    try:
        return int(user.semester)
    except (TypeError, ValueError):
        return None


def _in_unit_group(student, unit):
    return GroupMembership.objects.filter(student=student, group__unit=unit).exists()


def _join_block(group):
    """Return a message if the group cannot take another member, else None."""
    if group.is_archived:
        return CLOSED_MESSAGE
    if group.is_locked:
        return LOCKED_MESSAGE
    if group.max_members is not None and GroupMembership.objects.filter(group=group).count() >= group.max_members:
        return FULL_MESSAGE
    return None


def _unit_group_block(group, student):
    if group.unit_id and _in_unit_group(student, group.unit):
        return 'This student is already in a group for this unit.'
    return None


def _student_unit(user, unit_id):
    if user.user_type != 'student':
        return None, _error('Only students can do this.', status.HTTP_403_FORBIDDEN)
    unit = Unit.objects.filter(pk=unit_id).first()
    if unit is None:
        return None, _error('Unit not found', status.HTTP_404_NOT_FOUND)
    if not _is_enrolled_in_unit(user, unit):
        return None, _error('You are not enrolled in this unit.', status.HTTP_403_FORBIDDEN)
    return unit, None


def _same_cohort(user, other):
    my_course = effective_course(user)
    their_course = effective_course(other)
    return (
        other.user_type == 'student'
        and my_course is not None
        and their_course is not None
        and their_course.id == my_course.id
        and str(other.year_of_study) == str(user.year_of_study)
        and other.semester == user.semester
    )


def _shares_unit(user, other, unit):
    """Two students are classmates when both are enrolled in the same unit and current term."""
    if other.user_type != 'student' or unit is None:
        return _same_cohort(user, other)
    term = current_term()
    if term is None:
        return _same_cohort(user, other)
    return StudentEnrollment.objects.filter(
        student=user, unit=unit, semester=term,
    ).exists() and StudentEnrollment.objects.filter(
        student=other, unit=unit, semester=term,
    ).exists()


def _classmates(unit):
    """Students enrolled in this unit for the current term (falls back to cohort when none)."""
    term = current_term()
    if term is not None and StudentEnrollment.objects.filter(unit=unit, semester=term).exists():
        return User.objects.filter(
            user_type='student',
            enrollments__unit=unit,
            enrollments__semester=term,
        ).distinct()
    return User.objects.filter(
        user_type='student',
        year_of_study=str(unit.year_of_study),
        semester=unit.semester,
    ).filter(
        Q(enrolled_course_id=unit.course_id)
        | Q(enrolled_course__isnull=True, course__iexact=unit.course.name)
        | Q(enrolled_course__isnull=True, course__iexact=unit.course.code)
    ).distinct()


def _is_member(group, user):
    return GroupMembership.objects.filter(group=group, student=user).exists()


def _notify(user, notification_type, title, message, **related):
    return Notification.objects.create(
        user=user, notification_type=notification_type, title=title, message=message, **related
    )


def _new_join_code():
    from .join_codes import generate_join_code
    return generate_join_code()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unit_classmates(request, unit_id):
    unit, error = _student_unit(request.user, unit_id)
    if error:
        return error
    classmates = _classmates(unit).exclude(pk=request.user.pk)
    query = str(request.query_params.get('q') or '').strip()
    for term in query.split()[:3]:
        classmates = classmates.filter(Q(first_name__icontains=term) | Q(last_name__icontains=term))
    classmates = list(classmates.order_by('first_name', 'last_name', 'id')[:50])
    grouped_ids = set(GroupMembership.objects.filter(
        group__unit=unit, student__in=classmates
    ).values_list('student_id', flat=True))
    return Response([{
        'id': student.id,
        'name': f'{student.first_name} {student.last_name}'.strip() or student.username,
        'first_name': student.first_name,
        'last_name': student.last_name,
        'admission_number': student.username,
        'has_group': student.id in grouped_ids,
    } for student in classmates])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unit_open_groups(request, unit_id):
    unit, error = _student_unit(request.user, unit_id)
    if error:
        return error
    relink_groups_for_unit(unit)
    my_requests = dict(JoinRequest.objects.filter(
        student=request.user, status='pending'
    ).values_list('group_id', 'id'))
    my_memberships = dict(GroupMembership.objects.filter(
        student=request.user, group__unit=unit
    ).values_list('group_id', 'id'))
    groups = Group.objects.filter(unit=unit, is_archived=False).select_related('lecturer').order_by('name')
    data = []
    for group in groups:
        count = group.members_count
        is_member = group.id in my_memberships
        is_full = group.max_members is not None and count >= group.max_members
        is_locked = group.is_locked
        can_request = (not is_member and not is_full and not is_locked and group.id not in my_requests)
        data.append({
            'id': group.id,
            'name': group.name,
            'members_count': count,
            'max_members': group.max_members,
            'leader_name': _display_name(group.lecturer),
            'is_member': is_member,
            'is_full': is_full,
            'is_locked': is_locked,
            'request_pending': group.id in my_requests,
            'can_request': can_request,
        })
    return Response(data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def group_invites(request, group_id):
    user = request.user
    group = Group.objects.filter(pk=group_id).first()
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    if user.user_type != 'student' or not _is_member(group, user):
        return _error('Access denied', status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        invites = group.invites.filter(status='pending').select_related('invited_student', 'invited_by')
        return Response([{
            'id': invite.id,
            'student_id': invite.invited_student_id,
            'first_name': invite.invited_student.first_name,
            'last_name': invite.invited_student.last_name,
            'invited_by_name': _display_name(invite.invited_by),
            'created_at': invite.created_at.isoformat(),
        } for invite in invites])

    try:
        student_id = int(request.data.get('student_id'))
    except (TypeError, ValueError):
        return _error('Choose a classmate to invite.')
    student = User.objects.filter(pk=student_id).first()
    if student is None or student.id == user.id or not _shares_unit(user, student, group.unit):
        return _error('You can only invite classmates enrolled in this unit for the current term.')

    with transaction.atomic():
        group = Group.objects.select_for_update().get(pk=group.pk)
        message = _join_block(group)
        if message:
            return _error(message)
        if _is_member(group, student):
            return _error('This student is already in the group.')
        message = _unit_group_block(group, student)
        if message:
            return _error(message)
        if group.invites.filter(invited_student=student, status='pending').exists():
            return _error('This student already has a pending invite.')
        invite = GroupInvite.objects.create(group=group, invited_student=student, invited_by=user)
        _notify(
            student, 'group_invitation', 'Group invitation',
            f'{_display_name(user)} invited you to join {group.name}.',
            related_group=group, related_invite=invite,
        )
    return Response({
        'id': invite.id,
        'student_id': student.id,
        'first_name': student.first_name,
        'last_name': student.last_name,
        'invited_by_name': _display_name(user),
        'created_at': invite.created_at.isoformat(),
    }, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def cancel_group_invite(request, group_id, invite_id):
    invite = GroupInvite.objects.filter(pk=invite_id, group_id=group_id, status='pending').select_related('group').first()
    if invite is None:
        return _error('Invite not found', status.HTTP_404_NOT_FOUND)
    if request.user.id not in (invite.invited_by_id, invite.group.lecturer_id) and not is_supervising_lecturer(request.user, invite.group):
        return _error('Only the person who sent the invite or a supervising lecturer can cancel it.', status.HTTP_403_FORBIDDEN)
    invite.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def _respond_to_invite(request, invite_id, accept):
    user = request.user
    with transaction.atomic():
        invite = GroupInvite.objects.select_for_update().filter(
            pk=invite_id, invited_student=user
        ).select_related('group', 'invited_by').first()
        if invite is None:
            return _error('Invite not found', status.HTTP_404_NOT_FOUND)
        if invite.status != 'pending':
            return _error('This invite has already been answered.')
        group = Group.objects.select_for_update().get(pk=invite.group_id)
        if accept:
            message = _join_block(group) or _unit_group_block(group, user)
            if _is_member(group, user):
                message = 'You are already a member of this group.'
            if message:
                return _error(message)
            GroupMembership.objects.create(group=group, student=user, role='member')
        invite.status = 'accepted' if accept else 'declined'
        invite.save(update_fields=['status'])
        Notification.objects.filter(related_invite=invite, user=user).update(is_read=True)
        _notify(
            invite.invited_by, 'invite_response',
            'Invite accepted' if accept else 'Invite declined',
            f'{_display_name(user)} {"joined" if accept else "declined your invite to"} {group.name}.',
            related_group=group,
        )
    return Response({'status': invite.status, 'group_id': group.id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_group_invite(request, invite_id):
    return _respond_to_invite(request, invite_id, True)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decline_group_invite(request, invite_id):
    return _respond_to_invite(request, invite_id, False)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_join_request(request, group_id):
    user = request.user
    if user.user_type != 'student':
        return _error('Only students can request to join groups.', status.HTTP_403_FORBIDDEN)
    with transaction.atomic():
        group = Group.objects.select_for_update().select_related('unit').filter(pk=group_id).first()
        if group is None:
            return _error('Group not found', status.HTTP_404_NOT_FOUND)
        if _is_member(group, user):
            return _error('You are already a member of this group.')
        if group.unit_id and not _is_enrolled_in_unit(user, group.unit):
            return _error('You are not enrolled in this group\'s unit.', status.HTTP_403_FORBIDDEN)
        message = _join_block(group)
        if message:
            return _error(message)
        if group.unit_id and _in_unit_group(user, group.unit):
            return _error('You are already in a group for this unit.')
        if group.join_requests.filter(student=user, status='pending').exists():
            return _error('You have already asked to join this group.')
        join_request = JoinRequest.objects.create(group=group, student=user)
        for supervisor in supervising_lecturers(group):
            _notify(
                supervisor, 'join_request', 'Join request',
                f'{_display_name(user)} asked to join {group.name}.',
                related_group=group, related_join_request=join_request,
            )
    return Response({'id': join_request.id, 'status': join_request.status}, status=status.HTTP_201_CREATED)


def _resolve_join_request(request, request_id, approve):
    user = request.user
    with transaction.atomic():
        join_request = JoinRequest.objects.select_for_update().filter(pk=request_id).select_related('group', 'student').first()
        if join_request is None:
            return _error('Request not found', status.HTTP_404_NOT_FOUND)
        group = Group.objects.select_for_update().select_related('unit').get(pk=join_request.group_id)
        if group.lecturer_id != user.id and not is_supervising_lecturer(user, group):
            return _error('Only the group creator or a supervising lecturer can answer join requests.', status.HTTP_403_FORBIDDEN)
        if join_request.status != 'pending':
            return _error('This request has already been answered.')
        student = join_request.student
        if approve:
            message = _join_block(group) or _unit_group_block(group, student)
            if _is_member(group, student):
                message = 'This student is already in the group.'
            if message:
                return _error(message)
            GroupMembership.objects.create(group=group, student=student, role='member')
        join_request.status = 'approved' if approve else 'declined'
        join_request.save(update_fields=['status'])
        Notification.objects.filter(related_join_request=join_request, user=user).update(is_read=True)
        _notify(
            student, 'join_response',
            'Join request approved' if approve else 'Join request declined',
            f'Your request to join {group.name} was {"approved" if approve else "declined"}.',
            related_group=group,
        )
    return Response({'status': join_request.status, 'group_id': group.id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_join_request(request, request_id):
    return _resolve_join_request(request, request_id, True)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decline_join_request(request, request_id):
    return _resolve_join_request(request, request_id, False)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_join_code(request, group_id):
    group = Group.objects.filter(pk=group_id).first()
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    if group.lecturer_id != request.user.id and not is_supervising_lecturer(request.user, group):
        return _error('Only the group creator or a supervising lecturer can regenerate the join code.', status.HTTP_403_FORBIDDEN)
    group.join_code = _new_join_code()
    group.save(update_fields=['join_code', 'updated_at'])
    return Response({'join_code': group.join_code})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_group_settings(request, group_id):
    group = Group.objects.filter(pk=group_id).first()
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    if group.lecturer_id != request.user.id and not is_supervising_lecturer(request.user, group):
        return _error('Only the group creator or a supervising lecturer can change group settings.', status.HTTP_403_FORBIDDEN)
    fields = []
    if 'is_locked' in request.data:
        if not isinstance(request.data['is_locked'], bool):
            return _error('is_locked must be true or false.')
        group.is_locked = request.data['is_locked']
        fields.append('is_locked')
    if 'max_members' in request.data:
        try:
            max_members = int(request.data['max_members'])
        except (TypeError, ValueError):
            return _error('Choose a valid group size.')
        if max_members < max(2, group.members_count) or max_members > 32767:
            return _error('The group size cannot be smaller than the current number of members (minimum 2).')
        group.max_members = max_members
        fields.append('max_members')
    if fields:
        group.save(update_fields=fields + ['updated_at'])
    return Response({'is_locked': group.is_locked, 'max_members': group.max_members})

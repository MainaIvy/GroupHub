"""Centralised access-control rules.

Single source of truth for who may view or manage a unit, group or student.
Replaces the ad-hoc ``Group.lecturer_id`` / ``Unit.assigned_lecturer`` checks
that were scattered across the views.

``Group.lecturer`` is now a historical record only and is never consulted for
permission or workflow decisions; leadership flows through ``Group.leader`` and
lecturer authority flows through an active ``UnitAssignment``.
"""
from django.db.models import Q
from django.utils import timezone

from .academic import current_term
from .models import GroupMembership, UnitAssignment, User


def is_admin(user):
    """True for staff/superusers, who bypass all access checks."""
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def is_supervising_lecturer(user, group):
    """True when ``user`` has an active (approved, end-date empty or in the
    future) ``UnitAssignment`` for the group's unit in the current term.

    Admins supervise every group.
    """
    if is_admin(user):
        return True
    if user is None or user.user_type != 'lecturer':
        return False
    term = current_term()
    if term is None or group.unit_id is None:
        return False
    today = timezone.now().date()
    return UnitAssignment.objects.filter(
        lecturer=user, unit_id=group.unit_id, term=term, status='approved',
    ).filter(
        Q(end_date__isnull=True) | Q(end_date__gte=today)
    ).exists()


def _lecturer_active_unit_ids(lecturer):
    """Unit ids the lecturer has an active approved assignment for in the
    current term."""
    term = current_term()
    if term is None:
        return set()
    today = timezone.now().date()
    return set(UnitAssignment.objects.filter(
        lecturer=lecturer, term=term, status='approved',
    ).filter(
        Q(end_date__isnull=True) | Q(end_date__gte=today)
    ).values_list('unit_id', flat=True))


def can_view_unit(user, unit):
    """Who may view a unit's roster/groups."""
    if is_admin(user):
        return True
    if unit is None or user is None:
        return False
    if user.user_type == 'lecturer':
        return unit.id in _lecturer_active_unit_ids(user)
    if user.user_type == 'student':
        term = current_term()
        if term is None:
            return False
        return unit.student_enrollments.filter(student=user, semester=term).exists()
    return False


def can_view_group(user, group):
    """Who may view or act on a group."""
    if is_admin(user):
        return True
    if group is None or user is None:
        return False
    if user.user_type == 'lecturer':
        return is_supervising_lecturer(user, group)
    # Students: leader or member.
    if group.leader_id == user.id:
        return True
    return GroupMembership.objects.filter(group=group, student=user).exists()


def can_view_student(user, student):
    """Who may view a student's profile/roster row."""
    if is_admin(user):
        return True
    if student is None or user is None:
        return False
    if user.id == student.id:
        return True
    term = current_term()
    if term is None:
        return False
    if user.user_type == 'lecturer':
        active_unit_ids = _lecturer_active_unit_ids(user)
        if not active_unit_ids:
            return False
        return student.enrollments.filter(
            unit_id__in=active_unit_ids, semester=term,
        ).exists()
    if user.user_type == 'student':
        # Classmates: share at least one enrolled unit in the current term.
        return student.enrollments.filter(
            unit_id__in=user.enrollments.filter(semester=term).values_list('unit_id', flat=True),
            semester=term,
        ).exists()
    return False


def can_manage_group(user, group):
    """Who may change a group's settings, regenerate its code, approve
    join requests, delete it, or otherwise manage it: the leader or an admin."""
    if is_admin(user):
        return True
    if group is None:
        return False
    return group.leader_id == user.id

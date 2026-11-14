from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import re

from .academic import approved_units_for_lecturer, current_term
from .balance import calculate_group_balance
from .models import Group, GroupMembership, StudentEnrollment, Unit, User


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_semester_units(request):
    """Return the authenticated student's current semester units.

    Units store each unit's programme, year and semester on the Unit record.
    """
    try:
        user = request.user
        year_of_study = getattr(user, 'year_of_study', '')
        try:
            year_value = int(float(year_of_study))
        except Exception:
            year_value = None

        try:
            semester_value = int(getattr(user, 'semester', None))
        except (TypeError, ValueError):
            semester_value = None
        if semester_value is None:
            course_str = str(getattr(user, 'course', '') or '')
            match = re.search(r'\b(?:S|Sem|Semester)\s*([1-9]\d*)\b', course_str, flags=re.IGNORECASE)
            semester_value = int(match.group(1)) if match else 1

        qs = Unit.objects.select_related('course')
        term = current_term()
        if term is not None and StudentEnrollment.objects.filter(student=user, semester=term).exists():
            qs = qs.filter(student_enrollments__student=user, student_enrollments__semester=term)
        else:
            if year_value is not None:
                qs = qs.filter(year_of_study=year_value)
            qs = qs.filter(semester=semester_value)

            if getattr(user, 'enrolled_course_id', None):
                qs = qs.filter(course_id=user.enrolled_course_id)
            elif getattr(user, 'course', ''):
                qs = qs.filter(course__name__icontains=user.course) | qs.filter(course__code__icontains=user.course)
                qs = qs.distinct()

        data = [
            {
                'id': unit.id,
                'code': unit.code,
                'name': unit.name,
                'course_code': unit.course.code,
                'course_name': unit.course.name,
                'year_of_study': unit.year_of_study,
                'semester': unit.semester,
            }
            for unit in qs.order_by('course__code', 'code')
        ]
        return Response(data, status=status.HTTP_200_OK)

    except Exception:
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _unit_group_rows(unit, term):
    groups = Group.objects.filter(unit=unit).filter(
        Q(term=term) | Q(term__isnull=True)
    ).select_related('lecturer').order_by('name')
    rows = []
    for group in groups:
        balance = calculate_group_balance(group)
        at_risk = any(
            member.get('warning_level') in ('warning', 'critical')
            for member in balance.get('members', [])
        )
        rows.append({
            'id': group.id,
            'name': group.name,
            'members_count': group.members_count,
            'max_members': group.max_members,
            'is_locked': group.is_locked,
            'is_archived': group.is_archived,
            'at_risk': at_risk,
            'leader_name': f'{group.lecturer.first_name} {group.lecturer.last_name}'.strip() or group.lecturer.username,
        })
    return rows


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lecturer_my_units(request):
    """A lecturer's approved units for the current term, with rosters, groups and risk."""
    user = request.user
    if user.user_type != 'lecturer':
        return Response({'error': 'Lecturer access required.'}, status=status.HTTP_403_FORBIDDEN)

    term = current_term()
    if term is None:
        return Response({'status': 'no_term', 'message': 'No academic term is current.', 'units': []})

    units = approved_units_for_lecturer(user, term)
    if not units.exists():
        return Response({'status': 'pending', 'message': 'Waiting for approval', 'units': []})

    payload = []
    for unit in units:
        students = list(User.objects.filter(
            user_type='student', enrollments__unit=unit, enrollments__semester=term,
        ).distinct().order_by('first_name', 'last_name', 'id'))
        groups = _unit_group_rows(unit, term)
        grouped_ids = set(GroupMembership.objects.filter(
            group__unit=unit, student__in=students,
        ).values_list('student_id', flat=True))
        without_group = [student for student in students if student.id not in grouped_ids]
        payload.append({
            'id': unit.id,
            'code': unit.code,
            'name': unit.name,
            'programme': unit.course.name,
            'programme_code': unit.course.code,
            'year_of_study': unit.year_of_study,
            'semester': unit.semester,
            'student_count': len(students),
            'students': [{
                'id': student.id,
                'name': f'{student.first_name} {student.last_name}'.strip() or student.username,
                'admission_number': student.username,
                'programme': student.course,
                'year_of_study': student.year_of_study,
                'semester': student.semester,
            } for student in students],
            'groups': groups,
            'students_without_group': [{
                'id': student.id,
                'name': f'{student.first_name} {student.last_name}'.strip() or student.username,
                'admission_number': student.username,
            } for student in without_group],
            'at_risk_groups': [group for group in groups if group['at_risk']],
        })
    return Response({'status': 'ok', 'term': term.name, 'units': payload})


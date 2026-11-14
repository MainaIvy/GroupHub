"""Academic-term helpers: current term, auto-enrollment and lecturer supervision.

The project reuses ``Semester`` as its ``AcademicTerm`` (name, start/end date, current flag).
``StudentEnrollment.semester`` and ``Group.term`` point at it.
"""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.db import models

from .models import (
    AdminSetting, Course, Group, Semester, StudentEnrollment, Unit, UnitAssignment, User,
)

AUTO_APPROVE_KEY = 'auto_approve_lecturer_claims'


def current_term():
    """The single active academic term, if one has been marked current."""
    return Semester.objects.filter(is_current=True).order_by('-year', '-semester').first()


def term_for_cohort(year, semester, create=True):
    term = Semester.objects.filter(year=year, semester=semester).order_by('-id').first()
    if term is None and create:
        term = Semester.objects.create(
            name=f'Year {year} Semester {semester}', year=year, semester=semester,
        )
    return term


def ensure_current_term(year=None, semester=None):
    """Return the current term, creating one for a cohort when none exists yet."""
    term = current_term()
    if term is not None:
        return term
    if year is None or semester is None:
        return None
    term = term_for_cohort(year, semester)
    if term is not None:
        term.is_current = True
        term.save(update_fields=['is_current'])
    return term


def student_cohort(user):
    """Return (course_id, year, semester), resolving the legacy free-text course."""
    course_id = user.enrolled_course_id
    if course_id is None and user.course:
        course = Course.objects.filter(
            Q(code__iexact=user.course) | Q(name__iexact=user.course)
        ).first()
        if course:
            course_id = course.id
    try:
        year = int(user.year_of_study)
    except (TypeError, ValueError):
        year = None
    try:
        semester = int(user.semester)
    except (TypeError, ValueError):
        semester = None
    return course_id, year, semester


def matching_units(course_id, year, semester):
    if not course_id or not year or not semester:
        return Unit.objects.none()
    return Unit.objects.filter(course_id=course_id, year_of_study=year, semester=semester)


@transaction.atomic
def sync_student_enrollments(user, year=None, semester=None):
    """Enrol a student in every unit matching their programme/year/semester for the current term.

    Enrolments for the current term whose unit no longer matches are removed.
    Returns (term, enrolled_unit_count).
    """
    course_id, user_year, user_semester = student_cohort(user)
    if year is not None and str(year).strip() != '':
        user_year = int(year)
    if semester is not None and str(semester).strip() != '':
        user_semester = int(semester)

    term = ensure_current_term(user_year, user_semester)
    if term is None:
        return None, 0

    unit_ids = list(matching_units(course_id, user_year, user_semester).values_list('id', flat=True))
    StudentEnrollment.objects.filter(student=user, semester=term).exclude(unit_id__in=unit_ids).delete()
    existing = set(StudentEnrollment.objects.filter(
        student=user, semester=term, unit_id__in=unit_ids,
    ).values_list('unit_id', flat=True))
    StudentEnrollment.objects.bulk_create([
        StudentEnrollment(student=user, unit_id=unit_id, semester=term)
        for unit_id in unit_ids if unit_id not in existing
    ], ignore_conflicts=True)
    return term, len(unit_ids)


def auto_approve_lecturer_claims():
    setting = AdminSetting.objects.filter(key=AUTO_APPROVE_KEY).first()
    if not setting:
        return False
    value = setting.value
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'yes', 'on')
    return bool(value)


from django.utils import timezone


def approved_units_for_lecturer(lecturer, term):
    """Units the lecturer is approved to teach in a term.

    Only returns units with an active ``UnitAssignment`` (approved, end date
    empty or in the future). ``Group.lecturer`` / ``Unit.assigned_lecturer``
    are never consulted for access decisions.
    """
    if term is None:
        return Unit.objects.none()
    today = timezone.now().date()
    unit_ids = set(UnitAssignment.objects.filter(
        lecturer=lecturer, term=term, status='approved',
    ).filter(
        models.Q(end_date__isnull=True) | models.Q(end_date__gte=today)
    ).values_list('unit_id', flat=True))
    return Unit.objects.filter(id__in=unit_ids).select_related('course')


def group_term(group):
    return group.term or current_term()


def supervising_lecturer_ids(group):
    """User ids with an active (approved, end-date empty/future)
    ``UnitAssignment`` for the group's unit in the current term."""
    term = group_term(group)
    if term is None or group.unit_id is None:
        return set()
    return set(UnitAssignment.objects.filter(
        unit_id=group.unit_id, term=term, status='approved',
    ).values_list('lecturer_id', flat=True))


def supervising_lecturers(group):
    return User.objects.filter(id__in=supervising_lecturer_ids(group))


def is_supervising_lecturer(user, group):
    return user.id in supervising_lecturer_ids(group)


def unit_has_lecturer(unit, term=None):
    term = term or current_term()
    if unit.assigned_lecturer_id:
        return True
    if term is None:
        return False
    return UnitAssignment.objects.filter(unit=unit, term=term, status='approved').exists()


def group_access_denied(user, group):
    """True when this user may not view/act on the group."""
    if user.user_type == 'lecturer':
        return not is_supervising_lecturer(user, group)
    return not group.memberships.filter(student=user).exists()


def archive_term_groups(term):
    return Group.objects.filter(term=term, is_archived=False).update(is_archived=True)


def advance_cohort(user):
    """Move a student one semester forward (2 -> next year 1, otherwise +1)."""
    try:
        semester = int(user.semester)
    except (TypeError, ValueError):
        return
    try:
        year = int(user.year_of_study)
    except (TypeError, ValueError):
        year = None
    if semester == 2:
        user.semester = 1
        if year is not None:
            user.year_of_study = str(year + 1)
    else:
        user.semester = semester + 1
    user.save(update_fields=['semester', 'year_of_study'])
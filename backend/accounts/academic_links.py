"""Self-healing links between students, groups and the academic catalogue (survives a course reseed)."""
from django.db.models import Q

from .models import Course, Group, Unit, User


def effective_course(user):
    """The student's programme: `enrolled_course`, or the course matching their saved programme text (and re-linked)."""
    if user.enrolled_course_id:
        return user.enrolled_course
    if not user.course:
        return None
    course = Course.objects.filter(Q(code__iexact=user.course) | Q(name__iexact=user.course)).first()
    if course:
        User.objects.filter(pk=user.pk).update(enrolled_course=course)
        user.enrolled_course = course
    return course


def classmates_queryset(unit):
    """Students in this unit's programme, year and semester, including ones whose course link was lost."""
    return User.objects.filter(
        user_type='student',
        year_of_study=str(unit.year_of_study),
        semester=unit.semester,
    ).filter(
        Q(enrolled_course_id=unit.course_id)
        | Q(enrolled_course__isnull=True, course__iexact=unit.course.name)
        | Q(enrolled_course__isnull=True, course__iexact=unit.course.code)
    )


def relink_group_units(groups):
    """Set `Group.unit` when it is empty but `unit_code` matches a Unit (prefer the group's own programme)."""
    for group in groups:
        if group.unit_id or not group.unit_code:
            continue
        matches = list(Unit.objects.filter(code__iexact=group.unit_code).select_related('course'))
        if len(matches) > 1:
            own = [unit for unit in matches if str(group.course).casefold() in (unit.course.name.casefold(), unit.course.code.casefold())]
            matches = own or matches
        if len(matches) == 1:
            Group.objects.filter(pk=group.pk).update(unit=matches[0])
            group.unit = matches[0]


def relink_groups_for_unit(unit):
    relink_group_units(Group.objects.filter(unit__isnull=True, unit_code__iexact=unit.code))

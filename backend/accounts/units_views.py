from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import re

from .models import Unit


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


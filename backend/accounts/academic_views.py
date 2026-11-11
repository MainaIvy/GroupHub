from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Course, Unit


@api_view(['GET'])
@permission_classes([AllowAny])
def academic_courses_view(request):
    courses = Course.objects.all().order_by('code')
    course_data = []

    for course in courses:
        structure = {}
        course_units = Unit.objects.filter(course=course).order_by('year_of_study', 'semester', 'code')
        unit_rows = course_units.values_list('year_of_study', 'semester').distinct()
        for year, semester in unit_rows.order_by('year_of_study', 'semester'):
            structure.setdefault(str(year), []).append(semester)

        course_data.append({
            'id': course.id,
            'code': course.code,
            'name': course.name,
            'department': course.department,
            'structure': structure,
            'units': [{
                'id': unit.id,
                'code': unit.code,
                'name': unit.name,
                'academic_level': unit.academic_level,
                'year_of_study': unit.year_of_study,
                'semester': unit.semester,
                'assigned_lecturer_id': unit.assigned_lecturer_id,
            } for unit in course_units],
        })

    return Response({'courses': course_data})

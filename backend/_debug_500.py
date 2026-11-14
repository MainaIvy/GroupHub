import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from accounts.models import StudentEnrollment, Unit, Semester

print('terms', list(Semester.objects.values('id', 'year', 'semester', 'is_current')))
print('unit3496', Unit.objects.filter(id=3496).values('id', 'code', 'name', 'course_id', 'year_of_study', 'semester').first())
print('enroll count', StudentEnrollment.objects.count())
print('unit3496 enroll', StudentEnrollment.objects.filter(unit_id=3496).values('id', 'student_id').first())
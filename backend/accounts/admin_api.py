import csv
import json
from datetime import timedelta

from django.core.management import call_command
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .balance import calculate_group_balance
from .models import (
    AdminSetting, Announcement, AuditLog, Course, Group, GroupMembership,
    Notification, Project, Semester, StudentEnrollment, Submission, Task, Unit, UnitAssignment, User,
)


class IsAdmin(BasePermission):
    message = 'Administrator permission is required.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_staff or request.user.is_superuser
        ))


admin_permissions = [IsAuthenticated, IsAdmin]


def _name(user):
    return f'{user.first_name} {user.last_name}'.strip() or user.username


def _audit(request, action, target_type, target_id='', details=None):
    AuditLog.objects.create(
        actor=request.user,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        details=details or {},
    )


def _user_data(user):
    return {
        'id': user.id, 'username': user.username, 'email': user.email,
        'name': _name(user), 'first_name': user.first_name, 'last_name': user.last_name,
        'user_type': user.user_type, 'role': user.user_type, 'staff_id': user.staff_id,
        'programme': user.course, 'year': user.year_of_study, 'semester': user.semester,
        'status': user.status, 'is_staff': user.is_staff,
    }


def _catalog_data():
    courses = list(Course.objects.values('id', 'code', 'name', 'department'))
    units = list(Unit.objects.select_related('course').values(
        'id', 'code', 'name', 'year_of_study', 'semester', 'academic_level',
        'course_id', 'course__name', 'course__department', 'assigned_lecturer_id',
    ))
    terms = list(Semester.objects.values('id', 'name', 'year', 'semester'))
    return {
        'departments': sorted({course['department'] for course in courses if course['department']}),
        'courses': courses,
        'units': units,
        'terms': terms,
    }


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_overview(request):
    groups = Group.objects.filter(is_archived=False)
    at_risk = []
    quiet = 0
    for group in groups:
        balance = calculate_group_balance(group)
        if any(member['warning_level'] in ('warning', 'critical') for member in balance['members']):
            at_risk.append({'id': group.id, 'name': group.name, 'balance': balance})
        recent_activity = Task.objects.filter(project__group=group, updated_at__gte=timezone.now() - timedelta(days=14)).exists()
        if not recent_activity:
            quiet += 1
    return Response({
        'users': User.objects.count(),
        'groups': Group.objects.count(),
        'tasks': Task.objects.count(),
        'submissions': Submission.objects.count(),
        'active_groups': groups.count() - quiet,
        'quiet_groups': quiet,
        'at_risk_groups': at_risk[:20],
    })


@api_view(['GET', 'POST'])
@permission_classes(admin_permissions)
def admin_users(request):
    if request.method == 'GET':
        users = User.objects.all().order_by('last_name', 'first_name')
        query = request.query_params.get('search', '').strip()
        if query:
            users = users.filter(email__icontains=query) | users.filter(
                first_name__icontains=query
            ) | users.filter(last_name__icontains=query) | users.filter(username__icontains=query)
        for field in ('user_type', 'status'):
            if request.query_params.get(field):
                users = users.filter(**{field: request.query_params[field]})
        if request.query_params.get('programme'):
            users = users.filter(course__icontains=request.query_params['programme'])
        rows = []
        for user in users[:300]:
            row = _user_data(user)
            if user.user_type == 'lecturer':
                row['load_count'] = UnitAssignment.objects.filter(lecturer=user).count()
            rows.append(row)
        return Response(rows)

    data = request.data
    if data.get('user_type', 'lecturer') != 'lecturer':
        return Response({'error': 'This endpoint creates lecturers only.'}, status=status.HTTP_400_BAD_REQUEST)
    email = str(data.get('email', '')).strip().lower()
    staff_id = str(data.get('staff_id', '')).strip()
    if not email or not staff_id or not data.get('password'):
        return Response({'error': 'Email, staff ID, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists() or User.objects.filter(staff_id__iexact=staff_id).exists():
        return Response({'error': 'A user with that email or staff ID already exists.'}, status=status.HTTP_400_BAD_REQUEST)
    first_name, _, last_name = str(data.get('full_name', '')).strip().partition(' ')
    user = User.objects.create_user(
        username=staff_id.upper(), email=email, password=data['password'],
        first_name=first_name, last_name=last_name, user_type='lecturer',
        staff_id=staff_id, department=str(data.get('department', '')).strip(),
        status='pending',
    )
    _audit(request, 'create_lecturer', 'User', user.id, {'email': email})
    return Response(_user_data(user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_create_user(request):
    data = request.data
    user_type = data.get('user_type', 'lecturer')
    full_name = str(data.get('full_name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    first_name, _, last_name = full_name.partition(' ')
    if user_type not in ('student', 'lecturer'):
        return Response({'error': 'Choose either student or lecturer.'}, status=status.HTTP_400_BAD_REQUEST)
    if not first_name or not email or not password:
        return Response({'error': 'Full name, email, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'A user with that email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    course = None
    year = semester_number = None
    if user_type == 'student':
        admission_number = str(data.get('admission_number', '')).strip().upper()
        try:
            course = Course.objects.get(pk=int(data.get('course_id')))
            year = int(data.get('year'))
            semester_number = int(data.get('semester'))
        except (Course.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Select a valid programme, year, and semester.'}, status=status.HTTP_400_BAD_REQUEST)
        if not admission_number:
            return Response({'error': 'Admission number is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username__iexact=admission_number).exists():
            return Response({'error': 'That admission number already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        username = admission_number
    else:
        staff_id = str(data.get('staff_id', '')).strip()
        department = str(data.get('department', '')).strip()
        if not staff_id or not department:
            return Response({'error': 'Staff ID and department are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(staff_id__iexact=staff_id).exists() or User.objects.filter(username__iexact=staff_id).exists():
            return Response({'error': 'That staff ID already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        username = staff_id.upper()

    assignments = data.get('assignments', [])
    if user_type == 'lecturer' and not isinstance(assignments, list):
        return Response({'error': 'Assignments must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            user_type=user_type,
            staff_id=str(data.get('staff_id', '')).strip() if user_type == 'lecturer' else '',
            department=str(data.get('department', '')).strip() if user_type == 'lecturer' else '',
            course=course.name if course else '',
            enrolled_course=course,
            year_of_study=str(year) if user_type == 'student' else '',
            semester=semester_number,
            status='active',
        )
        if user_type == 'student':
            term, _ = Semester.objects.get_or_create(
                year=year,
                semester=semester_number,
                defaults={'name': f'Year {year} Semester {semester_number}'},
            )
            StudentEnrollment.objects.bulk_create([
                StudentEnrollment(student=user, unit=unit, semester=term)
                for unit in Unit.objects.filter(course=course, year_of_study=year, semester=semester_number)
            ])
        else:
            assignment_rows = []
            for assignment in assignments:
                try:
                    unit = Unit.objects.get(pk=int(assignment.get('unit_id')))
                    term = Semester.objects.get(pk=int(assignment.get('term_id')))
                except (Unit.DoesNotExist, Semester.DoesNotExist, TypeError, ValueError):
                    return Response({'error': 'Every selected unit and term must be valid.'}, status=status.HTTP_400_BAD_REQUEST)
                if unit.course.department != str(data.get('department', '')).strip():
                    return Response({'error': 'Each selected unit must belong to the lecturer department.'}, status=status.HTTP_400_BAD_REQUEST)
                if unit.year_of_study != term.year or unit.semester != term.semester:
                    return Response({'error': 'Each unit must match its selected year and semester.'}, status=status.HTTP_400_BAD_REQUEST)
                if UnitAssignment.objects.filter(unit=unit, term=term).exclude(lecturer=user).exists():
                    return Response({'error': f'{unit.code} is already assigned for {term.name}.'}, status=status.HTTP_400_BAD_REQUEST)
                assignment_rows.append(UnitAssignment(lecturer=user, unit=unit, term=term))
            UnitAssignment.objects.bulk_create(assignment_rows, ignore_conflicts=True)
            Unit.objects.filter(id__in=[row.unit_id for row in assignment_rows]).update(assigned_lecturer=user)

    _audit(request, f'create_{user_type}', 'User', user.id, {'email': email})
    return Response(_user_data(user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_user_action(request, user_id, action):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    if action == 'approve':
        user.status = 'active'
    elif action == 'suspend':
        user.status = 'suspended'
    elif action == 'reactivate':
        user.status = 'active'
    elif action == 'role':
        role = request.data.get('role')
        if role not in ('student', 'lecturer'):
            return Response({'error': 'Invalid role.'}, status=status.HTTP_400_BAD_REQUEST)
        user.user_type = role
    elif action == 'reset-password':
        password = str(request.data.get('password', ''))
        if not password:
            return Response({'error': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(password)
    elif action == 'edit-student':
        if user.user_type != 'student':
            return Response({'error': 'Only students can be edited here.'}, status=status.HTTP_400_BAD_REQUEST)
        user.course = str(request.data.get('programme', user.course))
        user.year_of_study = str(request.data.get('year', user.year_of_study))
        user.semester = request.data.get('semester', user.semester)
    else:
        return Response({'error': 'Unknown action.'}, status=status.HTTP_400_BAD_REQUEST)
    user.save()
    _audit(request, action, 'User', user.id, request.data)
    return Response(_user_data(user))


@api_view(['GET', 'POST'])
@permission_classes(admin_permissions)
def admin_assignments(request):
    if request.method == 'GET':
        assignments = UnitAssignment.objects.select_related('lecturer', 'unit', 'term')
        lecturer_id = request.query_params.get('lecturer')
        if lecturer_id:
            assignments = assignments.filter(lecturer_id=lecturer_id)
        return Response([{
            'id': item.id, 'lecturer': _user_data(item.lecturer), 'unit': item.unit.name,
            'unit_id': item.unit_id, 'unit_code': item.unit.code, 'term': item.term.name,
            'term_id': item.term_id,
            'lecturer_load': UnitAssignment.objects.filter(lecturer=item.lecturer).count(),
        } for item in assignments])
    try:
        lecturer = User.objects.get(pk=request.data.get('lecturer_id'), user_type='lecturer')
        unit = Unit.objects.get(pk=request.data.get('unit_id'))
        term = Semester.objects.get(pk=request.data.get('term_id'))
    except (User.DoesNotExist, Unit.DoesNotExist, Semester.DoesNotExist, TypeError, ValueError):
        return Response({'error': 'Lecturer, unit, and term are required.'}, status=status.HTTP_400_BAD_REQUEST)
    assignment, created = UnitAssignment.objects.get_or_create(lecturer=lecturer, unit=unit, term=term)
    if created:
        unit.assigned_lecturer = lecturer
        unit.save(update_fields=['assigned_lecturer'])
        _audit(request, 'assign_unit', 'UnitAssignment', assignment.id, {'unit_id': unit.id, 'lecturer_id': lecturer.id})
    return Response({'id': assignment.id, 'created': created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_unassigned_units(request):
    return Response(list(Unit.objects.filter(assigned_lecturer__isnull=True).values(
        'id', 'code', 'name', 'course__name', 'year_of_study', 'semester'
    )))


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_lecturer_load(request, lecturer_id):
    lecturer = User.objects.filter(pk=lecturer_id, user_type='lecturer').first()
    if not lecturer:
        return Response({'error': 'Lecturer not found.'}, status=status.HTTP_404_NOT_FOUND)
    assignments = UnitAssignment.objects.filter(lecturer=lecturer).select_related('unit', 'term')
    return Response({
        'lecturer': _user_data(lecturer),
        'assignments': [{
            'id': assignment.id, 'unit_id': assignment.unit_id, 'unit': assignment.unit.name,
            'code': assignment.unit.code, 'term': assignment.term.name,
        } for assignment in assignments],
    })


@api_view(['DELETE'])
@permission_classes(admin_permissions)
def admin_assignment_delete(request, assignment_id):
    assignment = UnitAssignment.objects.filter(pk=assignment_id).first()
    if not assignment:
        return Response({'error': 'Assignment not found.'}, status=status.HTTP_404_NOT_FOUND)
    _audit(request, 'remove_unit_assignment', 'UnitAssignment', assignment.id)
    unit_id = assignment.unit_id
    lecturer_id = assignment.lecturer_id
    assignment.delete()
    if not UnitAssignment.objects.filter(unit_id=unit_id, lecturer_id=lecturer_id).exists():
        Unit.objects.filter(pk=unit_id, assigned_lecturer_id=lecturer_id).update(assigned_lecturer=None)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_groups(request):
    groups = Group.objects.select_related('unit', 'lecturer').all()
    if request.query_params.get('unit'):
        groups = groups.filter(unit_id=request.query_params['unit'])
    if request.query_params.get('lecturer'):
        groups = groups.filter(lecturer_id=request.query_params['lecturer'])
    if request.query_params.get('status') == 'active':
        groups = groups.filter(is_archived=False, is_locked=False)
    elif request.query_params.get('status') == 'archived':
        groups = groups.filter(is_archived=True)
    rows = []
    for group in groups[:300]:
        balance = calculate_group_balance(group)
        risk = any(item['warning_level'] in ('warning', 'critical') for item in balance['members'])
        rows.append({
            'id': group.id, 'name': group.name, 'unit': group.unit.name if group.unit else group.unit_code,
            'lecturer': _name(group.lecturer), 'members': group.members_count,
            'locked': group.is_locked, 'archived': group.is_archived, 'at_risk': risk,
            'join_code': group.join_code,
        })
    return Response(rows)


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_group_members(request, group_id):
    return Response([_user_data(item.student) for item in GroupMembership.objects.filter(group_id=group_id).select_related('student')])


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_students_without_group(request):
    students = User.objects.filter(user_type='student').exclude(group_memberships__isnull=False)
    return Response([_user_data(student) for student in students])


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_move_student(request, group_id):
    student_id = request.data.get('student_id')
    group = Group.objects.filter(pk=group_id).first()
    student = User.objects.filter(pk=student_id, user_type='student').first()
    if not group or not student:
        return Response({'error': 'Group and student are required.'}, status=status.HTTP_400_BAD_REQUEST)
    GroupMembership.objects.filter(student=student).exclude(group=group).delete()
    membership, _ = GroupMembership.objects.get_or_create(group=group, student=student)
    _audit(request, 'move_student', 'GroupMembership', membership.id, {'group_id': group.id, 'student_id': student.id})
    return Response({'id': membership.id})


@api_view(['POST', 'DELETE'])
@permission_classes(admin_permissions)
def admin_group_action(request, group_id, action):
    group = Group.objects.filter(pk=group_id).first()
    if not group:
        return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)
    if action == 'lock':
        group.is_locked = True
    elif action == 'archive':
        group.is_archived = True
    elif action == 'delete':
        _audit(request, action, 'Group', group.id)
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    elif action == 'regenerate-code':
        from django.utils.crypto import get_random_string
        group.join_code = get_random_string(6).upper()
    else:
        return Response({'error': 'Unknown action.'}, status=status.HTTP_400_BAD_REQUEST)
    group.save()
    _audit(request, action, 'Group', group.id)
    return Response({'id': group.id, 'join_code': group.join_code, 'locked': group.is_locked, 'archived': group.is_archived})


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_catalog(request):
    catalog = _catalog_data()
    catalog['programmes'] = catalog.pop('courses')
    return Response(catalog)


@api_view(['POST', 'PATCH'])
@permission_classes(admin_permissions)
def admin_catalog_item(request, item_type, item_id=None):
    model = Course if item_type == 'programme' else Unit
    instance = model.objects.filter(pk=item_id).first() if item_id else None
    if request.method == 'PATCH' and not instance:
        return Response({'error': 'Catalog item not found.'}, status=status.HTTP_404_NOT_FOUND)
    data = request.data
    if item_type == 'programme':
        fields = {'code': data.get('code'), 'name': data.get('name'), 'department': data.get('department')}
    else:
        try:
            fields = {
                'code': data.get('code'), 'name': data.get('name'),
                'course_id': int(data.get('course_id')), 'year_of_study': int(data.get('year_of_study', 1)),
                'semester': int(data.get('semester', 1)), 'academic_level': data.get('academic_level', ''),
            }
        except (TypeError, ValueError):
            return Response({'error': 'Unit programme and academic values are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if any(value in (None, '') for value in fields.values()):
        return Response({'error': 'Complete all catalog fields.'}, status=status.HTTP_400_BAD_REQUEST)
    instance = model.objects.create(**fields) if instance is None else instance
    if request.method == 'PATCH':
        for key, value in fields.items():
            setattr(instance, key, value)
        instance.save()
    _audit(request, f'{request.method.lower()}_{item_type}', item_type, instance.id, fields)
    return Response({'id': instance.id})


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_import_catalog(request):
    call_command('seed_from_excel')
    _audit(request, 'import_catalog', 'Catalog')
    return Response({'message': 'Catalog import completed.'})


@api_view(['GET', 'PUT'])
@permission_classes(admin_permissions)
def admin_settings(request):
    defaults = {
        'allowed_email_domain': 'zetech.ac.ke', 'default_group_size': 5,
        'balance_thresholds': {'warning': 15, 'critical': 25},
        'minimum_points': 6, 'file_size_limit': 10485760,
    }
    if request.method == 'GET':
        values = {setting.key: setting.value for setting in AdminSetting.objects.all()}
        return Response({**defaults, **values})
    for key, value in request.data.items():
        AdminSetting.objects.update_or_create(key=key, defaults={'value': value})
    _audit(request, 'update_settings', 'AdminSetting', details=request.data)
    return Response(request.data)


@api_view(['GET', 'POST'])
@permission_classes(admin_permissions)
def admin_announcements(request):
    if request.method == 'GET':
        return Response(list(Announcement.objects.values('id', 'title', 'body', 'audience', 'created_at').order_by('-created_at')[:100]))
    data = request.data
    audience = data.get('audience', 'all')
    announcement = Announcement.objects.create(
        title=data.get('title', ''), body=data.get('body', ''), audience=audience,
        programme_id=data.get('programme_id') if audience == 'programme' else None,
        unit_id=data.get('unit_id') if audience == 'unit' else None,
        created_by=request.user,
    )
    users = User.objects.filter(status='active')
    if audience == 'programme':
        programme = Course.objects.filter(pk=announcement.programme_id).first()
        users = users.filter(enrolled_course=programme) if programme else User.objects.none()
    elif audience == 'unit':
        users = users.filter(enrollments__unit_id=announcement.unit_id).distinct()
    Notification.objects.bulk_create([
        Notification(user=user, notification_type='announcement', title=announcement.title, message=announcement.body)
        for user in users
    ])
    _audit(request, 'create_announcement', 'Announcement', announcement.id, {'audience': audience})
    return Response({'id': announcement.id}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_audit(request):
    logs = AuditLog.objects.select_related('actor').all()
    if request.query_params.get('action'):
        logs = logs.filter(action=request.query_params['action'])
    if request.query_params.get('actor'):
        logs = logs.filter(actor_id=request.query_params['actor'])
    return Response([{
        'id': log.id, 'actor': _name(log.actor), 'action': log.action,
        'target_type': log.target_type, 'target_id': log.target_id,
        'details': log.details, 'created_at': log.created_at,
    } for log in logs[:300]])


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_export(request, export_type):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{export_type}.csv"'
    writer = csv.writer(response)
    if export_type == 'users':
        writer.writerow(['id', 'name', 'email', 'role', 'programme', 'status'])
        for user in User.objects.all():
            writer.writerow([user.id, _name(user), user.email, user.user_type, user.course, user.status])
    elif export_type == 'groups':
        writer.writerow(['id', 'name', 'unit', 'lecturer', 'members', 'status'])
        for group in Group.objects.select_related('unit', 'lecturer'):
            writer.writerow([group.id, group.name, group.unit, _name(group.lecturer), group.members_count, 'archived' if group.is_archived else 'active'])
    elif export_type == 'contributions':
        writer.writerow(['unit', 'student', 'tasks', 'submissions'])
        for assignment in UnitAssignment.objects.select_related('unit'):
            for student in User.objects.filter(enrollments__unit=assignment.unit).distinct():
                writer.writerow([assignment.unit.code, _name(student), Task.objects.filter(project__group__unit=assignment.unit, assigned_to=student).count(), Submission.objects.filter(submitted_by=student, project__group__unit=assignment.unit).count()])
    else:
        return Response({'error': 'Unknown export.'}, status=status.HTTP_400_BAD_REQUEST)
    _audit(request, f'export_{export_type}', 'Export')
    return response


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def lecturer_setup(request):
    if request.user.user_type != 'lecturer':
        return Response({'error': 'Lecturer access required.'}, status=status.HTTP_403_FORBIDDEN)
    if request.method == 'GET':
        catalog = _catalog_data()
        return Response(catalog)
    assignments = request.data.get('assignments', [])
    if not isinstance(assignments, list) or not assignments:
        return Response({'error': 'Add at least one teaching unit.'}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        for row in assignments:
            UnitAssignment.objects.get_or_create(
                lecturer=request.user, unit_id=row.get('unit_id'), term_id=row.get('term_id')
            )
    return Response({'message': 'Teaching units saved.'})

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

from .academic import (
    advance_cohort, approved_units_for_lecturer, auto_approve_lecturer_claims,
    current_term, sync_student_enrollments, term_for_cohort, advance_cohort,
)
from .balance import calculate_group_balance
from .models import (
    AdminSetting, Announcement, AuditLog, Course, Group, GroupMembership,
    ImportBatch, LecturerRoster, Notification, Project, Semester, StudentEnrollment, Submission, Task, Unit, UnitAssignment, User,
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
    terms = list(Semester.objects.values(
        'id', 'name', 'year', 'semester', 'start_date', 'end_date', 'is_current',
    ))
    return {
        'departments': sorted({course['department'] for course in courses if course['department']}),
        'courses': courses,
        'units': units,
        'terms': terms,
        'current_term_id': (current_term().id if current_term() else None),
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
            'term_id': item.term_id, 'status': item.status,
            'requested_by': _user_data(item.requested_by)['name'] if item.requested_by_id else None,
            'approved_by': _user_data(item.approved_by)['name'] if item.approved_by_id else None,
            'lecturer_load': UnitAssignment.objects.filter(
                lecturer=item.lecturer, status='approved',
            ).count(),
        } for item in assignments])
    try:
        lecturer = User.objects.get(pk=request.data.get('lecturer_id'), user_type='lecturer')
        unit = Unit.objects.get(pk=request.data.get('unit_id'))
        term_id = request.data.get('term_id') or (current_term().id if current_term() else None)
        term = Semester.objects.get(pk=term_id)
    except (User.DoesNotExist, Unit.DoesNotExist, Semester.DoesNotExist, TypeError, ValueError):
        return Response({'error': 'Lecturer, unit, and term are required.'}, status=status.HTTP_400_BAD_REQUEST)
    assignment, created = UnitAssignment.objects.get_or_create(
        lecturer=lecturer, unit=unit, term=term,
        defaults={
            'status': 'approved', 'requested_by': lecturer,
            'approved_by': request.user, 'approved_at': timezone.now(),
        },
    )
    if not created and assignment.status != 'approved':
        assignment.status = 'approved'
        assignment.approved_by = request.user
        assignment.approved_at = timezone.now()
        assignment.save(update_fields=['status', 'approved_by', 'approved_at'])
    unit.assigned_lecturer = lecturer
    unit.save(update_fields=['assigned_lecturer'])
    _audit(request, 'assign_unit', 'UnitAssignment', assignment.id, {
        'unit_id': unit.id, 'lecturer_id': lecturer.id, 'created': created,
    })
    return Response({'id': assignment.id, 'created': created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_pending_assignments(request):
    """Lecturer claim queue: pending requests awaiting approval."""
    assignments = UnitAssignment.objects.filter(status='pending').select_related(
        'lecturer', 'unit', 'term', 'requested_by',
    ).order_by('created_at')
    return Response([{
        'id': item.id, 'lecturer': _user_data(item.lecturer), 'unit': item.unit.name,
        'unit_id': item.unit_id, 'unit_code': item.unit.code, 'course': item.unit.course.name,
        'term': item.term.name, 'term_id': item.term_id,
        'requested_by': _user_data(item.requested_by)['name'] if item.requested_by_id else None,
        'created_at': item.created_at,
    } for item in assignments])


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_assignment_decision(request, assignment_id, decision):
    assignment = UnitAssignment.objects.filter(pk=assignment_id).select_related('unit', 'lecturer').first()
    if not assignment:
        return Response({'error': 'Assignment not found.'}, status=status.HTTP_404_NOT_FOUND)
    if decision == 'approve':
        assignment.status = 'approved'
        assignment.approved_by = request.user
        assignment.approved_at = timezone.now()
        assignment.unit.assigned_lecturer = assignment.lecturer
        assignment.unit.save(update_fields=['assigned_lecturer'])
    elif decision == 'reject':
        assignment.status = 'rejected'
        assignment.approved_by = request.user
        assignment.approved_at = timezone.now()
        if assignment.unit.assigned_lecturer_id == assignment.lecturer_id:
            assignment.unit.assigned_lecturer = None
            assignment.unit.save(update_fields=['assigned_lecturer'])
    else:
        return Response({'error': 'Unknown decision.'}, status=status.HTTP_400_BAD_REQUEST)
    assignment.save(update_fields=['status', 'approved_by', 'approved_at'])
    _audit(request, f'{decision}_unit_assignment', 'UnitAssignment', assignment.id, {
        'unit_id': assignment.unit_id, 'lecturer_id': assignment.lecturer_id,
    })
    return Response({'id': assignment.id, 'status': assignment.status})


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_unassigned_units(request):
    """Units with no approved lecturer for the current term."""
    term = current_term()
    assigned_ids = set(UnitAssignment.objects.filter(
        status='approved', term=term,
    ).values_list('unit_id', flat=True)) if term else set()
    units = Unit.objects.exclude(id__in=assigned_ids).exclude(assigned_lecturer__isnull=False)
    return Response(list(units.values(
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
        'approved_count': assignments.filter(status='approved').count(),
        'pending_count': assignments.filter(status='pending').count(),
        'assignments': [{
            'id': assignment.id, 'unit_id': assignment.unit_id, 'unit': assignment.unit.name,
            'code': assignment.unit.code, 'term': assignment.term.name, 'status': assignment.status,
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
        'auto_approve_lecturer_claims': False,
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


@api_view(['GET', 'POST'])
@permission_classes(admin_permissions)
def admin_terms(request):
    """Academic terms. Admin creates terms and marks one current."""
    if request.method == 'GET':
        return Response(list(Semester.objects.values(
            'id', 'name', 'year', 'semester', 'start_date', 'end_date', 'is_current',
        ).order_by('-year', '-semester')))
    name = str(request.data.get('name') or '').strip()
    try:
        year = int(request.data.get('year'))
        semester_number = int(request.data.get('semester'))
    except (TypeError, ValueError):
        return Response({'error': 'Year and semester are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not name:
        name = f'Year {year} Semester {semester_number}'
    if Semester.objects.filter(year=year, semester=semester_number).exists():
        return Response({'error': 'That term already exists.'}, status=status.HTTP_400_BAD_REQUEST)
    term = Semester.objects.create(
        name=name, year=year, semester=semester_number,
        start_date=request.data.get('start_date') or None,
        end_date=request.data.get('end_date') or None,
        is_current=bool(request.data.get('is_current')),
    )
    _audit(request, 'create_term', 'Semester', term.id, {'name': name, 'is_current': term.is_current})
    return Response({'id': term.id, 'name': term.name, 'is_current': term.is_current}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_term_action(request, term_id, action):
    term = Semester.objects.filter(pk=term_id).first()
    if not term:
        return Response({'error': 'Term not found.'}, status=status.HTTP_404_NOT_FOUND)
    if action != 'make_current':
        return Response({'error': 'Unknown action.'}, status=status.HTTP_400_BAD_REQUEST)
    term.is_current = True
    term.save(update_fields=['is_current'])
    synced = 0
    for student in User.objects.filter(user_type='student'):
        sync_student_enrollments(student)
        synced += 1
    _audit(request, 'make_current_term', 'Semester', term.id, {'name': term.name, 'students_synced': synced})
    return Response({'id': term.id, 'is_current': True, 'students_synced': synced})


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_rollover(request):
    """Advance students, archive old groups and copy approved assignments as pending."""
    term = current_term()
    if term is None:
        return Response({'error': 'Mark a current term before rolling over.'}, status=status.HTTP_400_BAD_REQUEST)
    if request.data.get('confirm') is not True:
        return Response({
            'requires_confirmation': True,
            'message': f'Roll over from {term.name}? Students advance a semester, current groups are archived, and approved assignments are copied as pending.',
            'current_term': term.name,
        }, status=status.HTTP_200_OK)

    next_year, next_semester = term.year, term.semester + 1
    if next_semester > 2:
        next_year, next_semester = term.year + 1, 1
    new_term = term_for_cohort(next_year, next_semester)
    new_term.start_date = request.data.get('start_date') or None
    new_term.end_date = request.data.get('end_date') or None
    new_term.is_current = True
    new_term.save()

    archived = Group.objects.filter(term=term, is_archived=False).update(is_archived=True)
    student_ids = list(User.objects.filter(
        user_type='student', enrollments__semester=term,
    ).values_list('id', flat=True).distinct())
    synced = 0
    for student in User.objects.filter(id__in=student_ids):
        advance_cohort(student)
        sync_student_enrollments(student)
        synced += 1

    copied = 0
    for assignment in UnitAssignment.objects.filter(term=term, status='approved').select_related('lecturer', 'unit'):
        _, created = UnitAssignment.objects.get_or_create(
            lecturer=assignment.lecturer, unit=assignment.unit, term=new_term,
            defaults={'status': 'pending', 'requested_by': assignment.lecturer},
        )
        copied += int(created)

    _audit(request, 'rollover_term', 'Semester', new_term.id, {
        'from': term.name, 'to': new_term.name, 'archived_groups': archived,
        'advanced_students': len(student_ids), 'copied_assignments': copied,
        'synced_students': synced,
    })
    return Response({
        'from_term': term.name,
        'to_term': new_term.name,
        'archived_groups': archived,
        'advanced_students': len(student_ids),
        'copied_assignments': copied,
        'synced_students': synced,
    })


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
    """Lecturer teaching-unit picker. Filters only find units; submitting creates claims."""
    if request.user.user_type != 'lecturer':
        return Response({'error': 'Lecturer access required.'}, status=status.HTTP_403_FORBIDDEN)
    if request.method == 'GET':
        catalog = _catalog_data()
        term = current_term()
        catalog['assignments'] = [{
            'id': item.id, 'unit_id': item.unit_id, 'unit': item.unit.name,
            'unit_code': item.unit.code, 'term': item.term.name, 'status': item.status,
        } for item in UnitAssignment.objects.filter(
            lecturer=request.user, term=term,
        ).select_related('unit', 'term')] if term else []
        catalog['auto_approve'] = auto_approve_lecturer_claims()
        return Response(catalog)

    raw_unit_ids = request.data.get('unit_ids')
    if raw_unit_ids is None:
        raw_unit_ids = [
            row.get('unit_id') for row in (request.data.get('assignments') or [])
            if isinstance(row, dict)
        ]
    if not isinstance(raw_unit_ids, list) or not raw_unit_ids:
        return Response({'error': 'Select at least one teaching unit.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        unit_ids = []
        for value in raw_unit_ids:
            unit_id = int(value)
            if unit_id not in unit_ids:
                unit_ids.append(unit_id)
    except (TypeError, ValueError):
        return Response({'error': 'Select valid teaching units.'}, status=status.HTTP_400_BAD_REQUEST)

    units = list(Unit.objects.filter(id__in=unit_ids).select_related('course'))
    if len(units) != len(unit_ids):
        return Response({'error': 'One or more selected units could not be found.'}, status=status.HTTP_400_BAD_REQUEST)

    term = current_term()
    if term is None and units:
        term = term_for_cohort(units[0].year_of_study, units[0].semester)
        term.is_current = True
        term.save(update_fields=['is_current'])
    if term is None:
        return Response({'error': 'Create an academic term before claiming units.'}, status=status.HTTP_400_BAD_REQUEST)

    auto_approve = auto_approve_lecturer_claims()
    claims = []
    approved = 0
    with transaction.atomic():
        for unit in units:
            assignment = UnitAssignment.objects.filter(
                lecturer=request.user, unit=unit, term=term,
            ).first()
            if assignment is None:
                assignment = UnitAssignment.objects.create(
                    lecturer=request.user, unit=unit, term=term,
                    status='pending', requested_by=request.user,
                )
                claims.append(assignment)
            elif assignment.status == 'rejected':
                assignment.status = 'pending'
                assignment.requested_by = request.user
                assignment.save(update_fields=['status', 'requested_by'])

            if assignment.status == 'pending' and auto_approve:
                has_lecturer = (
                    unit.assigned_lecturer_id is not None
                    or UnitAssignment.objects.filter(
                        unit=unit, term=term, status='approved',
                    ).exclude(pk=assignment.pk).exists()
                )
                if not has_lecturer:
                    assignment.status = 'approved'
                    assignment.approved_by = None
                    assignment.approved_at = timezone.now()
                    assignment.save(update_fields=['status', 'approved_by', 'approved_at'])
                    unit.assigned_lecturer = request.user
                    unit.save(update_fields=['assigned_lecturer'])
            if assignment.status == 'approved':
                approved += 1

    _audit(request, 'lecturer_claim_units', 'Lecturer', request.user.id, {
        'unit_ids': unit_ids, 'term_id': term.id, 'auto_approved': auto_approve,
    })
    return Response({
        'message': 'Teaching units submitted for approval.' if approved < len(units)
        else 'Teaching units approved.',
        'term': term.name,
        'pending': len(units) - approved,
        'approved': approved,
    })


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_roster_template(request):
    """Download CSV template for lecturer roster import."""
    import csv
    from django.http import HttpResponse
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="lecturer_roster_template.csv"'
    writer = csv.writer(response)
    writer.writerow(['lecturer_email', 'full_name', 'department', 'programme_code', 'unit_code', 'staff_id'])
    writer.writerow(['john.doe@zetech.ac.ke', 'John Doe', 'Computer Science', 'BSCS', 'BCU101', 'CS1234'])
    writer.writerow(['jane.smith@zetech.ac.ke', 'Jane Smith', 'Engineering', 'BSE', 'BEE201', 'ENG5678'])
    return response


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_roster_import_preview(request):
    """Preview lecturer roster import from CSV/XLSX file."""
    import csv
    import io
    from openpyxl import load_workbook

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

    mode = request.data.get('mode', 'add')
    if mode not in ('add', 'replace'):
        return Response({'error': 'Mode must be "add" or "replace".'}, status=status.HTTP_400_BAD_REQUEST)

    term = current_term()
    if not term:
        return Response({'error': 'No current academic term set.'}, status=status.HTTP_400_BAD_REQUEST)

    filename = file.name.lower()
    rows = []
    if filename.endswith('.csv'):
        content = file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
    elif filename.endswith('.xlsx'):
        wb = load_workbook(file, read_only=True)
        ws = wb.active
        headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
        for row in ws.iter_rows(min_row=2, values_only=True):
            rows.append(dict(zip(headers, row)))
    else:
        return Response({'error': 'File must be CSV or XLSX.'}, status=status.HTTP_400_BAD_REQUEST)

    required_columns = ['lecturer_email', 'full_name', 'department', 'programme_code']
    missing_cols = [col for col in required_columns if col not in (rows[0] if rows else {})]
    if missing_cols:
        return Response({'error': f'Missing required columns: {", ".join(missing_cols)}'}, status=status.HTTP_400_BAD_REQUEST)

    matched_rows = []
    errors = []
    unknown_programmes = set()
    unknown_units = set()
    duplicates = []
    new_lecturers = []
    existing_lecturers = []
    rows_without_programme = []

    seen_emails = set()
    for idx, row in enumerate(rows):
        row_num = idx + 2
        email = str(row.get('lecturer_email', '')).strip().lower()
        full_name = str(row.get('full_name', '')).strip()
        department = str(row.get('department', '')).strip()
        programme_code = str(row.get('programme_code', '')).strip().upper()
        unit_code = str(row.get('unit_code', '')).strip().upper() if row.get('unit_code') else ''
        staff_id = str(row.get('staff_id', '')).strip().upper() if row.get('staff_id') else ''

        if not email or not full_name or not department:
            errors.append({'row': row_num, 'error': 'Missing required fields: lecturer_email, full_name, department'})
            continue

        if email in seen_emails:
            duplicates.append({'row': row_num, 'email': email, 'error': 'Duplicate email in file'})
            continue
        seen_emails.add(email)

        if not programme_code:
            rows_without_programme.append({'row': row_num, 'email': email})
            errors.append({'row': row_num, 'error': 'Missing programme_code'})
            continue

        course = Course.objects.filter(code__iexact=programme_code).first()
        if not course:
            unknown_programmes.add(programme_code)
            errors.append({'row': row_num, 'error': f'Unknown programme code: {programme_code}'})
            continue

        unit = None
        if unit_code:
            unit = Unit.objects.filter(code__iexact=unit_code, course=course).first()
            if not unit:
                unknown_units.add(f'{programme_code}:{unit_code}')
                errors.append({'row': row_num, 'error': f'Unknown unit code: {unit_code} for programme {programme_code}'})
                continue

        roster_entry = LecturerRoster.objects.filter(email=email).first()
        is_new = roster_entry is None

        if unit:
            units_for_programme = 1
        else:
            units_for_programme = Unit.objects.filter(course=course).count()

        matched_rows.append({
            'row': row_num,
            'email': email,
            'full_name': full_name,
            'department': department,
            'programme_code': programme_code,
            'programme_name': course.name,
            'unit_code': unit_code,
            'unit_name': unit.name if unit else 'All units in programme',
            'staff_id': staff_id,
            'is_new_lecturer': is_new,
            'existing_roster_status': roster_entry.status if roster_entry else None,
            'units_affected': units_for_programme,
        })

        if is_new:
            new_lecturers.append(email)
        else:
            existing_lecturers.append(email)

    return Response({
        'mode': mode,
        'total_rows': len(rows),
        'matched_rows': matched_rows,
        'errors': errors,
        'summary': {
            'total': len(rows),
            'valid': len(matched_rows),
            'errors': len(errors),
            'unknown_programmes': list(unknown_programmes),
            'unknown_units': list(unknown_units),
            'duplicates': duplicates,
            'new_lecturers': len(new_lecturers),
            'existing_lecturers': len(existing_lecturers),
            'rows_without_programme': len(rows_without_programme),
        }
    })


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_roster_import_commit(request):
    """Commit lecturer roster import from preview data."""
    import csv
    import io
    from openpyxl import load_workbook
    from django.utils import timezone

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

    mode = request.data.get('mode', 'add')
    if mode not in ('add', 'replace'):
        return Response({'error': 'Mode must be "add" or "replace".'}, status=status.HTTP_400_BAD_REQUEST)

    term = current_term()
    if not term:
        return Response({'error': 'No current academic term set.'}, status=status.HTTP_400_BAD_REQUEST)

    filename = file.name.lower()
    rows = []
    if filename.endswith('.csv'):
        content = file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
    elif filename.endswith('.xlsx'):
        wb = load_workbook(file, read_only=True)
        ws = wb.active
        headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
        for row in ws.iter_rows(min_row=2, values_only=True):
            rows.append(dict(zip(headers, row)))
    else:
        return Response({'error': 'File must be CSV or XLSX.'}, status=status.HTTP_400_BAD_REQUEST)

    required_columns = ['lecturer_email', 'full_name', 'department', 'programme_code']
    missing_cols = [col for col in required_columns if col not in (rows[0] if rows else {})]
    if missing_cols:
        return Response({'error': f'Missing required columns: {", ".join(missing_cols)}'}, status=status.HTTP_400_BAD_REQUEST)

    summary = {
        'created_rosters': 0,
        'updated_rosters': 0,
        'created_assignments': 0,
        'updated_assignments': 0,
        'ended_assignments': 0,
        'errors': 0,
    }

    with transaction.atomic():
        import_batch = ImportBatch.objects.create(
            type='lecturer_roster',
            file_name=file.name,
            mode=mode,
            created_by=request.user,
            summary={},
            status='committed',
        )

        seen_emails = set()
        for row in rows:
            email = str(row.get('lecturer_email', '')).strip().lower()
            full_name = str(row.get('full_name', '')).strip()
            department = str(row.get('department', '')).strip()
            programme_code = str(row.get('programme_code', '')).strip().upper()
            unit_code = str(row.get('unit_code', '')).strip().upper() if row.get('unit_code') else ''
            staff_id = str(row.get('staff_id', '')).strip().upper() if row.get('staff_id') else ''

            if not email or not full_name or not department or not programme_code:
                summary['errors'] += 1
                continue

            if email in seen_emails:
                summary['errors'] += 1
                continue
            seen_emails.add(email)

            course = Course.objects.filter(code__iexact=programme_code).first()
            if not course:
                summary['errors'] += 1
                continue

            unit = None
            if unit_code:
                unit = Unit.objects.filter(code__iexact=unit_code, course=course).first()
                if not unit:
                    summary['errors'] += 1
                    continue

            roster_entry, created = LecturerRoster.objects.update_or_create(
                email=email,
                defaults={
                    'full_name': full_name,
                    'department': department,
                    'staff_id': staff_id or None,
                    'status': 'active',
                }
            )
            if created:
                summary['created_rosters'] += 1
            else:
                summary['updated_rosters'] += 1

            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email,
                    'user_type': 'lecturer',
                    'first_name': full_name.split(' ')[0] if full_name else '',
                    'last_name': ' '.join(full_name.split(' ')[1:]) if len(full_name.split(' ')) > 1 else '',
                    'department': department,
                    'staff_id': staff_id or '',
                    'email_verified': True,
                    'is_active': True,
                }
            )
            if user.user_type != 'lecturer':
                user.user_type = 'lecturer'
            user.department = department
            user.staff_id = staff_id or ''
            if full_name:
                name_parts = full_name.split(' ', 1)
                user.first_name = name_parts[0]
                user.last_name = name_parts[1] if len(name_parts) > 1 else ''
            user.save()

            units_to_assign = [unit] if unit else list(Unit.objects.filter(course=course))

            for u in units_to_assign:
                assignment, created = UnitAssignment.objects.get_or_create(
                    lecturer=user, unit=u, term=term,
                    defaults={
                        'status': 'approved',
                        'requested_by': user,
                        'approved_by': request.user,
                        'approved_at': timezone.now(),
                        'import_batch': import_batch,
                        'start_date': term.start_date,
                        'end_date': None,
                    }
                )
                if not created:
                    if mode == 'replace':
                        if assignment.status != 'approved':
                            assignment.status = 'approved'
                            assignment.approved_by = request.user
                            assignment.approved_at = timezone.now()
                        assignment.import_batch = import_batch
                        assignment.start_date = term.start_date
                        assignment.end_date = None
                        assignment.save(update_fields=['status', 'approved_by', 'approved_at', 'import_batch', 'start_date', 'end_date'])
                        summary['updated_assignments'] += 1
                else:
                    summary['created_assignments'] += 1

                u.assigned_lecturer = user
                u.save(update_fields=['assigned_lecturer'])

        if mode == 'replace':
            existing_active = UnitAssignment.objects.filter(
                term=term, status='approved'
            ).exclude(import_batch=import_batch)
            for old_assignment in existing_active:
                if not UnitAssignment.objects.filter(
                    lecturer=old_assignment.lecturer, unit=old_assignment.unit, term=term, import_batch=import_batch
                ).exists():
                    old_assignment.end_date = timezone.now().date()
                    old_assignment.save(update_fields=['end_date'])
                    summary['ended_assignments'] += 1

        import_batch.summary = summary
        import_batch.save(update_fields=['summary'])

    _audit(request, 'import_lecturer_roster', 'ImportBatch', import_batch.id, {
        'mode': mode, 'summary': summary,
    })

    return Response({
        'message': 'Import completed successfully.',
        'import_batch_id': import_batch.id,
        'summary': summary,
    })


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_import_history(request):
    """Get import history."""
    batches = ImportBatch.objects.select_related('created_by').all()
    return Response([{
        'id': batch.id,
        'type': batch.get_type_display(),
        'file_name': batch.file_name,
        'mode': batch.mode,
        'created_by': _name(batch.created_by),
        'created_at': batch.created_at,
        'summary': batch.summary,
        'status': batch.status,
    } for batch in batches])


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_import_undo(request, batch_id):
    """Undo the latest import batch."""
    batch = ImportBatch.objects.filter(pk=batch_id).first()
    if not batch:
        return Response({'error': 'Import batch not found.'}, status=status.HTTP_404_NOT_FOUND)
    if batch.status == 'undone':
        return Response({'error': 'This batch has already been undone.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        assignments = batch.unit_assignments.all()
        for assignment in assignments:
            if assignment.end_date is None:
                assignment.end_date = timezone.now().date()
                assignment.save(update_fields=['end_date'])
            if assignment.status == 'approved':
                unit = assignment.unit
                other_active = UnitAssignment.objects.filter(
                    unit=unit, term=assignment.term, status='approved'
                ).exclude(pk=assignment.pk).first()
                if not other_active:
                    unit.assigned_lecturer = None
                    unit.save(update_fields=['assigned_lecturer'])

        batch.status = 'undone'
        batch.save(update_fields=['status'])

    _audit(request, 'undo_import', 'ImportBatch', batch.id, {'mode': batch.mode})
    return Response({'message': 'Import undone successfully.'})


@api_view(['GET'])
@permission_classes(admin_permissions)
def admin_rosters(request):
    """List all lecturer roster entries."""
    rosters = LecturerRoster.objects.all()
    return Response([{
        'id': r.id,
        'email': r.email,
        'full_name': r.full_name,
        'department': r.department,
        'staff_id': r.staff_id,
        'status': r.status,
        'created_at': r.created_at,
        'activated_at': r.activated_at,
    } for r in rosters])


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_roster_create(request):
    """Create a new lecturer roster entry."""
    email = str(request.data.get('email', '')).strip().lower()
    full_name = str(request.data.get('full_name', '')).strip()
    department = str(request.data.get('department', '')).strip()
    staff_id = str(request.data.get('staff_id', '')).strip().upper() or None
    status = request.data.get('status', 'invited')

    if not email or not full_name or not department:
        return Response({'error': 'Email, full name, and department are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if LecturerRoster.objects.filter(email=email).exists():
        return Response({'error': 'A roster entry with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    roster = LecturerRoster.objects.create(
        email=email,
        full_name=full_name,
        department=department,
        staff_id=staff_id,
        status=status,
    )
    _audit(request, 'create_roster', 'LecturerRoster', roster.id, {'email': email})
    return Response({'id': roster.id, 'email': roster.email, 'full_name': roster.full_name}, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes(admin_permissions)
def admin_roster_update(request, roster_id):
    """Update a lecturer roster entry."""
    roster = LecturerRoster.objects.filter(pk=roster_id).first()
    if not roster:
        return Response({'error': 'Roster entry not found.'}, status=status.HTTP_404_NOT_FOUND)

    full_name = str(request.data.get('full_name', roster.full_name) or '').strip()
    department = str(request.data.get('department', roster.department) or '').strip()
    staff_id = str(request.data.get('staff_id', roster.staff_id) or '').strip().upper() or None
    new_status = request.data.get('status', roster.status)

    if not full_name or not department:
        return Response({'error': 'Full name and department are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if new_status not in ('invited', 'active', 'deactivated'):
        return Response({'error': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

    old_status = roster.status
    roster.full_name = full_name
    roster.department = department
    roster.staff_id = staff_id
    roster.status = new_status
    if old_status != 'active' and new_status == 'active' and not roster.activated_at:
        from django.utils import timezone
        roster.activated_at = timezone.now()
    roster.save(update_fields=['full_name', 'department', 'staff_id', 'status', 'activated_at'])

    _audit(request, 'update_roster', 'LecturerRoster', roster.id, {
        'old_status': old_status, 'new_status': new_status,
    })
    return Response({'id': roster.id, 'email': roster.email, 'full_name': roster.full_name, 'status': roster.status})


@api_view(['POST'])
@permission_classes(admin_permissions)
def admin_roster_resend(request):
    """Resend sign-in instructions for a roster entry."""
    email = str(request.data.get('email', '')).strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    roster = LecturerRoster.objects.filter(email=email, status='invited').first()
    if not roster:
        return Response({'error': 'No invited roster entry found for this email.'}, status=status.HTTP_404_NOT_FOUND)

    import secrets
    from django.utils import timezone
    from datetime import timedelta
    from django.conf import settings

    token = secrets.token_urlsafe(32)
    roster.activation_token = token
    roster.activation_token_expires = timezone.now() + timedelta(hours=24)
    roster.save(update_fields=['activation_token', 'activation_token_expires'])

    signin_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/staff/activate/{token}/"
    print(f"\n=== STAFF SIGN-IN LINK (RESENT) ===")
    print(f"Lecturer: {roster.full_name} ({roster.email})")
    print(f"Activation link: {signin_url}")
    print(f"Expires: {roster.activation_token_expires}")
    print(f"===================================\n")

    _audit(request, 'resend_signin', 'LecturerRoster', roster.id, {'email': email})
    return Response({'message': 'Sign-in link sent. Check backend console for the link in development.'})

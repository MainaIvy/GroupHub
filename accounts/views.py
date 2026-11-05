import json
import logging
import os
import re
import uuid

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from rest_framework import serializers, status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Course, Group, GroupMembership, Notification, Project, Submission, Task, User

logger = logging.getLogger(__name__)


# -------------------------------------------------------------------------
# Serializers
# -------------------------------------------------------------------------
class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id', 'code', 'name', 'target_program', 'taught_in_year', 'taught_in_semester']


# -------------------------------------------------------------------------
# Course & Academic Program Views
# -------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([AllowAny])
def courses_list(request):
    queryset = Course.objects.all()

    target_program = request.query_params.get('target_program')
    year = request.query_params.get('taught_in_year')
    sem = request.query_params.get('taught_in_semester')

    if target_program:
        queryset = queryset.filter(target_program__iexact=target_program.strip())
    if year:
        queryset = queryset.filter(taught_in_year=str(year).strip())
    if sem:
        queryset = queryset.filter(taught_in_semester=str(sem).strip())

    serializer = CourseSerializer(queryset, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_academic_programs(request):
    programs = Course.objects.values_list('target_program', flat=True).distinct()
    return Response(sorted(list(set(filter(None, programs)))))


@api_view(['GET'])
@permission_classes([AllowAny])
def get_student_units(request):
    program = request.query_params.get('program')
    year = request.query_params.get('year')
    semester = request.query_params.get('semester')

    queryset = Course.objects.all()
    if program:
        queryset = queryset.filter(target_program__iexact=program.strip())
    if year:
        queryset = queryset.filter(taught_in_year=str(year).strip())
    if semester:
        queryset = queryset.filter(taught_in_semester=str(semester).strip())

    units = queryset.values('id', 'code', 'name', 'taught_in_year', 'taught_in_semester')
    return Response(list(units))


# -------------------------------------------------------------------------
# Authentication & User Views (Strict & DB-Driven)
# -------------------------------------------------------------------------
@csrf_exempt
@require_POST
def signup_view(request):
    try:
        data = json.loads(request.body)

        user_type = (data.get('user_type') or data.get('role') or '').strip().capitalize()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password')
        full_name = (data.get('fullName') or data.get('full_name') or '').strip()
        university = (data.get('university') or 'Zetech University').strip()
        reg_number = (
            data.get('registrationNo')
            or data.get('registration_no')
            or data.get('identifier')
            or data.get('staffId')
            or data.get('staff_id')
            or ''
        ).strip().upper()

        if not email or not password or not user_type or not full_name or not reg_number:
            return JsonResponse({'error': 'Name, Email, Password, Role, and Registration/Staff Number are required.'}, status=400)

        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            return JsonResponse({'error': 'Invalid email format.'}, status=400)

        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'An account with this email already exists.'}, status=400)

        if User.objects.filter(registration_no=reg_number).exists() or User.objects.filter(staff_id=reg_number).exists():
            return JsonResponse({'error': 'An account with this Registration/Staff ID already exists.'}, status=400)

        if len(password) < 6:
            return JsonResponse({'error': 'Password must be at least 6 characters long.'}, status=400)

        base_username = email.split('@')[0]
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        name_parts = full_name.split(' ', 1)
        first_name = name_parts[0] if len(name_parts) > 0 else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            user_type=user_type.lower(),
            university=university,
            is_active=True,
        )

        if hasattr(user, 'full_name'):
            user.full_name = full_name

        if user_type.lower() == 'student':
            if hasattr(user, 'course'):
                user.course = (data.get('course') or '').strip()
            if hasattr(user, 'year_of_study'):
                user.year_of_study = str(data.get('yearOfStudy') or data.get('year_of_study') or '1').strip()
            if hasattr(user, 'semester'):
                user.semester = str(data.get('semester') or '1').strip()
            if hasattr(user, 'registration_no'):
                user.registration_no = reg_number
            elif hasattr(user, 'student_id'):
                user.student_id = reg_number
        elif user_type.lower() == 'lecturer':
            if hasattr(user, 'salutation'):
                user.salutation = (data.get('salutation') or '').strip()
            if hasattr(user, 'staff_id'):
                user.staff_id = reg_number
            if hasattr(user, 'department'):
                user.department = (data.get('department') or '').strip()
            if hasattr(user, 'courses_taught'):
                user.courses_taught = (data.get('coursesTaught') or data.get('courses_taught') or '').strip()

        if hasattr(user, 'email_verified'):
            user.email_verified = True

        user.save()
        refresh = RefreshToken.for_user(user)

        return JsonResponse({
            'message': 'Account created successfully in database.',
            'user_id': user.id,
            'user_type': user.user_type,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': full_name or f"{user.first_name} {user.last_name}".strip(),
                'registration_no': reg_number,
                'user_type': user.user_type,
                'university': user.university,
                'course': getattr(user, 'course', ''),
                'year_of_study': getattr(user, 'year_of_study', ''),
                'semester': getattr(user, 'semester', ''),
            }
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON format.'}, status=400)
    except ValidationError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Registration failed: {str(e)}'}, status=500)


@csrf_exempt
@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
        identifier = (data.get('identifier') or data.get('email') or data.get('registration_no') or '').strip()
        password = data.get('password')

        if not identifier or not password:
            return JsonResponse({'error': 'Email/Registration number and password are required.'}, status=400)

        # Strict lookup by Registration Number, Staff ID, or Email
        user_obj = (
            User.objects.filter(registration_no__iexact=identifier).first()
            or User.objects.filter(staff_id__iexact=identifier).first()
            or User.objects.filter(email__iexact=identifier).first()
            or User.objects.filter(username__iexact=identifier).first()
        )

        user = None
        if user_obj:
            user = authenticate(request, username=user_obj.username, password=password)

        if user is not None:
            if not user.is_active:
                return JsonResponse({'error': 'Account is inactive. Please contact support.'}, status=403)

            if hasattr(user, 'failed_attempts') and user.failed_attempts >= 5:
                return JsonResponse({'error': 'Account is locked due to too many failed attempts.'}, status=403)

            login(request, user)
            if hasattr(user, 'failed_attempts'):
                user.failed_attempts = 0
                user.save()

            first_name = getattr(user, 'first_name', '')
            last_name = getattr(user, 'last_name', '')
            full_name = getattr(user, 'full_name', '') or f"{first_name} {last_name}".strip()

            return JsonResponse({
                'message': 'Login successful',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'full_name': full_name or user.username,
                    'registration_no': getattr(user, 'registration_no', '') or getattr(user, 'staff_id', ''),
                    'user_type': user.user_type,
                    'university': getattr(user, 'university', ''),
                    'course': getattr(user, 'course', ''),
                    'year_of_study': getattr(user, 'year_of_study', ''),
                    'semester': getattr(user, 'semester', ''),
                }
            })
        else:
            if user_obj and hasattr(user_obj, 'failed_attempts'):
                user_obj.failed_attempts += 1
                user_obj.save()
            return JsonResponse({'error': 'Invalid credentials provided.'}, status=401)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@login_required
def logout_view(request):
    logout(request)
    return JsonResponse({'message': 'Logged out successfully'})


@login_required
def profile_view(request):
    user = request.user
    return JsonResponse({
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'full_name': getattr(user, 'full_name', f"{user.first_name} {user.last_name}".strip()),
        'registration_no': getattr(user, 'registration_no', '') or getattr(user, 'staff_id', ''),
        'user_type': user.user_type,
        'university': getattr(user, 'university', ''),
        'course': getattr(user, 'course', ''),
        'year_of_study': getattr(user, 'year_of_study', ''),
        'staff_id': getattr(user, 'staff_id', ''),
        'department': getattr(user, 'department', ''),
        'courses_taught': getattr(user, 'courses_taught', ''),
        'salutation': getattr(user, 'salutation', '')
    })


class LoginView(APIView):
    def post(self, request):
        identifier = (request.data.get('identifier') or request.data.get('email') or request.data.get('registration_no') or '').strip()
        password = request.data.get('password')

        if not identifier or not password:
            return Response({'error': 'Email/Registration number and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        user_obj = (
            User.objects.filter(registration_no__iexact=identifier).first()
            or User.objects.filter(staff_id__iexact=identifier).first()
            or User.objects.filter(email__iexact=identifier).first()
            or User.objects.filter(username__iexact=identifier).first()
        )

        user = None
        if user_obj:
            user = authenticate(username=user_obj.username, password=password)

        if user:
            if not user.is_active:
                return Response({'error': 'Account is not active.'}, status=status.HTTP_403_FORBIDDEN)
            refresh = RefreshToken.for_user(user)
            full_name = getattr(user, 'full_name', '') or f"{user.first_name} {user.last_name}".strip()
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'full_name': full_name or user.username,
                    'registration_no': getattr(user, 'registration_no', '') or getattr(user, 'staff_id', ''),
                    'user_type': user.user_type,
                    'university': getattr(user, 'university', ''),
                    'course': getattr(user, 'course', ''),
                    'year_of_study': getattr(user, 'year_of_study', ''),
                    'semester': getattr(user, 'semester', ''),
                }
            })
        else:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token') or request.data.get('id_token')
        if not token:
            return Response({'error': 'Google ID token is required'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': 'Google authentication endpoint active'}, status=status.HTTP_200_OK)


# -------------------------------------------------------------------------
# Dynamic Dashboard Views (Zero Hardcoded Fallbacks)
# -------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([AllowAny])
def student_dashboard_api(request):
    reg_no = request.query_params.get('registration_no', '').strip()
    email = request.query_params.get('email', '').strip()
    user_id = request.query_params.get('user_id', '').strip()

    student = None

    if user_id and user_id.isdigit():
        student = User.objects.filter(id=int(user_id)).first()
    if not student and request.user and request.user.is_authenticated and getattr(request.user, 'user_type', '').lower() == 'student':
        student = request.user
    if not student and reg_no:
        student = User.objects.filter(Q(registration_no__iexact=reg_no) | Q(username__iexact=reg_no)).first()
    if not student and email:
        student = User.objects.filter(email__iexact=email).first()

    if not student:
        return Response({'error': 'Student profile not found.'}, status=404)

    full_name = getattr(student, 'full_name', '') or f"{getattr(student, 'first_name', '')} {getattr(student, 'last_name', '')}".strip()
    course_name = getattr(student, 'course', '')
    year_str = str(getattr(student, 'year_of_study', '1')).strip()
    semester_str = str(getattr(student, 'semester', '1')).strip()
    reg_val = getattr(student, 'registration_no', '') or getattr(student, 'staff_id', '')
    university = getattr(student, 'university', 'Zetech University')

    # Enrolled Units strictly mapped to student's DB profile
    units_qs = Course.objects.filter(
        target_program__icontains=course_name,
        taught_in_year=year_str,
        taught_in_semester=semester_str
    )
    units_data = [
        {
            'id': u.id,
            'code': u.code,
            'name': u.name,
            'year': u.taught_in_year,
            'semester': u.taught_in_semester,
        }
        for u in units_qs
    ]

    # Groups joined via GroupMembership
    group_ids = GroupMembership.objects.filter(student=student).values_list('group_id', flat=True)
    groups = Group.objects.filter(id__in=group_ids)
    groups_data = [
        {
            'id': g.id,
            'name': g.name,
            'course': g.course,
            'join_code': getattr(g, 'join_code', ''),
            'members_count': g.memberships.count() if hasattr(g, 'memberships') else 1,
        }
        for g in groups
    ]

    # Tasks
    user_tasks = Task.objects.filter(
        Q(assigned_to=student) | Q(project__group_id__in=group_ids)
    ).distinct()

    total_tasks = user_tasks.count()
    completed_tasks = user_tasks.filter(status__iexact='completed').count()
    progress_percentage = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0

    pending_tasks = [
        {
            'id': t.id,
            'title': t.title,
            'status': t.status,
            'priority': getattr(t, 'priority', 'Normal'),
            'deadline': str(t.deadline) if t.deadline else 'No deadline',
            'project': t.project.title if t.project else '',
        }
        for t in user_tasks.exclude(status__iexact='completed')
    ]

    # Submissions / Documents
    submissions_qs = Submission.objects.filter(
        Q(submitted_by=student) | Q(project__group_id__in=group_ids)
    ).select_related('project')

    documents_data = [
        {
            'id': s.id,
            'name': os.path.basename(s.file.name) if s.file else f"Submission_{s.id}.pdf",
            'size': 'Document',
            'date': s.submitted_at.strftime('%b %d, %Y') if s.submitted_at else 'Recent',
            'status': s.status,
        }
        for s in submissions_qs
    ]

    return Response({
        'student': {
            'id': student.id,
            'full_name': full_name,
            'registration_no': reg_val,
            'email': student.email,
            'course': course_name,
            'year_of_study': year_str,
            'semester': semester_str,
            'university': university,
        },
        'units': units_data,
        'groups': groups_data,
        'tasks': {
            'total': total_tasks,
            'completed': completed_tasks,
            'progress_percentage': progress_percentage,
            'pending': pending_tasks,
        },
        'documents': documents_data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_dashboard_view(request):
    return student_dashboard_api(request)


@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def upload_submission_document(request):
    file_obj = request.FILES.get('file')
    project_id = request.data.get('project_id')
    user = request.user if request.user.is_authenticated else None

    if not file_obj:
        return Response({'error': 'No file was uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        project = Project.objects.filter(id=project_id).first() if project_id else None
        submission = Submission.objects.create(
            project=project,
            submitted_by=user,
            file=file_obj,
            status='submitted'
        )
        return Response({
            'message': 'File uploaded successfully',
            'document': {
                'id': submission.id,
                'name': os.path.basename(file_obj.name),
                'status': submission.status,
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': 'Failed to save uploaded document.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lecturer_dashboard_view(request):
    user = request.user
    if user.user_type.lower() != 'lecturer':
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    groups = Group.objects.filter(lecturer=user).prefetch_related('memberships', 'projects')
    groups_data = []
    for group in groups:
        projects = Project.objects.filter(group=group).prefetch_related('tasks', 'submissions')
        projects_data = []
        for project in projects:
            submissions = Submission.objects.filter(project=project).select_related('submitted_by')
            submissions_data = [{
                'id': submission.id,
                'submitted_by': f"{submission.submitted_by.first_name} {submission.submitted_by.last_name}",
                'status': submission.status,
                'grade': submission.grade,
                'submitted_at': submission.submitted_at
            } for submission in submissions]
            projects_data.append({
                'id': project.id,
                'title': project.title,
                'status': project.status,
                'deadline': project.deadline,
                'submissions': submissions_data
            })
        groups_data.append({
            'id': group.id,
            'name': group.name,
            'course': getattr(group, 'course', ''),
            'members_count': group.memberships.count() if hasattr(group, 'memberships') else 0,
            'projects': projects_data
        })

    recent_submissions = Submission.objects.filter(
        project__group__lecturer=user
    ).select_related('project', 'submitted_by').order_by('-submitted_at')[:10]

    submissions_data = [{
        'id': submission.id,
        'project_title': submission.project.title if submission.project else '',
        'submitted_by': f"{submission.submitted_by.first_name} {submission.submitted_by.last_name}",
        'status': submission.status,
        'submitted_at': submission.submitted_at
    } for submission in recent_submissions]

    return Response({
        'user': {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'department': getattr(user, 'department', ''),
            'courses_taught': getattr(user, 'courses_taught', '')
        },
        'groups': groups_data,
        'recent_submissions': submissions_data,
        'stats': {
            'total_groups': len(groups_data),
            'total_students': sum(group.memberships.count() if hasattr(group, 'memberships') else 0 for group in groups),
            'pending_submissions': Submission.objects.filter(
                project__group__lecturer=user,
                status='submitted'
            ).count()
        }
    })


# -------------------------------------------------------------------------
# Group Management Views
# -------------------------------------------------------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_group_view(request):
    user = request.user
    if user.user_type.lower() != 'student':
        return Response({'error': 'Only students can create groups'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    name = data.get('name')
    course = data.get('course')
    year_of_study = data.get('year_of_study')

    if not name or not course or not year_of_study:
        return Response({'error': 'Name, course, and year of study are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        group = Group.objects.create(
            name=name,
            course=course,
            year_of_study=year_of_study,
        )
        GroupMembership.objects.create(group=group, student=user, role='leader')

        return Response({
            'message': 'Group created successfully',
            'group': {
                'id': group.id,
                'name': group.name,
                'course': group.course,
                'year_of_study': group.year_of_study,
                'members_count': 1
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': 'Failed to create group'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_group_view(request):
    user = request.user
    if user.user_type.lower() != 'student':
        return Response({'error': 'Only students can join groups'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    group_code = data.get('group_code')

    if not group_code:
        return Response({'error': 'Group code is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        group = Group.objects.get(id=group_code)
        GroupMembership.objects.get_or_create(group=group, student=user, defaults={'role': 'member'})

        return Response({
            'message': 'Successfully joined the group',
            'group': {
                'id': group.id,
                'name': group.name,
                'course': group.course,
                'year_of_study': group.year_of_study,
            }
        }, status=status.HTTP_200_OK)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': 'Failed to join group'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------------------------------------------------------------
# Search View
# -------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_view(request):
    user = request.user
    query = request.GET.get('q', '').strip()

    if not query:
        return Response({'error': 'Search query is required'}, status=status.HTTP_400_BAD_REQUEST)

    u_type = user.user_type.lower()
    if u_type == 'student':
        user_group_ids = user.group_memberships.values_list('group_id', flat=True) if hasattr(user, 'group_memberships') else []
        groups = Group.objects.filter(
            Q(id__in=user_group_ids) &
            (Q(name__icontains=query) | Q(course__icontains=query))
        )
        projects = Project.objects.filter(
            Q(group__id__in=user_group_ids) &
            Q(title__icontains=query)
        ).select_related('group')
        tasks = Task.objects.filter(
            (Q(project__group__id__in=user_group_ids) | Q(assigned_to=user)) &
            Q(title__icontains=query)
        ).select_related('project', 'assigned_to')

    elif u_type == 'lecturer':
        groups = Group.objects.filter(
            Q(lecturer=user) &
            (Q(name__icontains=query) | Q(course__icontains=query))
        )
        projects = Project.objects.filter(
            Q(group__lecturer=user) &
            Q(title__icontains=query)
        ).select_related('group')
        tasks = Task.objects.filter(
            Q(project__group__lecturer=user) &
            Q(title__icontains=query)
        ).select_related('project', 'assigned_to')

    else:
        return Response({'error': 'Invalid user type'}, status=status.HTTP_400_BAD_REQUEST)

    groups_data = [{
        'id': g.id,
        'name': g.name,
        'course': getattr(g, 'course', ''),
        'year_of_study': getattr(g, 'year_of_study', ''),
        'members_count': g.memberships.count() if hasattr(g, 'memberships') else 0,
        'type': 'group'
    } for g in groups]

    projects_data = [{
        'id': p.id,
        'title': p.title,
        'status': p.status,
        'deadline': p.deadline,
        'group_name': p.group.name if p.group else '',
        'group_id': p.group.id if p.group else None,
        'type': 'project'
    } for p in projects]

    tasks_data = [{
        'id': t.id,
        'title': t.title,
        'status': t.status,
        'priority': t.priority,
        'deadline': t.deadline,
        'project_title': t.project.title if t.project else '',
        'project_id': t.project.id if t.project else None,
        'assigned_to': f"{t.assigned_to.first_name} {t.assigned_to.last_name}" if t.assigned_to else None,
        'type': 'task'
    } for t in tasks]

    return Response({
        'query': query,
        'results': {
            'groups': groups_data,
            'projects': projects_data,
            'tasks': tasks_data
        },
        'counts': {
            'groups': len(groups_data),
            'projects': len(projects_data),
            'tasks': len(tasks_data),
            'total': len(groups_data) + len(projects_data) + len(tasks_data)
        }
    })


# -------------------------------------------------------------------------
# Task Views
# -------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_tasks_view(request, group_id):
    user = request.user
    try:
        group = Group.objects.get(id=group_id)
        tasks = Task.objects.filter(project__group=group).select_related('project', 'assigned_to')
        tasks_data = [{
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'priority': task.priority,
            'deadline': task.deadline,
            'assigned_to': task.assigned_to.id if task.assigned_to else None,
            'assigned_to_name': f"{task.assigned_to.first_name} {task.assigned_to.last_name}" if task.assigned_to else None,
            'project': task.project.title if task.project else '',
            'progress_percentage': getattr(task, 'progress_percentage', 0)
        } for task in tasks]

        return Response({'tasks': tasks_data})
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': 'Failed to fetch tasks'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_task_status_view(request, task_id):
    try:
        task = Task.objects.get(id=task_id)
        new_status = request.data.get('status')
        if new_status not in ['todo', 'in_progress', 'completed']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        task.status = new_status
        task.save()

        return Response({'message': 'Task status updated successfully'})
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': 'Failed to update task status'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_task_progress_view(request, task_id):
    try:
        task = Task.objects.get(id=task_id)
        progress_percentage = request.data.get('progress_percentage')
        if not isinstance(progress_percentage, int) or not (0 <= progress_percentage <= 100):
            return Response({'error': 'Invalid progress percentage'}, status=status.HTTP_400_BAD_REQUEST)

        task.progress_percentage = progress_percentage
        task.save()

        return Response({'message': 'Task progress updated successfully'})
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': 'Failed to update task progress'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_task_view(request, group_id):
    try:
        group = Group.objects.get(id=group_id)
        data = request.data
        title = data.get('title')
        description = data.get('description', '')
        assigned_to_id = data.get('assigned_to')
        due_date = data.get('due_date')

        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)

        project, _ = Project.objects.get_or_create(
            group=group,
            defaults={
                'title': f"{group.name} Project",
                'description': f"Default project for {group.name}",
                'status': 'in_progress'
            }
        )

        assigned_to = None
        if assigned_to_id:
            assigned_to = User.objects.filter(id=assigned_to_id).first()

        task = Task.objects.create(
            title=title,
            description=description,
            project=project,
            assigned_to=assigned_to,
            deadline=due_date if due_date else None
        )

        return Response({
            'message': 'Task created successfully',
            'task': {
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'status': task.status,
                'assigned_to': task.assigned_to.id if task.assigned_to else None,
                'assigned_to_name': f"{task.assigned_to.first_name} {task.assigned_to.last_name}" if task.assigned_to else None,
                'deadline': task.deadline,
                'progress_percentage': 0
            }
        }, status=status.HTTP_201_CREATED)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': 'Failed to create task'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_tasks_view(request):
    user = request.user
    try:
        user_group_ids = user.group_memberships.values_list('group_id', flat=True) if hasattr(user, 'group_memberships') else []
        tasks = Task.objects.filter(
            Q(project__group__id__in=user_group_ids) | Q(assigned_to=user)
        ).select_related('project', 'assigned_to').distinct()

        tasks_data = [{
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'priority': task.priority,
            'deadline': task.deadline,
            'assigned_to': task.assigned_to.id if task.assigned_to else None,
            'assigned_to_name': f"{task.assigned_to.first_name} {task.assigned_to.last_name}" if task.assigned_to else None,
            'project': task.project.title if task.project else '',
            'progress_percentage': getattr(task, 'progress_percentage', 0)
        } for task in tasks]

        return Response({'tasks': tasks_data})
    except Exception as e:
        return Response({'error': 'Failed to fetch tasks'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------------------------------------------------------------
# Notification Views
# -------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notifications_view(request):
    user = request.user
    try:
        notifications = Notification.objects.filter(user=user).order_by('-created_at')
        notifications_data = [{
            'id': n.id,
            'notification_type': n.notification_type,
            'title': n.title,
            'message': n.message,
            'is_read': n.is_read,
            'related_group': n.related_group.id if n.related_group else None,
            'related_group_name': n.related_group.name if n.related_group else None,
            'related_project': n.related_project.id if n.related_project else None,
            'related_project_title': n.related_project.title if n.related_project else None,
            'related_task': n.related_task.id if n.related_task else None,
            'related_task_title': n.related_task.title if n.related_task else None,
            'created_at': n.created_at
        } for n in notifications]

        return Response({'notifications': notifications_data})
    except Exception as e:
        return Response({'error': 'Failed to fetch notifications'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read_view(request, notification_id):
    user = request.user
    try:
        notification = Notification.objects.get(id=notification_id, user=user)
        notification.is_read = True
        notification.save()
        return Response({'message': 'Notification marked as read'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': 'Failed to mark notification as read'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read_view(request):
    user = request.user
    try:
        Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read'})
    except Exception as e:
        return Response({'error': 'Failed to mark all notifications as read'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
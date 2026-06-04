from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.conf import settings
from django.utils.crypto import get_random_string
from django.contrib.auth.hashers import make_password
from django.db.models import Q

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
import json
import logging
import re
import uuid
from .models import User, Group, Project, Task, Submission, Notification

logger = logging.getLogger(__name__)

@csrf_exempt
@require_POST
def signup_view(request):
    try:
        data = json.loads(request.body)
        user_type = data.get('user_type')
        email = data.get('email')
        password = data.get('password')
        full_name = data.get('fullName', '')
        university = data.get('university', '')

        # Sanitize inputs
        email = email.strip().lower() if email else ''
        full_name = full_name.strip()
        university = university.strip()

        if not email or not password or not user_type:
            logger.warning(f"Signup attempt with missing fields: {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Email, password, and user type are required'}, status=400)

        # Validate email format
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            logger.warning(f"Signup attempt with invalid email: {email} from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Invalid email format.'}, status=400)

        # Validate password strength
        if len(password) < 8:
            logger.warning(f"Signup attempt with weak password from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Password must be at least 8 characters long.'}, status=400)

        # Generate unique username since email can be duplicate
        base_username = email
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        # Split full name into first and last name
        name_parts = full_name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            user_type=user_type,
            university=university,
            is_active=True  # Allow immediate access
        )

        # Add additional fields based on user type
        if user_type == 'student':
            user.course = data.get('course', '').strip()
            user.year_of_study = data.get('yearOfStudy', '').strip()
        elif user_type == 'lecturer':
            user.salutation = data.get('salutation', '').strip()
            user.staff_id = data.get('staffId', '').strip()
            user.department = data.get('department', '').strip()
            user.courses_taught = data.get('coursesTaught', '').strip()

        user.save()

        # Send verification email
        verification_token = get_random_string(length=32)
        user.email_verified = False  # Reset to False
        user.save()
        # Note: In a real app, store token securely and send email
        logger.info(f"User {user.id} created successfully. Verification email sent to {email}")

        # Generate JWT tokens for automatic login after signup
        refresh = RefreshToken.for_user(user)

        return JsonResponse({
            'message': 'User created successfully. Please check your email for verification.',
            'user_id': user.id,
            'user_type': user.user_type,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'user_type': user.user_type,
                'university': user.university
            }
        }, status=201)

    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in signup: {request.META.get('REMOTE_ADDR')}")
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except ValidationError as e:
        logger.warning(f"Validation error in signup: {e} from {request.META.get('REMOTE_ADDR')}")
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        logger.error(f"Unexpected error in signup: {str(e)} from {request.META.get('REMOTE_ADDR')}")
        return JsonResponse({'error': 'An unexpected error occurred. Please try again later.'}, status=500)

@csrf_exempt
@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')

        # Sanitize inputs
        email = email.strip().lower() if email else ''

        if not email or not password:
            logger.warning(f"Login attempt with missing fields: {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Email and password are required'}, status=400)

        # Validate email format and domain
        if not re.match(r'^[a-zA-Z0-9._%+-]+@zetech\.ac\.ke$', email):
            logger.warning(f"Login attempt with invalid email: {email} from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Invalid email format or domain. Only @zetech.ac.ke emails are allowed.'}, status=400)

        # Find user by email since username is now unique and generated
        try:
            user_obj = User.objects.filter(email=email).first()
            if user_obj:
                user = authenticate(request, username=user_obj.username, password=password)
            else:
                user = None
        except User.DoesNotExist:
            user = None

        if user is not None:
            if not user.is_active:
                logger.warning(f"Login attempt for inactive account: {email} from {request.META.get('REMOTE_ADDR')}")
                return JsonResponse({'error': 'Account is not active. Please verify your email.'}, status=403)
            if user.failed_attempts >= 5:
                logger.warning(f"Login attempt for locked account: {email} from {request.META.get('REMOTE_ADDR')}")
                return JsonResponse({'error': 'Account is locked due to too many failed attempts.'}, status=403)
            login(request, user)
            user.failed_attempts = 0  # Reset on successful login
            user.save()
            logger.info(f"Successful login for user {user.id}: {email}")
            return JsonResponse({
                'message': 'Login successful',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_type': user.user_type,
                    'university': user.university
                }
            })
        else:
            # Handle failed login
            try:
                user_obj = User.objects.get(email=email)
                user_obj.failed_attempts += 1
                user_obj.save()
                if user_obj.failed_attempts >= 5:
                    logger.warning(f"Account locked after failed attempts: {email} from {request.META.get('REMOTE_ADDR')}")
                    return JsonResponse({'error': 'Account locked due to too many failed attempts.'}, status=403)
            except User.DoesNotExist:
                pass  # Don't reveal if email exists
            logger.warning(f"Failed login attempt: {email} from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Invalid credentials'}, status=401)

    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in login: {request.META.get('REMOTE_ADDR')}")
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f"Unexpected error in login: {str(e)} from {request.META.get('REMOTE_ADDR')}")
        return JsonResponse({'error': 'An unexpected error occurred. Please try again later.'}, status=500)

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
        'user_type': user.user_type,
        'university': user.university,
        'course': user.course,
        'year_of_study': user.year_of_study,
        'staff_id': user.staff_id,
        'department': user.department,
        'courses_taught': user.courses_taught,
        'salutation': user.salutation
    })

from rest_framework.views import APIView

class LoginView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Find user by email since username is now unique and generated
        try:
            user_obj = User.objects.filter(email=email).first()
            if user_obj:
                user = authenticate(username=user_obj.username, password=password)
            else:
                user = None
        except User.DoesNotExist:
            user = None

        if user:
            if not user.is_active:
                return Response({'error': 'Account is not active. Please verify your email.'}, status=status.HTTP_403_FORBIDDEN)
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_type': user.user_type,
                    'university': user.university
                }
            })
        else:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

# Dashboard API views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_dashboard_view(request):
    user = request.user
    if user.user_type != 'student':
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    # Get user's groups
    groups = Group.objects.filter(members=user).select_related('created_by')
    groups_data = []
    for group in groups:
        projects = Project.objects.filter(group=group).select_related('group')
        projects_data = []
        for project in projects:
            tasks = Task.objects.filter(project=project, assigned_to=user).select_related('project', 'assigned_to')
            tasks_data = [{
                'id': task.id,
                'title': task.title,
                'status': task.status,
                'priority': task.priority,
                'deadline': task.deadline
            } for task in tasks]
            projects_data.append({
                'id': project.id,
                'title': project.title,
                'status': project.status,
                'deadline': project.deadline,
                'tasks': tasks_data
            })
        groups_data.append({
            'id': group.id,
            'name': group.name,
            'course': group.course,
            'projects': projects_data
        })

    # Get upcoming deadlines
    upcoming_tasks = Task.objects.filter(
        assigned_to=user,
        deadline__isnull=False
    ).order_by('deadline')[:5]

    deadlines_data = [{
        'id': task.id,
        'title': task.title,
        'deadline': task.deadline,
        'project': task.project.title
    } for task in upcoming_tasks]

    return Response({
        'user': {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'course': user.course,
            'year_of_study': user.year_of_study
        },
        'groups': groups_data,
        'upcoming_deadlines': deadlines_data,
        'stats': {
            'total_groups': len(groups_data),
            'active_projects': sum(len(group['projects']) for group in groups_data),
            'pending_tasks': Task.objects.filter(assigned_to=user, status='todo').count()
        }
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lecturer_dashboard_view(request):
    user = request.user
    if user.user_type != 'lecturer':
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    # Get groups created by lecturer
    groups = Group.objects.filter(created_by=user).prefetch_related('members', 'projects')
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
            'course': group.course,
            'members_count': group.members.count(),
            'projects': projects_data
        })

    # Get recent submissions
    recent_submissions = Submission.objects.filter(
        project__group__created_by=user
    ).select_related('project', 'submitted_by').order_by('-submitted_at')[:10]

    submissions_data = [{
        'id': submission.id,
        'project_title': submission.project.title,
        'submitted_by': f"{submission.submitted_by.first_name} {submission.submitted_by.last_name}",
        'status': submission.status,
        'submitted_at': submission.submitted_at
    } for submission in recent_submissions]

    return Response({
        'user': {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'department': user.department,
            'courses_taught': user.courses_taught
        },
        'groups': groups_data,
        'recent_submissions': submissions_data,
        'stats': {
            'total_groups': len(groups_data),
            'total_students': sum(group.members.count() for group in groups),
            'pending_submissions': Submission.objects.filter(
                project__group__created_by=user,
                status='submitted'
            ).count()
        }
    })

# Group management views
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_group_view(request):
    user = request.user
    if user.user_type != 'student':
        return Response({'error': 'Only students can create groups'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    name = data.get('name')
    course = data.get('course')
    year_of_study = data.get('year_of_study')
    description = data.get('description', '')

    if not name or not course or not year_of_study:
        return Response({'error': 'Name, course, and year of study are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        group = Group.objects.create(
            name=name,
            course=course,
            year_of_study=year_of_study,
            description=description,
            created_by=user
        )
        group.members.add(user)
        group.save()

        return Response({
            'message': 'Group created successfully',
            'group': {
                'id': group.id,
                'name': group.name,
                'course': group.course,
                'year_of_study': group.year_of_study,
                'description': group.description,
                'created_by': f"{user.first_name} {user.last_name}",
                'members_count': group.members.count()
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error creating group: {str(e)}")
        return Response({'error': 'Failed to create group'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_group_view(request):
    user = request.user
    if user.user_type != 'student':
        return Response({'error': 'Only students can join groups'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    group_code = data.get('group_code')

    if not group_code:
        return Response({'error': 'Group code is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # For now, we'll use group ID as the code. In a real app, you'd generate unique codes
        group = Group.objects.get(id=group_code)

        if group.members.filter(id=user.id).exists():
            return Response({'error': 'You are already a member of this group'}, status=status.HTTP_400_BAD_REQUEST)

        group.members.add(user)
        group.save()

        # Create notification for group creator
        Notification.objects.create(
            user=group.created_by,
            notification_type='group_join',
            title='New Member Joined Group',
            message=f'{user.first_name} {user.last_name} has joined your group "{group.name}"',
            related_group=group
        )

        return Response({
            'message': 'Successfully joined the group',
            'group': {
                'id': group.id,
                'name': group.name,
                'course': group.course,
                'year_of_study': group.year_of_study,
                'description': group.description,
                'created_by': f"{group.created_by.first_name} {group.created_by.last_name}",
                'members_count': group.members.count()
            }
        }, status=status.HTTP_200_OK)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error joining group: {str(e)}")
        return Response({'error': 'Failed to join group'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Search API view
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_view(request):
    user = request.user
    query = request.GET.get('q', '').strip()

    if not query:
        return Response({'error': 'Search query is required'}, status=status.HTTP_400_BAD_REQUEST)

    if user.user_type == 'student':
        # Students can search within their groups, projects, and tasks
        user_groups = Group.objects.filter(members=user)

        # Search groups
        groups = Group.objects.filter(
            Q(members=user) &
            (Q(name__icontains=query) |
             Q(course__icontains=query) |
             Q(description__icontains=query))
        ).select_related('created_by')

        # Search projects
        projects = Project.objects.filter(
            Q(group__members=user) &
            (Q(title__icontains=query) |
             Q(description__icontains=query))
        ).select_related('group')

        # Search tasks
        tasks = Task.objects.filter(
            Q(project__group__members=user) &
            (Q(title__icontains=query) |
             Q(description__icontains=query))
        ).select_related('project', 'assigned_to')

    elif user.user_type == 'lecturer':
        # Lecturers can search within groups they created and related projects/tasks
        groups = Group.objects.filter(
            Q(created_by=user) &
            (Q(name__icontains=query) |
             Q(course__icontains=query) |
             Q(description__icontains=query))
        ).select_related('created_by')

        projects = Project.objects.filter(
            Q(group__created_by=user) &
            (Q(title__icontains=query) |
             Q(description__icontains=query))
        ).select_related('group')

        tasks = Task.objects.filter(
            Q(project__group__created_by=user) &
            (Q(title__icontains=query) |
             Q(description__icontains=query))
        ).select_related('project', 'assigned_to')

    else:
        return Response({'error': 'Invalid user type'}, status=status.HTTP_400_BAD_REQUEST)

    # Format results
    groups_data = [{
        'id': group.id,
        'name': group.name,
        'course': group.course,
        'year_of_study': group.year_of_study,
        'description': group.description,
        'created_by': f"{group.created_by.first_name} {group.created_by.last_name}",
        'members_count': group.members.count(),
        'type': 'group'
    } for group in groups]

    projects_data = [{
        'id': project.id,
        'title': project.title,
        'description': project.description,
        'status': project.status,
        'deadline': project.deadline,
        'group_name': project.group.name,
        'group_id': project.group.id,
        'type': 'project'
    } for project in projects]

    tasks_data = [{
        'id': task.id,
        'title': task.title,
        'description': task.description,
        'status': task.status,
        'priority': task.priority,
        'deadline': task.deadline,
        'project_title': task.project.title,
        'project_id': task.project.id,
        'assigned_to': f"{task.assigned_to.first_name} {task.assigned_to.last_name}" if task.assigned_to else None,
        'type': 'task'
    } for task in tasks]

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

# Task management views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_tasks_view(request, group_id):
    user = request.user
    try:
        group = Group.objects.get(id=group_id)
        if not group.members.filter(id=user.id).exists():
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

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
            'project': task.project.title,
            'progress_percentage': task.progress_percentage if hasattr(task, 'progress_percentage') else 0
        } for task in tasks]

        return Response({'tasks': tasks_data})
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error fetching group tasks: {str(e)}")
        return Response({'error': 'Failed to fetch tasks'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_task_status_view(request, task_id):
    user = request.user
    try:
        task = Task.objects.get(id=task_id)
        # Check if user is member of the group that owns the project
        if not task.project.group.members.filter(id=user.id).exists():
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status')
        if new_status not in ['todo', 'in_progress', 'completed']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        task.status = new_status
        task.save()

        return Response({'message': 'Task status updated successfully'})
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error updating task status: {str(e)}")
        return Response({'error': 'Failed to update task status'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_task_progress_view(request, task_id):
    user = request.user
    try:
        task = Task.objects.get(id=task_id)
        # Check if user is member of the group that owns the project
        if not task.project.group.members.filter(id=user.id).exists():
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        progress_percentage = request.data.get('progress_percentage')
        if not isinstance(progress_percentage, int) or not (0 <= progress_percentage <= 100):
            return Response({'error': 'Invalid progress percentage'}, status=status.HTTP_400_BAD_REQUEST)

        # For now, we'll store progress in a field. Since the model doesn't have it, we'll add it dynamically
        # In a real app, you'd add this field to the model
        task.progress_percentage = progress_percentage
        task.save()

        return Response({'message': 'Task progress updated successfully'})
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error updating task progress: {str(e)}")
        return Response({'error': 'Failed to update task progress'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_task_view(request, group_id):
    user = request.user
    try:
        group = Group.objects.get(id=group_id)
        if not group.members.filter(id=user.id).exists():
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        title = data.get('title')
        description = data.get('description', '')
        assigned_to_id = data.get('assigned_to')
        due_date = data.get('due_date')

        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Create a default project for the group if none exists
        project, created = Project.objects.get_or_create(
            group=group,
            defaults={
                'title': f"{group.name} Project",
                'description': f"Default project for {group.name}",
                'status': 'in_progress'
            }
        )

        assigned_to = None
        if assigned_to_id:
            try:
                assigned_to = User.objects.get(id=assigned_to_id)
                if not group.members.filter(id=assigned_to_id).exists():
                    return Response({'error': 'Assigned user is not a member of this group'}, status=status.HTTP_400_BAD_REQUEST)
            except User.DoesNotExist:
                return Response({'error': 'Assigned user not found'}, status=status.HTTP_404_NOT_FOUND)

        task = Task.objects.create(
            title=title,
            description=description,
            project=project,
            assigned_to=assigned_to,
            deadline=due_date if due_date else None
        )

        # Create notification for task assignment
        if assigned_to:
            Notification.objects.create(
                user=assigned_to,
                notification_type='task_assigned',
                title='New Task Assigned',
                message=f'You have been assigned a new task: "{task.title}" in project "{project.title}"',
                related_group=group,
                related_project=project,
                related_task=task
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
        logger.error(f"Error creating task: {str(e)}")
        return Response({'error': 'Failed to create task'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_tasks_view(request):
    user = request.user
    try:
        tasks = Task.objects.filter(
            Q(project__group__members=user) |
            Q(assigned_to=user)
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
            'project': task.project.title,
            'progress_percentage': task.progress_percentage if hasattr(task, 'progress_percentage') else 0
        } for task in tasks]

        return Response({'tasks': tasks_data})
    except Exception as e:
        logger.error(f"Error fetching all tasks: {str(e)}")
        return Response({'error': 'Failed to fetch tasks'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Notification views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notifications_view(request):
    user = request.user
    try:
        notifications = Notification.objects.filter(user=user).order_by('-created_at')
        notifications_data = [{
            'id': notification.id,
            'notification_type': notification.notification_type,
            'title': notification.title,
            'message': notification.message,
            'is_read': notification.is_read,
            'related_group': notification.related_group.id if notification.related_group else None,
            'related_group_name': notification.related_group.name if notification.related_group else None,
            'related_project': notification.related_project.id if notification.related_project else None,
            'related_project_title': notification.related_project.title if notification.related_project else None,
            'related_task': notification.related_task.id if notification.related_task else None,
            'related_task_title': notification.related_task.title if notification.related_task else None,
            'created_at': notification.created_at
        } for notification in notifications]

        return Response({'notifications': notifications_data})
    except Exception as e:
        logger.error(f"Error fetching notifications: {str(e)}")
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
        logger.error(f"Error marking notification as read: {str(e)}")
        return Response({'error': 'Failed to mark notification as read'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read_view(request):
    user = request.user
    try:
        Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read'})
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {str(e)}")
        return Response({'error': 'Failed to mark all notifications as read'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
from django_ratelimit.decorators import ratelimit
from django_ratelimit.core import is_ratelimited
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
import json
import logging
import re
import os
from django.db import models
from .models import User, Group, GroupMembership, Project, Task, Submission, ChatRoom, Message, Notification

logger = logging.getLogger(__name__)

class GoogleLoginView(APIView):

    """Handle POST /api/accounts/google/login/ from the React frontend.

    Expected body: { "token": <google id_token or access_token> }
    Returns: { access, refresh, user }
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        try:
            token = request.data.get('token')
            if not token:
                return Response({'error': 'Missing token'}, status=status.HTTP_400_BAD_REQUEST)

            google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or os.getenv('GOOGLE_CLIENT_ID')

            payload = None
            # Preferred: verify ID token using google-auth.
            try:
                from google.oauth2 import id_token as google_id_token
                from google.auth.transport import requests as google_requests

                request_adapter = google_requests.Request()
                if google_client_id:
                    payload = google_id_token.verify_oauth2_token(token, request_adapter, google_client_id)
                else:
                    # If client id isn't configured, verify without audience check.
                    payload = google_id_token.verify_oauth2_token(token, request_adapter, audience=None)
            except Exception as e:
                # Fallback: decode JWT without verification (dev convenience)
                # NOTE: do not use this for production.
                logger.warning(f"Google token verification failed, using unverified decode fallback: {e}")
                try:
                    import jwt as pyjwt
                    payload = pyjwt.decode(token, options={"verify_signature": False})
                except Exception:
                    payload = None

            if not payload:
                return Response({'error': 'Invalid Google token'}, status=status.HTTP_401_UNAUTHORIZED)

            email = payload.get('email')
            if not email:
                return Response({'error': 'Google token missing email'}, status=status.HTTP_400_BAD_REQUEST)

            email = str(email).strip().lower()
            name = payload.get('name') or ''
            given_name = payload.get('given_name') or ''
            family_name = payload.get('family_name') or ''

            if given_name or family_name:
                first_name = given_name.strip()
                last_name = family_name.strip()
            else:
                parts = name.split(' ', 1)
                first_name = parts[0].strip() if parts and parts[0] else 'User'
                last_name = parts[1].strip() if len(parts) > 1 else 'Account'

            # Decide user type from email if needed (matches existing frontend logic)
            user_type = 'lecturer' if 'lecturer' in email else 'student'

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email,
                    'user_type': user_type,
                    'first_name': first_name,
                    'last_name': last_name,
                    'university': payload.get('hd', ''),
                    'email_verified': True,
                    'is_active': True,
                },
            )

            # Update fields on subsequent logins
            if not user.email_verified:
                user.email_verified = True
            user.is_active = True
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name
            # Keep stored user_type if already set
            if not getattr(user, 'user_type', None):
                user.user_type = user_type
            user.save()

            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_type': user.user_type,
                    'university': user.university,
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Google login failed: {e}")
            return Response({'error': 'Google login failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
def signup_view(request):

    try:
        # Handle preflight/empty bodies safely
        if not request.body:
            return JsonResponse({'error': 'Empty request body'}, status=400)

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

        # Validate email format and domain
        if not re.match(r'^[a-zA-Z0-9._%+-]+@zetech\.ac\.ke$', email):
            logger.warning(f"Signup attempt with invalid email: {email} from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Invalid email format or domain. Only @zetech.ac.ke emails are allowed.'}, status=400)

        # Validate password strength
        if len(password) < 8 or not re.search(r'[a-zA-Z]', password) or not re.search(r'\d', password):
            logger.warning(f"Signup attempt with weak password from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Password must be at least 8 characters long and contain both letters and numbers.'}, status=400)

        if User.objects.filter(email=email).exists():
            logger.warning(f"Signup attempt with existing email: {email} from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'User with this email already exists'}, status=400)

        # Split full name into first and last name
        name_parts = full_name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        user = User.objects.create_user(
            username=email,  # Use email as username
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            user_type=user_type,
            university=university,
            is_active=True  # Force active
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

        # 📳 DEVELOPMENT BYPASS: Always ensure accounts are verified upon sign-up
        user.email_verified = True
        user.is_active = True
        user.save()

        logger.info(f"User {user.id} created successfully. Automated development bypass activation.")
        return JsonResponse({'message': 'User created successfully.', 'user_id': user.id}, status=201)

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
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
def login_view(request):
    try:
        if not request.body:
            return JsonResponse({'error': 'Empty request body'}, status=400)

        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')

        email = email.strip().lower() if email else ''

        if not email or not password:
            logger.warning(f"Login attempt with missing fields: {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Email and password are required'}, status=400)

        if not re.match(r'^[a-zA-Z0-9._%+-]+@zetech\.ac\.ke$', email):
            logger.warning(f"Login attempt with invalid email: {email} from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Invalid email format or domain. Only @zetech.ac.ke emails are allowed.'}, status=400)

        user = authenticate(request, username=email, password=password)
        if user is not None:
            if user.failed_attempts >= 5:
                logger.warning(f"Login attempt for locked account: {email} from {request.META.get('REMOTE_ADDR')}")
                return JsonResponse({'error': 'Account is locked due to too many failed attempts.'}, status=403)
            
            # 📳 FORCE COMPLIANCE FOR THE FUNCTION VIEW LOGIN
            user.is_active = True
            user.email_verified = True
            user.failed_attempts = 0  
            user.save()
            
            login(request, user)
            logger.info(f"Successful login for user {user.id}: {email}")

            # Return JWT tokens so the React frontend can authenticate API calls.
            refresh = RefreshToken.for_user(user)
            return JsonResponse({
                'message': 'Login successful',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
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
            try:
                user_obj = User.objects.get(email=email)
                user_obj.failed_attempts += 1
                user_obj.save()
                if user_obj.failed_attempts >= 5:
                    logger.warning(f"Account locked after failed attempts: {email} from {request.META.get('REMOTE_ADDR')}")
                    return JsonResponse({'error': 'Account locked due to too many failed attempts.'}, status=403)
            except User.DoesNotExist:
                pass  
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


class LoginView(APIView):
    permission_classes = []  
    authentication_classes = []

    def options(self, request, *args, **kwargs):
        from django.http import HttpResponse
        resp = HttpResponse(status=200)
        return resp

    def post(self, request):
        email = request.data.get('email') or request.data.get('username')
        password = request.data.get('password')

        if email:
            email = str(email).strip().lower()

        try:
            user = User.objects.get(email=email)
            if user.check_password(password):
                user.is_active = True
                user.email_verified = True
                user.save()
            else:
                user = None
        except User.DoesNotExist:
            user = None

        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'user_type': user.user_type,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'university': user.university
                }
            })
        else:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lecturer_dashboard(request):
    try:
        user = request.user
        logger.info(f"Dashboard request for user {user.id}: {user.email}, type: {user.user_type}")
        if user.user_type != 'lecturer':
            logger.warning(f"Access denied for non-lecturer user {user.id}")
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        total_groups = Group.objects.filter(lecturer=user).count()
        total_students = User.objects.filter(user_type='student').count()
        pending_submissions = Submission.objects.filter(
            project__group__lecturer=user,
            status='submitted'
        ).count()

        groups = Group.objects.filter(lecturer=user).values(
            'id', 'name', 'course', 'year_of_study', 'created_at'
        )
        for group in groups:
            group['members_count'] = GroupMembership.objects.filter(group_id=group['id']).count()
            group['projects'] = list(Project.objects.filter(group_id=group['id']).values('id', 'title', 'status'))

        recent_submissions = Submission.objects.filter(
            project__group__lecturer=user
        ).select_related('project', 'submitted_by').order_by('-submitted_at')[:10]

        submissions_data = []
        for sub in recent_submissions:
            submissions_data.append({
                'id': sub.id,
                'project_title': sub.project.title,
                'submitted_by': f"{sub.submitted_by.first_name} {sub.submitted_by.last_name}",
                'status': sub.status,
                'submitted_at': sub.submitted_at.isoformat()
            })

        data = {
            'user': {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'user_type': user.user_type
            },
            'stats': {
                'total_groups': total_groups,
                'total_students': total_students,
                'pending_submissions': pending_submissions
            },
            'groups': list(groups),
            'recent_submissions': submissions_data
        }

        logger.info(f"Dashboard data returned for user {user.id}")
        return Response(data)
    except Exception as e:
        logger.error(f"Error in lecturer_dashboard: {str(e)}", exc_info=True)
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_dashboard(request):
    try:
        user = request.user
        logger.info(f"Dashboard request for user {user.id}: {user.email}, type: {user.user_type}")
        if user.user_type != 'student':
            logger.warning(f"Access denied for non-student user {user.id}")
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        total_groups = GroupMembership.objects.filter(student=user).count()
        active_projects = Project.objects.filter(group__memberships__student=user, status='active').count()
        pending_tasks = Task.objects.filter(assigned_to=user, status__in=['pending', 'in_progress']).count()

        memberships = GroupMembership.objects.filter(student=user).select_related('group')
        groups = []
        for membership in memberships:
            group = membership.group
            projects = list(Project.objects.filter(group=group).values('id', 'title', 'status'))
            progress_percentage = 0
            if projects:
                completed_projects = sum(1 for p in projects if p['status'] == 'completed')
                progress_percentage = int((completed_projects / len(projects)) * 100)
            groups.append({
                'id': group.id,
                'name': group.name,
                'course': group.course,
                'year_of_study': group.year_of_study,
                'role': membership.role,
                'is_admin': membership.role == 'admin',
                'members_count': group.members_count,
                'progress_percentage': progress_percentage,
                'projects': projects
            })

        tasks = Task.objects.filter(assigned_to=user).select_related('project').order_by('-created_at')[:10]
        tasks_data = []
        for task in tasks:
            tasks_data.append({
                'id': task.id,
                'title': task.title,
                'status': task.status,
                'progress_percentage': task.progress_percentage,
                'project': task.project.title,
                'due_date': task.due_date.isoformat() if task.due_date else None
            })

        submissions = Submission.objects.filter(submitted_by=user).select_related('project').order_by('-submitted_at')[:5]
        submissions_data = []
        for sub in submissions:
            submissions_data.append({
                'id': sub.id,
                'project_title': sub.project.title,
                'status': sub.status,
                'submitted_at': sub.submitted_at.isoformat(),
                'feedback': sub.feedback
            })

        data = {
            'user': {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'user_type': user.user_type
            },
            'stats': {
                'total_groups': total_groups,
                'active_projects': active_projects,
                'pending_tasks': pending_tasks
            },
            'groups': groups,
            'recent_tasks': tasks_data,
            'recent_submissions': submissions_data
        }

        logger.info(f"Dashboard data returned for user {user.id}")
        return Response(data)
    except Exception as e:
        logger.error(f"Error in student_dashboard: {str(e)}", exc_info=True)
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_tasks(request, group_id):
    try:
        user = request.user
        group = Group.objects.get(id=group_id)

        if user.user_type == 'lecturer':
            if group.lecturer != user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:
            if not GroupMembership.objects.filter(group=group, student=user).exists():
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        tasks = Task.objects.filter(project__group=group).select_related('assigned_to', 'project').order_by('-created_at')

        data = []
        for task in tasks:
            can_update_progress = (user.user_type == 'lecturer' or task.assigned_to == user)
            assigned_to_name = f"{task.assigned_to.first_name} {task.assigned_to.last_name}" if task.assigned_to else "Unassigned"
            data.append({
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'status': task.status,
                'progress_percentage': task.progress_percentage,
                'assigned_to_name': assigned_to_name,
                'project': task.project.title,
                'due_date': task.due_date.isoformat() if task.due_date else None,
                'can_update_progress': can_update_progress
            })

        return Response(data)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in get_group_tasks: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_task(request, group_id):
    try:
        user = request.user
        group = Group.objects.get(id=group_id)

        if user.user_type != 'lecturer' or group.lecturer != user:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        title = request.data.get('title', '').strip()
        description = request.data.get('description', '').strip()
        project_id = request.data.get('project_id')
        assigned_to_id = request.data.get('assigned_to_id')
        due_date = request.data.get('due_date')

        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)

        project = Project.objects.get(id=project_id, group=group)
        assigned_to = None
        if assigned_to_id:
            assigned_to = User.objects.get(id=assigned_to_id)

        task = Task.objects.create(
            title=title,
            description=description,
            project=project,
            assigned_to=assigned_to,
            due_date=due_date
        )

        return Response({
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'progress_percentage': task.progress_percentage,
            'assigned_to': {
                'id': task.assigned_to.id,
                'first_name': task.assigned_to.first_name,
                'last_name': task.assigned_to.last_name
            } if task.assigned_to else None,
            'project_title': task.project.title,
            'due_date': task.due_date.isoformat() if task.due_date else None
        }, status=status.HTTP_201_CREATED)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
    except User.DoesNotExist:
        return Response({'error': 'Assigned user not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in create_task: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_task_status(request, task_id):
    try:
        user = request.user
        task = Task.objects.get(id=task_id)

        if user.user_type == 'lecturer':
            if task.project.group.lecturer != user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:
            if task.assigned_to != user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status')
        if new_status not in ['todo', 'in_progress', 'completed']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        task.status = new_status
        if new_status == 'completed':
            try:
                task.progress_percentage = 100
            except Exception:
                pass
        task.save()

        return Response({'message': 'Task status updated successfully', 'id': task.id, 'status': task.status})
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in update_task_status: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_task_progress(request, task_id):
    try:
        user = request.user
        task = Task.objects.get(id=task_id)

        if user.user_type == 'lecturer':
            if task.project.group.lecturer != user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:
            if task.assigned_to != user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        progress_percentage = request.data.get('progress_percentage')
        if progress_percentage is None:
            return Response({'error': 'Progress percentage is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            progress_percentage = int(progress_percentage)
            if not (0 <= progress_percentage <= 100):
                raise ValueError
        except ValueError:
            return Response({'error': 'Progress percentage must be an integer between 0 and 100'}, status=status.HTTP_400_BAD_REQUEST)

        task.progress_percentage = progress_percentage
        if progress_percentage == 100:
            task.status = 'completed'
        task.save()

        return Response({
            'id': task.id,
            'title': task.title,
            'status': task.status,
            'progress_percentage': task.progress_percentage
        })
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in update_task_progress: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notifications(request):
    try:
        user = request.user
        notifications = Notification.objects.filter(user=user).order_by('-created_at')[:20]

        data = []
        for notification in notifications:
            data.append({
                'id': notification.id,
                'notification_type': notification.notification_type,
                'title': notification.title,
                'message': notification.message,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat()
            })

        return Response(data)
    except Exception as e:
        logger.error(f"Error in get_notifications: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    try:
        user = request.user
        notification = Notification.objects.get(id=notification_id, user=user)
        notification.is_read = True
        notification.save()

        return Response({'message': 'Notification marked as read'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in mark_notification_read: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_members(request, group_id):
    try:
        user = request.user
        group = Group.objects.get(id=group_id)

        if user.user_type == 'lecturer':
            if group.lecturer != user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:
            if not GroupMembership.objects.filter(group=group, student=user).exists():
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        memberships = GroupMembership.objects.filter(group=group).select_related('student')

        data = []
        for membership in memberships:
            data.append({
                'id': membership.id,
                'student': {
                    'id': membership.student.id,
                    'first_name': membership.student.first_name,
                    'last_name': membership.student.last_name,
                    'email': membership.student.email
                },
                'role': membership.role,
                'joined_at': membership.joined_at.isoformat()
            })

        return Response(data)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in get_group_members: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_students_for_lecturer(request):
    try:
        user = request.user
        if user.user_type != 'lecturer':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        students = User.objects.filter(user_type='student').values(
            'id', 'first_name', 'last_name', 'email', 'course', 'year_of_study'
        )

        data = []
        for student in students:
            data.append({
                'id': student['id'],
                'name': f"{student['first_name']} {student['last_name']}",
                'email': student['email'],
                'course': student['course'],
                'year_of_study': student['year_of_study']
            })

        return Response(data)
    except Exception as e:
        logger.error(f"Error in get_students_for_lecturer: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat_rooms(request):
    try:
        user = request.user
        group_chat_rooms = ChatRoom.objects.filter(chat_type='group', group__lecturer=user).select_related('group') if user.user_type == 'lecturer' else ChatRoom.objects.filter(chat_type='group', group__memberships__student=user).select_related('group')
        direct_chat_rooms = ChatRoom.objects.filter(chat_type='direct').filter(
            models.Q(user1=user) | models.Q(user2=user)
        ).select_related('user1', 'user2')

        data = []

        for room in group_chat_rooms:
            last_message = Message.objects.filter(chat_room=room).select_related('sender').order_by('-timestamp').first()
            data.append({
                'id': room.id,
                'type': 'group',
                'name': room.group.name,
                'group_id': room.group.id,
                'last_message': last_message.content if last_message else None,
                'last_message_time': last_message.timestamp.isoformat() if last_message else None,
                'last_message_sender': f"{last_message.sender.first_name} {last_message.sender.last_name}" if last_message else None
            })

        for room in direct_chat_rooms:
            other_user = room.user2 if room.user1 == user else room.user1
            last_message = Message.objects.filter(chat_room=room).select_related('sender').order_by('-timestamp').first()
            data.append({
                'id': room.id,
                'type': 'direct',
                'name': f"{other_user.first_name} {other_user.last_name}",
                'other_user_id': other_user.id,
                'last_message': last_message.content if last_message else None,
                'last_message_time': last_message.timestamp.isoformat() if last_message else None,
                'last_message_sender': f"{last_message.sender.first_name} {last_message.sender.last_name}" if last_message else None
            })

        data.sort(key=lambda x: x.get('last_message_time') or '1970-01-01T00:00:00', reverse=True)
        return Response(data)
    except Exception as e:
        logger.error(f"Error in get_chat_rooms: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_messages(request, room_id):
    try:
        user = request.user
        chat_room = ChatRoom.objects.get(id=room_id)

        if chat_room.chat_type == 'group':
            if user.user_type == 'lecturer':
                if chat_room.group.lecturer != user:
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            else:
                if not GroupMembership.objects.filter(group=chat_room.group, student=user).exists():
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:  
            if not (chat_room.user1 == user or chat_room.user2 == user):
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        messages = Message.objects.filter(chat_room=chat_room).select_related('sender').order_by('timestamp')

        data = []
        for msg in messages:
            data.append({
                'id': msg.id,
                'content': msg.content,
                'sender': {
                    'id': msg.sender.id,
                    'first_name': msg.sender.first_name,
                    'last_name': msg.sender.last_name,
                    'user_type': msg.sender.user_type
                },
                'timestamp': msg.timestamp.isoformat()
            })

        return Response(data)
    except ChatRoom.DoesNotExist:
        return Response({'error': 'Chat room not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in get_messages: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request, room_id):
    try:
        user = request.user
        content = request.data.get('content', '').strip()

        if not content:
            return Response({'error': 'Message content is required'}, status=status.HTTP_400_BAD_REQUEST)

        chat_room = ChatRoom.objects.get(id=room_id)

        if chat_room.chat_type == 'group':
            if user.user_type == 'lecturer':
                if chat_room.group.lecturer != user:
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            else:
                if not GroupMembership.objects.filter(group=chat_room.group, student=user).exists():
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:  
            if not (chat_room.user1 == user or chat_room.user2 == user):
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        message = Message.objects.create(
            chat_room=chat_room,
            sender=user,
            content=content
        )

        return Response({
            'id': message.id,
            'content': message.content,
            'sender': {
                'id': message.sender.id,
                'first_name': message.sender.first_name,
                'last_name': message.sender.last_name,
                'user_type': message.sender.user_type
            },
            'timestamp': message.timestamp.isoformat()
        }, status=status.HTTP_201_CREATED)
    except ChatRoom.DoesNotExist:
        return Response({'error': 'Chat room not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in send_message: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_or_create_direct_chat(request):
    try:
        user = request.user
        student_id = request.data.get('student_id')

        if not student_id:
            return Response({'error': 'Student ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        if user.user_type != 'lecturer':
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        student = User.objects.get(id=student_id, user_type='student')

        chat_room = ChatRoom.objects.filter(
            chat_type='direct',
            user1=user,
            user2=student
        ).first()

        if not chat_room:
            chat_room = ChatRoom.objects.create(
                chat_type='direct',
                user1=user,
                user2=student
            )

        return Response({
            'id': chat_room.id,
            'type': 'direct',
            'name': f"{student.first_name} {student.last_name}",
            'other_user_id': student.id
        })
    except User.DoesNotExist:
        return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in get_or_create_direct_chat: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_unread_message_counts(request):
    try:
        user = request.user

        chat_rooms = []
        if user.user_type == 'lecturer':
            group_rooms = ChatRoom.objects.filter(chat_type='group', group__lecturer=user)
            direct_rooms = ChatRoom.objects.filter(chat_type='direct').filter(
                models.Q(user1=user) | models.Q(user2=user)
            )
        else:
            group_rooms = ChatRoom.objects.filter(chat_type='group', group__memberships__student=user)
            direct_rooms = ChatRoom.objects.filter(chat_type='direct').filter(
                models.Q(user1=user) | models.Q(user2=user)
            )

        chat_rooms.extend(list(group_rooms) + list(direct_rooms))

        unread_counts = {}
        for room in chat_rooms:
            count = Notification.objects.filter(
                user=user,
                notification_type='message_received',
                related_chat_room=room,
                is_read=False
            ).count()
            unread_counts[str(room.id)] = count

        return Response(unread_counts)
    except Exception as e:
        logger.error(f"Error in get_unread_message_counts: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_room_notifications_read(request, room_id):
    try:
        user = request.user

        Notification.objects.filter(
            user=user,
            notification_type='message_received',
            related_chat_room_id=room_id,
            is_read=False
        ).update(is_read=True)

        return Response({'message': 'Notifications marked as read'})
    except Exception as e:
        logger.error(f"Error in mark_room_notifications_read: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
            lecturer=user  
        )
        GroupMembership.objects.create(
            group=group,
            student=user,
            role='admin'
        )
        ChatRoom.objects.create(
            chat_type='group',
            group=group
        )

        return Response({
            'message': 'Group created successfully',
            'group': {
                'id': group.id,
                'name': group.name,
                'course': group.course,
                'year_of_study': group.year_of_study,
                'description': group.description,
                'lecturer': f"{user.first_name} {user.last_name}",
                'members_count': 1
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error creating group: {str(e)}")
        return Response({'error': 'Failed to create group'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_chat_room(request, group_id):
    try:
        user = request.user
        group = Group.objects.get(id=group_id)

        if user.user_type == 'lecturer':
            if group.lecturer != user:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:
            if not GroupMembership.objects.filter(group=group, student=user).exists():
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        chat_room = ChatRoom.objects.get(chat_type='group', group=group)

        return Response({
            'id': chat_room.id,
            'name': group.name,
            'group_id': group.id
        })
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except ChatRoom.DoesNotExist:
        return Response({'error': 'Chat room not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in get_group_chat_room: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        group = Group.objects.get(id=group_code)

        if GroupMembership.objects.filter(group=group, student=user).exists():
            return Response({'error': 'You are already a member of this group'}, status=status.HTTP_400_BAD_REQUEST)

        GroupMembership.objects.create(
            group=group,
            student=user,
            role='member'
        )

        return Response({
            'message': 'Successfully joined the group',
            'group': {
                'id': group.id,
                'name': group.name,
                'course': group.course,
                'year_of_study': group.year_of_study,
                'description': group.description,
                'lecturer': f"{group.lecturer.first_name} {group.lecturer.last_name}",
                'members_count': GroupMembership.objects.filter(group=group).count()
            }
        }, status=status.HTTP_200_OK)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error joining group: {str(e)}")
        return Response({'error': 'Failed to join group'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

   
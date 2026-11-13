from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.decorators import login_required
from django.http import FileResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.conf import settings
from django.utils.crypto import get_random_string
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
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
from datetime import datetime, time, timedelta
from django.db import models, transaction
from django.db.models import Exists, OuterRef
from django.core.files.storage import default_storage
from .models import (
    User, Group, GroupMembership, Project, Task, TaskActivity, TaskComment, Submission, SubmissionAttachment,
    ChatRoom, Message, Notification, NotificationSettings, Course, Unit, Semester,     StudentEnrollment, UnitAssignment, LecturerRoster,
)
from .planning_rules import avatar_url, board_status, weight_change_block, weight_confirm_block, WEIGHT_MIN, WEIGHT_MAX
from .balance import calculate_group_balance
from .health import compute_group_health, get_health_details
from .academic import (
    approved_units_for_lecturer, current_term, is_supervising_lecturer,
    sync_student_enrollments, supervising_lecturer_ids, supervising_lecturers,
)

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

            # Check if email is in lecturer roster
            roster_entry = LecturerRoster.objects.filter(email=email).first()
            is_lecturer = roster_entry is not None and roster_entry.status == 'active'

            user_type = 'lecturer' if is_lecturer else 'student'

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
            # Update user_type based on roster
            if is_lecturer and user.user_type != 'lecturer':
                user.user_type = 'lecturer'
            elif not is_lecturer and user.user_type != 'student':
                user.user_type = 'student'
            user.save()

            # Update roster entry if lecturer
            if is_lecturer and roster_entry:
                roster_entry.status = 'active'
                if not roster_entry.activated_at:
                    from django.utils import timezone
                    roster_entry.activated_at = timezone.now()
                roster_entry.save(update_fields=['status', 'activated_at'])

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
                    'lecturer_setup_required': (
                        user.user_type == 'lecturer'
                        and not UnitAssignment.objects.filter(lecturer=user).exists()
                    ),
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Google login failed: {e}")
            return Response({'error': 'Google login failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([])
def staff_signin_email(request):
    """Send one-time sign-in link to lecturer email (checks roster)."""
    email = str(request.data.get('email', '')).strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    roster_entry = LecturerRoster.objects.filter(email=email, status='invited').first()
    if not roster_entry:
        return Response({'error': 'No invited lecturer found with this email.'}, status=status.HTTP_404_NOT_FOUND)

    import secrets
    from django.utils import timezone
    from datetime import timedelta

    token = secrets.token_urlsafe(32)
    roster_entry.activation_token = token
    roster_entry.activation_token_expires = timezone.now() + timedelta(hours=24)
    roster_entry.save(update_fields=['activation_token', 'activation_token_expires'])

    signin_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/staff/activate/{token}/"
    print(f"\n=== STAFF SIGN-IN LINK ===")
    print(f"Lecturer: {roster_entry.full_name} ({roster_entry.email})")
    print(f"Activation link: {signin_url}")
    print(f"Expires: {roster_entry.activation_token_expires}")
    print(f"===========================\n")

    return Response({'message': 'Sign-in link sent. Check backend console for the link in development.'})


@api_view(['POST'])
@permission_classes([])
def staff_activate(request):
    """Activate lecturer account using one-time token."""
    token = str(request.data.get('token', '')).strip()
    password = request.data.get('password')
    if not token:
        return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({'error': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)

    roster_entry = LecturerRoster.objects.filter(activation_token=token).first()
    if not roster_entry:
        return Response({'error': 'Invalid or expired activation link.'}, status=status.HTTP_400_BAD_REQUEST)

    from django.utils import timezone
    if roster_entry.activation_token_expires and roster_entry.activation_token_expires < timezone.now():
        return Response({'error': 'Activation link has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    user, created = User.objects.get_or_create(
        email=roster_entry.email,
        defaults={
            'username': roster_entry.email,
            'user_type': 'lecturer',
            'first_name': roster_entry.full_name.split(' ')[0] if roster_entry.full_name else '',
            'last_name': ' '.join(roster_entry.full_name.split(' ')[1:]) if len(roster_entry.full_name.split(' ')) > 1 else '',
            'department': roster_entry.department,
            'staff_id': roster_entry.staff_id or '',
            'email_verified': True,
            'is_active': True,
            'password': password,  # Include password in defaults for new users
        }
    )

    if not created:
        # User exists, update password and other fields
        user.set_password(password)

    if user.user_type != 'lecturer':
        user.user_type = 'lecturer'
    user.department = roster_entry.department
    user.staff_id = roster_entry.staff_id or ''
    name_parts = roster_entry.full_name.split(' ', 1)
    user.first_name = name_parts[0]
    user.last_name = name_parts[1] if len(name_parts) > 1 else ''
    user.email_verified = True
    user.is_active = True
    user.save()

    roster_entry.activation_token = None
    roster_entry.activation_token_expires = None
    roster_entry.status = 'active'
    roster_entry.activated_at = timezone.now()
    roster_entry.save(update_fields=['activation_token', 'activation_token_expires', 'status', 'activated_at'])
    roster_entry.save(update_fields=['activation_token', 'activation_token_expires', 'status', 'activated_at'])

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
            'lecturer_setup_required': (
                user.user_type == 'lecturer'
                and not UnitAssignment.objects.filter(lecturer=user).exists()
            ),
        }
    })


@api_view(['POST'])
@permission_classes([])
def staff_forgot_password(request):
    """Send password reset link to lecturer email (checks roster)."""
    email = str(request.data.get('email', '')).strip().lower()
    if not email:
        return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    roster_entry = LecturerRoster.objects.filter(email=email, status='active').first()
    if not roster_entry:
        return Response({'error': 'No active lecturer found with this email.'}, status=status.HTTP_404_NOT_FOUND)

    import secrets
    from django.utils import timezone
    from datetime import timedelta

    token = secrets.token_urlsafe(32)
    roster_entry.reset_token = token
    roster_entry.reset_token_expires = timezone.now() + timedelta(hours=2)
    roster_entry.save(update_fields=['reset_token', 'reset_token_expires'])

    reset_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/staff/reset-password/{token}/"
    print(f"\n=== PASSWORD RESET LINK ===")
    print(f"Lecturer: {roster_entry.full_name} ({roster_entry.email})")
    print(f"Reset link: {reset_url}")
    print(f"Expires: {roster_entry.reset_token_expires}")
    print(f"============================\n")

    return Response({'message': 'Password reset link sent. Check backend console for the link in development.'})


@api_view(['POST'])
@permission_classes([])
def staff_reset_password(request):
    """Reset lecturer password using one-time token."""
    token = str(request.data.get('token', '')).strip()
    password = request.data.get('password')
    if not token:
        return Response({'error': 'Token is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({'error': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)

    roster_entry = LecturerRoster.objects.filter(reset_token=token).first()
    if not roster_entry:
        return Response({'error': 'Invalid or expired reset link.'}, status=status.HTTP_400_BAD_REQUEST)

    from django.utils import timezone
    if roster_entry.reset_token_expires and roster_entry.reset_token_expires < timezone.now():
        return Response({'error': 'Reset link has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email=roster_entry.email).first()
    if not user:
        return Response({'error': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

    user.set_password(password)
    user.save()

    roster_entry.reset_token = None
    roster_entry.reset_token_expires = None
    roster_entry.save(update_fields=['reset_token', 'reset_token_expires'])

    return Response({'message': 'Password reset successfully. You can now sign in.'})


@csrf_exempt
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
def signup_view(request):
    try:
        if not request.body:
            return JsonResponse({'error': 'Empty request body'}, status=400)

        data = json.loads(request.body)
        user_type = data.get('user_type')
        email = str(data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        full_name = str(data.get('fullName') or '').strip()
        university = str(data.get('university') or '').strip()
        username = str(data.get('admissionNumber') or data.get('username') or email).strip().upper()

        if not email or not password or not user_type:
            logger.warning(f"Signup attempt with missing fields: {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Email, password, and user type are required'}, status=400)
        if not full_name:
            return JsonResponse({'error': 'Full name is required.'}, status=400)

        if user_type != 'student':
            return JsonResponse({'error': 'Only student registration is allowed. Lecturers are added by administrators.'}, status=400)

        if data.get('confirmPassword') != password:
            return JsonResponse({'error': 'Passwords do not match'}, status=400)

        if not re.match(r'^[a-zA-Z0-9._%+-]+@zetech\.ac\.ke$', email):
            logger.warning(f"Signup attempt with invalid email: {email} from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Invalid email format or domain. Only @zetech.ac.ke emails are allowed.'}, status=400)

        if len(password) < 8 or not re.search(r'[a-zA-Z]', password) or not re.search(r'\d', password):
            logger.warning(f"Signup attempt with weak password from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'Password must be at least 8 characters long and contain both letters and numbers.'}, status=400)

        if User.objects.filter(email=email).exists():
            logger.warning(f"Signup attempt with existing email: {email} from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({'error': 'User with this email already exists'}, status=400)

        if User.objects.filter(username__iexact=username).exists():
            return JsonResponse({'error': 'User with this admission number or username already exists'}, status=400)

        course = None
        year = None
        semester_number = None
        matching_units = Unit.objects.none()
        if user_type == 'student':
            academic_level = str(data.get('academic_level') or '').strip()
            try:
                course = Course.objects.get(pk=int(data.get('course_id')))
                year = int(data.get('yearOfStudy'))
            except (Course.DoesNotExist, TypeError, ValueError):
                return JsonResponse({'error': 'Select a valid programme, academic level, and year.'}, status=400)

            if year < 1:
                return JsonResponse({'error': 'Select a valid programme, academic level, and year.'}, status=400)

            matching_units = Unit.objects.filter(course=course, year_of_study=year)
            if academic_level:
                matching_units = matching_units.filter(academic_level=academic_level).order_by('semester', 'code')
                semester_number = matching_units.values_list('semester', flat=True).first()
                if semester_number is not None:
                    matching_units = matching_units.filter(semester=semester_number)
            else:
                try:
                    semester_number = int(data.get('semester'))
                except (TypeError, ValueError):
                    return JsonResponse({'error': 'Select a valid programme, year, and semester.'}, status=400)
                if semester_number < 1:
                    return JsonResponse({'error': 'Select a valid programme, year, and semester.'}, status=400)
                matching_units = matching_units.filter(semester=semester_number)

            if not matching_units.exists():
                return JsonResponse({'error': 'No units are available for the selected programme, academic level, and year.'}, status=400)

        name_parts = full_name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                user_type=user_type,
                university=university,
                is_active=True,
            )

            if user_type == 'student':
                user.course = course.name
                user.academic_level = academic_level
                user.year_of_study = str(year)
                user.enrolled_course = course
                user.semester = semester_number

            user.email_verified = True
            user.is_active = True
            user.save()

            if user_type == 'student':
                term, enrolled_count = sync_student_enrollments(user)
                if term is None:
                    return JsonResponse({'error': 'Create an academic term before enrolling students.'}, status=400)

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


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def student_settings(request):
    user = request.user
    if user.user_type != 'student':
        return Response({'error': 'Student settings are only available to student accounts.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PATCH':
        first_name = str(request.data.get('first_name', user.first_name) or '').strip()
        last_name = str(request.data.get('last_name', user.last_name) or '').strip()
        course_id = request.data.get('course_id', user.enrolled_course_id)
        year_value = request.data.get('year_of_study', user.year_of_study)
        semester_value = request.data.get('semester', user.semester)

        if not first_name:
            return Response({'error': 'First name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        course = None
        if course_id not in (None, ''):
            try:
                course = Course.objects.get(pk=int(course_id))
            except (Course.DoesNotExist, TypeError, ValueError):
                return Response({'error': 'Select a valid programme.'}, status=status.HTTP_400_BAD_REQUEST)

        year = ''
        semester = None
        if year_value not in (None, ''):
            try:
                year = str(int(year_value))
                if int(year) not in range(1, 5):
                    raise ValueError
            except (TypeError, ValueError):
                return Response({'error': 'Year of study must be between 1 and 4.'}, status=status.HTTP_400_BAD_REQUEST)
        if semester_value not in (None, ''):
            try:
                semester = int(semester_value)
                if semester not in (1, 2):
                    raise ValueError
            except (TypeError, ValueError):
                return Response({'error': 'Semester must be 1 or 2.'}, status=status.HTTP_400_BAD_REQUEST)

        if course and (not year or semester is None):
            return Response({'error': 'Select a year and semester for the programme.'}, status=status.HTTP_400_BAD_REQUEST)
        if course and not Unit.objects.filter(
            course=course,
            year_of_study=year,
            semester=semester,
        ).exists():
            return Response({'error': 'That year and semester are not available for the selected programme.'}, status=status.HTTP_400_BAD_REQUEST)

        user.first_name = first_name
        user.last_name = last_name
        user.enrolled_course = course
        user.course = course.name if course else ''
        user.year_of_study = year
        user.semester = semester
        try:
            user.save()
        except ValidationError as error:
            return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)

        # Keep enrolments in step with the saved programme/year/semester.
        sync_student_enrollments(user)

    course = user.enrolled_course
    if course is None and user.course:
        course = Course.objects.filter(
            models.Q(code__iexact=user.course) | models.Q(name__iexact=user.course)
        ).first()

    return Response({
        'id': user.id,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'course_id': course.id if course else None,
        'course': course.name if course else user.course,
        'course_code': course.code if course else '',
        'year_of_study': user.year_of_study,
        'semester': user.semester,
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def lecturer_settings(request):
    user = request.user
    if user.user_type != 'lecturer':
        return Response({'error': 'Lecturer settings are only available to lecturer accounts.'}, status=status.HTTP_403_FORBIDDEN)
    if request.method == 'PATCH':
        user.first_name = str(request.data.get('first_name', user.first_name) or '').strip()
        user.last_name = str(request.data.get('last_name', user.last_name) or '').strip()
        user.salutation = str(request.data.get('title', user.salutation) or '').strip()
        user.department = str(request.data.get('department', user.department) or '').strip()
        user.staff_id = str(request.data.get('staff_id', user.staff_id) or '').strip()
        user.courses_taught = str(request.data.get('courses_taught', user.courses_taught) or '').strip()
        if not user.first_name:
            return Response({'error': 'First name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user.save()
        except ValidationError as error:
            return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({
        'id': user.id,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'salutation': user.salutation or '',
        'department': user.department or '',
        'staff_id': user.staff_id or '',
        'courses_taught': user.courses_taught or '',
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def notification_settings(request):
    user = request.user
    settings, _ = NotificationSettings.objects.get_or_create(user=user)

    if request.method == 'PATCH':
        settings.task_assigned = request.data.get('taskAssigned', settings.task_assigned)
        settings.task_due = request.data.get('taskDue', settings.task_due)
        settings.poll_opened = request.data.get('pollOpened', settings.poll_opened)
        settings.mention = request.data.get('mention', settings.mention)
        settings.message_received = request.data.get('messageReceived', settings.message_received)
        settings.join_request = request.data.get('joinRequest', settings.join_request)
        settings.invite_response = request.data.get('inviteResponse', settings.invite_response)
        settings.save()

    return Response({
        'taskAssigned': settings.task_assigned,
        'taskDue': settings.task_due,
        'pollOpened': settings.poll_opened,
        'mention': settings.mention,
        'messageReceived': settings.message_received,
        'joinRequest': settings.join_request,
        'inviteResponse': settings.invite_response,
    })


def _lecturer_unit_or_error(user, unit_id):
    try:
        unit = Unit.objects.get(pk=unit_id)
    except (Unit.DoesNotExist, TypeError, ValueError):
        return None, Response({'error': 'Select a valid unit.'}, status=status.HTTP_400_BAD_REQUEST)
    if not approved_units_for_lecturer(user, current_term()).filter(pk=unit.pk).exists():
        return None, Response({'error': 'You can only manage your assigned units.'}, status=status.HTTP_403_FORBIDDEN)
    return unit, None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lecturer_create_unit(request):
    user = request.user
    if user.user_type != 'lecturer':
        return Response({'error': 'Lecturer access required.'}, status=status.HTTP_403_FORBIDDEN)
    code = str(request.data.get('code') or '').strip().upper()
    name = str(request.data.get('name') or '').strip()
    try:
        course = Course.objects.get(pk=int(request.data.get('course_id')))
        year = int(request.data.get('year_of_study'))
        semester = int(request.data.get('semester'))
    except (Course.DoesNotExist, TypeError, ValueError):
        return Response({'error': 'Choose a valid programme, year, and semester.'}, status=status.HTTP_400_BAD_REQUEST)
    if not code or not name or year not in range(1, 5) or semester not in (1, 2):
        return Response({'error': 'Unit code, name, year, and semester are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if Unit.objects.filter(code__iexact=code, course=course).exists():
        return Response({'error': 'That unit already exists in this programme.'}, status=status.HTTP_400_BAD_REQUEST)
    unit = Unit.objects.create(
        code=code, name=name, course=course, year_of_study=year, semester=semester,
        academic_level=str(request.data.get('academic_level') or '').strip(),
        assigned_lecturer=user,
    )
    return Response({'id': unit.id, 'code': unit.code, 'name': unit.name, 'course_name': course.name}, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def lecturer_update_unit(request, unit_id):
    user = request.user
    if user.user_type != 'lecturer':
        return Response({'error': 'Lecturer access required.'}, status=status.HTTP_403_FORBIDDEN)
    unit, error_response = _lecturer_unit_or_error(user, unit_id)
    if error_response:
        return error_response
    code = str(request.data.get('code', unit.code) or '').strip().upper()
    name = str(request.data.get('name', unit.name) or '').strip()
    try:
        year = int(request.data.get('year_of_study', unit.year_of_study))
        semester = int(request.data.get('semester', unit.semester))
    except (TypeError, ValueError):
        return Response({'error': 'Year and semester must be valid numbers.'}, status=status.HTTP_400_BAD_REQUEST)
    if not code or not name or year not in range(1, 5) or semester not in (1, 2):
        return Response({'error': 'Unit code, name, year, and semester are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if Unit.objects.filter(course=unit.course, code__iexact=code).exclude(pk=unit.id).exists():
        return Response({'error': 'That unit already exists in this programme.'}, status=status.HTTP_400_BAD_REQUEST)
    unit.code, unit.name, unit.year_of_study, unit.semester = code, name, year, semester
    unit.save(update_fields=['code', 'name', 'year_of_study', 'semester'])
    return Response({'id': unit.id, 'code': unit.code, 'name': unit.name})


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def lecturer_manage_student(request, unit_id, student_id):
    user = request.user
    if user.user_type != 'lecturer':
        return Response({'error': 'Lecturer access required.'}, status=status.HTTP_403_FORBIDDEN)
    unit, error_response = _lecturer_unit_or_error(user, unit_id)
    if error_response:
        return error_response
    try:
        student = User.objects.get(pk=student_id, user_type='student')
    except User.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'DELETE':
        StudentEnrollment.objects.filter(student=student, unit=unit).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    semester = Semester.objects.filter(year=unit.year_of_study, semester=unit.semester).first()
    if not semester:
        semester = Semester.objects.order_by('-year', '-semester').first()
    if not semester:
        return Response({'error': 'Create an academic term before enrolling students.'}, status=status.HTTP_400_BAD_REQUEST)
    StudentEnrollment.objects.get_or_create(student=student, unit=unit, semester=semester)
    return Response({'message': f'{student.get_full_name() or student.username} enrolled successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lecturer_import_students(request):
    user = request.user
    if user.user_type != 'lecturer':
        return Response({'error': 'Lecturer access required.'}, status=status.HTTP_403_FORBIDDEN)
    rows = request.data.get('students')
    unit_id = request.data.get('unit_id')
    if not isinstance(rows, list) or not unit_id:
        return Response({'error': 'Provide a unit and a list of students.'}, status=status.HTTP_400_BAD_REQUEST)
    unit, error_response = _lecturer_unit_or_error(user, unit_id)
    if error_response:
        return error_response
    enrolled = 0
    errors = []
    semester = Semester.objects.filter(year=unit.year_of_study, semester=unit.semester).first()
    if not semester:
        semester = Semester.objects.order_by('-year', '-semester').first()
    if not semester:
        return Response({'error': 'Create an academic term before enrolling students.'}, status=status.HTTP_400_BAD_REQUEST)
    for index, row in enumerate(rows, start=2):
        identifier = str(row.get('email') or row.get('username') or '').strip()
        student = User.objects.filter(models.Q(email__iexact=identifier) | models.Q(username__iexact=identifier), user_type='student').first()
        if not student:
            errors.append(f'Row {index}: student {identifier or "(blank)"} was not found.')
            continue
        StudentEnrollment.objects.get_or_create(student=student, unit=unit, semester=semester)
        enrolled += 1
    return Response({'enrolled': enrolled, 'errors': errors})


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def lecturer_demo_data(request):
    user = request.user
    if user.user_type != 'lecturer':
        return Response({'error': 'Lecturer access required.'}, status=status.HTTP_403_FORBIDDEN)

    demo_username_prefix = f'DEMO_{user.id}_'
    if request.method == 'DELETE':
        demo_groups = Group.objects.filter(lecturer=user, name__startswith='[Demo]')
        demo_student_ids = User.objects.filter(username__startswith=demo_username_prefix, user_type='student').values_list('id', flat=True)
        deleted_groups = demo_groups.count()
        demo_groups.delete()
        deleted_students, _ = User.objects.filter(id__in=demo_student_ids).delete()
        return Response({'groups_deleted': deleted_groups, 'students_deleted': deleted_students})

    assigned_units = approved_units_for_lecturer(user, current_term())
    if not assigned_units.exists():
        return Response({'error': 'Assign at least one unit to yourself before creating demo data.'}, status=status.HTTP_400_BAD_REQUEST)

    created_students = 0
    created_groups = 0
    created_messages = 0
    created_submissions = 0
    with transaction.atomic():
        for unit in assigned_units:
            semester = Semester.objects.filter(year=unit.year_of_study, semester=unit.semester).first()
            if not semester:
                semester = Semester.objects.order_by('-year', '-semester').first()
            if not semester:
                return Response({'error': 'Create an academic term before creating demo data.'}, status=status.HTTP_400_BAD_REQUEST)

            demo_students = []
            for index in range(1, 11):
                username = f'{demo_username_prefix}{unit.id}_{index}'
                student, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'email': f'{username.lower()}@zetech.ac.ke',
                        'first_name': f'Demo {unit.code}',
                        'last_name': f'Student {index}',
                        'user_type': 'student',
                        'course': unit.course.name,
                        'enrolled_course': unit.course,
                        'year_of_study': str(unit.year_of_study),
                        'semester': unit.semester,
                        'status': 'active',
                        'password': make_password('DemoStudent123!'),
                    },
                )
                if created:
                    created_students += 1
                StudentEnrollment.objects.get_or_create(student=student, unit=unit, semester=semester)
                demo_students.append(student)

            for group_index in range(1, 3):
                group, created = Group.objects.get_or_create(
                    lecturer=user,
                    unit=unit,
                    name=f'[Demo] {unit.code} Group {group_index}',
                    defaults={
                        'course': unit.course.name,
                        'year_of_study': str(unit.year_of_study),
                        'description': 'Temporary demo group. Safe to remove from the lecturer dashboard.',
                        'join_code': get_random_string(6).upper(),
                        'unit_code': unit.code,
                        'max_members': 5,
                    },
                )
                if created:
                    created_groups += 1
                selected_students = demo_students[(group_index - 1) * 5:group_index * 5]
                for student in selected_students:
                    GroupMembership.objects.get_or_create(group=group, student=student)

                project, _ = Project.objects.get_or_create(
                    group=group,
                    title=f'[Demo] {unit.code} Assessment {group_index}',
                    defaults={'description': 'Temporary assessment created for dashboard preview.'},
                )
                for student in selected_students[:3]:
                    _, created = Submission.objects.get_or_create(
                        project=project,
                        submitted_by=student,
                        defaults={
                            'content': 'Demo submission for lecturer dashboard preview.',
                            'proof_text': 'Demo evidence',
                            'status': 'submitted',
                        },
                    )
                    created_submissions += int(created)
                room, _ = ChatRoom.objects.get_or_create(group=group, defaults={'chat_type': 'group'})
                for sender, content in (
                    (selected_students[0], f'Hello lecturer, this is a demo message from {unit.code}.'),
                    (user, f'Thanks everyone. This is a demo announcement for {group.name}.'),
                    (selected_students[1], 'We have submitted our assessment for review.'),
                ):
                    Message.objects.create(chat_room=room, sender=sender, content=content)
                    created_messages += 1

    return Response({
        'message': 'Demo data created for your assigned units.',
        'students_created': created_students,
        'groups_created': created_groups,
        'submissions_created': created_submissions,
        'messages_created': created_messages,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_student_password(request):
    user = request.user
    old_password = str(request.data.get('current_password') or '')
    new_password = str(request.data.get('new_password') or '')
    confirm_password = str(request.data.get('confirm_password') or '')
    if not old_password or not new_password or not confirm_password:
        return Response({'error': 'Complete all password fields.'}, status=status.HTTP_400_BAD_REQUEST)
    if not user.check_password(old_password):
        return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
    if new_password != confirm_password:
        return Response({'error': 'New passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new_password, user=user)
    except ValidationError as error:
        return Response({'error': ' '.join(error.messages)}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(new_password)
    user.save(update_fields=['password', 'is_active', 'email_verified'])
    return Response({'message': 'Password updated successfully.'})


class LoginView(APIView):
    permission_classes = []  
    authentication_classes = []

    def options(self, request, *args, **kwargs):
        from django.http import HttpResponse
        resp = HttpResponse(status=200)
        return resp

    def post(self, request):
        username = str(request.data.get('username') or '').strip()
        password = request.data.get('password')

        if not username or '@' in username:
            return Response(
                {'error': 'Enter your admission number or staff ID, not your email address.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(username__iexact=username)
            if user.status == 'suspended':
                return Response(
                    {'error': 'This account has been suspended. Contact an administrator.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if user.check_password(password):
                user.email_verified = True
                user.save(update_fields=['email_verified', 'is_active', 'status'])
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
                    'university': user.university,
                    'is_staff': user.is_staff,
                    'lecturer_setup_required': (
                        user.user_type == 'lecturer'
                        and not UnitAssignment.objects.filter(lecturer=user).exists()
                    ),
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
        # Allow access if user is a lecturer OR has approved unit assignments
        lecturer_units = approved_units_for_lecturer(user, current_term())
        logger.info(f"User {user.id} has {lecturer_units.count()} approved units for current term")
        if user.user_type != 'lecturer' and not lecturer_units.exists():
            logger.warning(f"Access denied for non-lecturer user {user.id} with {lecturer_units.count()} units")
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        unit_ids = list(lecturer_units.values_list('id', flat=True))
        lecturer_groups = Group.objects.filter(unit_id__in=unit_ids)
        total_groups = lecturer_groups.count()
        enrolled_students = User.objects.filter(
            user_type='student',
            enrollments__unit_id__in=unit_ids,
        ).distinct()
        total_students = enrolled_students.count()
        pending_submissions = Submission.objects.filter(
            project__group__in=lecturer_groups,
            status='submitted'
        ).count()

        groups = lecturer_groups.values(
            'id', 'name', 'course', 'year_of_study', 'created_at', 'unit_id', 'unit_code'
        )
        for group in groups:
            group['members_count'] = GroupMembership.objects.filter(group_id=group['id']).count()
            group['projects'] = list(Project.objects.filter(group_id=group['id']).values('id', 'title', 'status'))

        recent_submissions = Submission.objects.filter(
            project__group__in=lecturer_groups
        ).select_related('project', 'submitted_by').order_by('-submitted_at')[:10]

        submissions_data = []
        for sub in recent_submissions:
            submissions_data.append({
                'id': sub.id,
                'project_title': sub.project.title,
                'submitted_by': f"{sub.submitted_by.first_name} {sub.submitted_by.last_name}",
                'grade': float(sub.grade) if sub.grade is not None else None,
                'feedback': sub.feedback,
                'status': sub.status,
                'submitted_at': sub.submitted_at.isoformat()
            })

        units = []
        active_term = current_term()
        for unit in lecturer_units:
            enrollment_filter = {'enrollments__unit': unit}
            if active_term is not None:
                enrollment_filter['enrollments__semester_id'] = active_term.id
            students = User.objects.filter(
                user_type='student',
                **enrollment_filter,
            ).distinct().order_by('first_name', 'last_name', 'id')
            unit_groups = lecturer_groups.filter(unit=unit).order_by('name')
            unit_submissions = Submission.objects.filter(project__group__in=unit_groups)
            unit_submission_count = unit_submissions.count()
            unit_submitted_count = unit_submissions.exclude(status='submitted').count()
            units.append({
                'id': unit.id,
                'code': unit.code,
                'name': unit.name,
                'course_code': unit.course.code,
                'course_name': unit.course.name,
                'year_of_study': unit.year_of_study,
                'semester': unit.semester,
                'academic_level': unit.academic_level,
                'student_count': students.count(),
                'group_count': unit_groups.count(),
                'assessment_count': Project.objects.filter(group__in=unit_groups).count(),
                'submission_count': unit_submission_count,
                'graded_submission_count': unit_submitted_count,
                'completion_percentage': round((unit_submitted_count / unit_submission_count) * 100) if unit_submission_count else 0,
                'students': [{
                    'id': student.id,
                    'name': f'{student.first_name} {student.last_name}'.strip() or student.username,
                    'email': student.email,
                    'course': student.course,
                    'year_of_study': student.year_of_study,
                    'semester': student.semester,
                } for student in students],
            })

        data = {
            'user': {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'salutation': user.salutation or '',
                'email': user.email,
                'avatar': avatar_url(user),
                'user_type': user.user_type,
                'course': user.course,
                'year_of_study': user.year_of_study,
            },
            'pending_approval': not units and UnitAssignment.objects.filter(
                lecturer=user, status='pending',
            ).exists(),
            'stats': {
                'total_groups': total_groups,
                'total_units': len(units),
                'total_students': total_students,
                'pending_submissions': pending_submissions
            },
            'units': units,
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
            health = get_health_details(group)
            groups.append({
                'id': group.id,
                'name': group.name,
                'course': group.course,
                'year_of_study': group.year_of_study,
                'join_code': group.join_code,
                'description': group.description,
                'unit_id': group.unit_id,
                'unit_code': group.unit.code if group.unit_id else group.unit_code,
                'unit_name': group.unit.name if group.unit_id else '',
                'role': membership.role,
                'is_leader': group.lecturer_id == user.id,
                'members_count': group.members_count,
                'max_members': group.max_members,
                'progress_percentage': progress_percentage,
                'projects': projects,
                'health': health,
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

        academic = None
        units_data = []
        enrolled_course = user.enrolled_course
        if enrolled_course is None and user.course:
            enrolled_course = Course.objects.filter(
                models.Q(code__iexact=user.course) | models.Q(name__iexact=user.course)
            ).first()
        if enrolled_course:
            academic = {
                'course_code': enrolled_course.code,
                'course_name': enrolled_course.name,
                'year_of_study': user.year_of_study,
                'semester': user.semester,
            }
            try:
                year_of_study = int(user.year_of_study)
            except (TypeError, ValueError):
                year_of_study = None
            if year_of_study and user.semester:
                units_data = list(Unit.objects.filter(
                    course=enrolled_course,
                    year_of_study=year_of_study,
                    semester=user.semester,
                ).values('id', 'code', 'name'))

        data = {
            'user': {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'user_type': user.user_type,
                'course': user.course,
                'course_id': user.enrolled_course_id,
                'year_of_study': user.year_of_study,
                'semester': user.semester,
            },
            'stats': {
                'total_groups': total_groups,
                'active_projects': active_projects,
                'pending_tasks': pending_tasks
            },
            'academic': academic,
            'units': units_data,
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
def student_workload_summary(request):
    user = request.user
    if user.user_type != 'student':
        return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

    now = timezone.now()
    next_week = now + timedelta(days=7)
    group_ids = GroupMembership.objects.filter(student=user).values_list('group_id', flat=True)
    groups = Group.objects.filter(id__in=group_ids).distinct().order_by('name')
    result = []
    for group in groups:
        balance = calculate_group_balance(group)
        own_balance = next((member for member in balance['members'] if member['user_id'] == user.id), {})
        due_soon = Task.objects.filter(
            project__group=group,
            assigned_to=user,
            due_date__gte=now,
            due_date__lte=next_week,
        ).exclude(status='completed').annotate(
            has_subtasks=Exists(Task.objects.filter(parent_task_id=OuterRef('pk')))
        ).filter(has_subtasks=False).count()
        due_tasks = Task.objects.filter(
            project__group=group,
            assigned_to=user,
            due_date__gte=now,
            due_date__lte=next_week,
        ).exclude(status='completed').annotate(
            has_subtasks=Exists(Task.objects.filter(parent_task_id=OuterRef('pk')))
        ).filter(has_subtasks=False).select_related('project').order_by('due_date')
        result.append({
            'group_id': group.id,
            'group_name': group.name,
            'points': own_balance.get('points_assigned', 0),
            'fair_share': own_balance.get('fair_share', balance['fair_share']),
            'share_percent': own_balance.get('share_percent', 0),
            'warning_level': own_balance.get('warning_level', 'ok'),
            'suggestion': balance['suggestion'],
            'total_points': balance['total_points'],
            'members': balance['members'],
            'tasks_due_next_7_days': due_soon,
            'upcoming_tasks': [{
                'id': task.id,
                'title': task.title,
                'group_name': group.name,
                'project_name': task.project.title,
                'weight': task.weight,
                'due_date': task.due_date.isoformat(),
                'status': task.status,
            } for task in due_tasks],
        })
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_tasks(request, group_id):
    try:
        user = request.user
        group = Group.objects.get(id=group_id)

        if user.user_type == 'lecturer':
            if not is_supervising_lecturer(user, group):
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:
            if not GroupMembership.objects.filter(group=group, student=user).exists():
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        tasks = Task.objects.filter(project__group=group).select_related('assigned_to', 'project').prefetch_related('comments__author', 'subtasks').order_by('-created_at')

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
                'weight': task.weight,
                'task_weight': task.weight,
                'assigned_to_name': assigned_to_name,
                'assigned_to_id': task.assigned_to_id,
                'project_id': task.project_id,
                'project': task.project.title,
                'project_name': task.project.title,
                'due_date': task.due_date.isoformat() if task.due_date else None,
                'completed_at': task.completed_at.isoformat() if task.completed_at else None,
                'parent_task_id': task.parent_task_id,
                'is_parent': task.subtasks.exists(),
                'is_overdue': bool(task.due_date and task.due_date < timezone.now() and task.status != 'completed'),
                'can_update_progress': can_update_progress or (user.user_type == 'lecturer' and is_supervising_lecturer(user, group)),
                'comments': [{
                    'id': comment.id,
                    'author_id': comment.author_id,
                    'author_name': f"{comment.author.first_name} {comment.author.last_name}".strip() or comment.author.username,
                    'author_type': comment.author.user_type,
                    'content': comment.content,
                    'created_at': comment.created_at.isoformat(),
                } for comment in task.comments.all()],
            })

        return Response(data)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in get_group_tasks: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_task_workspace(request, group_id):
    try:
        group = Group.objects.get(pk=group_id)
        is_member = GroupMembership.objects.filter(group=group, student=request.user).exists()
        is_supervisor = request.user.user_type == 'lecturer' and is_supervising_lecturer(request.user, group)
        if not is_supervisor and not is_member:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        members = GroupMembership.objects.filter(group=group).select_related('student').order_by('joined_at')
        tasks = list(Task.objects.filter(project__group=group).select_related('project', 'assigned_to').order_by('created_at'))
        projects = list(Project.objects.filter(group=group).order_by('created_at'))
        comments_by_task = {}
        comments = TaskComment.objects.filter(task__project__group=group).select_related('author').order_by('created_at')
        for comment in comments:
            comments_by_task.setdefault(comment.task_id, []).append({
                'id': comment.id,
                'author_id': comment.author_id,
                'author_name': f"{comment.author.first_name} {comment.author.last_name}".strip() or comment.author.username,
                'author_type': comment.author.user_type,
                'content': comment.content,
                'created_at': comment.created_at.isoformat(),
            })
        children_by_parent = {}
        for task in tasks:
            children_by_parent.setdefault(task.parent_task_id, []).append(task)
        rollup_cache = {}

        def task_rollup(task):
            if task.id in rollup_cache:
                return rollup_cache[task.id]
            children = children_by_parent.get(task.id, [])
            if children:
                child_rollups = [(child, task_rollup(child)) for child in children]
                total_weight = sum(max(1, child.weight) for child, _ in child_rollups)
                progress = round(sum(result['progress'] * max(1, child.weight) for child, result in child_rollups) / total_weight) if total_weight else 0
                status_value = 'completed' if all(result['progress'] >= 100 for _, result in child_rollups) else 'in_progress' if progress else 'pending'
            else:
                progress = 100 if task.status == 'completed' else task.progress_percentage
                status_value = 'completed' if progress >= 100 else 'in_progress' if progress > 0 or task.status == 'in_progress' else 'pending'
            result = {'progress': progress, 'status': status_value}
            rollup_cache[task.id] = result
            return result

        root_tasks = children_by_parent.get(None, [])
        project_weight = sum(max(1, task.weight) for task in root_tasks)
        project_progress = round(sum(task_rollup(task)['progress'] * max(1, task.weight) for task in root_tasks) / project_weight) if project_weight else 0
        member_data = [{
            'id': membership.student_id,
            'name': f"{membership.student.first_name} {membership.student.last_name}".strip() or membership.student.username,
            'first_name': membership.student.first_name,
            'last_name': membership.student.last_name,
            'role': membership.role,
            'is_leader': membership.student_id == group.lecturer_id,
        } for membership in members]
        task_data = []
        for task in tasks:
            rollup = task_rollup(task)
            task_data.append({
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'status': rollup['status'],
                'board_status': board_status(task, rollup['status']),
                'proposal_status': task.proposal_status,
                'assignment_mode': task.assignment_mode,
                'weight_confirmed': task.weight_confirmed,
                'progress_percentage': rollup['progress'],
                'weight': task.weight,
                'task_weight': task.weight,
                'parent_task_id': task.parent_task_id,
                'is_parent': bool(children_by_parent.get(task.id)),
                'assigned_to_id': task.assigned_to_id,
                'assigned_to_name': f"{task.assigned_to.first_name} {task.assigned_to.last_name}".strip() if task.assigned_to else 'Unassigned',
                'project_name': task.project.title,
                'project_id': task.project_id,
                'project_title': task.project.title,
                'due_date': task.due_date.isoformat() if task.due_date else None,
                'is_overdue': bool(task.due_date and task.due_date < timezone.now() and rollup['status'] != 'completed'),
                'completed_at': task.completed_at.isoformat() if task.completed_at else None,
                'comments': comments_by_task.get(task.id, []),
                'has_subtasks': bool(children_by_parent.get(task.id)),
                'can_update_progress': (
                    task.assigned_to_id == request.user.id
                    or (request.user.user_type == 'lecturer' and is_supervising_lecturer(request.user, group))
                    or GroupMembership.objects.filter(group=group, student=request.user, role='admin').exists()
                ),
                'can_change_weight': weight_change_block(request.user, group, task) is None,
                'proposed_by_id': task.proposed_by_id,
                'can_confirm_weight': weight_confirm_block(request.user, group, task) is None,
            })
        now = timezone.now()
        deadlines = [
            *[due_date for due_date in Task.objects.filter(
                project__group=group, due_date__gte=now
            ).values_list('due_date', flat=True) if due_date],
            *[deadline for deadline in Project.objects.filter(
                group=group, deadline__gte=now
            ).values_list('deadline', flat=True) if deadline],
        ]
        next_deadline = min(deadlines).isoformat() if deadlines else None
        health = get_health_details(group)
        return Response({
            'group': {
                'id': group.id,
                'name': group.name,
                'project_title': tasks[0].project.title if tasks else group.name,
                'unit_code': group.unit_code,
                'unit_name': group.unit.name if group.unit_id else '',
                'join_code': group.join_code,
                'members_count': len(member_data),
                'max_members': group.max_members,
                'leader_id': group.lecturer_id,
                'project_count': len(projects),
                'projects': [{
                    'id': project.id,
                    'title': project.title,
                    'description': project.description,
                    'status': project.status,
                    'deadline': project.deadline.isoformat() if project.deadline else None,
                    'tasks': [task for task in task_data if task['project_id'] == project.id],
                } for project in projects],
                'next_deadline': next_deadline,
            },
            'project_progress': project_progress,
            'project_status': 'completed' if root_tasks and project_progress == 100 else 'in_progress' if project_progress else 'planning',
            'members': member_data,
            'tasks': task_data,
            'health': health,
        })
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error loading task workspace for group {group_id}: {str(e)}")
        return Response({'error': 'Unable to load group workspace'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_activity(request, group_id):
    try:
        group = Group.objects.get(pk=group_id)
        is_supervisor = request.user.user_type == 'lecturer' and is_supervising_lecturer(request.user, group)
        if not is_supervisor and not GroupMembership.objects.filter(
            group=group, student=request.user
        ).exists():
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        activities = TaskActivity.objects.filter(task__project__group=group).select_related(
            'actor', 'task', 'from_user', 'to_user'
        ).order_by('-created_at')[:30]
        return Response([{
            'id': activity.id,
            'task_id': activity.task_id,
            'actor_name': f"{activity.actor.first_name} {activity.actor.last_name}".strip() or activity.actor.username,
            'action': activity.action,
            'task_title': activity.task.title,
            'note': activity.note,
            'old_weight': activity.old_weight,
            'new_weight': activity.new_weight,
            'from_user_name': (
                f"{activity.from_user.first_name} {activity.from_user.last_name}".strip() or activity.from_user.username
            ) if activity.from_user_id else None,
            'to_user_name': (
                f"{activity.to_user.first_name} {activity.to_user.last_name}".strip() or activity.to_user.username
            ) if activity.to_user_id else None,
            'created_at': activity.created_at.isoformat(),
        } for activity in activities])
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error loading activity for group {group_id}: {str(e)}")
        return Response({'error': 'Unable to load group activity'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def get_group_comments(request, group_id):
    try:
        group = Group.objects.get(pk=group_id)
        is_lecturer = request.user.user_type == 'lecturer' and is_supervising_lecturer(request.user, group)
        is_member = GroupMembership.objects.filter(group=group, student=request.user).exists()
        if not is_lecturer and not is_member:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'POST':
            task = Task.objects.filter(
                pk=request.data.get('task_id'), project__group=group
            ).first()
            content = str(request.data.get('content') or '').strip()
            if task is None or not content:
                return Response({'error': 'Choose a group task and enter a comment.'}, status=status.HTTP_400_BAD_REQUEST)
            comment = TaskComment.objects.create(task=task, author=request.user, content=content)
            return Response({
                'id': comment.id,
                'task_id': task.id,
                'task_title': task.title,
                'author_name': f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
                'author_type': request.user.user_type,
                'content': comment.content,
                'created_at': comment.created_at.isoformat(),
            }, status=status.HTTP_201_CREATED)

        comments = TaskComment.objects.filter(task__project__group=group).select_related(
            'author', 'task'
        ).order_by('-created_at')[:50]
        return Response([{
            'id': comment.id,
            'task_id': comment.task_id,
            'task_title': comment.task.title,
            'author_name': f"{comment.author.first_name} {comment.author.last_name}".strip() or comment.author.username,
            'author_type': comment.author.user_type,
            'content': comment.content,
            'created_at': comment.created_at.isoformat(),
        } for comment in comments])
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)


def _serialize_submission(submission):
    return {
        'id': submission.id,
        'project_id': submission.project_id,
        'project_title': submission.project.title,
        'submitted_by_id': submission.submitted_by_id,
        'submitted_by_name': f"{submission.submitted_by.first_name} {submission.submitted_by.last_name}".strip() or submission.submitted_by.username,
        'github_url': submission.github_url,
        'proof_text': submission.proof_text,
        'screenshot_url': submission.screenshot.url if submission.screenshot else None,
        'attachments': [{
            'id': attachment.id,
            'name': attachment.file.name.rsplit('/', 1)[-1],
            'url': attachment.file.url,
        } for attachment in submission.attachments.all()],
        'status': submission.status,
        'submitted_at': submission.submitted_at.isoformat(),
        'feedback': submission.feedback,
        'grade': float(submission.grade) if submission.grade is not None else None,
    }


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def grade_submission(request, submission_id):
    if request.user.user_type != 'lecturer':
        return Response({'error': 'Lecturer access required.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        submission = Submission.objects.select_related('project__group', 'project', 'submitted_by').get(pk=submission_id)
    except Submission.DoesNotExist:
        return Response({'error': 'Submission not found.'}, status=status.HTTP_404_NOT_FOUND)
    if not is_supervising_lecturer(request.user, submission.project.group):
        return Response({'error': 'You can only grade submissions from your groups.'}, status=status.HTTP_403_FORBIDDEN)
    raw_grade = request.data.get('grade')
    try:
        grade = None if raw_grade in (None, '') else float(raw_grade)
        if grade is not None and not 0 <= grade <= 100:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'error': 'Grade must be a number between 0 and 100.'}, status=status.HTTP_400_BAD_REQUEST)
    submission.grade = grade
    submission.feedback = str(request.data.get('feedback', submission.feedback) or '').strip()
    submission.status = str(request.data.get('status') or ('reviewed' if grade is not None else submission.status))
    submission.reviewed_at = timezone.now() if submission.status in ('reviewed', 'approved', 'rejected') else None
    submission.save(update_fields=['grade', 'feedback', 'status', 'reviewed_at'])
    return Response(_serialize_submission(submission))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def group_submissions(request, group_id):
    try:
        group = Group.objects.get(pk=group_id)
        is_supervisor = request.user.user_type == 'lecturer' and is_supervising_lecturer(request.user, group)
        if not is_supervisor and not GroupMembership.objects.filter(
            group=group, student=request.user
        ).exists():
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            submissions = Submission.objects.filter(project__group=group).select_related(
                'project', 'submitted_by'
            ).prefetch_related('attachments').order_by('-submitted_at')
            return Response([_serialize_submission(submission) for submission in submissions])

        proof_text = str(request.data.get('proof_text') or '').strip()
        github_url = str(request.data.get('github_url') or '').strip()
        project_id = request.data.get('project_id')
        if not proof_text:
            return Response({'error': 'Add a short description of the submission.'}, status=status.HTTP_400_BAD_REQUEST)

        project = Project.objects.filter(pk=project_id, group=group).first() if project_id else Project.objects.filter(group=group).order_by('created_at').first()
        if project_id and project is None:
            return Response({'error': 'Select a project in this group.'}, status=status.HTTP_400_BAD_REQUEST)
        if project is None:
            project = Project.objects.create(
                group=group,
                title=group.name,
                description='Group submission project',
            )

        screenshot = request.FILES.get('screenshot')
        attachments = request.FILES.getlist('attachments')
        if len(attachments) > 5:
            return Response({'error': 'Add no more than 5 documents or photos.'}, status=status.HTTP_400_BAD_REQUEST)
        allowed_extensions = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp'}
        for uploaded_file in [*attachments, *([screenshot] if screenshot else [])]:
            extension = uploaded_file.name.rsplit('.', 1)[-1].lower() if '.' in uploaded_file.name else ''
            if extension not in allowed_extensions:
                return Response({'error': 'Use a PDF, Office document, text, CSV, or image file.'}, status=status.HTTP_400_BAD_REQUEST)
            if uploaded_file.size > 10 * 1024 * 1024:
                return Response({'error': 'Each file must be 10 MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)

        submission = Submission.objects.create(
            project=project,
            submitted_by=request.user,
            github_url=github_url or None,
            proof_text=proof_text,
            screenshot=screenshot,
        )
        SubmissionAttachment.objects.bulk_create([
            SubmissionAttachment(submission=submission, file=uploaded_file)
            for uploaded_file in attachments
        ])
        submission = Submission.objects.select_related('project', 'submitted_by').prefetch_related('attachments').get(pk=submission.pk)
        return Response(_serialize_submission(submission), status=status.HTTP_201_CREATED)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error handling submissions for group {group_id}: {str(e)}")
        return Response({'error': 'Unable to process submission'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _task_balance_warning(group, assigned_to_id, weight, *, exclude_task_id=None):
    balance = calculate_group_balance(
        group,
        exclude_task_id=exclude_task_id,
        task_weight_to_add=weight,
        assignee_id=assigned_to_id,
    )
    if balance['total_points'] < 6:
        return {'level': 'too_early', 'suggestion': '', 'total_points': balance['total_points'], 'members': balance['members']}
    if any(member['warning_level'] in ('warning', 'critical') for member in balance['members']):
        return {
            'level': 'critical' if any(member['warning_level'] == 'critical' for member in balance['members']) else 'warning',
            'suggestion': balance['suggestion'] or 'This assignment would create an uneven workload.',
            'total_points': balance['total_points'],
            'members': balance['members'],
        }
    return {'level': 'ok', 'suggestion': '', 'total_points': balance['total_points'], 'members': balance['members']}


def _parse_required_task_due_date(value):
    if not value:
        return None
    due_date = parse_datetime(str(value))
    if due_date is None:
        parsed_date = parse_date(str(value))
        if parsed_date:
            due_date = timezone.make_aware(datetime.combine(parsed_date, time.min))
    if due_date is not None and timezone.is_naive(due_date):
        due_date = timezone.make_aware(due_date)
    return due_date


def _sync_parent_task_rollups(task):
    parent = task.parent_task
    while parent is not None:
        children = list(parent.subtasks.all())
        total_weight = sum(max(1, child.weight) for child in children)
        progress = round(
            sum(
                (100 if child.status == 'completed' else child.progress_percentage)
                * max(1, child.weight)
                for child in children
            ) / total_weight
        ) if total_weight else 0
        next_status = 'completed' if children and all(
            child.status == 'completed' or (child.subtasks.exists() and child.progress_percentage == 100)
            for child in children
        ) else 'in_progress' if progress else 'pending'
        if next_status == 'completed' and parent.status != 'completed':
            parent.completed_at = timezone.now()
        elif next_status != 'completed':
            parent.completed_at = None
        parent.status = next_status
        parent.progress_percentage = progress
        parent.save(update_fields=['status', 'progress_percentage', 'completed_at', 'updated_at'])
        parent = parent.parent_task


def _group_task_participant(user, group):
    if user.user_type == 'lecturer':
        return is_supervising_lecturer(user, group)
    return GroupMembership.objects.filter(group=group, student=user).exists()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_group_task(request, group_id):
    try:
        group = Group.objects.get(pk=group_id)
        if not _group_task_participant(request.user, group):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        title = str(request.data.get('title') or '').strip()
        description = str(request.data.get('description') or '').strip()
        try:
            weight = int(request.data.get('weight', 1))
            assigned_to_id = int(request.data.get('assigned_to_id'))
            if not title or weight < WEIGHT_MIN or weight > WEIGHT_MAX:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'error': f'A task title, group member, and weight from {WEIGHT_MIN} to {WEIGHT_MAX} are required.'}, status=status.HTTP_400_BAD_REQUEST)

        assigned_to = User.objects.filter(
            pk=assigned_to_id,
            group_memberships__group=group,
        ).first()
        if assigned_to is None:
            return Response({'error': 'Assign the task to a member of this group.'}, status=status.HTTP_400_BAD_REQUEST)

        due_date_value = request.data.get('due_date')
        due_date = _parse_required_task_due_date(due_date_value)
        if due_date is None:
            message = 'A due date is required.' if not due_date_value else 'Enter a valid due date.'
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

        project_id = request.data.get('project_id')
        project = Project.objects.filter(pk=project_id, group=group).first() if project_id else None
        if project_id and project is None:
            return Response({'error': 'Choose a project in this group.'}, status=status.HTTP_400_BAD_REQUEST)
        if project is None:
            project = Project.objects.filter(group=group).order_by('created_at').first()
        if project is None:
            project = Project.objects.create(group=group, title=group.name, description='Group task workspace')
        parent_task = None
        parent_task_id = request.data.get('parent_task_id')
        if parent_task_id:
            parent_task = Task.objects.filter(pk=parent_task_id, project=project).first()
            if parent_task is None:
                return Response({'error': 'Parent task must belong to this group project.'}, status=status.HTTP_400_BAD_REQUEST)
        projection = _task_balance_warning(group, assigned_to.id, weight)
        if projection['level'] in ('warning', 'critical') and request.data.get('confirm_override') is not True:
            return Response({
                'balance_warning': projection['suggestion'],
                'projection': projection,
                'requires_confirmation': True,
            }, status=status.HTTP_200_OK)

        task = Task.objects.create(
            project=project,
            title=title,
            description=description,
            assigned_to=assigned_to,
            weight=weight,
            task_weight=weight,
            parent_task=parent_task,
            due_date=due_date,
        )
        reason = str(request.data.get('override_reason') or '').strip()
        TaskActivity.objects.create(
            task=task,
            actor=request.user,
            to_user=assigned_to,
            action='created',
            note=reason or f"Created and assigned to {assigned_to.first_name} {assigned_to.last_name}".strip(),
        )
        TaskActivity.objects.create(
            task=task,
            actor=request.user,
            to_user=assigned_to,
            action='assigned',
            note=f"Assigned to {assigned_to.first_name} {assigned_to.last_name}".strip(),
        )
        # Notify assigned user
        if assigned_to.id != request.user.id:
            Notification.objects.create(
                user=assigned_to,
                notification_type='task_assigned',
                title='New task assigned',
                message=f'{request.user.first_name} {request.user.last_name} assigned you to "{task.title}" in {group.name}.',
                related_task=task,
                related_group=group,
            )
        return Response({
            'task': {
                'id': task.id,
                'title': task.title,
                'description': task.description,
                'status': task.status,
                'progress_percentage': task.progress_percentage,
                'weight': task.weight,
                'assigned_to_id': task.assigned_to_id,
                'assigned_to_name': f"{assigned_to.first_name} {assigned_to.last_name}".strip(),
                'project_name': project.title,
                'project_id': project.id,
                'due_date': task.due_date.isoformat() if task.due_date else None,
                'parent_task_id': task.parent_task_id,
            }
        }, status=status.HTTP_201_CREATED)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error assigning task in group {group_id}: {str(e)}")
        return Response({'error': 'Unable to assign task'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reassign_group_task(request, group_id, task_id):
    try:
        group = Group.objects.get(pk=group_id)
        if not _group_task_participant(request.user, group):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        task = Task.objects.select_related('assigned_to').get(pk=task_id, project__group=group)
        try:
            assigned_to_id = int(request.data.get('assigned_to_id'))
        except (TypeError, ValueError):
            return Response({'error': 'Choose a group member'}, status=status.HTTP_400_BAD_REQUEST)
        assigned_to = User.objects.filter(pk=assigned_to_id, group_memberships__group=group).first()
        if assigned_to is None:
            return Response({'error': 'Assign the task to a member of this group.'}, status=status.HTTP_400_BAD_REQUEST)
        if assigned_to.id == task.assigned_to_id:
            return Response({'error': 'Choose a different assignee.'}, status=status.HTTP_400_BAD_REQUEST)

        projection = _task_balance_warning(group, assigned_to.id, task.weight, exclude_task_id=task.id)
        if projection['level'] in ('warning', 'critical') and request.data.get('confirm_override') is not True:
            return Response({
                'balance_warning': projection['suggestion'],
                'projection': projection,
                'requires_confirmation': True,
            }, status=status.HTTP_200_OK)

        previous_assignee = task.assigned_to
        task.assigned_to = assigned_to
        task.save(update_fields=['assigned_to'])
        reason = str(request.data.get('override_reason') or '').strip()
        TaskActivity.objects.create(
            task=task,
            actor=request.user,
            from_user=previous_assignee,
            to_user=assigned_to,
            action='reassigned',
            note=reason or f"Reassigned to {assigned_to.first_name} {assigned_to.last_name}".strip(),
        )
        # Notify new assignee
        if assigned_to.id != request.user.id:
            Notification.objects.create(
                user=assigned_to,
                notification_type='task_assigned',
                title='Task reassigned to you',
                message=f'{request.user.first_name} {request.user.last_name} reassigned "{task.title}" to you in {group.name}.',
                related_task=task,
                related_group=group,
            )
        # Notify previous assignee
        if previous_assignee and previous_assignee.id != request.user.id and previous_assignee.id != assigned_to.id:
            Notification.objects.create(
                user=previous_assignee,
                notification_type='task_assigned',
                title='Task reassigned',
                message=f'{request.user.first_name} {request.user.last_name} reassigned "{task.title}" from you to {assigned_to.first_name} {assigned_to.last_name} in {group.name}.',
                related_task=task,
                related_group=group,
            )
        return Response({'task': {'id': task.id, 'assigned_to_id': assigned_to.id, 'assigned_to_name': f"{assigned_to.first_name} {assigned_to.last_name}".strip()}})
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error reassigning task {task_id} in group {group_id}: {str(e)}")
        return Response({'error': 'Unable to reassign task'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def get_group_balance(request, group_id):
    """
    Workload balance per member: each member's share of the group's total
    assigned task weight (points), with warnings when someone is carrying
    more than fair share + 15 or + 25 points. Used for the Task Weigher /
    at-risk workload view on both dashboards.
    """
    try:
        user = request.user
        group = Group.objects.get(id=group_id)

        if user.user_type == 'lecturer':
            if not is_supervising_lecturer(user, group):
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:
            if not GroupMembership.objects.filter(group=group, student=user).exists():
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'POST':
            try:
                weight = int(request.data.get('weight', 1))
                assignee_id = int(request.data.get('assigned_to_id'))
                if weight < WEIGHT_MIN or weight > WEIGHT_MAX:
                    raise ValueError
            except (TypeError, ValueError):
                return Response({'error': f'Choose a group member and task weight from {WEIGHT_MIN} to {WEIGHT_MAX}.'}, status=status.HTTP_400_BAD_REQUEST)
            assignee = GroupMembership.objects.filter(group=group, student_id=assignee_id).first()
            if assignee is None:
                return Response({'error': 'Assign the task to a member of this group.'}, status=status.HTTP_400_BAD_REQUEST)
            exclude_task_id = request.data.get('exclude_task_id')
            if exclude_task_id:
                task_exists = Task.objects.filter(pk=exclude_task_id, project__group=group).exists()
                if not task_exists:
                    return Response({'error': 'Task not found in this group.'}, status=status.HTTP_404_NOT_FOUND)
            balance = calculate_group_balance(
                group,
                exclude_task_id=exclude_task_id,
                task_weight_to_add=weight,
                assignee_id=assignee_id,
            )
            warning_level = (
                'too_early' if balance['total_points'] < 6 else
                'critical' if any(member['warning_level'] == 'critical' for member in balance['members']) else
                'warning' if any(member['warning_level'] == 'warning' for member in balance['members']) else
                'ok'
            )
            return Response({
                **balance,
                'warning_level': warning_level,
                'requires_confirmation': warning_level in ('warning', 'critical'),
            })

        balance = calculate_group_balance(group)
        return Response({
            'group_id': group.id,
            **balance,
            'at_risk': any(
                member['warning_level'] in ('warning', 'critical')
                for member in balance['members']
            ),
        })
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in get_group_balance: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_task(request, group_id):
    try:
        user = request.user
        group = Group.objects.get(id=group_id)

        if user.user_type != 'lecturer' or not is_supervising_lecturer(user, group):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        title = request.data.get('title', '').strip()
        description = request.data.get('description', '').strip()
        project_id = request.data.get('project_id')
        assigned_to_id = request.data.get('assigned_to_id')
        due_date = request.data.get('due_date')
        weight = request.data.get('weight', 1)

        if not title:
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)

        parsed_due_date = _parse_required_task_due_date(due_date)
        if parsed_due_date is None:
            message = 'A due date is required.' if not due_date else 'Enter a valid due date.'
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

        try:
            weight = int(weight)
            if not (WEIGHT_MIN <= weight <= WEIGHT_MAX):
                raise ValueError
        except (TypeError, ValueError):
            return Response({'error': f'Weight must be an integer between {WEIGHT_MIN} and {WEIGHT_MAX}'}, status=status.HTTP_400_BAD_REQUEST)

        project = Project.objects.get(id=project_id, group=group)
        assigned_to = None
        if not assigned_to_id:
            return Response({'error': 'Assign the task to a group member.'}, status=status.HTTP_400_BAD_REQUEST)
        assigned_to = User.objects.filter(
            id=assigned_to_id,
            group_memberships__group=group,
        ).first()
        if assigned_to is None:
            return Response({'error': 'Assign the task to a group member.'}, status=status.HTTP_400_BAD_REQUEST)

        task = Task.objects.create(
            title=title,
            description=description,
            project=project,
            assigned_to=assigned_to,
            due_date=parsed_due_date,
            weight=weight,
            task_weight=weight,
        )

        TaskActivity.objects.create(
            task=task,
            actor=user,
            to_user=assigned_to,
            action='created',
            note=f"Created and assigned to {assigned_to.first_name} {assigned_to.last_name}".strip(),
        )
        if assigned_to:
            TaskActivity.objects.create(
                task=task,
                actor=user,
                to_user=assigned_to,
                action='assigned',
                note=f"Assigned to {assigned_to.first_name} {assigned_to.last_name}".strip()
            )

        return Response({
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'progress_percentage': task.progress_percentage,
            'weight': task.weight,
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
            if not is_supervising_lecturer(user, task.project.group):
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        elif task.assigned_to != user and not GroupMembership.objects.filter(
            group=task.project.group, student=user, role='admin'
        ).exists():
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        if task.subtasks.exists():
            return Response({'error': 'Parent task progress is determined by its micro-tasks.'}, status=status.HTTP_400_BAD_REQUEST)

        new_status = request.data.get('status')
        if new_status not in ['pending', 'in_progress', 'completed']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = task.status
        task.status = new_status
        if new_status == 'completed':
            if old_status != 'completed' or task.completed_at is None:
                task.completed_at = timezone.now()
        else:
            task.completed_at = None
        task.progress_percentage = 100 if new_status == 'completed' else 0
        task.save()
        _sync_parent_task_rollups(task)

        activity_action = {
            'in_progress': 'started',
            'completed': 'completed',
        }.get(new_status)
        if old_status != new_status and activity_action:
            TaskActivity.objects.create(
                task=task,
                actor=user,
                action=activity_action,
                note=f"{old_status} -> {new_status}"
            )

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
            if not is_supervising_lecturer(user, task.project.group):
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        elif task.assigned_to != user and not GroupMembership.objects.filter(
            group=task.project.group, student=user, role='admin'
        ).exists():
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        if task.subtasks.exists():
            return Response({'error': 'Parent task progress is determined by its micro-tasks.'}, status=status.HTTP_400_BAD_REQUEST)

        progress_percentage = request.data.get('progress_percentage')
        if progress_percentage is None:
            return Response({'error': 'Progress percentage is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            progress_percentage = int(progress_percentage)
            if not (0 <= progress_percentage <= 100):
                raise ValueError
        except ValueError:
            return Response({'error': 'Progress percentage must be an integer between 0 and 100'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = task.status
        task.progress_percentage = progress_percentage
        if progress_percentage == 100:
            task.status = 'completed'
            if old_status != 'completed' or task.completed_at is None:
                task.completed_at = timezone.now()
        else:
            task.status = 'in_progress' if progress_percentage else 'pending'
            task.completed_at = None
        task.save()
        _sync_parent_task_rollups(task)

        progress_action = {
            'in_progress': 'started',
            'completed': 'completed',
        }.get(task.status)
        if task.status != old_status and progress_action:
            TaskActivity.objects.create(
                task=task,
                actor=user,
                action=progress_action,
                note=f"{old_status} -> {task.status}; progress {progress_percentage}%",
            )

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
                'created_at': notification.created_at.isoformat(),
                'related_group_id': notification.related_group_id,
                'related_invite_id': notification.related_invite_id,
                'related_join_request_id': notification.related_join_request_id,
                'related_chat_room_id': notification.related_chat_room_id
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
            if not is_supervising_lecturer(user, group):
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

        lecturer_units = approved_units_for_lecturer(user, current_term())
        students = User.objects.filter(
            user_type='student',
            enrollments__unit__in=lecturer_units,
            enrollments__semester=current_term(),
        ).distinct().values(
            'id', 'first_name', 'last_name', 'email', 'course', 'year_of_study'
        ).order_by('first_name', 'last_name', 'id')

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
def get_chat_contacts(request):
    user = request.user
    if user.user_type == 'lecturer':
        group_ids = Group.objects.filter(lecturer=user).values_list('id', flat=True)
    else:
        group_ids = GroupMembership.objects.filter(student=user).values_list('group_id', flat=True)

    member_ids = GroupMembership.objects.filter(group_id__in=group_ids).values_list('student_id', flat=True)
    group_owner_ids = Group.objects.filter(id__in=group_ids).values_list('lecturer_id', flat=True)
    contacts = User.objects.filter(
        models.Q(id__in=member_ids) | models.Q(id__in=group_owner_ids)
    ).exclude(id=user.id).distinct().order_by('first_name', 'last_name', 'username')

    return Response([{
        'id': contact.id,
        'first_name': contact.first_name,
        'last_name': contact.last_name,
        'email': contact.email,
        'user_type': contact.user_type,
    } for contact in contacts])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_chat_rooms(request):
    try:
        user = request.user
        groups = Group.objects.filter(lecturer=user) if user.user_type == 'lecturer' else Group.objects.filter(memberships__student=user)
        group_chat_rooms = []
        for group in groups.distinct():
            room, _ = ChatRoom.objects.get_or_create(group=group, defaults={'chat_type': 'group'})
            group_chat_rooms.append(room)
        direct_chat_rooms = ChatRoom.objects.filter(chat_type='direct').filter(
            models.Q(user1=user) | models.Q(user2=user)
        ).select_related('user1', 'user2')

        data = []

        for room in group_chat_rooms:
            last_message = Message.objects.filter(chat_room=room).select_related('sender').order_by('-timestamp').first()
            unread_count = Notification.objects.filter(
                user=user, notification_type='message_received', related_chat_room=room, is_read=False
            ).count()
            data.append({
                'id': room.id,
                'type': 'group',
                'name': room.group.name,
                'group_id': room.group.id,
                'join_code': room.group.join_code,
                'description': room.group.description,
                'can_delete': room.group.lecturer_id == user.id,
                'unread_count': unread_count,
                'last_message': last_message.content if last_message else None,
                'last_message_time': last_message.timestamp.isoformat() if last_message else None,
                'last_message_sender': f"{last_message.sender.first_name} {last_message.sender.last_name}" if last_message else None
            })

        for room in direct_chat_rooms:
            other_user = room.user2 if room.user1 == user else room.user1
            last_message = Message.objects.filter(chat_room=room).select_related('sender').order_by('-timestamp').first()
            unread_count = Notification.objects.filter(
                user=user, notification_type='message_received', related_chat_room=room, is_read=False
            ).count()
            data.append({
                'id': room.id,
                'type': 'direct',
                'name': f"{other_user.first_name} {other_user.last_name}",
                'other_user_id': other_user.id,
                'can_delete': True,
                'unread_count': unread_count,
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
                if not is_supervising_lecturer(user, chat_room.group):
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
                'timestamp': msg.timestamp.isoformat(),
                'attachment_name': msg.attachment.name.rsplit('/', 1)[-1] if msg.attachment else None,
                'attachment_url': f'/api/accounts/chat/messages/{msg.id}/attachment/' if msg.attachment else None,
            })

        Notification.objects.filter(
            user=user,
            notification_type='message_received',
            related_chat_room=chat_room,
            is_read=False,
        ).update(is_read=True)
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
        content = str(request.data.get('content') or '').strip()
        uploaded_file = request.FILES.get('file')
        voice_note = request.FILES.get('voice_note')
        if not content and not uploaded_file and not voice_note:
            return Response({'error': 'Write a message, attach a document, or record a voice note.'}, status=status.HTTP_400_BAD_REQUEST)

        if uploaded_file:
            allowed_extensions = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'}
            extension = uploaded_file.name.rsplit('.', 1)[-1].lower() if '.' in uploaded_file.name else ''
            if extension not in allowed_extensions:
                return Response({'error': 'Unsupported file type. Attach a PDF, Office document, text, CSV, or image.'}, status=status.HTTP_400_BAD_REQUEST)
            if uploaded_file.size > 10 * 1024 * 1024:
                return Response({'error': 'Files must be 10 MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)

        if voice_note:
            voice_extension = voice_note.name.rsplit('.', 1)[-1].lower() if '.' in voice_note.name else ''
            if voice_extension != 'webm':
                return Response({'error': 'Voice notes must be in webm format.'}, status=status.HTTP_400_BAD_REQUEST)
            if voice_note.size > 5 * 1024 * 1024:
                return Response({'error': 'Voice notes must be 5 MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)

        chat_room = ChatRoom.objects.get(id=room_id)

        if chat_room.chat_type == 'group':
            if user.user_type == 'lecturer':
                if not is_supervising_lecturer(user, chat_room.group):
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
            content=content,
            attachment=uploaded_file,
            voice_note=voice_note,
        )

        recipients = []
        if chat_room.chat_type == 'direct':
            recipient = chat_room.user2 if chat_room.user1_id == user.id else chat_room.user1
            if recipient:
                recipients.append(recipient)
        else:
            recipients.extend(
                membership.student
                for membership in chat_room.group.memberships.select_related('student').exclude(student=user)
            )
            supervisors = supervising_lecturers(chat_room.group).exclude(id=user.id)
            recipients.extend(supervisors)
        preview = content[:100] + ('...' if len(content) > 100 else '')
        for recipient in recipients:
            Notification.objects.create(
                user=recipient,
                notification_type='message_received',
                title=(f'New message in {chat_room.group.name}' if chat_room.chat_type == 'group'
                       else f'New message from {user.first_name} {user.last_name}'),
                message=preview or 'Shared a file',
                related_chat_room=chat_room,
                related_message=message,
            )
        # Handle @mentions in group chats
        if chat_room.chat_type == 'group' and content:
            import re
            mentions = re.findall(r'@(\w+)', content)
            for username in mentions:
                mentioned_user = User.objects.filter(username__iexact=username).first()
                if mentioned_user and mentioned_user != user:
                    # Check if mentioned user is in the group
                    is_member = GroupMembership.objects.filter(group=chat_room.group, student=mentioned_user).exists()
                    is_lecturer = is_supervising_lecturer(mentioned_user, chat_room.group)
                    if is_member or is_lecturer:
                        Notification.objects.create(
                            user=mentioned_user,
                            notification_type='mention',
                            title='You were mentioned',
                            message=f'{user.first_name} {user.last_name} mentioned you in {chat_room.group.name}: "{preview}"',
                            related_chat_room=chat_room,
                            related_message=message,
                        )

        response_data = {
            'id': message.id,
            'content': message.content,
            'sender': {
                'id': message.sender.id,
                'first_name': message.sender.first_name,
                'last_name': message.sender.last_name,
                'user_type': message.sender.user_type
            },
            'timestamp': message.timestamp.isoformat(),
            'attachment_name': message.attachment.name.rsplit('/', 1)[-1] if message.attachment else None,
            'attachment_url': f'/api/accounts/chat/messages/{message.id}/attachment/' if message.attachment else None,
            'voice_note_url': f'/api/accounts/chat/messages/{message.id}/voice-note/' if message.voice_note else None,
        }
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f'chat_{chat_room.id}',
                    {'type': 'chat_message', 'message_data': response_data},
                )
        except Exception:
            logger.exception('Unable to broadcast chat message to WebSocket clients')

        return Response(response_data, status=status.HTTP_201_CREATED)
    except ChatRoom.DoesNotExist:
        return Response({'error': 'Chat room not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in send_message: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_message_attachment(request, message_id):
    try:
        message = Message.objects.select_related('chat_room__group').get(pk=message_id)
        chat_room = message.chat_room
        user = request.user
        if chat_room.chat_type == 'group':
            allowed = is_supervising_lecturer(user, chat_room.group) or GroupMembership.objects.filter(
                group=chat_room.group, student=user
            ).exists()
        else:
            allowed = chat_room.user1_id == user.id or chat_room.user2_id == user.id
        if not allowed:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        if not message.attachment:
            return Response({'error': 'Attachment not found'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            message.attachment.open('rb'),
            as_attachment=True,
            filename=message.attachment.name.rsplit('/', 1)[-1],
        )
    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error downloading chat attachment: {str(e)}")
        return Response({'error': 'Unable to download attachment'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_message_voice_note(request, message_id):
    try:
        message = Message.objects.select_related('chat_room__group').get(pk=message_id)
        chat_room = message.chat_room
        user = request.user
        if chat_room.chat_type == 'group':
            allowed = is_supervising_lecturer(user, chat_room.group) or GroupMembership.objects.filter(
                group=chat_room.group, student=user
            ).exists()
        else:
            allowed = chat_room.user1_id == user.id or chat_room.user2_id == user.id
        if not allowed:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        if not message.voice_note:
            return Response({'error': 'Voice note not found'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            message.voice_note.open('rb'),
            as_attachment=False,
            filename=message.voice_note.name.rsplit('/', 1)[-1],
        )
    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error downloading voice note: {str(e)}")
        return Response({'error': 'Unable to download voice note'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_chat_room(request, room_id):
    try:
        chat_room = ChatRoom.objects.get(pk=room_id)
        if chat_room.chat_type != 'direct':
            return Response({'error': 'Delete the group to remove its group chat'}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.id not in (chat_room.user1_id, chat_room.user2_id):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        attachment_names = list(Message.objects.filter(
            chat_room=chat_room,
        ).exclude(attachment='').values_list('attachment', flat=True))
        with transaction.atomic():
            chat_room.delete()
            transaction.on_commit(lambda: [default_storage.delete(name) for name in attachment_names])
        return Response(status=status.HTTP_204_NO_CONTENT)
    except ChatRoom.DoesNotExist:
        return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error deleting chat room {room_id}: {str(e)}")
        return Response({'error': 'Unable to delete conversation'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_or_create_direct_chat(request):
    try:
        user = request.user
        contact_id = request.data.get('user_id') or request.data.get('student_id')

        if not contact_id:
            return Response({'error': 'A contact is required'}, status=status.HTTP_400_BAD_REQUEST)

        contact = User.objects.get(id=contact_id)
        if contact.id == user.id:
            return Response({'error': 'You cannot start a chat with yourself'}, status=status.HTTP_400_BAD_REQUEST)

        if user.user_type == 'lecturer':
            active_term = current_term()
            taught_units = approved_units_for_lecturer(user, active_term)
            supervised_group_ids = Group.objects.filter(
                unit_id__in=taught_units.values('id')
            ).values_list('id', flat=True)
            enrollment_qs = StudentEnrollment.objects.filter(student=contact, unit__in=taught_units)
            if active_term is not None:
                enrollment_qs = enrollment_qs.filter(semester=active_term)
            can_contact = (
                GroupMembership.objects.filter(group_id__in=supervised_group_ids, student=contact).exists()
                or enrollment_qs.exists()
            )
        else:
            shared_group_ids = GroupMembership.objects.filter(student=user).values_list('group_id', flat=True)
            shared_group_unit_ids = Group.objects.filter(id__in=shared_group_ids).values_list('unit_id', flat=True)
            can_contact = (
                GroupMembership.objects.filter(group_id__in=shared_group_ids, student=contact).exists()
                or UnitAssignment.objects.filter(
                    lecturer=contact, status='approved', unit_id__in=shared_group_unit_ids,
                ).exists()
                or UnitAssignment.objects.filter(
                    lecturer=contact, status='approved',
                    unit__student_enrollments__student=user,
                ).exists()
            )
        if not can_contact:
            return Response({'error': 'You can only start a chat with someone in one of your groups.'}, status=status.HTTP_403_FORBIDDEN)

        first_user, second_user = sorted((user, contact), key=lambda account: account.id)
        chat_room, _ = ChatRoom.objects.get_or_create(
            chat_type='direct',
            user1=first_user,
            user2=second_user,
        )

        return Response({
            'id': chat_room.id,
            'type': 'direct',
            'name': f"{contact.first_name} {contact.last_name}".strip() or contact.username,
            'other_user_id': contact.id,
            'last_message': None,
        })
    except User.DoesNotExist:
        return Response({'error': 'Contact not found'}, status=status.HTTP_404_NOT_FOUND)
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
        room = ChatRoom.objects.get(pk=room_id)
        if room.chat_type == 'group':
            allowed = is_supervising_lecturer(user, room.group) or GroupMembership.objects.filter(
                group=room.group, student=user
            ).exists()
        else:
            allowed = room.user1_id == user.id or room.user2_id == user.id
        if not allowed:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        Notification.objects.filter(
            user=user,
            notification_type='message_received',
            related_chat_room_id=room_id,
            is_read=False
        ).update(is_read=True)

        return Response({'message': 'Notifications marked as read'})
    except ChatRoom.DoesNotExist:
        return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in mark_room_notifications_read: {str(e)}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_group_view(request):
    user = request.user
    if user.user_type not in ('student', 'lecturer'):
        return Response({'error': 'Only students and lecturers can create groups'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    name = data.get('name')
    course = data.get('course')
    year_of_study = data.get('year_of_study')
    description = data.get('description', '')
    unit = None
    invited_usernames = data.get('invite_usernames') or []
    if isinstance(invited_usernames, str):
        invited_usernames = invited_usernames.split(',')
    invited_usernames = list(dict.fromkeys(
        str(value).strip().upper() for value in invited_usernames if str(value).strip()
    ))

    try:
        max_members = int(data.get('max_members'))
        if max_members < 2 or max_members > 32767:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'error': 'Choose a group size of at least 2 members.'}, status=status.HTTP_400_BAD_REQUEST)

    if data.get('unit_id'):
        try:
            unit = Unit.objects.select_related('course').get(pk=data.get('unit_id'))
        except (Unit.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'Select a valid unit'}, status=status.HTTP_400_BAD_REQUEST)
        if user.user_type == 'student' and user.enrolled_course_id and unit.course_id != user.enrolled_course_id:
            return Response({'error': 'Select a unit from your enrolled programme'}, status=status.HTTP_400_BAD_REQUEST)
        if user.user_type == 'lecturer' and not approved_units_for_lecturer(
            user, current_term()
        ).filter(pk=unit.pk).exists():
            return Response({'error': 'Select one of your assigned units'}, status=status.HTTP_403_FORBIDDEN)
        course = unit.course.name
        year_of_study = unit.year_of_study

    if not name or not course or not year_of_study:
        return Response({'error': 'Name, course, and year of study are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        year_of_study = str(int(year_of_study))
        if int(year_of_study) not in range(1, 5):
            raise ValueError
    except (TypeError, ValueError):
        return Response({'error': 'Year of study must be between 1 and 4'}, status=status.HTTP_400_BAD_REQUEST)

    course_record = unit.course if unit else Course.objects.filter(
        models.Q(code__iexact=str(course).strip()) | models.Q(name__iexact=str(course).strip())
    ).first()
    invitees = []
    for username in invited_usernames:
        invitee = User.objects.filter(username__iexact=username, user_type='student').first()
        if invitee is None:
            return Response({'error': f'No student account was found for {username}.'}, status=status.HTTP_400_BAD_REQUEST)
        if invitee.id == user.id:
            continue
        expected_course_values = {
            str(course).strip().casefold(),
            course_record.code.casefold() if course_record else '',
            course_record.name.casefold() if course_record else '',
        }
        same_course = (
            invitee.enrolled_course_id == course_record.id
            if course_record and invitee.enrolled_course_id
            else invitee.course.strip().casefold() in expected_course_values
        )
        if not same_course or str(invitee.year_of_study) != year_of_study:
            return Response({'error': f'{username} is not in this programme and year.'}, status=status.HTTP_400_BAD_REQUEST)
        invitees.append(invitee)
    if 1 + len(invitees) > max_members:
        return Response({'error': 'The invited classmates exceed the selected group size.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            join_code = get_random_string(6, allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
            while Group.objects.filter(join_code=join_code).exists():
                join_code = get_random_string(6, allowed_chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
            group = Group.objects.create(
                name=str(name).strip(),
                course=str(course).strip(),
                year_of_study=year_of_study,
                description=str(description or '').strip(),
                join_code=join_code,
                    unit=unit,
                    unit_code=unit.code if unit else '',
                    term=current_term(),
                    lecturer=user,
                    max_members=max_members,
                )
            if user.user_type == 'student':
                GroupMembership.objects.create(group=group, student=user, role='member')
            GroupMembership.objects.bulk_create([
                GroupMembership(group=group, student=invitee, role='member')
                for invitee in invitees
            ])
            ChatRoom.objects.get_or_create(group=group, defaults={'chat_type': 'group'})

        return Response({
            'message': 'Group created successfully',
            'group': {
                'id': group.id,
                'name': group.name,
                'course': group.course,
                'year_of_study': group.year_of_study,
                'description': group.description,
                'join_code': group.join_code,
                'unit_id': group.unit_id,
                'unit_code': group.unit.code if group.unit_id else group.unit_code,
                'unit_name': group.unit.name if group.unit_id else '',
                'lecturer': f"{user.first_name} {user.last_name}",
                'leader_id': user.id,
                'is_leader': True,
                'max_members': group.max_members,
                'members_count': 1 + len(invitees),
                'projects': [],
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error creating group: {str(e)}")
        return Response({'error': 'Failed to create group'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_group_view(request, group_id):
    try:
        group = Group.objects.get(pk=group_id)
        if group.lecturer_id != request.user.id and not is_supervising_lecturer(request.user, group):
            return Response({'error': 'Only the group creator or a supervising lecturer can delete this group.'}, status=status.HTTP_403_FORBIDDEN)

        attachment_names = list(Message.objects.filter(
            chat_room__group=group,
        ).exclude(attachment='').values_list('attachment', flat=True))
        with transaction.atomic():
            group.delete()
            transaction.on_commit(lambda: [default_storage.delete(name) for name in attachment_names])
        return Response(status=status.HTTP_204_NO_CONTENT)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error deleting group {group_id}: {str(e)}")
        return Response({'error': 'Unable to delete group'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_chat_room(request, group_id):
    try:
        user = request.user
        group = Group.objects.get(id=group_id)

        if user.user_type == 'lecturer':
            if not is_supervising_lecturer(user, group):
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        else:
            if not GroupMembership.objects.filter(group=group, student=user).exists():
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        chat_room, _ = ChatRoom.objects.get_or_create(group=group, defaults={'chat_type': 'group'})

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
    group_code = str(data.get('code') or data.get('group_code') or '').strip().upper()

    if not group_code:
        return Response({'error': 'Group code is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            group = Group.objects.select_for_update().filter(join_code__iexact=group_code).first()
            if group is None:
                raise Group.DoesNotExist

            if GroupMembership.objects.filter(group=group, student=user).exists():
                return Response({'error': 'You are already a member of this group'}, status=status.HTTP_400_BAD_REQUEST)

            member_count = GroupMembership.objects.filter(group=group).count()
            if group.is_archived:
                return Response({'error': 'This group is closed and cannot accept new members.'}, status=status.HTTP_400_BAD_REQUEST)
            if group.max_members is not None and member_count >= group.max_members:
                return Response({'error': 'This group is full.'}, status=status.HTTP_400_BAD_REQUEST)

            GroupMembership.objects.create(group=group, student=user, role='member')
            ChatRoom.objects.get_or_create(group=group, defaults={'chat_type': 'group'})

            return Response({
                'message': 'Successfully joined the group',
                'group': {
                    'id': group.id,
                    'name': group.name,
                    'course': group.course,
                    'year_of_study': group.year_of_study,
                    'description': group.description,
                    'join_code': group.join_code,
                    'unit_code': group.unit.code if group.unit_id else group.unit_code,
                    'unit_name': group.unit.name if group.unit_id else '',
                    'max_members': group.max_members,
                    'leader_id': group.lecturer_id,
                    'lecturer': f"{group.lecturer.first_name} {group.lecturer.last_name}",
                    'members_count': member_count + 1,
                }
            }, status=status.HTTP_200_OK)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error joining group: {str(e)}")
        return Response({'error': 'Failed to join group'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def leave_group_view(request, group_id):
    try:
        group = Group.objects.get(pk=group_id)
        if group.lecturer_id == request.user.id:
            return Response({'error': 'The group leader cannot leave. Delete the group instead.'}, status=status.HTTP_400_BAD_REQUEST)
        membership = GroupMembership.objects.filter(group=group, student=request.user).first()
        if membership is None:
            return Response({'error': 'You are not a member of this group.'}, status=status.HTTP_400_BAD_REQUEST)
        membership.delete()
        return Response({'message': 'You left the group.'}, status=status.HTTP_200_OK)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
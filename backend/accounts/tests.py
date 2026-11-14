import tempfile
import json
from datetime import timedelta
from asgiref.sync import async_to_sync

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.consumers import ChatConsumer
from accounts.balance import calculate_group_balance
from accounts.models import AdminSetting, ChatRoom, Course, Group, GroupMembership, Message, Notification, Project, Semester, StudentEnrollment, Submission, SubmissionAttachment, Task, TaskActivity, TaskComment, Unit, UnitAssignment, User


class LecturerClaimFlowTests(TestCase):
    def test_lecturer_signup_assigns_selected_units(self):
        course = Course.objects.create(code='BIS', name='BSc Information Systems', department='Computing')
        unit = Unit.objects.create(course=course, code='BIS 101', name='Information Systems')

        response = APIClient().post('/api/accounts/signup/', {
            'user_type': 'lecturer',
            'fullName': 'Unit Lecturer',
            'email': 'unit-lecturer@zetech.ac.ke',
            'password': 'StrongPass123',
            'confirmPassword': 'StrongPass123',
            'department': 'Computing',
            'staffId': 'IS1234',
            'unit_ids': [unit.id],
        }, format='json')

        self.assertEqual(response.status_code, 201, response.json())
        lecturer = User.objects.get(email='unit-lecturer@zetech.ac.ke')
        unit.refresh_from_db()
        self.assertEqual(unit.assigned_lecturer_id, lecturer.id)

    def test_lecturer_dashboard_only_lists_students_registered_in_taught_units(self):
        course = Course.objects.create(code='BIS', name='BSc Information Systems', department='Computing')
        semester = Semester.objects.create(name='Year 1 Semester 1', year=1, semester=1)
        unit = Unit.objects.create(
            course=course,
            code='BIS 101',
            name='Information Systems',
            year_of_study=1,
            semester=1,
        )
        lecturer = User.objects.create_user(
            username='roster-lecturer',
            email='roster-lecturer@zetech.ac.ke',
            password='secret123',
            user_type='lecturer',
            staff_id='IS1234',
        )
        registered = User.objects.create_user(
            username='registered-student',
            email='registered-student@zetech.ac.ke',
            password='secret123',
            user_type='student',
            course=course.name,
            year_of_study='1',
            semester=1,
        )
        unrelated = User.objects.create_user(
            username='unrelated-student',
            email='unrelated-student@zetech.ac.ke',
            password='secret123',
            user_type='student',
        )
        unit.assigned_lecturer = lecturer
        unit.save()
        StudentEnrollment.objects.create(student=registered, unit=unit, semester=semester)

        client = APIClient()
        client.force_authenticate(user=lecturer)
        response = client.get('/api/accounts/dashboard/lecturer/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['stats']['total_students'], 1)
        self.assertEqual(response.json()['stats']['total_units'], 1)
        self.assertEqual(response.json()['units'][0]['students'][0]['id'], registered.id)
        self.assertNotIn(unrelated.id, [student['id'] for student in response.json()['units'][0]['students']])

        chat_response = client.post('/api/accounts/chat/direct/', {'user_id': registered.id}, format='json')
        self.assertEqual(chat_response.status_code, 200)

    def test_lecturer_can_claim_and_release_unit(self):
        course = Course.objects.create(code='BCS', name='BSc Computer Science', department='Computing')
        unit = Unit.objects.create(course=course, code='BCU 112', name='Digital Literacy', year_of_study=1, semester=1)
        lecturer = User.objects.create_user(
            username='lecturer1',
            email='lecturer1@zetech.ac.ke',
            password='secret123',
            user_type='lecturer',
            department='Computing',
            staff_id='CS1234',
        )

        client = APIClient()
        client.force_authenticate(user=lecturer)

        claim_response = client.post(f'/api/units/{unit.id}/claim/')
        self.assertEqual(claim_response.status_code, 200)
        unit.refresh_from_db()
        self.assertEqual(unit.assigned_lecturer_id, lecturer.id)

        release_response = client.post(f'/api/units/{unit.id}/unclaim/')
        self.assertEqual(release_response.status_code, 200)
        unit.refresh_from_db()
        self.assertIsNone(unit.assigned_lecturer_id)

    def test_lecturer_department_units_response_includes_group_archive_state(self):
        course = Course.objects.create(code='BCS', name='BSc Computer Science', department='Computing')
        unit = Unit.objects.create(course=course, code='BCU 213', name='Data Structures', year_of_study=2, semester=1)
        lecturer = User.objects.create_user(
            username='lecturer2',
            email='lecturer2@zetech.ac.ke',
            password='secret123',
            user_type='lecturer',
            department='Computing',
            staff_id='CS5678',
        )
        group = Group.objects.create(
            name='DS Group',
            course='BSc Computer Science',
            year_of_study='2',
            join_code='AB1234',
            lecturer=lecturer,
            unit=unit,
            academic_term='2025/2026 Semester 1',
            is_archived=True,
        )

        client = APIClient()
        client.force_authenticate(user=lecturer)

        response = client.get('/api/lecturer/oversight/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('archived_groups', payload)
        archived_item = next(item for item in payload['archived_groups'] if item['id'] == group.id)
        self.assertTrue(archived_item['id'] == group.id)
        self.assertIsNotNone(archived_item['chat_room_id'])
        self.assertIn('last_message_preview', archived_item)
        self.assertIn('unread_count', archived_item)


class StudentSignupEnrollmentTests(TestCase):
    def test_student_signup_creates_account_and_enrolls_in_matching_units(self):
        course = Course.objects.create(code='BCS', name='BSc Computer Science', department='Computer Science')
        semester = Semester.objects.create(name='Year 2 Semester 1', year=2, semester=1)
        matching_unit = Unit.objects.create(
            course=course,
            code='BCU 201',
            name='Data Structures',
            academic_level="Bachelor's",
            year_of_study=2,
            semester=1,
        )
        other_unit = Unit.objects.create(
            course=course,
            code='BCU 202',
            name='Algorithms',
            academic_level="Bachelor's",
            year_of_study=2,
            semester=2,
        )
        other_course = Course.objects.create(code='BLAW', name='Bachelor of Laws', department='School of Law')
        Unit.objects.create(
            course=other_course,
            code='LAW 201',
            name='Legal Research',
            academic_level="Bachelor's",
            year_of_study=2,
            semester=1,
        )

        response = APIClient().post('/api/accounts/signup/', {
            'user_type': 'student',
            'fullName': 'Jane Student',
            'admissionNumber': 'ZEC/002/2024',
            'email': 'jane.student@zetech.ac.ke',
            'password': 'StrongPass123',
            'confirmPassword': 'StrongPass123',
            'course_id': course.id,
            'academic_level': "Bachelor's",
            'yearOfStudy': 2,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.json())
        user = User.objects.get(email='jane.student@zetech.ac.ke')
        self.assertEqual(user.user_type, 'student')
        self.assertEqual(user.username, 'ZEC/002/2024')
        self.assertTrue(user.check_password('StrongPass123'))
        self.assertEqual(user.course, 'BSc Computer Science')
        self.assertEqual(user.academic_level, "Bachelor's")
        self.assertEqual(user.year_of_study, '2')
        self.assertEqual(user.enrolled_course_id, course.id)
        self.assertEqual(user.semester, 1)

        login_response = APIClient().post('/api/login/', {
            'username': 'ZEC/002/2024',
            'password': 'StrongPass123',
        }, format='json')
        self.assertEqual(login_response.status_code, 200, login_response.json())

        enrollments = StudentEnrollment.objects.filter(student=user).order_by('unit__code')
        self.assertEqual(list(enrollments.values_list('unit__code', flat=True)), ['BCU 201'])
        self.assertEqual(enrollments.get().semester_id, semester.id)

    def test_student_signup_requires_zetech_email_and_available_programme_term(self):
        course = Course.objects.create(code='BCS-VALIDATION', name='Computing', department='Computing')
        Unit.objects.create(course=course, code='BCS 101', name='Foundations', year_of_study=1, semester=1)
        payload = {
            'user_type': 'student',
            'fullName': 'Sample Student',
            'admissionNumber': 'ZEC/VALID/2024',
            'email': 'sample@example.com',
            'password': 'StrongPass123',
            'confirmPassword': 'StrongPass123',
            'course_id': course.id,
            'yearOfStudy': 1,
            'semester': 1,
        }

        external_email = APIClient().post('/api/accounts/signup/', payload, format='json')
        self.assertEqual(external_email.status_code, 400)
        self.assertIn('@zetech.ac.ke', external_email.json()['error'])

        payload['email'] = 'sample@zetech.ac.ke'
        payload['semester'] = 2
        unavailable_term = APIClient().post('/api/accounts/signup/', payload, format='json')
        self.assertEqual(unavailable_term.status_code, 400)
        self.assertIn('No units', unavailable_term.json()['error'])
        self.assertFalse(User.objects.filter(email=payload['email']).exists())

    def test_student_signup_with_missing_cohort_does_not_create_user(self):
        course = Course.objects.create(code='BCS-EMPTY', name='Empty Course', department='Computing')
        response = APIClient().post('/api/signup/', {
            'user_type': 'student',
            'fullName': 'No Units Student',
            'admissionNumber': 'ZEC/003/2024',
            'email': 'no.units@zetech.ac.ke',
            'password': 'StrongPass123',
            'confirmPassword': 'StrongPass123',
            'course_id': course.id,
            'yearOfStudy': 1,
            'semester': 1,
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('No units', response.json()['error'])
        self.assertFalse(User.objects.filter(email='no.units@zetech.ac.ke').exists())

    def test_academic_courses_endpoint_builds_structure_from_units(self):
        course = Course.objects.create(code='BCS-STRUCT', name='Structure Course', department='Computing')
        Unit.objects.create(course=course, code='BCS 102', name='Second Semester', academic_level="Bachelor's", year_of_study=1, semester=2)
        Unit.objects.create(course=course, code='BCS 101', name='First Semester', academic_level="Bachelor's", year_of_study=1, semester=1)
        Unit.objects.create(course=course, code='BCS 201', name='Year Two', academic_level='Diploma', year_of_study=2, semester=1)

        response = APIClient().get('/api/accounts/academic/courses/')
        self.assertEqual(response.status_code, 200)
        course_payload = next(item for item in response.json()['courses'] if item['id'] == course.id)
        self.assertEqual(course_payload['structure'], {'1': [1, 2], '2': [1]})
        self.assertEqual(
            [unit['academic_level'] for unit in course_payload['units']],
            ["Bachelor's", "Bachelor's", 'Diploma'],
        )

    def test_student_dashboard_returns_only_enrolled_course_year_and_semester_units(self):
        course = Course.objects.create(code='BCS-DASH', name='Dashboard Course', department='Computing')
        first_unit = Unit.objects.create(course=course, code='BCS 100', name='Current Cohort', year_of_study=2, semester=1)
        Unit.objects.create(course=course, code='BCS 101', name='Different Semester', year_of_study=2, semester=2)
        Unit.objects.create(course=course, code='BCS 201', name='Different Year', year_of_study=1, semester=1)
        student = User.objects.create_user(
            username='cohort-dashboard',
            email='cohort-dashboard@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
            enrolled_course=course,
            course=course.name,
            year_of_study='2',
            semester=1,
        )

        client = APIClient()
        client.force_authenticate(user=student)
        response = client.get('/api/accounts/dashboard/student/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['academic'], {
            'course_code': course.code,
            'course_name': course.name,
            'year_of_study': '2',
            'semester': 1,
        })
        self.assertEqual(payload['units'], [{'id': first_unit.id, 'code': first_unit.code, 'name': first_unit.name}])

    def test_student_dashboard_returns_null_academic_for_legacy_account(self):
        student = User.objects.create_user(
            username='legacy-dashboard',
            email='legacy-dashboard@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
        )
        client = APIClient()
        client.force_authenticate(user=student)
        response = client.get('/api/accounts/dashboard/student/')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['academic'])
        self.assertEqual(response.json()['units'], [])


class LecturerSignupPayloadTests(TestCase):
    def test_lecturer_signup_requires_full_name_department_and_matching_passwords(self):
        client = APIClient()

        response = client.post('/api/signup/', {
            'user_type': 'lecturer',
            'fullName': 'Dr. Jane Doe',
            'email': 'j.doe@zetech.ac.ke',
            'password': 'StrongPass123',
            'confirmPassword': 'WrongPassword123',
            'department': 'Computer Science',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('match', response.json()['error'].lower())

        success = client.post('/api/signup/', {
            'user_type': 'lecturer',
            'fullName': 'Prof. James Mwangi',
            'email': 'j.mwangi@zetech.ac.ke',
            'password': 'StrongPass123',
            'confirmPassword': 'StrongPass123',
            'department': 'School of Business',
        }, format='json')
        self.assertEqual(success.status_code, 201)
        user = User.objects.get(email='j.mwangi@zetech.ac.ke')
        self.assertEqual(user.user_type, 'lecturer')
        self.assertEqual(user.department, 'School of Business')
        self.assertEqual(user.first_name, 'Prof.')

    def test_departments_endpoint_returns_distinct_course_departments(self):
        Course.objects.create(code='BCS', name='BSc Computer Science', department='Computer Science')
        Course.objects.create(code='LLB', name='Bachelor of Laws', department='School of Law')
        Course.objects.create(code='NUR', name='Bachelor of Nursing', department='Nursing')
        Course.objects.create(code='CLM', name='Clinical Medicine', department='Clinical Medicine')
        Course.objects.create(code='PSY', name='Psychology', department='Psychology & Social Sciences')
        Course.objects.create(code='CS2', name='Computer Science Duplicate', department='Computer Science')

        response = APIClient().get('/api/departments/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['departments'], [
            'Clinical Medicine',
            'Computer Science',
            'Nursing',
            'Psychology & Social Sciences',
            'School of Law',
        ])


class LoginEndpointTests(TestCase):
    def test_login_returns_user_payload_and_tokens_for_username(self):
        user = User.objects.create_user(
            username='CT101',
            email='ct101@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
            course='BSc Computer Science',
            year_of_study='2',
        )

        response = APIClient().post('/api/login/', {
            'username': 'CT101',
            'password': 'StrongPass123',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('access', payload)
        self.assertIn('refresh', payload)
        self.assertEqual(payload['user']['username'], user.username)
        self.assertEqual(payload['user']['id'], user.id)
        self.assertEqual(payload['user']['user_type'], 'student')

        email_login = APIClient().post('/api/login/', {
            'username': 'ct101@zetech.ac.ke',
            'password': 'StrongPass123',
        }, format='json')
        self.assertEqual(email_login.status_code, 200, email_login.json())
        self.assertEqual(email_login.json()['user']['username'], user.username)

        refreshed = APIClient().post('/api/accounts/jwt/refresh/', {
            'refresh': payload['refresh'],
        }, format='json')
        self.assertEqual(refreshed.status_code, 200, refreshed.json())
        self.assertIn('access', refreshed.json())


class GroupLifecycleTests(TestCase):
    def setUp(self):
        self.course = Course.objects.create(code='BCS-GROUP', name='Computing', department='Computing')
        self.unit = Unit.objects.create(
            course=self.course, code='BCS 111', name='Foundations Of Computing',
            year_of_study=1, semester=1,
        )
        self.leader = User.objects.create_user(
            username='ZEC/LEAD/01', email='group-leader@zetech.ac.ke', password='StrongPass123',
            user_type='student', enrolled_course=self.course, course=self.course.name,
            year_of_study='1', semester=1,
        )
        self.member = User.objects.create_user(
            username='ZEC/MEMBER/01', email='group-member@zetech.ac.ke', password='StrongPass123',
            user_type='student', enrolled_course=self.course, course=self.course.name,
            year_of_study='1', semester=1,
        )
        self.outsider = User.objects.create_user(
            username='ZEC/OUT/01', email='group-outsider@zetech.ac.ke', password='StrongPass123',
            user_type='student', enrolled_course=self.course, course=self.course.name,
            year_of_study='1', semester=1,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.leader)

    def create_group(self, *, max_members=2, invite_usernames=None):
        return self.client.post('/api/accounts/groups/create/', {
            'name': 'Unit team',
            'course': self.course.name,
            'year_of_study': '1',
            'unit_id': self.unit.id,
            'max_members': max_members,
            'invite_usernames': invite_usernames or [],
        }, format='json')

    def test_create_group_sets_display_only_leader_invites_and_chatroom(self):
        response = self.create_group(invite_usernames=[self.member.username])
        self.assertEqual(response.status_code, 201, response.json())
        group = Group.objects.get(pk=response.json()['group']['id'])
        self.assertEqual(group.max_members, 2)
        self.assertTrue(response.json()['group']['is_leader'])
        self.assertEqual(GroupMembership.objects.get(group=group, student=self.leader).role, 'member')
        self.assertTrue(GroupMembership.objects.filter(group=group, student=self.member).exists())
        self.assertTrue(ChatRoom.objects.filter(group=group, chat_type='group').exists())
        self.assertEqual(response.json()['group']['unit_name'], self.unit.name)
        self.assertEqual(response.json()['group']['max_members'], 2)

        dashboard = self.client.get('/api/accounts/dashboard/student/')
        group_data = next(item for item in dashboard.json()['groups'] if item['id'] == group.id)
        self.assertTrue(group_data['is_leader'])
        self.assertEqual(group_data['unit_name'], self.unit.name)
        self.assertEqual(group_data['members_count'], 2)

        project = Project.objects.create(group=group, title='Team project')
        task = Task.objects.create(project=project, title='Build interface', assigned_to=self.member)
        workspace = self.client.get(f'/api/accounts/groups/{group.id}/workspace/')
        self.assertEqual(workspace.status_code, 200, workspace.json())
        self.assertEqual(workspace.json()['group']['project_count'], 1)
        denied_update = self.client.post(
            f'/api/accounts/tasks/{task.id}/update-status/',
            {'status': 'completed'},
            format='json',
        )
        self.assertEqual(denied_update.status_code, 403)

    def test_unit_group_list_uses_saved_course_year_semester_without_enrollment_row(self):
        created = self.create_group()
        self.assertEqual(created.status_code, 201, created.json())
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f'/api/accounts/units/{self.unit.id}/groups/')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual([group['id'] for group in response.json()], [created.json()['group']['id']])
        self.assertFalse(StudentEnrollment.objects.filter(student=self.outsider, unit=self.unit).exists())

    def test_join_code_reports_invalid_full_and_already_joined(self):
        created = self.create_group(invite_usernames=[self.member.username])
        self.assertEqual(created.status_code, 201, created.json())
        group = Group.objects.get(pk=created.json()['group']['id'])

        already_joined = self.client.post('/api/accounts/groups/join/', {'code': group.join_code}, format='json')
        self.assertEqual(already_joined.status_code, 400)
        self.assertIn('already a member', already_joined.json()['error'])

        self.client.force_authenticate(user=self.outsider)
        full = self.client.post('/api/accounts/groups/join/', {'code': group.join_code}, format='json')
        self.assertEqual(full.status_code, 400)
        self.assertIn('full', full.json()['error'].lower())
        invalid = self.client.post('/api/accounts/groups/join/', {'code': 'ZZZZZZ'}, format='json')
        self.assertEqual(invalid.status_code, 404)

    def test_group_join_repairs_chatroom_and_member_can_leave(self):
        created = self.create_group(max_members=3)
        group = Group.objects.get(pk=created.json()['group']['id'])
        ChatRoom.objects.filter(group=group).delete()

        self.client.force_authenticate(user=self.member)
        joined = self.client.post('/api/accounts/groups/join/', {'code': group.join_code}, format='json')
        self.assertEqual(joined.status_code, 200, joined.json())
        self.assertTrue(ChatRoom.objects.filter(group=group).exists())
        left = self.client.post(f'/api/accounts/groups/{group.id}/leave/')
        self.assertEqual(left.status_code, 200)
        self.assertFalse(GroupMembership.objects.filter(group=group, student=self.member).exists())

    def test_chat_rooms_endpoint_repairs_missing_rooms_for_existing_groups(self):
        created = self.create_group()
        group = Group.objects.get(pk=created.json()['group']['id'])
        ChatRoom.objects.filter(group=group).delete()
        response = self.client.get('/api/accounts/chat/rooms/')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertTrue(ChatRoom.objects.filter(group=group, chat_type='group').exists())

    def test_only_creator_can_delete_and_creator_cannot_leave(self):
        created = self.create_group()
        group = Group.objects.get(pk=created.json()['group']['id'])
        self.client.force_authenticate(user=self.member)
        denied = self.client.delete(f'/api/accounts/groups/{group.id}/delete/')
        self.assertEqual(denied.status_code, 403)
        not_member = self.client.post(f'/api/accounts/groups/{group.id}/leave/')
        self.assertEqual(not_member.status_code, 400)

        self.client.force_authenticate(user=self.leader)
        cannot_leave = self.client.post(f'/api/accounts/groups/{group.id}/leave/')
        self.assertEqual(cannot_leave.status_code, 400)
        deleted = self.client.delete(f'/api/accounts/groups/{group.id}/delete/')
        self.assertEqual(deleted.status_code, 204)


class AcademicCatalogApiTests(TestCase):
    def test_academic_courses_and_current_units_return_programme_scoped_data(self):
        course = Course.objects.create(code='BCS', name='Bachelor of Computing', department='')
        other_course = Course.objects.create(code='BBA', name='Bachelor of Business', department='')
        Unit.objects.create(course=course, code='BCS 211', name='Networks', year_of_study=2, semester=1)
        Unit.objects.create(course=course, code='BCS 221', name='Databases', year_of_study=2, semester=2)
        Unit.objects.create(course=other_course, code='BBA 221', name='Accounting', year_of_study=2, semester=2)
        student = User.objects.create_user(
            username='catalog-student',
            email='catalog-student@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
            course=course.name,
            enrolled_course=course,
            year_of_study='2',
            semester=2,
        )

        catalog = APIClient().get('/api/accounts/academic/courses/')
        self.assertEqual(catalog.status_code, 200)
        programme = next(item for item in catalog.json()['courses'] if item['code'] == 'BCS')
        self.assertEqual(programme['name'], 'Bachelor of Computing')
        self.assertEqual(programme['structure']['2'], [1, 2])

        client = APIClient()
        client.force_authenticate(user=student)
        current_units = client.get('/api/accounts/student/current-units/')
        self.assertEqual(current_units.status_code, 200)
        self.assertEqual([unit['code'] for unit in current_units.json()], ['BCS 221'])


class SeedFromExcelTests(TestCase):
    def test_clean_workbook_rebuild_is_normalized_and_idempotent(self):
        from io import StringIO
        from pathlib import Path
        from openpyxl import Workbook
        from django.core.management import call_command

        old_course = Course.objects.create(code='OLD', name='Old programme', department='')
        Unit.objects.create(course=old_course, code='OLD 101', name='Old unit')
        with tempfile.TemporaryDirectory() as temporary_directory:
            workbook_path = Path(temporary_directory) / 'cleaned.xlsx'
            workbook = Workbook()
            units_sheet = workbook.active
            units_sheet.title = 'All Programmes'
            units_sheet.append([
                'Programme/Cohort', 'Year', 'Semester', 'Estimated Total Years',
                'Estimated Total Semesters', 'Unit Code', 'Unit Name', 'Programme Name',
            ])
            units_sheet.append([
                'CS Y1S1', 1, 1, '4 years', '8 semesters', 'CS 101',
                '  introduction   to databases ii ', 'Bachelor of Computing',
            ])
            units_sheet.append([None, None, None, None, None, 'CS 102', 'programming iv', None])
            programmes_sheet = workbook.create_sheet('Programmes')
            programmes_sheet.append(['Code', 'Full Name', 'Level', 'Status', 'Source'])
            programmes_sheet.append(['CS', 'Bachelor of Computing', 'Degree', 'Active', 'Catalogue'])
            programmes_sheet.append(['IT', None, 'Diploma', 'Active', 'Catalogue'])
            workbook.save(workbook_path)

            call_command('seed_from_excel', workbook=str(workbook_path), clear_existing=True, stdout=StringIO())
            self.assertEqual(Course.objects.count(), 2)
            self.assertFalse(Course.objects.filter(code='OLD').exists())
            course = Course.objects.get(code='CS')
            self.assertEqual(course.name, 'Bachelor of Computing')
            self.assertEqual(Course.objects.get(code='IT').name, 'IT')
            self.assertEqual(Unit.objects.count(), 2)
            self.assertEqual(Unit.objects.get(code='CS 101', course=course).name, 'Introduction To Databases II')
            self.assertEqual(Unit.objects.get(code='CS 102', course=course).year_of_study, 1)

            call_command('seed_from_excel', workbook=str(workbook_path), stdout=StringIO())
            self.assertEqual(Course.objects.count(), 2)
            self.assertEqual(Unit.objects.count(), 2)


class SeedDemoCommandTests(TestCase):
    def test_seed_demo_is_scenario_complete_safe_and_idempotent(self):
        from io import StringIO
        from django.core.management import call_command

        unrelated_student = User.objects.create_user(
            username='unrelated-seed-user',
            email='unrelated-seed-user@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
            year_of_study='2',
        )
        unrelated_group = Group.objects.create(
            name='User-owned group', course='BSc Computer Science', year_of_study='2',
            join_code='OWN001', lecturer=unrelated_student,
        )
        unrelated_project = Project.objects.create(group=unrelated_group, title='Keep this project')
        unrelated_task = Task.objects.create(
            project=unrelated_project, title='Keep this task', assigned_to=unrelated_student,
        )

        call_command('seed_demo', stdout=StringIO())
        groups = list(Group.objects.filter(join_code__in=['DEMO01', 'DEMO02', 'DEMO03']))
        self.assertEqual(len(groups), 3)
        by_code = {group.join_code: group for group in groups}
        healthy = by_code['DEMO01']
        overloaded = by_code['DEMO02']
        quiet = by_code['DEMO03']

        for group in groups:
            project = Project.objects.get(group=group, title=f'{group.name} Project')
            tasks = list(Task.objects.filter(project=project))
            roots = [task for task in tasks if task.parent_task_id is None]
            self.assertEqual(len(roots), 8)
            self.assertEqual(len(tasks), 10)
            self.assertTrue(all(task.weight >= 1 and task.due_date for task in roots))
            self.assertGreaterEqual(TaskActivity.objects.filter(task__project=project).count(), 10)
            self.assertEqual(TaskComment.objects.filter(task__project=project).count(), 10)
            self.assertEqual(Message.objects.filter(chat_room=group.chat_room).count(), 3)

        healthy_project = Project.objects.get(group=healthy)
        healthy_roots = Task.objects.filter(project=healthy_project, parent_task__isnull=True)
        self.assertEqual(healthy_roots.filter(status='completed').count(), 7)
        self.assertTrue(Submission.objects.filter(project=healthy_project).exists())
        healthy_shares = [member['share_percent'] for member in calculate_group_balance(healthy)['members']]
        self.assertLess(max(healthy_shares) - min(healthy_shares), 10)

        overloaded_balance = calculate_group_balance(overloaded)
        warnings = [member for member in overloaded_balance['members'] if member['warning_level'] in ('warning', 'critical')]
        self.assertEqual(len(warnings), 1)
        self.assertGreater(warnings[0]['share_percent'], 60)

        quiet_project = Project.objects.get(group=quiet)
        quiet_roots = Task.objects.filter(project=quiet_project, parent_task__isnull=True)
        self.assertEqual(quiet_roots.filter(due_date__lt=timezone.now()).count(), 8)
        cutoff = timezone.now() - timedelta(days=10)
        latest_activity = TaskActivity.objects.filter(task__project=quiet_project).order_by('-created_at').first()
        latest_comment = TaskComment.objects.filter(task__project=quiet_project).order_by('-created_at').first()
        latest_message = Message.objects.filter(chat_room=quiet.chat_room).order_by('-timestamp').first()
        self.assertLess(latest_activity.created_at, cutoff)
        self.assertLess(latest_comment.created_at, cutoff)
        self.assertLess(latest_message.timestamp, cutoff)

        initial_counts = (
            Group.objects.filter(join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            Project.objects.filter(group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            Task.objects.filter(project__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            TaskActivity.objects.filter(task__project__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            TaskComment.objects.filter(task__project__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            Message.objects.filter(chat_room__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            Submission.objects.filter(project__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
        )
        call_command('seed_demo', stdout=StringIO())
        repeated_counts = (
            Group.objects.filter(join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            Project.objects.filter(group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            Task.objects.filter(project__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            TaskActivity.objects.filter(task__project__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            TaskComment.objects.filter(task__project__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            Message.objects.filter(chat_room__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
            Submission.objects.filter(project__group__join_code__in=['DEMO01', 'DEMO02', 'DEMO03']).count(),
        )
        self.assertEqual(repeated_counts, initial_counts)
        self.assertTrue(Task.objects.filter(pk=unrelated_task.pk).exists())
        self.assertTrue(Project.objects.filter(pk=unrelated_project.pk).exists())


class GroupChatRealtimeTests(TestCase):
    def test_group_chat_history_and_room_are_created_for_members(self):
        lecturer = User.objects.create_user(
            username='lecturer-chat',
            email='lecturer-chat@zetech.ac.ke',
            password='StrongPass123',
            user_type='lecturer',
            department='Computer Science',
            staff_id='CS1234',
        )
        student = User.objects.create_user(
            username='student-chat',
            email='student-chat@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
            course='BSc Computer Science',
            year_of_study='2',
        )
        group = Group.objects.create(
            name='Chat Test Group',
            course='BSc Computer Science',
            year_of_study='2',
            join_code='CHAT12',
            lecturer=lecturer,
        )
        GroupMembership.objects.create(group=group, student=student, role='member')

        room = group.chat_room
        self.assertIsNotNone(room)
        self.assertEqual(room.chat_type, 'group')

        Message.objects.create(chat_room=room, sender=student, content='Hello everyone')

        client = APIClient()
        client.force_authenticate(user=student)

        room_response = client.get(f'/api/accounts/groups/{group.id}/chat-room/')
        self.assertEqual(room_response.status_code, 200, room_response.json())
        self.assertEqual(room_response.json()['id'], room.id)
        response = client.get(f'/api/accounts/chat/messages/{room.id}/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload[0]['content'], 'Hello everyone')

    def test_chat_consumer_broadcasts_persisted_message_payload(self):
        from unittest.mock import AsyncMock

        lecturer = User.objects.create_user(
            username='lecturer-ws-payload', email='lecturer-ws-payload@zetech.ac.ke',
            password='StrongPass123', user_type='lecturer', staff_id='CS1235',
        )
        student = User.objects.create_user(
            username='student-ws-payload', email='student-ws-payload@zetech.ac.ke',
            password='StrongPass123', user_type='student',
        )
        group = Group.objects.create(
            name='Payload group', course='Computing', year_of_study='1',
            join_code='PAY123', lecturer=lecturer,
        )
        GroupMembership.objects.create(group=group, student=student)
        consumer = ChatConsumer()
        consumer.user = student
        consumer.chat_room = group.chat_room
        consumer.room_group_name = f'chat_{group.chat_room.id}'
        channel_layer = AsyncMock()
        consumer.channel_layer = channel_layer

        async_to_sync(consumer.receive)(json.dumps({'content': 'Hello over socket'}))
        event = channel_layer.group_send.call_args.args[1]
        payload = event['message_data']
        self.assertEqual(payload['content'], 'Hello over socket')
        self.assertEqual(payload['sender']['id'], student.id)
        self.assertIn('timestamp', payload)
        self.assertTrue(Message.objects.filter(pk=payload['id'], chat_room=group.chat_room).exists())
        self.assertEqual(Notification.objects.filter(related_message_id=payload['id'], user=lecturer).count(), 1)

    def test_chat_consumer_accepts_group_id_as_room_identifier(self):
        lecturer = User.objects.create_user(
            username='lecturer-room',
            email='lecturer-room@zetech.ac.ke',
            password='StrongPass123',
            user_type='lecturer',
            department='Computer Science',
            staff_id='CS4321',
        )
        student = User.objects.create_user(
            username='student-room',
            email='student-room@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
            course='BSc Computer Science',
            year_of_study='2',
        )
        group = Group.objects.create(
            name='Room Identifier Group',
            course='BSc Computer Science',
            year_of_study='2',
            join_code='ROOM12',
            lecturer=lecturer,
        )
        GroupMembership.objects.create(group=group, student=student, role='member')

        consumer = ChatConsumer()
        consumer.scope = {'url_route': {'kwargs': {'room_name': str(group.id)}}, 'query_string': b''}
        consumer.user = student

        resolved = consumer.resolve_chat_room_for_room_name_sync()
        self.assertEqual(resolved.group_id, group.id)


class GroupChatDocumentTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='chat-owner',
            email='chat-owner@zetech.ac.ke',
            password='StrongPass123',
            first_name='Amina',
            user_type='student',
            course='BBAM',
            year_of_study='2',
        )
        self.member = User.objects.create_user(
            username='chat-member',
            email='chat-member@zetech.ac.ke',
            password='StrongPass123',
            first_name='Brian',
            user_type='student',
            course='BBAM',
            year_of_study='2',
        )

    def test_student_can_create_group_and_classmate_can_join_with_code(self):
        owner_client = APIClient()
        owner_client.force_authenticate(user=self.owner)
        response = owner_client.post('/api/accounts/groups/create/', {
            'name': 'Marketing project',
            'course': 'BBAM',
            'year_of_study': '2',
            'description': 'Shared coursework',
            'max_members': 5,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.json())
        group_data = response.json()['group']
        group = Group.objects.get(pk=group_data['id'])
        self.assertEqual(len(group_data['join_code']), 6)
        self.assertTrue(ChatRoom.objects.filter(group=group, chat_type='group').exists())
        self.assertTrue(GroupMembership.objects.filter(group=group, student=self.owner, role='member').exists())

        member_client = APIClient()
        member_client.force_authenticate(user=self.member)
        joined = member_client.post('/api/accounts/groups/join/', {'code': group_data['join_code']}, format='json')
        self.assertEqual(joined.status_code, 200, joined.json())
        self.assertTrue(GroupMembership.objects.filter(group=group, student=self.member).exists())

    def test_group_rooms_are_repaired_and_all_groups_list_as_conversations(self):
        group = Group.objects.create(
            name='Legacy group without chat',
            course='BBAM',
            year_of_study='2',
            join_code='LEGACY',
            lecturer=self.owner,
        )
        GroupMembership.objects.create(group=group, student=self.member)
        self.assertTrue(ChatRoom.objects.filter(group=group).exists())
        ChatRoom.objects.filter(group=group).delete()

        client = APIClient()
        client.force_authenticate(user=self.member)
        response = client.get('/api/accounts/chat/rooms/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]['name'], group.name)
        self.assertTrue(ChatRoom.objects.filter(group=group, chat_type='group').exists())

    def test_chat_room_list_returns_direct_and_group_rooms_with_unread_counts(self):
        group = Group.objects.create(
            name='Unread group', course='BBAM', year_of_study='2', join_code='UNREAD', lecturer=self.owner,
        )
        GroupMembership.objects.create(group=group, student=self.member)
        direct_room, _ = ChatRoom.objects.get_or_create(
            chat_type='direct', user1=min(self.owner, self.member, key=lambda user: user.id),
            user2=max(self.owner, self.member, key=lambda user: user.id),
        )
        group_room = group.chat_room
        direct_message = Message.objects.create(chat_room=direct_room, sender=self.owner, content='Direct ping')
        group_message = Message.objects.create(chat_room=group_room, sender=self.owner, content='Group ping')
        Notification.objects.create(
            user=self.member, notification_type='message_received', title='Direct', message='Direct ping',
            related_chat_room=direct_room, related_message=direct_message,
        )
        Notification.objects.create(
            user=self.member, notification_type='message_received', title='Group', message='Group ping',
            related_chat_room=group_room, related_message=group_message,
        )
        client = APIClient()
        client.force_authenticate(user=self.member)
        rooms = client.get('/api/accounts/chat/rooms/').json()
        self.assertEqual({room['type'] for room in rooms}, {'direct', 'group'})
        self.assertTrue(all(room['unread_count'] == 1 for room in rooms))

        mark_read = client.post(f'/api/accounts/chat/{direct_room.id}/mark-read/')
        self.assertEqual(mark_read.status_code, 200)
        direct_notification = Notification.objects.get(related_message=direct_message)
        self.assertTrue(direct_notification.is_read)
        self.assertFalse(Notification.objects.get(related_message=group_message).is_read)

        outsider = User.objects.create_user(
            username='unread-outsider', email='unread-outsider@zetech.ac.ke', password='StrongPass123', user_type='student',
        )
        outsider_client = APIClient()
        outsider_client.force_authenticate(user=outsider)
        denied = outsider_client.post(f'/api/accounts/chat/{group_room.id}/mark-read/')
        self.assertEqual(denied.status_code, 403)

    def test_group_creation_can_link_a_unit_and_admin_can_delete_group(self):
        course = Course.objects.create(code='BBAM', name='Business Administration', department='Business')
        unit = Unit.objects.create(course=course, code='BBM 201', name='Marketing', year_of_study=2, semester=1)
        self.owner.enrolled_course = course
        self.owner.save()
        owner_client = APIClient()
        owner_client.force_authenticate(user=self.owner)
        response = owner_client.post('/api/accounts/groups/create/', {
            'name': 'Marketing study group',
            'course': course.name,
            'year_of_study': '1',
            'unit_id': unit.id,
            'max_members': 4,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.json())
        group = Group.objects.get(pk=response.json()['group']['id'])
        self.assertEqual(group.unit_id, unit.id)
        self.assertEqual(group.unit_code, unit.code)
        self.assertEqual(group.year_of_study, '2')

        member_client = APIClient()
        member_client.force_authenticate(user=self.member)
        denied = member_client.delete(f'/api/accounts/groups/{group.id}/delete/')
        self.assertEqual(denied.status_code, 403)

        deleted = owner_client.delete(f'/api/accounts/groups/{group.id}/delete/')
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(Group.objects.filter(pk=group.id).exists())
        self.assertFalse(ChatRoom.objects.filter(group_id=group.id).exists())

    def test_member_can_delete_direct_conversation_but_outsider_cannot(self):
        room = ChatRoom.objects.create(chat_type='direct', user1=self.owner, user2=self.member)
        member_client = APIClient()
        member_client.force_authenticate(user=self.member)
        outsider = User.objects.create_user(
            username='chat-delete-outsider',
            email='chat-delete-outsider@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
        )
        outsider_client = APIClient()
        outsider_client.force_authenticate(user=outsider)

        denied = outsider_client.delete(f'/api/accounts/chat/rooms/{room.id}/')
        self.assertEqual(denied.status_code, 403)
        deleted = member_client.delete(f'/api/accounts/chat/rooms/{room.id}/')
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(ChatRoom.objects.filter(pk=room.id).exists())

    def test_group_document_is_saved_and_only_members_can_download_it(self):
        group = Group.objects.create(
            name='Document group',
            course='BBAM',
            year_of_study='2',
            join_code='DOC123',
            lecturer=self.owner,
        )
        GroupMembership.objects.create(group=group, student=self.member)
        room = group.chat_room
        member_client = APIClient()
        member_client.force_authenticate(user=self.member)
        outsider = User.objects.create_user(
            username='chat-outsider',
            email='chat-outsider@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
        )
        outsider_client = APIClient()
        outsider_client.force_authenticate(user=outsider)

        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            uploaded = SimpleUploadedFile('project-brief.pdf', b'%PDF-1.4 test document', content_type='application/pdf')
            sent = member_client.post(
                f'/api/accounts/chat/send/{room.id}/',
                {'content': 'Please review this brief', 'file': uploaded},
                format='multipart',
            )
            self.assertEqual(sent.status_code, 201, sent.json())
            self.assertEqual(sent.json()['attachment_name'], 'project-brief.pdf')

            history = member_client.get(f'/api/accounts/chat/messages/{room.id}/')
            self.assertEqual(history.status_code, 200)
            self.assertEqual(history.json()[0]['attachment_name'], 'project-brief.pdf')

            download_url = history.json()[0]['attachment_url']
            download = member_client.get(download_url)
            self.assertEqual(download.status_code, 200)
            self.assertEqual(b''.join(download.streaming_content), b'%PDF-1.4 test document')

            denied = outsider_client.get(download_url)
            self.assertEqual(denied.status_code, 403)


class DirectChatTests(TestCase):
    def setUp(self):
        self.first = User.objects.create_user(
            username='direct-first',
            email='direct-first@zetech.ac.ke',
            password='StrongPass123',
            first_name='Amina',
            user_type='student',
        )
        self.second = User.objects.create_user(
            username='direct-second',
            email='direct-second@zetech.ac.ke',
            password='StrongPass123',
            first_name='Brian',
            user_type='student',
        )
        self.outsider = User.objects.create_user(
            username='direct-outsider',
            email='direct-outsider@zetech.ac.ke',
            password='StrongPass123',
            first_name='Chao',
            user_type='student',
        )
        group = Group.objects.create(
            name='Shared study group',
            course='BBAM',
            year_of_study='2',
            join_code='SHARE1',
            lecturer=self.first,
        )
        GroupMembership.objects.create(group=group, student=self.first, role='admin')
        GroupMembership.objects.create(group=group, student=self.second, role='member')

    def test_groupmates_can_start_same_private_chat_and_exchange_messages(self):
        first_client = APIClient()
        first_client.force_authenticate(user=self.first)
        contacts = first_client.get('/api/accounts/chat/contacts/')
        self.assertEqual(contacts.status_code, 200)
        self.assertEqual([contact['id'] for contact in contacts.json()], [self.second.id])

        created = first_client.post('/api/accounts/chat/direct/', {'user_id': self.second.id}, format='json')
        self.assertEqual(created.status_code, 200, created.json())
        room_id = created.json()['id']
        self.assertEqual(created.json()['type'], 'direct')

        second_client = APIClient()
        second_client.force_authenticate(user=self.second)
        opened = second_client.post('/api/accounts/chat/direct/', {'user_id': self.first.id}, format='json')
        self.assertEqual(opened.status_code, 200, opened.json())
        self.assertEqual(opened.json()['id'], room_id)

        sent = first_client.post(f'/api/accounts/chat/send/{room_id}/', {'content': 'Hi, Brian'}, format='json')
        self.assertEqual(sent.status_code, 201, sent.json())
        history = second_client.get(f'/api/accounts/chat/messages/{room_id}/')
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]['content'], 'Hi, Brian')
        self.assertEqual(history.json()[0]['sender']['id'], self.first.id)

    def test_users_without_a_shared_group_cannot_start_private_chat(self):
        outsider_client = APIClient()
        outsider_client.force_authenticate(user=self.outsider)
        response = outsider_client.post('/api/accounts/chat/direct/', {'user_id': self.first.id}, format='json')
        self.assertEqual(response.status_code, 403)


class StudentSettingsTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            username='settings-student',
            email='settings-student@zetech.ac.ke',
            password='StrongPass123',
            first_name='Janet',
            last_name='Doe',
            user_type='student',
        )
        self.course = Course.objects.create(code='BBAM', name='Business Administration', department='Business')
        Unit.objects.create(course=self.course, code='BBM 211', name='Management', year_of_study=2, semester=1)
        self.client = APIClient()
        self.client.force_authenticate(user=self.student)

    def test_student_settings_update_name_programme_year_and_semester(self):
        response = self.client.patch('/api/accounts/profile/settings/', {
            'first_name': 'Janet',
            'last_name': 'Wanjiku',
            'course_id': self.course.id,
            'year_of_study': '2',
            'semester': '1',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.json())
        self.student.refresh_from_db()
        self.assertEqual(self.student.first_name, 'Janet')
        self.assertEqual(self.student.last_name, 'Wanjiku')
        self.assertEqual(self.student.enrolled_course_id, self.course.id)
        self.assertEqual(self.student.year_of_study, '2')
        self.assertEqual(self.student.semester, 1)

    def test_settings_resolves_legacy_programme_code_without_enrolled_course(self):
        self.student.course = self.course.code
        self.student.save()
        response = self.client.get('/api/accounts/profile/settings/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['course_id'], self.course.id)
        self.assertEqual(response.json()['course'], self.course.name)

    def test_settings_reject_year_and_semester_without_units_for_programme(self):
        response = self.client.patch('/api/accounts/profile/settings/', {
            'first_name': 'Janet',
            'last_name': 'Doe',
            'course_id': self.course.id,
            'year_of_study': '3',
            'semester': '2',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('not available', response.json()['error'])
        self.student.refresh_from_db()
        self.assertIsNone(self.student.enrolled_course_id)

    def test_workload_summary_reuses_balance_and_counts_own_tasks_due_this_week(self):
        group = Group.objects.create(
            name='Settings workload group', course='BBAM', year_of_study='2',
            join_code='SET123', lecturer=self.student,
        )
        GroupMembership.objects.create(group=group, student=self.student)
        other = User.objects.create_user(
            username='workload-other', email='workload-other@zetech.ac.ke',
            password='StrongPass123', user_type='student',
        )
        GroupMembership.objects.create(group=group, student=other)
        project = Project.objects.create(group=group, title='Workload project')
        soon = timezone.now() + timedelta(days=3)
        Task.objects.create(project=project, title='My due task', assigned_to=self.student, weight=2, due_date=soon)
        Task.objects.create(project=project, title='Other due task', assigned_to=other, weight=4, due_date=soon)
        Task.objects.create(
            project=project, title='Parent summary', assigned_to=self.student, weight=3,
            due_date=soon,
        )
        parent = Task.objects.get(title='Parent summary')
        Task.objects.create(project=project, parent_task=parent, title='Microtask', assigned_to=self.student, weight=1, due_date=soon)

        response = APIClient()
        response.force_authenticate(user=self.student)
        payload = response.get('/api/accounts/student/workload-summary/').json()
        row = next(item for item in payload if item['group_id'] == group.id)
        self.assertEqual(row['group_name'], group.name)
        self.assertEqual(row['points'], 3)
        self.assertEqual(row['fair_share'], 50)
        self.assertEqual(row['share_percent'], 42.86)
        self.assertEqual(row['tasks_due_next_7_days'], 2)
        self.assertEqual([task['title'] for task in row['upcoming_tasks']], ['My due task', 'Microtask'])
        self.assertEqual(row['upcoming_tasks'][0]['group_name'], group.name)
        self.assertEqual(row['upcoming_tasks'][0]['weight'], 2)

    def test_student_can_change_password_after_current_password_check(self):
        response = self.client.post('/api/accounts/profile/change-password/', {
            'current_password': 'StrongPass123',
            'new_password': 'AnotherStrong456',
            'confirm_password': 'AnotherStrong456',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.json())
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password('AnotherStrong456'))

        invalid = self.client.post('/api/accounts/profile/change-password/', {
            'current_password': 'wrong-password',
            'new_password': 'ThirdStrong789',
            'confirm_password': 'ThirdStrong789',
        }, format='json')
        self.assertEqual(invalid.status_code, 400)


class GroupTaskBalanceTests(TestCase):
    def setUp(self):
        self.lecturer = User.objects.create_user(
            username='balance-lecturer',
            email='balance-lecturer@zetech.ac.ke',
            password='StrongPass123',
            user_type='lecturer',
            staff_id='CS7788',
        )
        self.member_one = User.objects.create_user(
            username='balance-one',
            email='balance-one@zetech.ac.ke',
            password='StrongPass123',
            first_name='Brian',
            user_type='student',
        )
        self.member_two = User.objects.create_user(
            username='balance-two',
            email='balance-two@zetech.ac.ke',
            password='StrongPass123',
            first_name='Amina',
            user_type='student',
        )
        self.outsider = User.objects.create_user(
            username='balance-outsider',
            email='balance-outsider@zetech.ac.ke',
            password='StrongPass123',
            user_type='student',
        )
        self.group = Group.objects.create(
            name='Balanced Group',
            course='Computer Science',
            year_of_study='2',
            join_code='BAL123',
            lecturer=self.lecturer,
        )
        GroupMembership.objects.create(group=self.group, student=self.member_one)
        GroupMembership.objects.create(group=self.group, student=self.member_two)
        self.project = Project.objects.create(
            group=self.group,
            title='Balanced Group Project',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.member_one)

    def test_balance_reports_zero_points_as_ok_and_uses_weighted_share(self):
        empty_balance = calculate_group_balance(self.group)
        self.assertEqual(empty_balance['total_points'], 0)
        self.assertTrue(all(member['warning_level'] == 'too_early' for member in empty_balance['members']))

        Task.objects.create(
            project=self.project,
            title='Heavy task',
            assigned_to=self.member_one,
            weight=5,
            task_weight=5,
        )
        balance = calculate_group_balance(self.group)
        brian = next(member for member in balance['members'] if member['user_id'] == self.member_one.id)
        self.assertEqual(brian['points_assigned'], 5)
        self.assertEqual(brian['share_percent'], 100)
        self.assertEqual(brian['warning_level'], 'too_early')

        Task.objects.create(
            project=self.project,
            title='Small task',
            assigned_to=self.member_two,
            weight=1,
            task_weight=1,
            status='completed',
            progress_percentage=100,
            due_date=timezone.now() + timedelta(days=1),
            completed_at=timezone.now(),
        )
        balance = calculate_group_balance(self.group)
        brian = next(member for member in balance['members'] if member['user_id'] == self.member_one.id)
        self.assertEqual(brian['warning_level'], 'critical')
        amina = next(member for member in balance['members'] if member['user_id'] == self.member_two.id)
        self.assertEqual(amina['points_completed'], 1)
        self.assertEqual(amina['tasks_completed'], 1)
        self.assertEqual(amina['on_time_rate'], 100)

    def test_balance_endpoint_requires_group_membership(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f'/api/accounts/groups/{self.group.id}/balance/')
        self.assertEqual(response.status_code, 403)

    def test_balance_projection_returns_too_early_and_warning_levels(self):
        path = f'/api/accounts/groups/{self.group.id}/balance/'
        early = self.client.post(path, {
            'assigned_to_id': self.member_one.id,
            'weight': 2,
        }, format='json')
        self.assertEqual(early.status_code, 200, early.json())
        self.assertEqual(early.json()['warning_level'], 'too_early')
        self.assertFalse(early.json()['requires_confirmation'])

        Task.objects.create(
            project=self.project, title='Existing load', assigned_to=self.member_one,
            weight=5, task_weight=5,
        )
        warning = self.client.post(path, {
            'assigned_to_id': self.member_one.id,
            'weight': 2,
        }, format='json')
        self.assertEqual(warning.status_code, 200, warning.json())
        self.assertIn(warning.json()['warning_level'], ('warning', 'critical'))
        self.assertTrue(warning.json()['requires_confirmation'])

    def test_create_requires_due_date_valid_project_and_group_member(self):
        missing_date = self.client.post(f'/api/accounts/groups/{self.group.id}/tasks/assign/', {
            'title': 'No date task', 'assigned_to_id': self.member_one.id, 'weight': 2,
        }, format='json')
        self.assertEqual(missing_date.status_code, 400)
        self.assertIn('due date', missing_date.json()['error'].lower())
        self.assertEqual(Task.objects.count(), 0)

        invalid_project = self.client.post(f'/api/accounts/groups/{self.group.id}/tasks/assign/', {
            'title': 'Wrong project', 'assigned_to_id': self.member_one.id, 'weight': 2,
            'due_date': '2026-11-12', 'project_id': 99999,
        }, format='json')
        self.assertEqual(invalid_project.status_code, 400)

        outsider_assignee = self.client.post(f'/api/accounts/groups/{self.group.id}/tasks/assign/', {
            'title': 'Outsider task', 'assigned_to_id': self.outsider.id, 'weight': 2,
            'due_date': '2026-11-12',
        }, format='json')
        self.assertEqual(outsider_assignee.status_code, 400)
        self.assertEqual(Task.objects.count(), 0)

    def test_reassigning_to_current_assignee_is_rejected_without_activity(self):
        task = Task.objects.create(
            project=self.project, title='Keep owner', assigned_to=self.member_one,
            due_date=timezone.now() + timedelta(days=2),
        )
        response = self.client.post(
            f'/api/accounts/groups/{self.group.id}/tasks/{task.id}/reassign/',
            {'assigned_to_id': self.member_one.id, 'confirm_override': True},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(TaskActivity.objects.filter(task=task).count(), 0)

    def test_weight_change_records_old_and_new_weight_and_noop_is_not_logged(self):
        task = Task.objects.create(
            project=self.project, title='Weighted task', assigned_to=self.member_one,
            weight=2, task_weight=2, due_date=timezone.now() + timedelta(days=2),
        )
        url = f'/api/accounts/groups/{self.group.id}/tasks/{task.id}/weight/'
        changed = self.client.post(url, {'weight': 5}, format='json')
        self.assertEqual(changed.status_code, 200, changed.json())
        task.refresh_from_db()
        self.assertEqual(task.weight, 5)
        activity = TaskActivity.objects.get(task=task, action='weight_changed')
        self.assertEqual((activity.old_weight, activity.new_weight), (2, 5))
        activity_response = self.client.get(f'/api/accounts/groups/{self.group.id}/activity/')
        self.assertEqual(activity_response.status_code, 200, activity_response.json())
        activity_payload = next(item for item in activity_response.json() if item['id'] == activity.id)
        self.assertEqual((activity_payload['old_weight'], activity_payload['new_weight']), (2, 5))

        unchanged = self.client.post(url, {'weight': 5}, format='json')
        self.assertEqual(unchanged.status_code, 200, unchanged.json())
        self.assertEqual(TaskActivity.objects.filter(task=task, action='weight_changed').count(), 1)

    def test_task_workspace_serializes_proposed_board_state(self):
        task = Task.objects.create(
            project=self.project, title='Proposed task', assigned_to=None,
            proposal_status='proposed', proposed_by=self.member_one,
            weight=3, task_weight=3, due_date=timezone.now() + timedelta(days=2),
        )
        response = self.client.get(f'/api/accounts/groups/{self.group.id}/workspace/')
        self.assertEqual(response.status_code, 200, response.json())
        payload = next(item for item in response.json()['tasks'] if item['id'] == task.id)
        self.assertEqual(payload['board_status'], 'proposed')
        self.assertEqual(payload['proposal_status'], 'proposed')
        self.assertEqual(payload['assigned_to_name'], 'Unassigned')

    def test_proposed_task_can_be_approved_open_to_claim_and_claimed(self):
        proposed = self.client.post(f'/api/accounts/groups/{self.group.id}/tasks/propose/', {
            'title': 'Research options', 'weight': 2, 'due_date': '2026-11-20',
            'project_id': self.project.id,
        }, format='json')
        self.assertEqual(proposed.status_code, 201, proposed.json())
        task_id = proposed.json()['task']['id']

        leader_client = APIClient()
        leader_client.force_authenticate(user=self.lecturer)
        approved = leader_client.post(
            f'/api/accounts/groups/{self.group.id}/tasks/{task_id}/approve/',
            {'assignment_mode': 'open_to_claim'}, format='json',
        )
        self.assertEqual(approved.status_code, 200, approved.json())

        claim = self.client.post(
            f'/api/accounts/groups/{self.group.id}/tasks/{task_id}/claim/', {}, format='json',
        )
        self.assertEqual(claim.status_code, 200, claim.json())
        task = Task.objects.get(pk=task_id)
        self.assertEqual(task.assigned_to_id, self.member_one.id)
        self.assertEqual(task.assignment_mode, 'assigned')
        self.assertEqual(TaskActivity.objects.filter(task=task, action='claimed').count(), 1)

    def test_projects_and_polls_are_available_to_group_members(self):
        created_project = self.client.post(
            f'/api/accounts/groups/{self.group.id}/projects/',
            {'title': 'Prototype', 'description': 'Build a working prototype.'}, format='json',
        )
        self.assertEqual(created_project.status_code, 201, created_project.json())

        created_poll = self.client.post(
            f'/api/accounts/groups/{self.group.id}/polls/',
            {'question': 'Which prototype should we build?', 'options': ['Mobile', 'Web']}, format='json',
        )
        self.assertEqual(created_poll.status_code, 201, created_poll.json())
        poll = created_poll.json()
        vote = self.client.post(
            f'/api/accounts/polls/{poll["id"]}/vote/',
            {'option_id': poll['options'][0]['id']}, format='json',
        )
        self.assertEqual(vote.status_code, 200, vote.json())
        self.assertEqual(vote.json()['total_votes'], 1)

    def test_member_can_add_task_comment_and_comment_is_in_workspace(self):
        task = Task.objects.create(
            project=self.project, title='Commentable', assigned_to=self.member_one,
            due_date=timezone.now() + timedelta(days=2),
        )
        response = self.client.post(f'/api/accounts/groups/{self.group.id}/comments/', {
            'task_id': task.id,
            'content': 'I will take this section.',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.json())
        workspace = self.client.get(f'/api/accounts/groups/{self.group.id}/workspace/')
        task_data = next(item for item in workspace.json()['tasks'] if item['id'] == task.id)
        self.assertEqual(task_data['comments'][0]['content'], 'I will take this section.')

    def test_task_workspace_returns_members_tasks_and_update_permission(self):
        due_date = timezone.now() + timedelta(days=2)
        task = Task.objects.create(project=self.project, title='Prepare presentation', assigned_to=self.member_one, due_date=due_date)
        response = self.client.get(f'/api/accounts/groups/{self.group.id}/workspace/')
        self.assertEqual(response.status_code, 200, response.json())
        payload = response.json()
        self.assertEqual(payload['group']['id'], self.group.id)
        self.assertEqual(payload['group']['join_code'], self.group.join_code)
        self.assertEqual(payload['group']['members_count'], 2)
        self.assertEqual(payload['group']['next_deadline'], due_date.isoformat())
        self.assertEqual({member['id'] for member in payload['members']}, {self.member_one.id, self.member_two.id})
        self.assertEqual(payload['tasks'][0]['id'], task.id)
        self.assertEqual(payload['tasks'][0]['assigned_to_id'], self.member_one.id)
        self.assertTrue(payload['tasks'][0]['can_update_progress'])

    def test_microtask_weights_roll_up_to_parent_and_project(self):
        parent = Task.objects.create(
            project=self.project,
            title='Database design',
            assigned_to=self.member_one,
            weight=2,
        )
        completed_microtask = Task.objects.create(
            project=self.project,
            parent_task=parent,
            title='Draw the ERD',
            assigned_to=self.member_one,
            weight=1,
            status='completed',
            progress_percentage=100,
            completed_at=timezone.now(),
        )
        pending_microtask = Task.objects.create(
            project=self.project,
            parent_task=parent,
            title='Write the SQL schema',
            assigned_to=self.member_two,
            weight=3,
        )

        workspace = self.client.get(f'/api/accounts/groups/{self.group.id}/workspace/')
        self.assertEqual(workspace.status_code, 200, workspace.json())
        payload = workspace.json()
        parent_data = next(task for task in payload['tasks'] if task['id'] == parent.id)
        completed_data = next(task for task in payload['tasks'] if task['id'] == completed_microtask.id)
        self.assertTrue(parent_data['is_parent'])
        self.assertEqual(parent_data['progress_percentage'], 25)
        self.assertEqual(parent_data['status'], 'in_progress')
        self.assertEqual(completed_data['completed_at'], completed_microtask.completed_at.isoformat())
        self.assertEqual(payload['project_progress'], 25)
        self.assertEqual(payload['project_status'], 'in_progress')

        second_client = APIClient()
        second_client.force_authenticate(user=self.member_two)
        done = second_client.post(f'/api/accounts/tasks/{pending_microtask.id}/update-status/', {'status': 'completed'}, format='json')
        self.assertEqual(done.status_code, 200, done.json())
        pending_microtask.refresh_from_db()
        self.assertIsNotNone(pending_microtask.completed_at)

        workspace = self.client.get(f'/api/accounts/groups/{self.group.id}/workspace/')
        payload = workspace.json()
        parent_data = next(task for task in payload['tasks'] if task['id'] == parent.id)
        self.assertEqual(parent_data['progress_percentage'], 100)
        self.assertEqual(parent_data['status'], 'completed')
        self.assertEqual(payload['project_progress'], 100)
        self.assertEqual(payload['project_status'], 'completed')
        parent.refresh_from_db()
        self.assertIsNotNone(parent.completed_at)

    def test_parent_task_status_is_derived_from_microtasks(self):
        parent = Task.objects.create(project=self.project, title='Report', assigned_to=self.member_one)
        Task.objects.create(project=self.project, parent_task=parent, title='Introduction', assigned_to=self.member_one)
        response = self.client.post(f'/api/accounts/tasks/{parent.id}/update-status/', {'status': 'completed'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('micro-tasks', response.json()['error'])

    def test_api_creates_due_dated_microtask_under_parent_task(self):
        parent_response = self.client.post(f'/api/accounts/groups/{self.group.id}/tasks/assign/', {
            'title': 'Database design',
            'assigned_to_id': self.member_one.id,
            'weight': 2,
            'due_date': '2026-11-12',
            'confirm_override': True,
        }, format='json')
        self.assertEqual(parent_response.status_code, 201, parent_response.json())
        parent_id = parent_response.json()['task']['id']

        microtask_response = self.client.post(f'/api/accounts/groups/{self.group.id}/tasks/assign/', {
            'title': 'Draw the ERD',
            'assigned_to_id': self.member_two.id,
            'weight': 1,
            'parent_task_id': parent_id,
            'due_date': '2026-11-06',
            'confirm_override': True,
        }, format='json')
        self.assertEqual(microtask_response.status_code, 201, microtask_response.json())
        microtask = Task.objects.get(pk=microtask_response.json()['task']['id'])
        self.assertEqual(microtask.parent_task_id, parent_id)
        self.assertIsNotNone(microtask.due_date)

        workspace = self.client.get(f'/api/accounts/groups/{self.group.id}/workspace/')
        children = [task for task in workspace.json()['tasks'] if task['parent_task_id'] == parent_id]
        self.assertEqual([task['title'] for task in children], ['Draw the ERD'])

    def test_group_activity_returns_latest_events_for_members_and_denies_outsiders(self):
        task = Task.objects.create(project=self.project, title='Chat page', assigned_to=self.member_one)
        created = TaskActivity.objects.create(task=task, actor=self.member_one, action='created', note='Created task')
        TaskActivity.objects.create(
            task=task, actor=self.member_two, action='reassigned', from_user=self.member_one,
            to_user=self.member_two, note='Moved to Brian',
        )

        response = self.client.get(f'/api/accounts/groups/{self.group.id}/activity/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 2)
        self.assertEqual(payload[0]['action'], 'reassigned')
        self.assertEqual(payload[0]['task_title'], 'Chat page')
        self.assertEqual(payload[0]['from_user_name'], 'Brian')
        self.assertEqual(payload[0]['to_user_name'], 'Amina')
        self.assertIn('created_at', payload[0])

        self.client.force_authenticate(user=self.outsider)
        denied = self.client.get(f'/api/accounts/groups/{self.group.id}/activity/')
        self.assertEqual(denied.status_code, 403)

    def test_group_comments_are_visible_to_members_and_denied_to_outsiders(self):
        task = Task.objects.create(project=self.project, title='Design screen', assigned_to=self.member_one)
        TaskComment.objects.create(task=task, author=self.lecturer, content='Please add mobile layouts.')
        response = self.client.get(f'/api/accounts/groups/{self.group.id}/comments/')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()[0]['content'], 'Please add mobile layouts.')
        self.assertEqual(response.json()[0]['author_type'], 'lecturer')

        self.client.force_authenticate(user=self.outsider)
        denied = self.client.get(f'/api/accounts/groups/{self.group.id}/comments/')
        self.assertEqual(denied.status_code, 403)

    def test_only_group_lecturer_can_add_a_comment_for_a_group_task(self):
        task = Task.objects.create(project=self.project, title='Write report', assigned_to=self.member_one)
        self.client.force_authenticate(user=self.lecturer)
        created = self.client.post(f'/api/accounts/groups/{self.group.id}/comments/', {
            'task_id': task.id,
            'content': 'Add references to the report.',
        }, format='json')
        self.assertEqual(created.status_code, 201, created.json())

        self.client.force_authenticate(user=self.member_one)
        listed = self.client.get(f'/api/accounts/groups/{self.group.id}/comments/')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()[0]['content'], 'Add references to the report.')


class StudentSubmissionTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            username='submission-student', email='submission-student@zetech.ac.ke',
            password='StrongPass123', first_name='Moses', user_type='student',
        )
        self.member = User.objects.create_user(
            username='submission-member', email='submission-member@zetech.ac.ke',
            password='StrongPass123', first_name='Janet', user_type='student',
        )
        self.outsider = User.objects.create_user(
            username='submission-outsider', email='submission-outsider@zetech.ac.ke',
            password='StrongPass123', user_type='student',
        )
        self.group = Group.objects.create(
            name='Submission group', course='BBAM', year_of_study='2',
            join_code='SUB123', lecturer=self.student,
        )
        GroupMembership.objects.create(group=self.group, student=self.student, role='admin')
        GroupMembership.objects.create(group=self.group, student=self.member)
        self.project = Project.objects.create(group=self.group, title='Library Management System')
        self.client = APIClient()
        self.client.force_authenticate(user=self.student)
        self.member_one = self.student
        self.member_two = self.member

    def test_group_member_can_create_and_list_submission(self):
        created = self.client.post(
            f'/api/accounts/groups/{self.group.id}/submissions/',
            {'project_id': self.project.id, 'github_url': 'https://github.com/example/library', 'proof_text': 'Final build and report are ready.'},
            format='json',
        )
        self.assertEqual(created.status_code, 201, created.json())
        self.assertEqual(created.json()['status'], 'submitted')
        self.assertEqual(created.json()['submitted_by_name'], 'Moses')

        listed = self.client.get(f'/api/accounts/groups/{self.group.id}/submissions/')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json()), 1)
        self.assertEqual(listed.json()[0]['project_title'], 'Library Management System')

        self.client.force_authenticate(user=self.member)
        shared = self.client.get(f'/api/accounts/groups/{self.group.id}/submissions/')
        self.assertEqual(shared.status_code, 200)
        self.assertEqual(len(shared.json()), 1)

    def test_group_submission_accepts_shared_document_attachments(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            response = self.client.post(
                f'/api/accounts/groups/{self.group.id}/submissions/',
                {
                    'project_id': self.project.id,
                    'proof_text': 'Design files attached.',
                    'attachments': [SimpleUploadedFile('design.txt', b'wireframe notes')],
                },
                format='multipart',
            )
            self.assertEqual(response.status_code, 201, response.json())
            self.assertEqual(response.json()['attachments'][0]['name'], 'design.txt')
            self.assertEqual(SubmissionAttachment.objects.filter(submission_id=response.json()['id']).count(), 1)

    def test_non_member_cannot_list_or_create_group_submission(self):
        self.client.force_authenticate(user=self.outsider)
        listed = self.client.get(f'/api/accounts/groups/{self.group.id}/submissions/')
        self.assertEqual(listed.status_code, 403)
        created = self.client.post(f'/api/accounts/groups/{self.group.id}/submissions/', {'proof_text': 'Not allowed'}, format='json')
        self.assertEqual(created.status_code, 403)

    def test_create_requires_warning_confirmation_and_saves_reason(self):
        Task.objects.create(
            project=self.project,
            title='Existing work',
            assigned_to=self.member_one,
            weight=5,
            task_weight=5,
        )
        payload = {
            'title': 'Research',
            'weight': 3,
            'assigned_to_id': self.member_one.id,
            'due_date': '2026-11-12',
        }
        warning = self.client.post(f'/api/accounts/groups/{self.group.id}/tasks/assign/', payload, format='json')
        self.assertEqual(warning.status_code, 200)
        self.assertIn('balance_warning', warning.json())
        self.assertTrue(warning.json()['requires_confirmation'])
        self.assertEqual(Task.objects.count(), 1)

        payload.update({'confirm_override': True, 'override_reason': 'Time-sensitive expertise'})
        created = self.client.post(f'/api/accounts/groups/{self.group.id}/tasks/assign/', payload, format='json')
        self.assertEqual(created.status_code, 201, created.json())
        activity = TaskActivity.objects.get(task_id=created.json()['task']['id'], action='created')
        self.assertEqual(activity.action, 'created')
        self.assertEqual(activity.actor_id, self.member_one.id)
        self.assertEqual(activity.to_user_id, self.member_one.id)
        self.assertEqual(activity.note, 'Time-sensitive expertise')
        assigned_activity = TaskActivity.objects.get(task_id=created.json()['task']['id'], action='assigned')
        self.assertEqual(assigned_activity.actor_id, self.member_one.id)
        self.assertEqual(assigned_activity.to_user_id, self.member_one.id)

        no_op = self.client.post(
            f'/api/accounts/groups/{self.group.id}/tasks/{created.json()["task"]["id"]}/reassign/',
            {'assigned_to_id': self.member_one.id, 'confirm_override': True},
            format='json',
        )
        self.assertEqual(no_op.status_code, 400)
        self.assertEqual(TaskActivity.objects.filter(task_id=created.json()['task']['id'], action='reassigned').count(), 0)

    def test_reassign_confirmation_and_status_changes_are_logged(self):
        task = Task.objects.create(
            project=self.project,
            title='Small task',
            assigned_to=self.member_two,
            weight=1,
            task_weight=1,
        )
        Task.objects.create(
            project=self.project,
            title='Large task',
            assigned_to=self.member_one,
            weight=5,
            task_weight=5,
        )

        path = f'/api/accounts/groups/{self.group.id}/tasks/{task.id}/reassign/'
        warning = self.client.post(path, {'assigned_to_id': self.member_one.id}, format='json')
        self.assertEqual(warning.status_code, 200)
        self.assertIn('balance_warning', warning.json())
        self.assertTrue(warning.json()['requires_confirmation'])

        reassigned = self.client.post(path, {
            'assigned_to_id': self.member_one.id,
            'confirm_override': True,
            'override_reason': 'Specialist availability',
        }, format='json')
        self.assertEqual(reassigned.status_code, 200)
        activity = TaskActivity.objects.get(task=task)
        self.assertEqual(activity.action, 'reassigned')
        self.assertEqual(activity.from_user_id, self.member_two.id)
        self.assertEqual(activity.to_user_id, self.member_one.id)
        self.assertEqual(activity.note, 'Specialist availability')

        status_response = self.client.post(
            f'/api/accounts/tasks/{task.id}/update-status/',
            {'status': 'in_progress'},
            format='json',
        )
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(TaskActivity.objects.filter(task=task, action='started').count(), 1)

        completed = self.client.post(
            f'/api/accounts/tasks/{task.id}/update-status/',
            {'status': 'completed'},
            format='json',
        )
        self.assertEqual(completed.status_code, 200)
        task.refresh_from_db()
        self.assertIsNotNone(task.completed_at)
        self.assertEqual(TaskActivity.objects.filter(task=task, action='completed').count(), 1)


class NotificationEndpointTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='notif-user', email='notif-user@zetech.ac.ke', password='StrongPass123', user_type='student')
        self.other = User.objects.create_user(
            username='notif-other', email='notif-other@zetech.ac.ke', password='StrongPass123', user_type='student')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        Notification.objects.create(user=self.user, notification_type='task_assigned', title='One', message='m')
        Notification.objects.create(user=self.user, notification_type='task_assigned', title='Two', message='m', is_read=True)
        Notification.objects.create(user=self.other, notification_type='task_assigned', title='Three', message='m')

    def test_mark_all_read_marks_only_own_notifications(self):
        response = self.client.post('/api/accounts/notifications/mark-all-read/', format='json')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()['updated'], 1)
        self.assertFalse(Notification.objects.filter(user=self.user, is_read=False).exists())
        self.assertTrue(Notification.objects.filter(user=self.other, is_read=False).exists())

    def test_patch_notification_toggle_read(self):
        notif = Notification.objects.create(user=self.user, notification_type='task_assigned', title='X', message='m')
        response = self.client.patch(
            f'/api/accounts/notifications/{notif.id}/', {'is_read': True}, format='json')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertTrue(response.json()['is_read'])
        response = self.client.patch(
            f'/api/accounts/notifications/{notif.id}/', {'is_read': False}, format='json')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertFalse(response.json()['is_read'])

    def test_patch_notification_is_own_only(self):
        notif = Notification.objects.create(user=self.other, notification_type='task_assigned', title='X', message='m')
        response = self.client.patch(
            f'/api/accounts/notifications/{notif.id}/', {'is_read': True}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_patch_notification_not_found(self):
        response = self.client.patch('/api/accounts/notifications/999999/', {'is_read': True}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_patch_notification_requires_boolean(self):
        notif = Notification.objects.create(user=self.user, notification_type='task_assigned', title='X', message='m')
        response = self.client.patch(
            f'/api/accounts/notifications/{notif.id}/', {'is_read': 'yes'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_get_notifications_returns_plain_list(self):
        response = self.client.get('/api/accounts/notifications/', {'limit': 50})
        self.assertEqual(response.status_code, 200, response.json())
        body = response.json()
        self.assertIsInstance(body, list)
        self.assertNotIn('results', body)


class NotificationTypeTests(TestCase):
    def test_announcement_is_a_declared_notification_type(self):
        self.assertIn('announcement', dict(Notification.NOTIFICATION_TYPES))


class TaskWeightSaveTests(TestCase):
    def test_save_mirrors_weight_into_task_weight(self):
        course = Course.objects.create(code='CS', name='CS', department='Computing')
        semester = Semester.objects.create(name='Y1S1', year=1, semester=1)
        unit = Unit.objects.create(course=course, code='CS 101', name='Intro', year_of_study=1, semester=1)
        lecturer = User.objects.create_user(
            username='tw-lecturer', email='tw-lecturer@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', first_name='A', last_name='B')
        group = Group.objects.create(name='G', course='CS', year_of_study='2', unit=unit, lecturer=lecturer)
        project = Project.objects.create(group=group, title='P')
        task = Task.objects.create(project=project, title='T', weight=4, task_weight=1)
        self.assertEqual(task.task_weight, 4)
        task.weight = 2
        task.save()
        task.refresh_from_db()
        self.assertEqual(task.task_weight, 2)

    def test_save_is_no_op_when_task_weight_matches_weight(self):
        course = Course.objects.create(code='CS', name='CS', department='Computing')
        semester = Semester.objects.create(name='Y1S1', year=1, semester=1)
        unit = Unit.objects.create(course=course, code='CS 101', name='Intro', year_of_study=1, semester=1)
        lecturer = User.objects.create_user(
            username='tw-lecturer2', email='tw-lecturer2@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', first_name='A', last_name='B')
        group = Group.objects.create(name='G', course='CS', year_of_study='2', unit=unit, lecturer=lecturer)
        project = Project.objects.create(group=group, title='P')
        task = Task.objects.create(project=project, title='T', weight=3, task_weight=3)
        task.save()
        task.refresh_from_db()
        self.assertEqual(task.task_weight, 3)


class JoinCodeTests(TestCase):
    def test_generate_join_code_uses_safe_alphabet(self):
        from accounts.join_codes import generate_join_code, JOIN_CODE_ALPHABET
        code = generate_join_code()
        self.assertEqual(len(code), 6)
        self.assertTrue(all(ch in JOIN_CODE_ALPHABET for ch in code))
        for ch in 'IO01':
            self.assertNotIn(ch, code)

    def test_generate_join_code_is_unique(self):
        from accounts.join_codes import generate_join_code
        code = generate_join_code()
        lecturer = User.objects.create_user(
            username='jc-lecturer', email='jc-lecturer@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', first_name='A', last_name='B')
        Group.objects.create(name='G', course='C', year_of_study='1', join_code=code, lecturer=lecturer)
        self.assertNotEqual(generate_join_code(), code)


class HealthThresholdTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            username='ht-student', email='ht-student@zetech.ac.ke', password='StrongPass123',
            user_type='student', course='C', year_of_study='1', semester=1)
        lecturer = User.objects.create_user(
            username='ht-lecturer', email='ht-lecturer@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', first_name='A', last_name='B')
        self.group = Group.objects.create(name='HG', course='C', year_of_study='1', lecturer=lecturer)
        GroupMembership.objects.create(group=self.group, student=self.student)
        self.project = Project.objects.create(group=self.group, title='P')
        self.task = Task.objects.create(
            project=self.project, title='T', weight=3, status='pending', assigned_to=self.student)
        TaskActivity.objects.create(task=self.task, actor=self.student, action='created')

    def test_balance_reads_minimum_points_from_admin_setting(self):
        from accounts.balance import calculate_group_balance
        AdminSetting.objects.create(key='minimum_points', value=10)
        balance = calculate_group_balance(self.group)
        self.assertEqual(balance['members'][0]['warning_level'], 'too_early')

    def test_health_reads_minimum_points_from_admin_setting(self):
        from accounts.health import compute_group_health
        AdminSetting.objects.create(key='minimum_points', value=10)
        self.assertEqual(compute_group_health(self.group), 'too_early')

    def test_health_reads_overdue_count_from_admin_setting(self):
        from accounts.health import compute_group_health
        AdminSetting.objects.create(key='minimum_points', value=1)
        AdminSetting.objects.create(key='overdue_count', value=1)
        overdue = Task.objects.create(
            project=self.project, title='Overdue', weight=1, status='pending',
            due_date=timezone.now() - timedelta(days=1))
        self.assertEqual(compute_group_health(self.group), 'at_risk')


class HealthEndpointsTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            username='he-student', email='he-student@zetech.ac.ke', password='StrongPass123',
            user_type='student', course='C', year_of_study='1', semester=1)
        course = Course.objects.create(code='HEC', name='HEC', department='Computing')
        unit = Unit.objects.create(course=course, code='HEC 101', name='Intro', year_of_study=1, semester=1)
        lecturer = User.objects.create_user(
            username='he-lecturer', email='he-lecturer@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', first_name='A', last_name='B')
        self.group = Group.objects.create(name='HE', course='C', year_of_study='1', unit=unit, lecturer=lecturer)
        GroupMembership.objects.create(group=self.group, student=self.student)
        self.project = Project.objects.create(group=self.group, title='P')
        self.task = Task.objects.create(project=self.project, title='T', weight=3, status='pending')
        TaskActivity.objects.create(task=self.task, actor=self.student, action='created')
        self.client = APIClient()
        self.client.force_authenticate(user=self.student)

    def test_student_dashboard_returns_health(self):
        response = self.client.get('/api/accounts/dashboard/student/')
        self.assertEqual(response.status_code, 200, response.json())
        group_data = response.json()['groups'][0]
        self.assertIn('health', group_data)
        self.assertIn('status', group_data['health'])
        self.assertIn('reasons', group_data['health'])

    def test_group_workspace_returns_health(self):
        response = self.client.get(f'/api/accounts/groups/{self.group.id}/workspace/')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertIn('health', response.json())
        self.assertIn('status', response.json()['health'])
        self.assertIn('reasons', response.json()['health'])

    def test_lecturer_dashboard_returns_health(self):
        term = Semester.objects.create(name='Y1S1', year=1, semester=1, is_current=True)
        lecturer = User.objects.create_user(
            username='he-lecturer2', email='he-lecturer2@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', first_name='A', last_name='B')
        self.group.lecturer = lecturer
        self.group.save(update_fields=['lecturer'])
        UnitAssignment.objects.create(lecturer=lecturer, unit=self.group.unit, term=term, status='approved')
        client = APIClient()
        client.force_authenticate(user=lecturer)
        response = client.get('/api/accounts/dashboard/lecturer/')
        self.assertEqual(response.status_code, 200, response.json())
        group_data = response.json()['groups'][0]
        self.assertIn('health', group_data)
        self.assertIn('status', group_data['health'])

    def test_admin_groups_returns_health(self):
        admin = User.objects.create_user(
            username='he-admin', email='he-admin@zetech.ac.ke', password='StrongPass123',
            user_type='student', is_staff=True, is_superuser=True)
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.get('/api/accounts/admin/groups/')
        self.assertEqual(response.status_code, 200, response.json())
        row = next(item for item in response.json() if item['id'] == self.group.id)
        self.assertIn('health', row)
        self.assertIn('status', row['health'])
        self.assertIn('reasons', row['health'])


class LoginRouteTests(TestCase):
    def test_views_login_routes_are_removed(self):
        response = APIClient().post('/api/accounts/login/', {'username': 'x', 'password': 'y'}, format='json')
        self.assertEqual(response.status_code, 404)
        response = APIClient().post('/api/accounts/jwt/login/', {'username': 'x', 'password': 'y'}, format='json')
        self.assertEqual(response.status_code, 404)


class ProfileCompleteSharedTests(TestCase):
    def test_compute_profile_complete_lecturer(self):
        from accounts.profile import compute_profile_complete
        complete = User.objects.create_user(
            username='pc-l', email='pc-l@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', first_name='Ada', last_name='Lovelace')
        self.assertTrue(compute_profile_complete(complete))
        incomplete = User.objects.create_user(
            username='pc-l2', email='pc-l2@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', first_name='Ada')
        self.assertFalse(compute_profile_complete(incomplete))

    def test_compute_profile_complete_student(self):
        from accounts.profile import compute_profile_complete
        course = Course.objects.create(code='CS', name='CS', department='Computing')
        complete = User.objects.create_user(
            username='pc-s', email='pc-s@zetech.ac.ke', password='StrongPass123',
            user_type='student', enrolled_course=course, year_of_study='1', semester=1)
        self.assertTrue(compute_profile_complete(complete))
        incomplete = User.objects.create_user(
            username='pc-s2', email='pc-s2@zetech.ac.ke', password='StrongPass123',
            user_type='student', enrolled_course=course)
        self.assertFalse(compute_profile_complete(incomplete))

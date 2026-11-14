"""Scenario tests for lecturer-to-student linking through units and academic terms."""
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import (
    AdminSetting, AuditLog, Course, Group, GroupMembership, Semester,
    StudentEnrollment, Unit, UnitAssignment, User,
)


class AcademicLinkingScenarioTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin1', email='admin1@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', is_staff=True, is_superuser=True,
        )
        self.term = Semester.objects.create(
            name='Year 1 Semester 1', year=1, semester=1,
            start_date='2026-09-01', end_date='2026-12-18', is_current=True,
        )
        self.prog_a = Course.objects.create(code='BSC-A', name='Programme A', department='Computing')
        self.prog_b = Course.objects.create(code='BSC-B', name='Programme B', department='Computing')
        self.unit_a1 = Unit.objects.create(course=self.prog_a, code='A1', name='Alpha', year_of_study=1, semester=1)
        self.unit_shared_a = Unit.objects.create(course=self.prog_a, code='CSC 101', name='Shared A', year_of_study=1, semester=1)
        self.unit_shared_b = Unit.objects.create(course=self.prog_b, code='CSC 101', name='Shared B', year_of_study=1, semester=1)
        self.unit_b1 = Unit.objects.create(course=self.prog_b, code='B1', name='Beta', year_of_study=1, semester=1)

        self.approved_lecturer = User.objects.create_user(
            username='LE1001', email='approved@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', staff_id='LE1001', department='Computing',
        )
        self.pending_lecturer = User.objects.create_user(
            username='LE1002', email='pending@zetech.ac.ke', password='StrongPass123',
            user_type='lecturer', staff_id='LE1002', department='Computing',
        )

        self.student_a1 = self._student('ST1001', 'a1', self.prog_a)
        self.student_a2 = self._student('ST1002', 'a2', self.prog_a)
        self.student_b1 = self._student('ST1003', 'b1', self.prog_b)

        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)

    def _student(self, admission, slug, course):
        return User.objects.create_user(
            username=admission, email=f'{slug}@zetech.ac.ke', password='StrongPass123',
            user_type='student', course=course.name, enrolled_course=course,
            year_of_study='1', semester=1,
            first_name='Student', last_name=admission,
        )

    def _enrol(self, student, unit):
        StudentEnrollment.objects.create(student=student, unit=unit, semester=self.term)

    def _approve(self, lecturer, unit):
        assignment = UnitAssignment.objects.create(
            lecturer=lecturer, unit=unit, term=self.term, status='approved',
            requested_by=lecturer, approved_by=self.admin,
        )
        unit.assigned_lecturer = lecturer
        unit.save(update_fields=['assigned_lecturer'])
        return assignment

    def test_admin_creates_terms_and_marks_one_current(self):
        response = self.admin_client.post('/api/accounts/admin/terms/', {
            'name': 'Year 2 Semester 1', 'year': 2, 'semester': 1,
            'start_date': '2027-01-11', 'end_date': '2027-04-30', 'is_current': True,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.json())
        self.term.refresh_from_db()
        self.assertFalse(self.term.is_current)
        new_term = Semester.objects.get(name='Year 2 Semester 1')
        self.assertTrue(new_term.is_current)
        self.assertTrue(AuditLog.objects.filter(action='create_term').exists())

        switched = self.admin_client.post(f'/api/accounts/admin/terms/{self.term.id}/make_current/')
        self.assertEqual(switched.status_code, 200)
        self.term.refresh_from_db()
        new_term.refresh_from_db()
        self.assertTrue(self.term.is_current)
        self.assertFalse(new_term.is_current)

    def test_student_settings_auto_enrols_and_removes_stale_enrolments(self):
        client = APIClient()
        client.force_authenticate(user=self.student_a1)
        response = client.patch('/api/accounts/profile/settings/', {
            'first_name': 'A', 'last_name': 'One',
            'course_id': self.prog_a.id, 'year_of_study': 1, 'semester': 1,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(
            set(StudentEnrollment.objects.filter(
                student=self.student_a1, semester=self.term,
            ).values_list('unit_id', flat=True)),
            {self.unit_a1.id, self.unit_shared_a.id},
        )

        # Move to programme B: programme A enrolments for this term must be removed.
        response = client.patch('/api/accounts/profile/settings/', {
            'first_name': 'A', 'last_name': 'One',
            'course_id': self.prog_b.id, 'year_of_study': 1, 'semester': 1,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(
            set(StudentEnrollment.objects.filter(
                student=self.student_a1, semester=self.term,
            ).values_list('unit_id', flat=True)),
            {self.unit_b1.id, self.unit_shared_b.id},
        )

    def test_lecturer_setup_creates_pending_and_auto_approves_unclaimed_units(self):
        AdminSetting.objects.update_or_create(
            key='auto_approve_lecturer_claims', defaults={'value': True},
        )
        client = APIClient()
        client.force_authenticate(user=self.approved_lecturer)
        response = client.post('/api/accounts/lecturer/setup/', {
            'unit_ids': [self.unit_a1.id, self.unit_shared_a.id, self.unit_shared_b.id],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(
            set(UnitAssignment.objects.filter(
                lecturer=self.approved_lecturer, term=self.term, status='approved',
            ).values_list('unit_id', flat=True)),
            {self.unit_a1.id, self.unit_shared_a.id, self.unit_shared_b.id},
        )
        self.assertTrue(AuditLog.objects.filter(action='lecturer_claim_units').exists())

        # The same unit code can be claimed across programmes (two distinct unit ids).
        self.assertEqual(
            UnitAssignment.objects.filter(
                lecturer=self.approved_lecturer, unit__code='CSC 101', term=self.term,
            ).count(), 2,
        )

    def test_pending_lecturer_sees_nothing_and_unrelated_lecturer_gets_403(self):
        self._approve(self.approved_lecturer, self.unit_a1)
        self._enrol(self.student_a1, self.unit_a1)
        group = Group.objects.create(
            name='Alpha group', course=self.prog_a.name, year_of_study='1',
            join_code='ALPHA1', unit=self.unit_a1, term=self.term,
            lecturer=self.approved_lecturer,
        )
        GroupMembership.objects.create(group=group, student=self.student_a1)

        pending_client = APIClient()
        pending_client.force_authenticate(user=self.pending_lecturer)
        claim = pending_client.post('/api/accounts/lecturer/setup/', {
            'unit_ids': [self.unit_a1.id],
        }, format='json')
        self.assertEqual(claim.status_code, 200, claim.json())
        self.assertTrue(UnitAssignment.objects.filter(
            lecturer=self.pending_lecturer, unit=self.unit_a1, term=self.term, status='pending',
        ).exists())

        units = pending_client.get('/api/accounts/lecturer/units/')
        self.assertEqual(units.status_code, 200)
        self.assertEqual(units.json()['status'], 'pending')
        self.assertEqual(units.json()['message'], 'Waiting for approval')
        self.assertEqual(units.json()['units'], [])

        # An unrelated lecturer (no approved assignment) is refused on another unit's group.
        denied = pending_client.get(f'/api/accounts/groups/{group.id}/tasks/')
        self.assertEqual(denied.status_code, 403)

        approved_client = APIClient()
        approved_client.force_authenticate(user=self.approved_lecturer)
        allowed = approved_client.get(f'/api/accounts/groups/{group.id}/tasks/')
        self.assertEqual(allowed.status_code, 200)

    def test_admin_queue_decision_and_load(self):
        self._approve(self.approved_lecturer, self.unit_a1)
        self._approve(self.approved_lecturer, self.unit_shared_a)
        pending = UnitAssignment.objects.create(
            lecturer=self.pending_lecturer, unit=self.unit_b1, term=self.term,
            status='pending', requested_by=self.pending_lecturer,
        )

        before = self.admin_client.get(f'/api/accounts/admin/lecturers/{self.pending_lecturer.id}/load/')
        self.assertEqual(before.json()['approved_count'], 0)
        self.assertEqual(before.json()['pending_count'], 1)

        queue = self.admin_client.get('/api/accounts/admin/assignments/pending/')
        self.assertEqual(queue.status_code, 200)
        self.assertEqual([row['id'] for row in queue.json()], [pending.id])

        approved = self.admin_client.post(f'/api/accounts/admin/assignments/{pending.id}/approve/')
        self.assertEqual(approved.status_code, 200)
        pending.refresh_from_db()
        self.assertEqual(pending.status, 'approved')
        self.unit_b1.refresh_from_db()
        self.assertEqual(self.unit_b1.assigned_lecturer_id, self.pending_lecturer.id)

        second = UnitAssignment.objects.create(
            lecturer=self.pending_lecturer, unit=self.unit_shared_b, term=self.term,
            status='pending', requested_by=self.pending_lecturer,
        )
        rejected = self.admin_client.post(f'/api/accounts/admin/assignments/{second.id}/reject/')
        self.assertEqual(rejected.status_code, 200)
        second.refresh_from_db()
        self.assertEqual(second.status, 'rejected')

        unassigned = self.admin_client.get('/api/accounts/admin/assignments/unassigned/')
        unassigned_ids = {row['id'] for row in unassigned.json()}
        self.assertNotIn(self.unit_a1.id, unassigned_ids)
        self.assertNotIn(self.unit_b1.id, unassigned_ids)
        self.assertIn(self.unit_shared_b.id, unassigned_ids)

        load = self.admin_client.get(f'/api/accounts/admin/lecturers/{self.pending_lecturer.id}/load/')
        self.assertEqual(load.status_code, 200)
        self.assertEqual(load.json()['approved_count'], 1)
        self.assertEqual(load.json()['pending_count'], 0)
        self.assertTrue(AuditLog.objects.filter(action='approve_unit_assignment').exists())
        self.assertTrue(AuditLog.objects.filter(action='reject_unit_assignment').exists())

    def test_lecturer_my_units_includes_students_groups_and_risk(self):
        self._approve(self.approved_lecturer, self.unit_a1)
        self._enrol(self.student_a1, self.unit_a1)
        self._enrol(self.student_a2, self.unit_a1)
        Group.objects.create(
            name='Alpha one', course=self.prog_a.name, year_of_study='1',
            join_code='ALPHA2', unit=self.unit_a1, term=self.term,
            lecturer=self.approved_lecturer,
        )

        client = APIClient()
        client.force_authenticate(user=self.approved_lecturer)
        response = client.get('/api/accounts/lecturer/units/')
        self.assertEqual(response.status_code, 200, response.json())
        body = response.json()
        self.assertEqual(body['status'], 'ok')
        unit = next(item for item in body['units'] if item['id'] == self.unit_a1.id)
        self.assertEqual(unit['student_count'], 2)
        self.assertEqual(
            {student['admission_number'] for student in unit['students']},
            {'ST1001', 'ST1002'},
        )
        self.assertEqual(len(unit['groups']), 1)
        self.assertEqual(len(unit['students_without_group']), 2)

    def test_classmates_returns_only_enrolled_students_with_admission_number(self):
        self._enrol(self.student_a1, self.unit_a1)
        self._enrol(self.student_a2, self.unit_a1)
        # student_b1 shares the unit code but not the unit: must not appear.

        client = APIClient()
        client.force_authenticate(user=self.student_a1)
        response = client.get(f'/api/accounts/units/{self.unit_a1.id}/classmates/')
        self.assertEqual(response.status_code, 200, response.json())
        rows = response.json()
        self.assertEqual({row['admission_number'] for row in rows}, {'ST1002'})
        self.assertEqual(rows[0]['name'], 'Student ST1002')

    def test_rollover_advances_students_archives_groups_and_copies_pending(self):
        self._approve(self.approved_lecturer, self.unit_a1)
        self._enrol(self.student_a1, self.unit_a1)
        group = Group.objects.create(
            name='Alpha group', course=self.prog_a.name, year_of_study='1',
            join_code='ROLL01', unit=self.unit_a1, term=self.term,
            lecturer=self.approved_lecturer,
        )

        confirm = self.admin_client.post('/api/accounts/admin/rollover/', {'confirm': True}, format='json')
        self.assertEqual(confirm.status_code, 200, confirm.json())
        self.assertEqual(confirm.json()['archived_groups'], 1)
        group.refresh_from_db()
        self.assertTrue(group.is_archived)
        self.student_a1.refresh_from_db()
        self.assertEqual(self.student_a1.semester, 2)

        new_term = Semester.objects.get(year=1, semester=2)
        self.assertTrue(new_term.is_current)
        self.term.refresh_from_db()
        self.assertFalse(self.term.is_current)
        self.assertTrue(UnitAssignment.objects.filter(
            lecturer=self.approved_lecturer, unit=self.unit_a1, term=new_term, status='pending',
        ).exists())
        self.assertTrue(AuditLog.objects.filter(action='rollover_term').exists())
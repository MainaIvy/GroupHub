import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta
from accounts.models import (
    User, Semester, Course, Unit, UnitAssignment,
    StudentEnrollment, Group, GroupMembership, Project, Task,
    TaskActivity, Notification, ChatRoom, Message, AuditLog
)
from accounts.services.insights import compute_group_insights, get_group_insights_for_user

print("=== E2E Flow Test ===\n")

client = APIClient()

# Cleanup any existing data
from accounts.models import (
    User, Semester, Course, Unit, UnitAssignment, Group, Task, ChatRoom, 
    Message, AuditLog, Notification, StudentEnrollment, GroupMembership, 
    Project, Submission, TaskSubmission, SubmissionAttachment, TaskComment, 
    Poll, PollOption, PollVote, TaskActivity, Announcement, AdminSetting, 
    LecturerRoster, ImportBatch, GroupInvite, JoinRequest, NotificationSettings
)
# Delete in reverse dependency order
AuditLog.objects.all().delete()
Notification.objects.all().delete()
Message.objects.all().delete()
ChatRoom.objects.all().delete()
TaskSubmission.objects.all().delete()
SubmissionAttachment.objects.all().delete()
TaskComment.objects.all().delete()
TaskActivity.objects.all().delete()
PollVote.objects.all().delete()
PollOption.objects.all().delete()
Poll.objects.all().delete()
Task.objects.all().delete()
Project.objects.all().delete()
GroupMembership.objects.all().delete()
GroupInvite.objects.all().delete()
JoinRequest.objects.all().delete()
Group.objects.all().delete()
StudentEnrollment.objects.all().delete()
UnitAssignment.objects.all().delete()
Unit.objects.all().delete()
Course.objects.all().delete()
Semester.objects.all().delete()
NotificationSettings.objects.all().delete()
AdminSetting.objects.all().delete()
Announcement.objects.all().delete()
LecturerRoster.objects.all().delete()
ImportBatch.objects.all().delete()
User.objects.all().delete()

# 1. ADMIN SETUP - Create term, programmes, courses, units
print("1. Admin creates academic structure...")
term = Semester.objects.create(
    name="2024-2025 Semester 1",
    year=2024,
    semester=1,
    start_date=timezone.now().date() - timedelta(days=60),
    end_date=timezone.now().date() + timedelta(days=120),
    is_current=True
)

cs_course = Course.objects.create(code="CS", name="BSc Computer Science", department="Computer Science")
se_course = Course.objects.create(code="SE", name="BSc Software Engineering", department="Computer Science")

# Create units for CS Year 3 Semester 1
unit1 = Unit.objects.create(
    code="CS311", name="Database Systems", course=cs_course, year_of_study=3, semester=1,
    academic_level="undergraduate"
)
unit2 = Unit.objects.create(
    code="CS312", name="Software Engineering", course=cs_course, year_of_study=3, semester=1,
    academic_level="undergraduate"
)

# Create another unit for a different programme (for test c/d)
se_unit1 = Unit.objects.create(
    code="SE311", name="Advanced SE", course=se_course, year_of_study=3, semester=1,
    academic_level="undergraduate"
)

# Create admin user
admin = User.objects.create_superuser(username="admin", email="admin@zetech.ac.ke", password="AdminPass123")
admin.is_staff = True
admin.user_type = 'lecturer'
admin.save()
client.force_authenticate(user=admin)

# Create lecturers
lecturer1 = User.objects.create_user(
    username="lecturer1", email="lecturer1@zetech.ac.ke", password="DemoPass123",
    first_name="Dr. John", last_name="Karis", user_type="lecturer",
    staff_id="LE1234", department="CS"
)
lecturer2 = User.objects.create_user(
    username="lecturer2", email="lecturer2@zetech.ac.ke", password="DemoPass123",
    first_name="Prof. Mary", last_name="Mwangi", user_type="lecturer",
    staff_id="LE1235", department="CS"
)

# Lecturer for different unit
lecturer3 = User.objects.create_user(
    username="lecturer3", email="lecturer3@zetech.ac.ke", password="DemoPass123",
    first_name="Dr. Alex", last_name="Ng", user_type="lecturer",
    staff_id="LE1236", department="SE"
)

assign1 = UnitAssignment.objects.create(unit=unit1, lecturer=lecturer1, term=term, status='approved', approved_by=admin)
assign2 = UnitAssignment.objects.create(unit=unit2, lecturer=lecturer2, term=term, status='approved', approved_by=admin)
assign3 = UnitAssignment.objects.create(unit=se_unit1, lecturer=lecturer3, term=term, status='approved', approved_by=admin)
print(f"   Assigned {unit1.code} to {lecturer1.get_full_name()}")
print(f"   Assigned {unit2.code} to {lecturer2.get_full_name()}")
print(f"   Assigned {se_unit1.code} to {lecturer3.get_full_name()}")

# 2. LECTURER LOGS IN
print("\n2. Lecturer logs in...")
client.force_authenticate(user=lecturer1)
lec_dashboard = client.get("/api/accounts/dashboard/lecturer/")
print(f"   Lecturer dashboard: {lec_dashboard.status_code}")
if lec_dashboard.status_code == 200:
    data = lec_dashboard.json()
    print(f"   Units: {[u['code'] for u in data.get('units', [])]}")
    print(f"   Enrolled students: {len(data.get('enrolled_students', []))}")

# 3. STUDENTS SIGN UP
print("\n3. Students sign up...")
students = []
for i, (fname, lname, email) in enumerate([
    ("Amina", "Ochieng", "amina@zetech.ac.ke"),
    ("Brian", "Kiprotich", "brian@zetech.ac.ke"),
    ("Wanjiku", "Njeri", "wanjiku@zetech.ac.ke"),
    ("Kevin", "Mutua", "kevin@zetech.ac.ke"),
    ("Leila", "Abdullahi", "leila@zetech.ac.ke"),
    ("Omar", "Hassan", "omar@zetech.ac.ke"),
    ("Fatuma", "Ali", "fatuma@zetech.ac.ke"),
    ("Yusuf", "Mohamed", "yusuf@zetech.ac.ke"),
]):
    student = User.objects.create_user(
        username=f"ADM{1000+i}", email=email, password="DemoPass123",
        first_name=fname, last_name=lname, user_type="student",
        course="CS", year_of_study=3, semester=1,
        enrolled_course=cs_course
    )
    # Create enrollment records
    StudentEnrollment.objects.create(student=student, unit=unit1, semester=term)
    StudentEnrollment.objects.create(student=student, unit=unit2, semester=term)
    students.append(student)
    print(f"   Created {fname} {lname}")

# STUDENTS FROM DIFFERENT UNIT (for test d)
print("\n   Creating students from different unit (SE)...")
se_students = []
for i, (fname, lname, email) in enumerate([
    ("SE_Student1", "One", "se1@zetech.ac.ke"),
    ("SE_Student2", "Two", "se2@zetech.ac.ke"),
]):
    student = User.objects.create_user(
        username=f"SE{1000+i}", email=email, password="DemoPass123",
        first_name=fname, last_name=lname, user_type="student",
        course="SE", year_of_study=3, semester=1,
        enrolled_course=se_course
    )
    # Create enrollment for SE unit
    StudentEnrollment.objects.create(student=student, unit=se_unit1, semester=term)
    se_students.append(student)
    print(f"   Created {fname} {lname}")

# (a) Assert lecturer's unit shows 8 enrolled students
print("\n3a. Assert lecturer's unit shows 8 enrolled students...")
client.force_authenticate(user=lecturer1)
lec_dashboard = client.get("/api/accounts/dashboard/lecturer/")
if lec_dashboard.status_code == 200:
    data = lec_dashboard.json()
    # Check stats.total_students and units[0].students
    total_students = data.get('stats', {}).get('total_students', 0)
    unit_students = data.get('units', [{}])[0].get('students', []) if data.get('units') else []
    print(f"   Total students (stats): {total_students}")
    print(f"   Students in unit[0]: {len(unit_students)}")
    assert total_students == 8, f"Expected 8 total students, got {total_students}"
    assert len(unit_students) == 8, f"Expected 8 students in unit, got {len(unit_students)}"
    print("   OK: Lecturer sees 8 enrolled students")

# 4. STUDENT CREATES GROUP
print("\n4. Student creates group...")
client.force_authenticate(user=students[0])
leader = students[0]

group_resp = client.post("/api/accounts/groups/create/", {
    "name": "CS311 Project Team Alpha",
    "unit_id": unit1.id,
    "year_of_study": 3,
    "max_members": 8,
    "description": "Database project group"
}, format="json")
print(f"   Create group: {group_resp.status_code}")
if group_resp.status_code == 201:
    group_data = group_resp.json()
    group_id = group_data['group']['id']
    join_code = group_data['group']['join_code']
    print(f"   Group ID: {group_id}, Join code: {join_code}")
else:
    print(f"   Error: {group_resp.json()}")

# 5. CLASSMATES JOIN GROUP
print("\n5. Classmates join group...")
for student in students[1:]:  # All 7 remaining students join (total 8)
    client.force_authenticate(user=student)
    join_resp = client.post("/api/accounts/groups/join/", {
        "code": join_code
    }, format="json")
    print(f"   {student.first_name} joins: {join_resp.status_code}")
    if join_resp.status_code != 200:
        print(f"   Error: {join_resp.json()}")

group = Group.objects.get(id=group_id)
print(f"   Group members: {GroupMembership.objects.filter(group=group).count()}")

# 6. TASKS ADDED WITH WEIGHTS (normal distribution)
print("\n6. Tasks added with weights (normal)...")
client.force_authenticate(user=leader)

project = Project.objects.filter(group=group).first()
if not project:
    project = Project.objects.create(group=group, title=group.name, description='Group task workspace')
print(f"   Project: {project.title}")

tasks = []
for title, weight, assignee in [
    ("Design ER Diagram", 3, students[0]),
    ("Create Tables", 4, students[1]),
    ("Write Queries", 5, students[2]),
    ("Build API", 5, students[3]),
    ("Write Tests", 3, students[4]),
    ("Documentation", 2, students[5]),
    ("Code Review", 2, students[6]),
    ("Deployment", 2, students[7]),
]:
    task_resp = client.post(f"/api/accounts/groups/{group_id}/tasks/assign/", {
        "title": title,
        "assigned_to_id": assignee.id,
        "weight": weight,
        "due_date": (timezone.now() + timedelta(days=7)).date().isoformat(),
        "confirm_override": True
    }, format="json")
    if task_resp.status_code == 201:
        task = task_resp.json()['task']
        tasks.append(task)
        print(f"   Created: {title} (weight={weight}) -> {assignee.first_name}")

# 7. OVERLOAD WARNING (normal - should not trigger)
print("\n7. Check overload warning (normal)...")
client.force_authenticate(user=leader)
balance_resp = client.get(f"/api/accounts/groups/{group_id}/balance/")
if balance_resp.status_code == 200:
    balance = balance_resp.json()
    warnings = [m for m in balance['members'] if m['warning_level'] in ['warning', 'critical']]
    print(f"   Members with warning/critical: {len(warnings)}")
    for member in balance['members']:
        print(f"     {member['name']}: {member['points_assigned']} pts ({member['warning_level']})")

# (b) SCENARIO: One member holds ~60% of points with 6+ total points
print("\n6b. SCENARIO: One member holds ~60% of points...")
# Clear existing tasks
Task.objects.filter(project=project).delete()

# Create tasks where one student gets 12 out of 20 points (60%)
overloaded_tasks = []
for title, weight, assignee in [
    ("Heavy Task 1", 5, students[0]),  # 5 pts
    ("Heavy Task 2", 5, students[0]),  # 5 pts
    ("Heavy Task 3", 2, students[0]),  # 2 pts = 12 total for student[0]
    ("Light Task 1", 3, students[1]),
    ("Light Task 2", 2, students[2]),
    ("Light Task 3", 1, students[3]),
    ("Light Task 4", 1, students[4]),
    ("Light Task 5", 1, students[5]),
]:
    task_resp = client.post(f"/api/accounts/groups/{group_id}/tasks/assign/", {
        "title": title,
        "assigned_to_id": assignee.id,
        "weight": weight,
        "due_date": (timezone.now() + timedelta(days=7)).date().isoformat(),
        "confirm_override": True
    }, format="json")
    if task_resp.status_code == 201:
        task = task_resp.json()['task']
        overloaded_tasks.append(task)
        print(f"   Created: {title} (weight={weight}) -> {assignee.first_name}")

# Check balance - should flag student[0] as warning/critical
balance_resp = client.get(f"/api/accounts/groups/{group_id}/balance/")
if balance_resp.status_code == 200:
    balance = balance_resp.json()
    for member in balance['members']:
        if member['user_id'] == students[0].id:
            print(f"   Overloaded member: {member['name']}: {member['points_assigned']} pts ({member['warning_level']})")
            assert member['warning_level'] in ['warning', 'critical'], f"Expected warning/critical, got {member['warning_level']}"
            print("   OK: Balance flags overloaded member")

# Check assign endpoint returns projected warning for another task to same student
print("\n   Testing assign endpoint projection for overloaded member...")
task_resp = client.post(f"/api/accounts/groups/{group_id}/tasks/assign/", {
    "title": "Another Heavy Task",
    "assigned_to_id": students[0].id,
    "weight": 3,
    "due_date": (timezone.now() + timedelta(days=7)).date().isoformat(),
    "confirm_override": False  # Don't confirm - should get warning
}, format="json")
print(f"   Assign response: {task_resp.status_code}")
if task_resp.status_code == 200 and 'balance_warning' in task_resp.json():
    print(f"   OK: Assign returns projected warning: {task_resp.json().get('balance_warning')}")
elif task_resp.status_code == 201:
    print("   Task created (no warning)")
else:
    print(f"   Response: {task_resp.json()}")

# (c) Assert lecturer on another unit gets 403 on this group
print("\n(c) Assert lecturer on another unit gets 403 on this group...")
client.force_authenticate(user=lecturer3)
# Try to access group workspace
resp = client.get(f"/api/accounts/groups/{group_id}/workspace/")
print(f"   Lecturer3 (different unit) accessing workspace: {resp.status_code}")
assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
print("   OK: Lecturer on different unit gets 403")

# Try to access group balance
resp = client.get(f"/api/accounts/groups/{group_id}/balance/")
print(f"   Lecturer3 accessing balance: {resp.status_code}")
assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
print("   OK: Lecturer on different unit gets 403 on balance")

# (d) Assert student from different unit cannot read this group or see classmates
print("\n(d) Assert student from different unit cannot read group/classmates...")
client.force_authenticate(user=se_students[0])

# Try to access group workspace
resp = client.get(f"/api/accounts/groups/{group_id}/workspace/")
print(f"   SE student accessing workspace: {resp.status_code}")
assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
print("   OK: SE student gets 403 on workspace")

# Try to access group balance
resp = client.get(f"/api/accounts/groups/{group_id}/balance/")
print(f"   SE student accessing balance: {resp.status_code}")
assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
print("   OK: SE student gets 403 on balance")

# Try to see classmates
resp = client.get(f"/api/accounts/units/{unit1.id}/classmates/")
print(f"   SE student accessing classmates: {resp.status_code}")
assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
print("   OK: SE student gets 403 on classmates")

# (e) Assert lecturer, student and admin endpoints return same balance and health
print("\n(e) Assert lecturer, student and admin endpoints return same balance and health...")

# Get balance from student (leader)
client.force_authenticate(user=leader)
student_balance = client.get(f"/api/accounts/groups/{group_id}/balance/")
student_ws = client.get(f"/api/accounts/groups/{group_id}/workspace/")
print(f"   Student balance: {student_balance.status_code}, workspace: {student_ws.status_code}")
student_balance_data = student_balance.json() if student_balance.status_code == 200 else {}
student_health = student_ws.json().get('health') if student_ws.status_code == 200 else None

# Get balance from lecturer1 (assigned to unit)
client.force_authenticate(user=lecturer1)
lecturer_balance = client.get(f"/api/accounts/groups/{group_id}/balance/")
lecturer_ws = client.get(f"/api/accounts/groups/{group_id}/workspace/")
print(f"   Lecturer balance: {lecturer_balance.status_code}, workspace: {lecturer_ws.status_code}")
lecturer_balance_data = lecturer_balance.json() if lecturer_balance.status_code == 200 else {}
lecturer_health = lecturer_ws.json().get('health') if lecturer_ws.status_code == 200 else None

# Get balance from admin
client.force_authenticate(user=admin)
admin_balance = client.get(f"/api/accounts/groups/{group_id}/balance/")
admin_groups = client.get("/api/accounts/admin/groups/")
print(f"   Admin balance: {admin_balance.status_code}, admin groups: {admin_groups.status_code}")
admin_balance_data = admin_balance.json() if admin_balance.status_code == 200 else {}
admin_health = None
if admin_groups.status_code == 200:
    for g in admin_groups.json():
        if g['id'] == group_id:
            admin_health = g.get('health')
            break

# Compare
print(f"\n   Student health: {student_health}")
print(f"   Lecturer health: {lecturer_health}")
print(f"   Admin health: {admin_health}")

assert student_health == lecturer_health == admin_health, f"Health mismatch: student={student_health}, lecturer={lecturer_health}, admin={admin_health}"
print("   OK: Health matches across all three roles")

# Compare balance totals
student_total = sum(m['points_assigned'] for m in student_balance_data.get('members', []))
lecturer_total = sum(m['points_assigned'] for m in lecturer_balance_data.get('members', []))
admin_total = sum(m['points_assigned'] for m in admin_balance_data.get('members', []))
print(f"   Student total points: {student_total}")
print(f"   Lecturer total points: {lecturer_total}")
print(f"   Admin total points: {admin_total}")

assert student_total == lecturer_total == admin_total, f"Balance totals mismatch: student={student_total}, lecturer={lecturer_total}, admin={admin_total}"
print("   OK: Balance totals match across all three roles")

# 8. CHAT MESSAGE SENT
print("\n8. Send chat message...")
client.force_authenticate(user=students[1])
chat_room = ChatRoom.objects.filter(group=group, chat_type='group').first()
if chat_room:
    chat_resp = client.post(f"/api/accounts/chat/send/{chat_room.id}/", {
        "content": "Hello team! Let's start with the ER diagram.",
        "message_type": "text"
    }, format="json")
    if chat_resp.status_code in (200, 201):
        print(f"   Chat message: {chat_resp.status_code} OK")
    else:
        print(f"   Chat message: {chat_resp.status_code} FAIL")
        print(f"   Error: {chat_resp.json()}")
else:
    print("   No chat room found")

# 9. TASK COMPLETED
print("\n9. Complete a task...")
client.force_authenticate(user=students[0])
task_to_complete = overloaded_tasks[0]['id']
complete_resp = client.post(f"/api/accounts/tasks/{task_to_complete}/update-status/", {
    "status": "completed"
}, format="json")
print(f"   Complete task: {complete_resp.status_code}")

client.force_authenticate(user=leader)
workspace_resp = client.get(f"/api/accounts/groups/{group_id}/workspace/")
if workspace_resp.status_code == 200:
    ws = workspace_resp.json()
    print(f"   Project progress: {ws.get('project_progress')}%")
    print(f"   Project status: {ws.get('project_status')}")

# 10. WORK SUBMITTED
print("\n10. Submit work...")
client.force_authenticate(user=students[0])
submit_resp = client.post(f"/api/accounts/groups/{group_id}/submissions/", {
    "proof_text": "Created all database tables with indexes",
    "project_id": project.id
}, format="json")
if submit_resp.status_code in (200, 201):
    print(f"   Submit work: {submit_resp.status_code} OK")
else:
    print(f"   Submit work: {submit_resp.status_code} FAIL")
    print(f"   Error: {submit_resp.json()}")

# 11. LECTURER SEES CONTRIBUTION
print("\n11. Lecturer sees contribution...")
client.force_authenticate(user=lecturer1)
lec_dashboard = client.get("/api/accounts/dashboard/lecturer/")
if lec_dashboard.status_code == 200:
    data = lec_dashboard.json()
    contributions = data.get('contributions', [])
    print(f"   Contributions for {len(contributions)} students:")
    for c in contributions:
        print(f"     {c['name']}: {c['points_assigned']} assigned, {c['points_completed']} completed, {c['tasks_completed']} tasks done")

# Also check admin
client.force_authenticate(user=admin)
admin_groups = client.get("/api/accounts/admin/groups/")
if admin_groups.status_code == 200:
    data = admin_groups.json()
    for g in data:
        if g['id'] == group_id:
            print(f"   Admin sees group health: {g.get('health')}")

print("\n=== E2E Flow Complete ===")
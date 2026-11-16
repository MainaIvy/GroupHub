# GroupHub Backend Audit

Scope: `backend/accounts` (Django 5.2 + DRF + SimpleJWT + Channels), `backend/backend`
(settings/urls), and the React/Flutter clients that consume the API. Factual snapshot of
the code as read; `makemigrations --check --dry-run` returns **"No changes detected"** (no
model/migration drift). Findings ranked by severity.

---

## 1. Models — fields & relations

All in `backend/accounts/models.py`.

### User (AbstractUser)
`username` (unique), `email` (unique), `user_type` (student|lecturer, default student),
`university`, `course` (free text), `academic_level`, `year_of_study` (CharField),
`staff_id`, `department`, `courses_taught`, `salutation`, `failed_attempts`, `email_verified`,
`avatar` (ImageField), `avatar_url` (URL), `status` (pending|active|suspended, default active),
`enrolled_course` (FK→Course, SET_NULL), `semester` (PositiveSmallInt). Inherited: password,
first/last name, is_staff, is_superuser, is_active, date_joined.
Relations (reverse): `lecturer_groups`, `group_memberships`, `assigned_tasks`,
`task_activity_actions`, `task_activity_from/to`, `proposed_tasks`, `weight_confirmations`,
`submissions`, `task_work_items`, `sent_messages`, `notifications`, `notification_settings`,
`enrollments`, `assigned_units`, `unit_assignments`, `requested_unit_assignments`,
`approved_unit_assignments`, `audit_logs`, `announcements`, `polls_created`,
`poll_options_added`, `poll_votes`, `group_invites_received/sent`, `join_requests`,
`import_batches`, `chat_rooms_as_user1/2`.

### LecturerRoster
`email` (unique), `full_name`, `department`, `staff_id`, `status` (invited|active|deactivated),
`created_at`, `activated_at`, `activation_token`, `activation_token_expires`, `reset_token`,
`reset_token_expires`.

### ImportBatch
`type` (lecturer_roster), `file_name`, `mode` (add|replace), `created_by` (FK→User, PROTECT),
`created_at`, `summary` (JSON), `status` (committed|undone). Reverse: `unit_assignments`.

### Group
`name`, `course` (free text), `year_of_study`, `description`, `join_code` (unique, 6 chars),
`unit_code`, `academic_term`, `term` (FK→Semester, SET_NULL), `is_archived`, `is_locked`,
`max_members` (default 5), `unit` (FK→Unit, SET_NULL), `lecturer` (FK→User, CASCADE),
`created_at`, `updated_at`. Property `members_count = memberships.count()`.
Reverse: `memberships`, `projects`, `chat_room` (OneToOne), `polls`, `invites`,
`join_requests`, `submissions` (via Project).
> `Group.lecturer` is overloaded: for student-created groups it stores the *student leader*,
> not a lecturer (see §4).

### GroupMembership
`group` (FK→Group, CASCADE), `student` (FK→User, CASCADE), `role` (member|admin),
`joined_at`. `unique_together = [group, student]`.

### Project
`title`, `description`, `group` (FK→Group, CASCADE), `status` (active|completed|cancelled),
`created_at`, `updated_at`, `deadline`. Reverse: `tasks`, `submissions`.

### Task
`title`, `description`, `project` (FK→Project, CASCADE), `assigned_to` (FK→User, CASCADE,
null), `status` (pending|in_progress|completed), `assignment_mode` (assigned|open_to_claim),
`proposal_status` (proposed|approved), `proposed_by` (FK→User, SET_NULL),
`weight_confirmed` (bool), `weight_confirmed_by` (FK→User, SET_NULL), `progress_percentage`
(0–100), `task_weight` (1–5), `weight` (1–5), `parent_task` (FK→self, CASCADE),
`created_at`, `updated_at`, `due_date`, `completed_at`.
> **Two weight fields** `weight` and `task_weight` (both 1–5) are kept in sync manually in
> every create/update path; `balance.py` uses `weight`, `task_rollup` uses `max(1, weight)`.
> Redundant.

### TaskActivity
`task` (FK→Task, CASCADE), `action` (created|assigned|reassigned|started|completed|
weight_changed|proposed|approved|claimed|weight_confirmed), `note`, `old_weight`,
`new_weight`, `created_at`, `actor` (FK→User, CASCADE), `from_user`/`to_user` (FK→User,
SET_NULL).

### Submission
`project` (FK→Project, CASCADE), `submitted_by` (FK→User, CASCADE), `content`, `status`
(submitted|reviewed|approved|rejected), `submitted_at`, `reviewed_at`, `feedback`,
`grade` (Decimal 5,2), `github_url`, `proof_text`, `screenshot` (ImageField).
Reverse: `attachments`.

### SubmissionAttachment
`submission` (FK→Submission, CASCADE), `file` (FileField), `uploaded_at`.

### ChatRoom
`chat_type` (group|direct), `group` (OneToOne→Group, CASCADE, null), `user1`/`user2`
(FK→User, CASCADE, null), `created_at`. `unique_together = [user1, user2]`.
Reverse: `messages`, `notifications` (related_chat_room).

### Message
`chat_room` (FK→ChatRoom, CASCADE), `sender` (FK→User, CASCADE), `content`,
`attachment` (FileField), `voice_note` (FileField), `timestamp`.

### TaskComment
`task` (FK→Task, CASCADE), `author` (FK→User, CASCADE), `content`, `created_at`.

### Notification
`user` (FK→User, CASCADE), `notification_type` (choices, max_length 20), `title`, `message`,
`is_read`, `created_at`, `related_task`/`related_project`/`related_group`/`related_chat_room`/
`related_message`/`related_invite`/`related_join_request` (all nullable FKs).
> `NOTIFICATION_TYPES` does **not** include `'announcement'`, yet `admin_api.py:570` creates
> rows with `notification_type='announcement'` (see §5/§7).

### NotificationSettings
`user` (OneToOne→User), `task_assigned`, `task_due`, `poll_opened`, `mention`,
`message_received`, `join_request`, `invite_response` (all bool, default True),
`created_at`, `updated_at`.

### Course
`code` (unique), `name`, `department`. Reverse: `units`, `enrolled_students`, `announcements`.

### Unit
`code`, `name`, `year_of_study` (PositiveSmallInt, default 1), `semester` (default 1),
`academic_level`, `course` (FK→Course, CASCADE), `assigned_lecturer` (FK→User, SET_NULL,
limit_choices_to lecturer). `unique_together = [code, course]`.
Reverse: `groups`, `student_enrollments`, `lecturer_assignments` (UnitAssignment).

### Semester (used as AcademicTerm)
`name` (unique), `year`, `semester`, `start_date`, `end_date`, `is_current`. `save()` enforces
a single current term. `unique_together = [year, semester]`. Reverse: `groups`,
`unit_assignments`, `student_enrollments`.

### UnitAssignment
`lecturer` (FK→User, CASCADE), `unit` (FK→Unit, CASCADE), `term` (FK→Semester, PROTECT),
`status` (pending|approved|rejected), `requested_by`/`approved_by` (FK→User, SET_NULL),
`approved_at`, `created_at`, `import_batch` (FK→ImportBatch, SET_NULL), `start_date`,
`end_date`. Constraint `unique (lecturer, unit, term)`.
> This is the **real** lecturer↔unit link per term. `Unit.assigned_lecturer` is a legacy
> single-owner mirror kept in sync in admin paths; the two can drift (see §4/§7).

### AuditLog
`actor` (FK→User, PROTECT), `action`, `target_type`, `target_id`, `details` (JSON),
`created_at`.

### Announcement
`title`, `body`, `audience` (all|programme|unit), `programme` (FK→Course, CASCADE, null),
`unit` (FK→Unit, CASCADE, null), `created_by` (FK→User, PROTECT), `created_at`.

### AdminSetting
`key` (unique), `value` (JSON), `updated_at`.

### StudentEnrollment
`student` (FK→User, CASCADE), `unit` (FK→Unit, CASCADE), `semester` (FK→Semester, PROTECT),
`enrolled_at`. `unique_together = [student, unit, semester]`.

### GroupInvite
`group` (FK→Group, CASCADE), `invited_student`/`invited_by` (FK→User, CASCADE), `status`
(pending|accepted|declined), `created_at`. Constraint: unique pending per (group, student).

### JoinRequest
`group` (FK→Group, CASCADE), `student` (FK→User, CASCADE), `status`
(pending|approved|declined), `created_at`. Constraint: unique pending per (group, student).

### Poll
`group` (FK→Group, CASCADE), `question`, `closes_at`, `status` (open|closed),
`allow_new_options` (bool), `created_by` (FK→User, CASCADE), `created_at`,
`winning_option` (FK→PollOption, SET_NULL). Reverse: `options`, `votes`.

### PollOption
`poll` (FK→Poll, CASCADE), `text`, `pitch`, `added_by` (FK→User, CASCADE), `created_at`.

### PollVote
`poll` (FK→Poll, CASCADE), `option` (FK→PollOption, CASCADE), `user` (FK→User, CASCADE),
`created_at`, `updated_at`. Constraint: unique (poll, user).

### TaskSubmission
`task` (FK→Task, CASCADE), `submitted_by` (FK→User, CASCADE), `note`, `url`, `file`,
`marks_complete` (bool), `created_at`.

---

## 2. API endpoints — who may call & how permission is checked

Routed in `backend/accounts/urls.py`; auth defaults: `DEFAULT_PERMISSION_CLASSES =
IsAuthenticated` + JWT (`settings.py`). Admin views add `IsAdmin` (`is_staff or
is_superuser`). Per-view checks listed; "self" = any authenticated user.

| Endpoint | Method | Who may call | Permission check |
|---|---|---|---|
| `academic/courses/` | GET | **AllowAny** | none (`academic_views.py:9`) |
| `signup/` | POST | anonymous | rate-limited 5/m; students only (`views.py:402`) |
| `google/login/` | POST | anonymous | none (token verified) (`views.py:45`) |
| `staff/signin-email|activate|forgot-password|reset-password/` | POST | anonymous | roster token lookup (`views.py:233-398`) |
| `login/`, `jwt/login/` | POST | anonymous | `LoginView` (rejects email; username/staff_id) (`views.py:1050`) |
| `jwt/refresh/` | POST | anonymous | SimpleJWT refresh |
| `logout/` | POST | authenticated | `login_required` (session) |
| `profile/` | GET | authenticated | returns own profile |
| `profile/settings/` | GET/PATCH | student | `user_type=='student'` (`views.py:561`) |
| `profile/complete/` | POST | student | `user_type=='student'` + not already complete |
| `profile/change-password/` | POST | authenticated | self password |
| `profile/avatar/` | GET/POST/DELETE | authenticated | self |
| `profile/notification-settings/` | GET/PATCH | authenticated | self |
| `lecturer/settings/` | GET/PATCH | lecturer | `user_type=='lecturer'` |
| `lecturer/units/` | GET | lecturer | `approved_units_for_lecturer` (`units_views.py:96`) |
| `lecturer/units/create|update|` | POST/PATCH | lecturer | `_lecturer_unit_or_error` → `approved_units_for_lecturer` (`views.py:802`) |
| `lecturer/units/<id>/students/<sid>/` | POST/DELETE | lecturer | assigned unit check |
| `lecturer/students/import/` | POST | lecturer | assigned unit check |
| `lecturer/demo-data/` | POST/DELETE | lecturer | `user_type=='lecturer'` + assigned units |
| `lecturer/setup/` | GET/POST | lecturer | `user_type=='lecturer'` (`admin_api.py:721`) |
| `dashboard/lecturer/` | GET | lecturer | `user_type=='lecturer'` OR approved units (`views.py:1116`) |
| `dashboard/student/` | GET | student | `user_type=='student'` |
| `student/workload-summary/` | GET | student | `user_type=='student'` |
| `student/current-units/` | GET | authenticated | any (filters by own enrollment) (`units_views.py:15`) |
| `groups/create/` | POST | student/lecturer | student or lecturer; lecturer needs assigned unit (`views.py:2908`) |
| `groups/join/` | POST | student | `user_type=='student'` |
| `groups/<id>/delete/` | DELETE | creator or supervising lecturer | `group.lecturer_id==user` OR `is_supervising_lecturer` (`views.py:3038`) |
| `groups/<id>/leave/` | POST/DELETE | member | leader blocked; membership delete |
| `groups/<id>/tasks/` | GET | member or supervising lecturer | membership / `is_supervising_lecturer` (`views.py:1411`) |
| `groups/<id>/workspace/` | GET | member or supervisor | membership / `is_supervising_lecturer` |
| `groups/<id>/activity/` | GET | member or supervisor | membership / supervisor |
| `groups/<id>/comments/` | GET/POST | member or supervisor | membership / supervisor |
| `groups/<id>/submissions/` | GET/POST | member or supervisor | membership / supervisor |
| `groups/<id>/balance/` | GET/POST | member or supervisor | membership / supervisor (`views.py:2049`) |
| `groups/<id>/tasks/assign/` | POST | member or supervisor | `_group_task_participant` (`views.py:1863`) |
| `groups/<id>/tasks/<tid>/reassign/` | POST | member or supervisor | `_group_task_participant` |
| `groups/<id>/create-task/` | POST | **supervising lecturer only** | `user_type=='lecturer'` + `is_supervising_lecturer` (`views.py:2113`) |
| `groups/<id>/tasks/<tid>/weight/confirm/approve/claim/` | POST | member / leader / member | `weight_*_block` / `is_leader` / `is_member` (`planning_views.py`) |
| `groups/<id>/tasks/propose/` | POST | member or leader | `is_member or is_leader` |
| `groups/<id>/projects/` | GET/POST | participant / member-leader | `is_participant` / `is_member or is_leader` |
| `tasks/<id>/update-progress|status/` | POST | assignee, group admin, or supervisor | assignee OR `role='admin'` OR supervisor (`views.py:2211`) |
| `groups/<id>/polls/`, `polls/<id>/…` | various | member/leader/creator | `_can_use` = student & (member or leader) (`poll_views.py:22`) |
| `groups/<id>/tasks/<tid>/work/` | POST/DELETE/GET | member/leader/author | `is_member or is_leader` (`work_views.py`) |
| `work-items/<id>/file/`, `submissions/attachments/<id>/` | GET | member/leader | `is_member or is_leader` |
| `notifications/` | GET | self | own |
| `notifications/<id>/read/` | POST | self | `user=user` filter (`views.py:2353`) |
| `groups/<id>/members/` | GET | member or supervisor | membership / supervisor |
| `students/` | GET | lecturer | `user_type=='lecturer'` + approved units |
| `groups/<id>/chat-room/` | GET | member or supervisor | membership / supervisor |
| `groups/<id>/invites/…` | GET/POST/DELETE | student member / inviter / supervisor | `_is_member` / supervisor (`group_access_views.py`) |
| `invites/<id>/accept|decline/` | POST | invited student | `invited_student=user` |
| `groups/<id>/join-requests/` | POST | student | enrolled + not already member (`group_access_views.py:332`) |
| `join-requests/<id>/approve|decline/` | POST | creator or supervisor | `group.lecturer_id==user` OR supervisor |
| `groups/<id>/settings/`, `regenerate-code/` | PATCH/POST | creator or supervisor | `group.lecturer_id==user` OR supervisor (`group_access_views.py:410,423`) |
| `units/<id>/classmates/` | GET | student enrolled in unit | `_is_enrolled_in_unit` (`group_access_views.py:161`) |
| `units/<id>/groups/` | GET | student enrolled in unit | `_is_enrolled_in_unit` |
| `chat/rooms|contacts|messages|send|direct|delete|unread-counts|mark-read/` | various | participant / room member | membership / `user1/user2` / supervisor |
| `submissions/<id>/grade/` | PATCH | supervising lecturer | `is_supervising_lecturer` (`views.py:1712`) |
| `admin/*` (overview, users, assignments, terms, rollover, groups, catalog, settings, announcements, audit, export, roster/import) | various | **admin only** | `IsAdmin` (`admin_api.py:25`) |

---

## 3. Where balance / health / contribution / counts are computed

### Backend (single source: `balance.py`, `health.py`)
- **Workload balance**: `accounts/balance.py::calculate_group_balance()` — per-member
  `points_assigned`, `points_completed`, `tasks_completed`, `on_time_rate`, `share_percent`,
  `fair_share` (100/member), `warning_level` (too_early <6 pts; critical >fair+25; warning
  >fair+15). Leaf tasks only (`has_subtasks=False`). Consumed by: `get_group_balance`,
  `student_workload_summary`, `get_group_task_workspace` (indirectly), `units_views`
  `_unit_group_rows` (at_risk), `admin_overview`, `admin_groups`, `seed_demo` self-check,
  and `_task_balance_warning` (projection on assign/reassign/approve/claim).
- **Health**: `accounts/health.py::compute_group_health` / `get_health_details` — too_early
  (<6 pts), quiet (no activity 5d), at_risk (critical member OR ≥2 overdue OR <30% progress
  with deadline ≤3d), else on_track. Used by `student_dashboard` (per group) and
  `get_group_task_workspace`.
- **Progress rollup**: `views.py::_sync_parent_task_rollups` (DB, on status/progress change)
  and `views.py::get_group_task_workspace::task_rollup` (read-time re-computation for the
  payload). Duplicated logic.
- **Counts**: `Group.members_count` property (`memberships.count()`) recomputed ad hoc in
  `lecturer_dashboard` (`views.py:1136`), `student_dashboard`, `unit_open_groups`,
  `lecturer_my_units`, `admin_groups`. `admin_overview` computes quiet/at-risk counts.

### Frontend (duplicates backend logic)
- **Health (duplicate + divergent)**: `frontend/src/student/health.js::computeHealth` —
  **overdue > 0 ⇒ at_risk** (backend: ≥2), **quiet = 7 days** (backend: 5 days), too_early
  <6 pts. Used by `useGroupInsights.js:55`. Backend `get_health_details` (5-day/2-overdue) is
  also sent to the client via `workspace.health` but the Overview tab uses the local
  `computeHealth`. Two different health results for the same group.
- **Weight scale**: `frontend/src/taskWeights.js` mirrors `backend/accounts/weights.py`
  (1–5, MIN_TOTAL_POINTS_FOR_BALANCE=6) — intentional mirror, kept in sync by hand.
- **Contribution/share**: read from backend `balance.members[].share_percent /
  points_completed` in `OverviewTab.jsx`, `SubmissionsPanel.jsx`, `GroupCard.jsx`,
  `GroupSummaryCard.jsx`. No re-derivation — display only.
- **Counts (frontend-derived)**: `useStudentWorkspace.js` computes `assignmentsDueCount`
  (14-day horizon), `completedWorkCount`, `completionRatePercentage`, `upcomingTasks`,
  `deadlineByDay` from the dashboard task list — **separate from backend health/balance**.
  `LecturerDashboard.jsx:175` averages `unit.completion_percentage` (backend-supplied).

> **Duplicate logic summary**: health (backend `health.py` vs frontend `health.js`, divergent
> thresholds); progress rollup (DB write vs read-time `task_rollup`); `members_count`
> recomputed in 5+ places; `profile_complete` duplicated in `GoogleLoginView._compute_profile_complete`
> and `profile_view`; task-creation/weight-sync duplicated across `assign_group_task`,
> `create_task`, `propose_task`, `approve_task`.

---

## 4. `Group.lecturer` / role checks that bypass unit assignments

`Group.lecturer` is overloaded: for student-created groups it is the **student leader**
(`views.py:2997` sets `lecturer=user` even when `user_type=='student'`), not a lecturer.
`planning_rules.py` and several views treat `group.lecturer_id` as "leader" and grant
rights **without** consulting `UnitAssignment` (the real term-scoped lecturer link):

- `planning_rules.py:18 is_leader` — `group.lecturer_id == user.id`; used by
  `approve_task` (leader-only), `claim_task`/`propose_task` (member-or-leader),
  `weight_change_block`/`weight_confirm_block` (leader shortcut), poll `close`/`delete`/
  `pick_winner`. A student "leader" therefore approves tasks, breaks poll ties, etc.
  — bypassing any lecturer/unit authority.
- `group_access_views.py:410,423` (`regenerate_join_code`, `update_group_settings`) —
  `group.lecturer_id != request.user.id and not is_supervising_lecturer` ⇒ the student
  leader can change settings regardless of unit assignment.
- `group_access_views.py:368` (`_resolve_join_request` approve/decline) — leader OR
  supervisor; student leader approves join requests.
- `views.py:3038 delete_group_view`, `3145 leave_group_view` — leader checks.
- `views.py:2488 get_chat_rooms can_delete` — `group.lecturer_id == user.id`.
- `views.py:1262 student_dashboard is_leader` — `group.lecturer_id == user.id`.
- `planning_rules.py:40 workflow_enforced` — `group.lecturer.user_type == 'student'`:
  decides propose/approve workflow purely from the overloaded field.
- Conversely, `is_group_lecturer` / `is_supervising_lecturer` (the unit-assignment path)
  is used for **access** in most group read views, but **not** for leader-only mutations
  above. Net: a student leader has leader powers; a supervising lecturer has access but
  not leader-only powers unless also `group.lecturer_id`.

> Also note `Unit.assigned_lecturer` (legacy single-owner) vs `UnitAssignment` (term-scoped)
> can disagree: `approved_units_for_lecturer` (academic.py:114) merges both; admin paths
> write both. Drift possible if a unit is reassigned via one path only.

---

## 5. Hard-coded / placeholder data

- `backend/seed_data.py` — large **hard-coded** academic catalogue (Clinical Medicine,
  Nursing, Law, Diploma CS, Counselling) inserted inline; not data-driven.
- `backend/accounts/management/commands/seed_demo.py` — hard-coded demo students/groups/
  tasks (`demo_student_*`, `DEMO01/02/03`, `BSc Computer Science`, fixed task titles).
- `backend/accounts/views.py::lecturer_demo_data` — generates `DEMO_<id>_*` students,
  `[Demo]` groups, password `DemoStudent123!` (`views.py:966`).
- `backend/settings.py` — hard-coded defaults: `GOOGLE_CLIENT_ID` fallback
  (`623176595516-…apps.googleusercontent.com`, line 45), `EMAIL_HOST_USER/PASSWORD`
  placeholders (`your-email@gmail.com`, line 241), `SECRET_KEY` fallback
  (`django-insecure-fallback-key`, line 33), `ALLOWED_HOSTS` includes `*` and
  `CORS_ALLOW_ALL_ORIGINS=True` (lines 39, 168).
- `backend/accounts/admin_api.py:824-825` — roster template sample rows (`john.doe@…`,
  `CS1234`, `ENG5678`).
- `backend/accounts/weights.py` / `frontend/src/taskWeights.js` — weight labels
  (Tiny…Very large) hard-coded in both (mirrors).
- `settings.py` balance thresholds (`warning:15, critical:25, minimum_points:6`) duplicated
  as defaults in `admin_settings` and re-implemented as literals in `balance.py`
  (`fair_share + 25`, `fair_share + 15`, `< 6`) — not read from AdminSetting.
- `group_access_views.py` `CODE_ALPHABET` / `views.py` `get_random_string(... allowed_chars)`
  duplicated join-code alphabets (two different alphabets: one excludes I/O/0/1, the other
  `get_random_string(6)` default includes them — see §6).
- `settings.py:263 SIMPLE_JWT_SERIALIZER = 'accounts.jwt.EmailTokenObtainPairSerializer'` —
  this string is never used (SimpleJWT reads `SIMPLE_JWT['TOKEN_OBTAIN_PAIR_SERIALIZER']`);
  dead config. The serializer is actually wired in `backend/urls.py:21-31`.
- Dead/ignored files: `accounts/views_current_units_patch.py` ("not used by Django"),
  `accounts/views.py.tmp` (absent), `accounts/login_test_views.py::test_login` (unused),
  `backend/_debug_500.py` (ad-hoc debug script), `backend/seed_data.py` (root, superseded by
  `seed_from_excel`).

---

## 6. Frontend calls endpoints/fields the backend does not provide

### Endpoints called by frontend but **not routed** (404 at runtime)
1. **`POST /api/accounts/notifications/mark-all-read/`** — `NotificationBell.jsx:59`.
   No such route in `accounts/urls.py` (only `notifications/<id>/read/`). "Mark all as read"
   always fails.
2. **`PATCH /api/accounts/notifications/<id>/`** — `NotificationBell.jsx:87`
   (mark-as-unread). No such route; only `POST /notifications/<id>/read/` exists. Fails.
3. **`GET /api/accounts/notifications/?limit=50` expecting `data.results`** —
   `NotificationBell.jsx:34` reads `response.data?.results`, but `get_notifications`
   (`views.py:2322`) returns a **plain list** (no pagination, no `results` key). The 30 s
   poll never populates `bellItems`; the bell only works off the initial
   `useStudentNotifications` list (which correctly handles a plain array). Inconsistent.

### Frontend reads fields the backend does not return
- `useStudentWorkspace.js:212` reads `dash.tasks.pending` / `dash.tasks`; backend
  `student_dashboard` returns `recent_tasks` (list) only — works via fallback to
  `recent_tasks`, but `dash.tasks` is never present (dead branch).
- `NotificationBell` expects `notification_type` values; backend `get_notifications`
  returns `notification_type` but **not** `announcement` rows from the bell filter (the
  `useStudentNotifications` hook filters `!== 'message_received'`, so `announcement`
  notifications would surface in the bell — but `Notification.NOTIFICATION_TYPES` doesn't
  declare `announcement`, so admin-created announcements are malformed rows).
- `Login.jsx` posts to `/api/login/` (SimpleJWT `EmailTokenObtainPairSerializer`) and reads
  `data.user`, `data.access`, `data.refresh` — all returned by `jwt.py:40`. OK. But the
  separate `views.LoginView` (`/api/accounts/login/`, `/api/accounts/jwt/login/`) is **never
  called** by the frontend — two login implementations coexist (the DRF `LoginView` rejects
  emails; the SimpleJWT one accepts username/staff_id/email). Redundant + divergent.

### Join-code alphabet mismatch
- `group_access_views._new_join_code` / `views.create_group_view` use
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I/O/0/1). `admin_api.admin_group_action`
  `regenerate-code` uses `get_random_string(6).upper()` (default alphabet **includes**
  I/O/0/1). Codes generated by admin may be ambiguous/unreadable vs the student path.

---

## 7. Migrations — conflicts / drift

- `python manage.py makemigrations --check --dry-run` → **"No changes detected"** (models
  match migrations as of this snapshot).
- **Resolved branch**: two migrations share number `0026` —
  `0026_submission_grade.py` and `0026_user_academic_level.py` — merged by
  `0028_merge_20261113_0752.py`. `showmigrations` shows both `0026_*` then `0028_merge` in
  sequence; consistent now, but the duplicate prefix is a historical foot-gun (re-running
  from scratch relies on the merge). No current drift.
- **Data/code inconsistencies (not migrations, but model-adjacent)**:
  - `Notification.notification_type='announcement'` (`admin_api.py:570`) is **not** in
    `Notification.NOTIFICATION_TYPES` (model `choices`). DB accepts it (choices not
    enforced at DB level, max_length 20 ≥ 12) but it's an undeclared type.
  - `Task.weight` and `Task.task_weight` both exist and must be manually kept equal; any
    path that sets one and not the other desyncs `balance.py` (reads `weight`) from
    `task_rollup`/`health.py` (reads `max(1, weight)`).
  - `Unit.assigned_lecturer` (legacy) and `UnitAssignment` (term-scoped) are both written
    in admin paths but read with fallbacks; a unit reassigned via `lecturer_setup`
    auto-approve writes `assigned_lecturer`, while `admin_assignment_delete` clears it only
    if no other assignment exists — divergence possible.

---

## Severity ranking (highest first)

1. **CRITICAL — Broken notification "mark all read" / "mark unread" endpoints**
   `NotificationBell.jsx:59,87` call `POST /notifications/mark-all-read/` and
   `PATCH /notifications/<id>/`, neither of which exists → 404. Core notification UX is
   broken. (Also the `data.results` poll mismatch, line 34.)

2. **CRITICAL — Permission model bypass via overloaded `Group.lecturer`**
   Student leaders (`group.lecturer_id` set to a student in `views.py:2997`) get
   leader-only powers (approve tasks, break poll ties, change settings, approve join
   requests, delete group) **without any `UnitAssignment`/lecturer check**
   (`planning_rules.is_leader`, `group_access_views.py:410/423/368`, `views.py:2488/3038/3145`).
   A student can exercise authority that should require lecturer unit ownership.

3. **HIGH — Divergent health logic (backend vs frontend)**
   `health.js` (overdue>0 ⇒ at_risk, quiet=7d) vs `health.py` (overdue≥2, quiet=5d). Same
   group can show "on_track" on the server payload and "at_risk" in the UI, or vice-versa.

4. **HIGH — Dead/duplicated login implementations**
   `views.LoginView` (`/api/accounts/login/`, `/jwt/login/`) is unused; frontend uses
   `/api/login/` (SimpleJWT). Two auth paths with different rules (email rejection vs
   username/staff_id/email). Confusing and a likely source of "login fails" bugs.

5. **HIGH — `Notification` `announcement` type not declared**
   `admin_api.py:570` writes `notification_type='announcement'` absent from
   `NOTIFICATION_TYPES`; frontend bell surfaces it but the type is undeclared → inconsistent
   filtering/display.

6. **MEDIUM — Duplicate `Task.weight` / `Task.task_weight`**
   Manually synced across 5+ code paths; `balance.py` and `health.py` read different fields
   (`weight` vs `max(1, weight)`). Drift risk on any missed update.

7. **MEDIUM — Join-code alphabet mismatch**
   Student/admin-create use a safe alphabet; `admin_group_action regenerate-code` uses
   `get_random_string(6).upper()` (ambiguous chars). Codes may be unreadable.

8. **MEDIUM — Hard-coded secrets/config in `settings.py`**
   `GOOGLE_CLIENT_ID` fallback, email host user/password placeholders, `SECRET_KEY`
   fallback, `ALLOWED_HOSTS=['*']`, `CORS_ALLOW_ALL_ORIGINS=True`, `DEBUG=True` — insecure
   defaults if deployed as-is.

9. **MEDIUM — Large hard-coded catalogues / seed data**
   `seed_data.py`, `seed_demo.py`, `lecturer_demo_data` embed substantial literal data
   (programmes, units, demo users, fixed passwords). Not data-driven; brittle.

10. **LOW — Duplicated `members_count` / `profile_complete` / balance thresholds**
    `members_count` recomputed in 5+ views; `profile_complete` duplicated in
    `GoogleLoginView._compute_profile_complete` and `profile_view`; balance thresholds
    hard-coded in `balance.py` instead of read from `AdminSetting`.

11. **LOW — Dead/temp files & unused config**
    `views_current_units_patch.py` ("not used"), `login_test_views.py`, `_debug_500.py`,
    root `seed_data.py` (superseded), `SIMPLE_JWT_SERIALIZER` string (never read),
    `views.py.tmp` (absent).

12. **LOW — Migration history foot-gun**
    Duplicate `0026_*` branch (merged by `0028`); currently consistent, no drift, but
    fragile for fresh installs.
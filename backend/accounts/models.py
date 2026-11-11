from django.conf import settings
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import validate_email, MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
import re

class User(AbstractUser):
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(max_length=254, unique=True)
    USER_TYPE_CHOICES = [
        ('student', 'Student'),
        ('lecturer', 'Lecturer'),
    ]
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='student')
    university = models.CharField(max_length=100, blank=True)
    course = models.CharField(max_length=100, blank=True)
    academic_level = models.CharField(max_length=50, blank=True)
    year_of_study = models.CharField(max_length=10, blank=True)
    staff_id = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    courses_taught = models.TextField(blank=True)
    salutation = models.CharField(max_length=10, blank=True)
    failed_attempts = models.PositiveIntegerField(default=0)
    email_verified = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    enrolled_course = models.ForeignKey(
        'Course', on_delete=models.SET_NULL, related_name='enrolled_students', null=True, blank=True
    )
    semester = models.PositiveSmallIntegerField(null=True, blank=True)
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
    ]
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='active')

    def __str__(self):
        return self.username

    def clean(self):
        super().clean()
        
        # Validate email format and domain
        if self.email:
            try:
                validate_email(self.email)
            except ValidationError:
                raise ValidationError({'email': 'Invalid email format.'})
            allowed_domains = getattr(settings, 'ALLOWED_EMAIL_DOMAINS', ['zetech.ac.ke'])
            if not any(self.email.endswith(f'@{d}') for d in allowed_domains):
                raise ValidationError({'email': f'Only {", ".join(allowed_domains)} emails are allowed.'})
        
        # Validate year of study for students
        if self.user_type == 'student' and self.year_of_study:
            if not re.match(r'^[1-4]$', self.year_of_study):
                raise ValidationError({'year_of_study': 'Year of study must be between 1 and 4.'})
        
        # Validate staff_id for lecturers
        if self.user_type == 'lecturer' and self.staff_id:
            if not re.match(r'^[A-Za-z]{2}\d{4}$', self.staff_id):
                raise ValidationError({'staff_id': 'Staff ID must be in format XX1234.'})

    def save(self, *args, **kwargs):
        self.is_active = self.status == 'active'
        self.full_clean()
        super().save(*args, **kwargs)


class Group(models.Model):
    name = models.CharField(max_length=100)
    course = models.CharField(max_length=100)
    year_of_study = models.CharField(max_length=10)
    description = models.TextField(blank=True)
    join_code = models.CharField(max_length=6, unique=True, db_index=True)
    unit_code = models.CharField(max_length=50, null=True, blank=True)
    academic_term = models.CharField(max_length=20, null=True, blank=True)
    is_archived = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    max_members = models.PositiveSmallIntegerField(default=5, null=True, blank=True)
    unit = models.ForeignKey(
        'Unit', on_delete=models.SET_NULL, related_name='groups', null=True, blank=True
    )
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lecturer_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new:
            ChatRoom.objects.get_or_create(group=self, defaults={'chat_type': 'group'})

    @property
    def members_count(self):
        return self.memberships.count()

    class Meta:
        ordering = ['-created_at']


class GroupMembership(models.Model):
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('admin', 'Admin'),
    ]
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_memberships')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['group', 'student']

    def __str__(self):
        return f"{self.student} in {self.group}"


class Project(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='projects')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deadline = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-created_at']


class Task(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    assigned_to = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assigned_tasks', null=True, blank=True)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default='pending')
    ASSIGNMENT_MODE_CHOICES = [('assigned', 'Assigned'), ('open_to_claim', 'Open to claim')]
    PROPOSAL_STATUS_CHOICES = [('proposed', 'Proposed'), ('approved', 'Approved')]
    assignment_mode = models.CharField(max_length=15, choices=ASSIGNMENT_MODE_CHOICES, default='assigned')
    proposal_status = models.CharField(max_length=10, choices=PROPOSAL_STATUS_CHOICES, default='approved')
    proposed_by = models.ForeignKey(User, on_delete=models.SET_NULL, related_name='proposed_tasks', null=True, blank=True)
    weight_confirmed = models.BooleanField(default=True)
    weight_confirmed_by = models.ForeignKey(User, on_delete=models.SET_NULL, related_name='weight_confirmations', null=True, blank=True)
    progress_percentage = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    task_weight = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    weight = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    parent_task = models.ForeignKey(
        'self', on_delete=models.CASCADE, related_name='subtasks', null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    due_date = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-created_at']


class TaskActivity(models.Model):
    ACTION_CHOICES = [
        ('created', 'Created'),
        ('assigned', 'Assigned'),
        ('reassigned', 'Reassigned'),
        ('started', 'Started'),
        ('completed', 'Completed'),
        ('weight_changed', 'Weight changed'),
        ('proposed', 'Proposed'),
        ('approved', 'Approved'),
        ('claimed', 'Claimed'),
        ('weight_confirmed', 'Weight confirmed'),
    ]
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='activities')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    note = models.TextField(blank=True)
    old_weight = models.PositiveSmallIntegerField(null=True, blank=True)
    new_weight = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_activity_actions')
    from_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, related_name='task_activity_from', null=True, blank=True
    )
    to_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, related_name='task_activity_to', null=True, blank=True
    )

    def __str__(self):
        return f"{self.action} on {self.task.title} by {self.actor.username}"

    class Meta:
        ordering = ['created_at']


class Submission(models.Model):
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('reviewed', 'Reviewed'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='submissions')
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submissions')
    content = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    feedback = models.TextField(blank=True)
    github_url = models.URLField(max_length=500, null=True, blank=True)
    proof_text = models.TextField()
    screenshot = models.ImageField(upload_to='submissions/screenshots/', null=True, blank=True)

    def __str__(self):
        return f"{self.project.title} by {self.submitted_by}"

    class Meta:
        ordering = ['-submitted_at']


class SubmissionAttachment(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='submissions/files/%Y/%m/')
    uploaded_at = models.DateTimeField(auto_now_add=True)


class ChatRoom(models.Model):
    CHAT_TYPE_CHOICES = [
        ('group', 'Group Chat'),
        ('direct', 'Direct Chat'),
    ]
    chat_type = models.CharField(max_length=10, choices=CHAT_TYPE_CHOICES, default='group')
    group = models.OneToOneField(Group, on_delete=models.CASCADE, related_name='chat_room', null=True, blank=True)
    user1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_rooms_as_user1', null=True, blank=True)
    user2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_rooms_as_user2', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.chat_type == 'group':
            return f"Group Chat for {self.group.name}"
        else:
            return f"Direct Chat: {self.user1.username} - {self.user2.username}"

    class Meta:
        unique_together = ['user1', 'user2']


class Message(models.Model):
    chat_room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    attachment = models.FileField(upload_to='chat_documents/%Y/%m/', null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sender.username}: {self.content[:50]}"

    class Meta:
        ordering = ['timestamp']


class TaskComment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_comments')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.author.username} on {self.task.title}"

    class Meta:
        ordering = ['created_at']


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('task_assigned', 'Task Assigned'),
        ('task_due', 'Task Due Soon'),
        ('project_deadline', 'Project Deadline'),
        ('submission_reviewed', 'Submission Reviewed'),
        ('group_invitation', 'Group Invitation'),
        ('message_received', 'Message Received'),
        ('join_request', 'Join Request'),
        ('join_response', 'Join Response'),
        ('invite_response', 'Invite Response'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    related_task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True)
    related_project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True)
    related_group = models.ForeignKey(Group, on_delete=models.CASCADE, null=True, blank=True)
    related_chat_room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, null=True, blank=True)
    related_message = models.ForeignKey(Message, on_delete=models.CASCADE, null=True, blank=True)
    related_invite = models.ForeignKey('GroupInvite', on_delete=models.CASCADE, null=True, blank=True)
    related_join_request = models.ForeignKey('JoinRequest', on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return f"{self.notification_type} for {self.user.username}"

    class Meta:
        ordering = ['-created_at']


class Course(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    department = models.CharField(max_length=100)

    def __str__(self):
        return f'{self.code} - {self.name}'


class Unit(models.Model):
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=255)
    year_of_study = models.PositiveSmallIntegerField(default=1)
    semester = models.PositiveSmallIntegerField(default=1)
    academic_level = models.CharField(max_length=50, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='units')
    assigned_lecturer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='assigned_units',
        limit_choices_to={'user_type': 'lecturer'},
        null=True,
        blank=True,
    )

    def __str__(self):
        return f'{self.code} - {self.name}'

    class Meta:
        ordering = ['year_of_study', 'semester', 'code']
        unique_together = [('code', 'course')]


class Semester(models.Model):
    name = models.CharField(max_length=50, unique=True)
    year = models.PositiveIntegerField()
    semester = models.PositiveIntegerField()

    def __str__(self):
        return self.name

    class Meta:
        ordering = ('year', 'semester', 'name')
        unique_together = [('year', 'semester')]


class UnitAssignment(models.Model):
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='unit_assignments')
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='lecturer_assignments')
    term = models.ForeignKey(Semester, on_delete=models.PROTECT, related_name='unit_assignments')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('lecturer', 'unit', 'term'), name='unique_lecturer_unit_term'),
        ]
        ordering = ['unit__code']


class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.PROTECT, related_name='audit_logs')
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=100)
    target_id = models.CharField(max_length=100, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Announcement(models.Model):
    AUDIENCE_CHOICES = [
        ('all', 'All users'),
        ('programme', 'Programme'),
        ('unit', 'Unit'),
    ]
    title = models.CharField(max_length=200)
    body = models.TextField()
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default='all')
    programme = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True, related_name='announcements')
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, null=True, blank=True, related_name='announcements')
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='announcements')
    created_at = models.DateTimeField(auto_now_add=True)


class AdminSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key


class StudentEnrollment(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='student_enrollments')
    semester = models.ForeignKey(
        Semester, on_delete=models.PROTECT, related_name='student_enrollments'
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.student} enrolled in {self.unit}'

    class Meta:
        ordering = ['unit__code']
        unique_together = [('student', 'unit', 'semester')]


class GroupInvite(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')]
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='invites')
    invited_student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_invites_received')
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_invites_sent')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(
            fields=['group', 'invited_student'], condition=models.Q(status='pending'),
            name='unique_pending_group_invite',
        )]


class JoinRequest(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('approved', 'Approved'), ('declined', 'Declined')]
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='join_requests')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='join_requests')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(
            fields=['group', 'student'], condition=models.Q(status='pending'),
            name='unique_pending_join_request',
        )]


class Poll(models.Model):
    STATUS_CHOICES = [('open', 'Open'), ('closed', 'Closed')]
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='polls')
    question = models.CharField(max_length=300)
    closes_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    allow_new_options = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='polls_created')
    created_at = models.DateTimeField(auto_now_add=True)
    winning_option = models.ForeignKey(
        'PollOption', on_delete=models.SET_NULL, related_name='+', null=True, blank=True
    )

    class Meta:
        ordering = ['-created_at']


class PollOption(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=200)
    pitch = models.TextField(blank=True)
    added_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='poll_options_added')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']


class PollVote(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='votes')
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='poll_votes')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['poll', 'user'], name='unique_vote_per_user_and_poll')]


class TaskSubmission(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='work_items')
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_work_items')
    note = models.TextField(blank=True)
    url = models.URLField(max_length=500, blank=True)
    file = models.FileField(upload_to='task_work/%Y/%m/', blank=True)
    marks_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
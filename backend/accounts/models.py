from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import validate_email, MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
import re

class User(AbstractUser):
    USER_TYPE_CHOICES = [
        ('student', 'Student'),
        ('lecturer', 'Lecturer'),
    ]
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='student')
    university = models.CharField(max_length=100, blank=True)
    course = models.CharField(max_length=100, blank=True)
    year_of_study = models.CharField(max_length=10, blank=True)
    staff_id = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)
    courses_taught = models.TextField(blank=True)
    salutation = models.CharField(max_length=10, blank=True)
    failed_attempts = models.PositiveIntegerField(default=0)
    email_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.username

    def clean(self):
        super().clean()
        
        # 📳 FORCE ALL VERIFICATION FLAGS TO TRUE
        self.is_active = True
        self.email_verified = True  
        if hasattr(self, 'is_verified'):
            self.is_verified = True

        # Validate email format and domain
        if self.email:
            try:
                validate_email(self.email)
            except ValidationError:
                raise ValidationError({'email': 'Invalid email format.'})
            if not self.email.endswith('@zetech.ac.ke'):
                raise ValidationError({'email': 'Only @zetech.ac.ke emails are allowed.'})
        
        # Validate year of study for students
        if self.user_type == 'student' and self.year_of_study:
            if not re.match(r'^[1-4]$', self.year_of_study):
                raise ValidationError({'year_of_study': 'Year of study must be between 1 and 4.'})
        
        # Validate staff_id for lecturers
        if self.user_type == 'lecturer' and self.staff_id:
            if not re.match(r'^[A-Za-z]{2}\d{4}$', self.staff_id):
                raise ValidationError({'staff_id': 'Staff ID must be in format XX1234.'})

    def save(self, *args, **kwargs):
        # 📳 FORCE COMPLIANCE RIGHT BEFORE IT SAVES TO FILE/DATABASE
        self.is_active = True
        self.email_verified = True
        self.full_clean()
        super().save(*args, **kwargs)


class Group(models.Model):
    name = models.CharField(max_length=100)
    course = models.CharField(max_length=100)
    year_of_study = models.CharField(max_length=10)
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lecturer_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

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
    assigned_to = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assigned_tasks')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress_percentage = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    due_date = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-created_at']


class Submission(models.Model):
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('reviewed', 'Reviewed'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='submissions')
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submissions')
    file = models.FileField(upload_to='submissions/', null=True, blank=True)
    content = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    feedback = models.TextField(blank=True)

    def __str__(self):
        return f"{self.project.title} by {self.submitted_by}"

    class Meta:
        ordering = ['-submitted_at']


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

    def __str__(self):
        return f"{self.notification_type} for {self.user.username}"

    class Meta:
        ordering = ['-created_at']
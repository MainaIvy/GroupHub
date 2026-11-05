from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import validate_email, MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
import re


class Course(models.Model):
    code = models.CharField(max_length=15, unique=True)
    name = models.CharField(max_length=100)
    department = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

class Unit(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='units')
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=200)
    year_of_study = models.PositiveIntegerField(default=1)
    semester = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('code', 'course')
        ordering = ['year_of_study', 'semester', 'code']

    def __str__(self):
        return f"{self.code}: {self.name} (Y{self.year_of_study}S{self.semester})"


class User(AbstractUser):
    email = models.EmailField(unique=False)
    USER_TYPE_CHOICES = [
        ('student', 'Student'),
        ('lecturer', 'Lecturer'),
    ]
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='student')
    university = models.CharField(max_length=100, blank=True)
    course = models.CharField(max_length=150, blank=True)
    year_of_study = models.CharField(max_length=10, blank=True)
    semester = models.CharField(max_length=10, blank=True)
    registration_no = models.CharField(max_length=50, blank=True)
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
        if self.email:
            try:
                validate_email(self.email)
            except ValidationError:
                raise ValidationError({'email': 'Invalid email format.'})
        if self.user_type == 'student' and self.year_of_study:
            if not re.match(r'^[1-6]$', str(self.year_of_study)):
                raise ValidationError({'year_of_study': 'Year of study must be between 1 and 6.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Group(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    join_code = models.CharField(max_length=20, blank=True, default='')
    course = models.CharField(max_length=150, blank=True)
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name='groups')
    year_of_study = models.CharField(max_length=10, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_groups')
    members = models.ManyToManyField(User, related_name='groups', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Project(models.Model):
    STATUS_CHOICES = [
        ('planning', 'Planning'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='projects')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planning')
    deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Task(models.Model):
    STATUS_CHOICES = [
        ('todo', 'To Do'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='todo')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    deadline = models.DateTimeField(null=True, blank=True)
    task_weight = models.PositiveIntegerField(default=1)
    progress_percentage = models.PositiveIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Submission(models.Model):
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('graded', 'Graded'),
        ('returned', 'Returned'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='submissions')
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submissions')
    github_url = models.URLField(blank=True)
    file_url = models.URLField(blank=True)
    proof_text = models.TextField(blank=True, default='')
    screenshot = models.ImageField(upload_to='submissions/screenshots/', blank=True, null=True)
    comments = models.TextField(blank=True)
    grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)
    graded_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.project.title} - {self.submitted_by.username}"


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('group_invite', 'Group Invite'),
        ('deadline_reminder', 'Deadline Reminder'),
        ('task_assigned', 'Task Assigned'),
        ('task_updated', 'Task Updated'),
        ('project_completed', 'Project Completed'),
        ('group_message', 'Group Message'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    related_group = models.ForeignKey(Group, on_delete=models.CASCADE, null=True, blank=True)
    related_project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True)
    related_task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.title}"

    class Meta:
        ordering = ['-created_at']
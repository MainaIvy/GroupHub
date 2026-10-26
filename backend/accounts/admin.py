from django.contrib import admin
from .models import (
    User,
    Group,
    GroupMembership,
    Project,
    Task,
    Submission,
    ChatRoom,
    Message,
    TaskComment,
    Notification,
)

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'user_type', 'is_staff', 'university', 'is_active')
    list_filter = ('user_type', 'university', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'course', 'year_of_study', 'lecturer', 'members_count', 'created_at')
    list_filter = ('course', 'year_of_study')
    search_fields = ('name', 'course', 'lecturer__username')
    autocomplete_fields = ('lecturer',)


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ('group', 'student', 'role', 'joined_at')
    list_filter = ('role',)
    search_fields = ('group__name', 'student__username', 'student__email')
    autocomplete_fields = ('group', 'student')


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'group', 'status', 'deadline', 'created_at')
    list_filter = ('status',)
    search_fields = ('title', 'group__name')
    autocomplete_fields = ('group',)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'project', 'assigned_to', 'status', 'progress_percentage', 'due_date')
    list_filter = ('status',)
    search_fields = ('title', 'project__title', 'assigned_to__username')
    autocomplete_fields = ('project', 'assigned_to')


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('project', 'submitted_by', 'status', 'submitted_at', 'reviewed_at')
    list_filter = ('status',)
    search_fields = ('project__title', 'submitted_by__username', 'submitted_by__email')
    autocomplete_fields = ('project', 'submitted_by')


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('chat_type', 'group', 'user1', 'user2', 'created_at')
    list_filter = ('chat_type',)
    search_fields = ('group__name', 'user1__username', 'user2__username')


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('chat_room', 'sender', 'timestamp')
    search_fields = ('content', 'sender__username')
    autocomplete_fields = ('chat_room', 'sender')


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ('task', 'author', 'created_at')
    search_fields = ('task__title', 'author__username', 'content')
    autocomplete_fields = ('task', 'author')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read')
    search_fields = ('user__username', 'message')
    autocomplete_fields = ('user',)

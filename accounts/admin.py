from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Group, Project, Task, Submission

class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'user_type', 'is_active')
    list_filter = ('user_type', 'is_active', 'email_verified')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('username',)

    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info', {
            'fields': ('user_type', 'university', 'course', 'year_of_study', 'staff_id', 'department', 'courses_taught', 'salutation', 'failed_attempts', 'email_verified')
        }),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Additional Info', {
            'fields': ('user_type', 'university', 'course', 'year_of_study', 'staff_id', 'department', 'courses_taught', 'salutation', 'email_verified')
        }),
    )

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'course', 'year_of_study', 'created_by', 'created_at')
    list_filter = ('course', 'year_of_study', 'created_at')
    search_fields = ('name', 'course', 'created_by__username')
    filter_horizontal = ('members',)

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'group', 'status', 'deadline', 'created_at')
    list_filter = ('status', 'created_at', 'deadline')
    search_fields = ('title', 'description', 'group__name')

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'project', 'assigned_to', 'status', 'priority', 'deadline')
    list_filter = ('status', 'priority', 'created_at', 'deadline')
    search_fields = ('title', 'description', 'project__title', 'assigned_to__username')

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('project', 'submitted_by', 'status', 'grade', 'submitted_at')
    list_filter = ('status', 'submitted_at', 'graded_at')
    search_fields = ('project__title', 'submitted_by__username', 'comments')

admin.site.register(User, CustomUserAdmin)

from django.contrib import admin
from .models import AdminSetting, Announcement, AuditLog, UnitAssignment, User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'user_type', 'university', 'is_active')
    list_filter = ('user_type', 'university', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')


@admin.register(UnitAssignment)
class UnitAssignmentAdmin(admin.ModelAdmin):
    list_display = ('lecturer', 'unit', 'term', 'created_at')
    list_filter = ('term',)
    search_fields = ('lecturer__email', 'unit__code', 'unit__name')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('actor', 'action', 'target_type', 'target_id', 'created_at')
    list_filter = ('action', 'target_type')
    search_fields = ('actor__email', 'target_id')
    readonly_fields = ('created_at',)


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'audience', 'created_by', 'created_at')
    list_filter = ('audience',)
    search_fields = ('title', 'body')


@admin.register(AdminSetting)
class AdminSettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'updated_at')

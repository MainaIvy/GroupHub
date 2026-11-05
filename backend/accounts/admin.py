from django.contrib import admin
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'user_type', 'university', 'is_active')
    list_filter = ('user_type', 'university', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')

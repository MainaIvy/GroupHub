from django.urls import path
from . import views
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('signup/', views.signup_view, name='signup'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),

    # JWT endpoints (used by frontend)
    path('jwt/login/', views.LoginView.as_view(), name='jwt_login'),
    path('jwt/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Dashboard endpoints
    path('dashboard/student/', views.student_dashboard_view, name='student_dashboard'),
    path('dashboard/lecturer/', views.lecturer_dashboard_view, name='lecturer_dashboard'),

    # Search endpoint
    path('search/', views.search_view, name='search'),

    # Task management endpoints
    path('groups/<int:group_id>/tasks/', views.get_group_tasks_view, name='get_group_tasks'),
    path('tasks/<int:task_id>/update-status/', views.update_task_status_view, name='update_task_status'),
    path('tasks/<int:task_id>/update-progress/', views.update_task_progress_view, name='update_task_progress'),
    path('groups/<int:group_id>/tasks/create/', views.create_task_view, name='create_task'),
    path('tasks/', views.get_all_tasks_view, name='get_all_tasks'),

    # Notification endpoints
    path('notifications/', views.get_notifications_view, name='get_notifications'),
    path('notifications/<int:notification_id>/read/', views.mark_notification_read_view, name='mark_notification_read'),
    path('notifications/mark-all-read/', views.mark_all_notifications_read_view, name='mark_all_notifications_read'),
]


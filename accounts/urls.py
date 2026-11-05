from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path('signup/', views.signup_view, name='signup'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),
    path('google/login/', views.GoogleLoginView.as_view(), name='api_google_login'),

    # JWT
    path('jwt/login/', views.LoginView.as_view(), name='jwt_login'),
    path('jwt/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Dashboards
    path('dashboard/student/', views.student_dashboard_api, name='student_dashboard'),
    path('dashboard/student/live/', views.student_dashboard_api, name='live_student_dashboard'),
    path('dashboard/lecturer/', views.lecturer_dashboard_view, name='lecturer_dashboard'),

    # Submissions & Documents
    path('submissions/upload/', views.upload_submission_document, name='upload_submission'),

    # Search
    path('search/', views.search_view, name='search'),

    # Tasks
    path('tasks/', views.get_all_tasks_view, name='get_all_tasks'),
    path('tasks/<int:task_id>/update-status/', views.update_task_status_view, name='update_task_status'),
    path('tasks/<int:task_id>/update-progress/', views.update_task_progress_view, name='update_task_progress'),
    path('groups/<int:group_id>/tasks/', views.get_group_tasks_view, name='get_group_tasks'),
    path('groups/<int:group_id>/tasks/create/', views.create_task_view, name='create_task'),

    # Groups
    path('groups/create/', views.create_group_view, name='create_group'),
    path('groups/join/', views.join_group_view, name='join_group'),

    # Notifications
    path('notifications/', views.get_notifications_view, name='get_notifications'),
    path('notifications/<int:notification_id>/read/', views.mark_notification_read_view, name='mark_notification_read'),
    path('notifications/mark-all-read/', views.mark_all_notifications_read_view, name='mark_all_notifications_read'),

    # Academics & Units
    path('courses/', views.courses_list, name='courses_list'),
    path('programs/', views.get_academic_programs, name='academic_programs'),
    path('student-units/', views.get_student_units, name='student_units'),
]
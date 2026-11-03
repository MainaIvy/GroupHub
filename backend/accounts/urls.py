from django.urls import path
from . import views

urlpatterns = [
    # Auth/session endpoints
    path('signup/', views.signup_view, name='signup'),

    # Google OAuth login
    path('google/login/', views.GoogleLoginView.as_view(), name='api_google_login'),

    # API login (DRF). DO NOT route the API login to the plain Django function view,
    # otherwise the browser can render the token JSON outside of React.
    path('login/', views.LoginView.as_view(), name='api_login'),

    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),

    # JWT endpoints (frontend expects this at /api/accounts/jwt/login/)
    path('jwt/login/', views.LoginView.as_view(), name='api_jwt_login'),


    # Dashboards
    path('dashboard/student/', views.student_dashboard, name='student_dashboard'),
    path('dashboard/lecturer/', views.lecturer_dashboard, name='lecturer_dashboard'),


    # Chat
    path('chat/rooms/', views.get_chat_rooms, name='get_chat_rooms'),
    path('chat/messages/<int:room_id>/', views.get_messages, name='get_messages'),
    path('chat/send/<int:room_id>/', views.send_message, name='send_message'),
    path('chat/direct/', views.get_or_create_direct_chat, name='get_or_create_direct_chat'),
    path('chat/unread-counts/', views.get_unread_message_counts, name='get_unread_message_counts'),
    path('chat/<int:room_id>/mark-read/', views.mark_room_notifications_read, name='mark_room_notifications_read'),

    # Tasks / Groups
    path('groups/<int:group_id>/tasks/', views.get_group_tasks, name='get_group_tasks'),
    path('groups/<int:group_id>/create-task/', views.create_task, name='create_task'),
    path('tasks/<int:task_id>/update-progress/', views.update_task_progress, name='update_task_progress'),
    path('tasks/<int:task_id>/update-status/', views.update_task_status, name='update_task_status'),
    path('notifications/', views.get_notifications, name='get_notifications'),
    path('notifications/<int:notification_id>/read/', views.mark_notification_read, name='mark_notification_read'),
    path('groups/<int:group_id>/members/', views.get_group_members, name='get_group_members'),
    path('students/', views.get_students_for_lecturer, name='get_students_for_lecturer'),
    path('groups/create/', views.create_group_view, name='create_group'),
    path('groups/<int:group_id>/chat-room/', views.get_group_chat_room, name='get_group_chat_room'),
    path('groups/join/', views.join_group_view, name='join_group'),
]


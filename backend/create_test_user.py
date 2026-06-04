import os
import django
import sys

# Add the project directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django.setup()

from accounts.models import User

# Create test users with known passwords
test_users = [
    {
        'email': 'student@zetech.ac.ke',
        'password': 'Student123',
        'first_name': 'Test',
        'last_name': 'Student',
        'user_type': 'student',
        'university': 'Zetech University'
    },
    {
        'email': 'lecturer@zetech.ac.ke',
        'password': 'Lecturer123',
        'first_name': 'Test',
        'last_name': 'Lecturer',
        'user_type': 'lecturer',
        'university': 'Zetech University'
    }
]

for user_data in test_users:
    try:
        user = User.objects.create_user(
            username=user_data['email'],
            email=user_data['email'],
            password=user_data['password'],
            first_name=user_data['first_name'],
            last_name=user_data['last_name'],
            user_type=user_data['user_type'],
            university=user_data['university'],
            is_active=True
        )
        print(f"Created test user: {user.email} (password: {user_data['password']})")
    except Exception as e:
        print(f"Error creating user {user_data['email']}: {e}")

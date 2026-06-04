import os
import django
import sys

# Add the project directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django.setup()

from accounts.models import User

# Create a test user
try:
    user = User.objects.create_user(
        username='test@zetech.ac.ke',
        email='test@zetech.ac.ke',
        password='password123',
        first_name='Test',
        last_name='User',
        user_type='student',
        university='Zetech University',
        is_active=True
    )
    print(f"User created: {user.email}")
except Exception as e:
    print(f"Error creating user: {e}")

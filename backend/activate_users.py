import os
import django
import sys

# Add the project directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django.setup()

from accounts.models import User

# Activate all users
users = User.objects.all()
for user in users:
    user.is_active = True
    user.save()
    print(f"Activated user: {user.email}")

print(f"Activated {users.count()} users")

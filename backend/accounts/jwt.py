from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model, authenticate


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Authenticate using either admission number/staff ID or email as the username.

    The custom User model uses `username` for admission number/staff ID, but the
    React app may send either an admission number, staff ID, or email address.
    This serializer handles both cases and always returns a `user` object.
    """

    def validate(self, attrs):
        identifier = str(attrs.get('username') or '').strip()
        password = attrs.get("password") or self.initial_data.get("password")

        if not identifier or not password:
            raise serializers.ValidationError("Enter your admission number, staff ID, or email and password.")

        user_model = get_user_model()

        # Try to find the user by username (admission number / staff ID) or by email
        user = user_model.objects.filter(username__iexact=identifier).first()
        if user is None and '@' in identifier:
            user = user_model.objects.filter(email__iexact=identifier).first()

user = authenticate(request=self.context.get("request"), username=email, password=password)
        if user is None or not user.is_active:
            raise serializers.ValidationError("No active account found with the given credentials.")

        data = super().validate({"username": email, "password": password})
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "user_type": user.user_type,
            "is_staff": user.is_staff,
            "is_active": user.is_active,
        }
        return data

from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UnitAssignment


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Authenticate with an admission number, staff ID, or email address."""

    def validate(self, attrs):
        identifier = str(attrs.get('username') or '').strip()
        password = attrs.get('password') or self.initial_data.get('password')

        if not identifier or not password:
            raise serializers.ValidationError(
                'Enter your admission number, staff ID, or email and password.'
            )

        user_model = get_user_model()
        user = user_model.objects.filter(username__iexact=identifier).first()
        if user is None and '@' in identifier:
            user = user_model.objects.filter(email__iexact=identifier).first()
        if user is None:
            user = user_model.objects.filter(staff_id__iexact=identifier).first()

        authenticated_user = authenticate(
            request=self.context.get('request'),
            username=user.username if user is not None else identifier,
            password=password,
        )
        if authenticated_user is None or authenticated_user.status == 'suspended' or not authenticated_user.is_active:
            raise serializers.ValidationError(
                'This account is suspended or has no active credentials.'
            )

        data = super().validate({
            'username': authenticated_user.username,
            'password': password,
        })
        data['user'] = {
            'id': authenticated_user.id,
            'username': authenticated_user.username,
            'email': authenticated_user.email,
            'first_name': authenticated_user.first_name,
            'last_name': authenticated_user.last_name,
            'user_type': authenticated_user.user_type,
            'is_staff': authenticated_user.is_staff,
            'is_active': authenticated_user.is_active,
            'lecturer_setup_required': (
                authenticated_user.user_type == 'lecturer'
                and not UnitAssignment.objects.filter(lecturer=authenticated_user).exists()
            ),
        }
        return data

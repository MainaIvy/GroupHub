from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Authenticate using `email` as the username.

    Your custom User model uses `email` for `username` (see signup_view), but
    SimpleJWT's default serializer expects a field called `username`. The React
    app is sending `username: <email>`.

    This serializer ensures we consistently authenticate against the email field.
    """

    @classmethod
    def get_token(cls, user):
        return super().get_token(user)

    def validate(self, attrs):
        # SimpleJWT passes `username` and `password` into attrs by default.
        email = attrs.get("username")
        password = attrs.get("password")

        if not email or not password:
            raise self.fail("missing_credentials")

        email = email.strip().lower()

        user = authenticate(request=self.context.get("request"), username=email, password=password)
        if user is None:
            raise self.fail("no_active_account")

        data = super().validate({"username": email, "password": password})
        return data


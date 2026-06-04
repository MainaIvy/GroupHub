from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET", "POST", "OPTIONS"])
def test_login(request):
    # Minimal endpoint to isolate routing/CORS/middleware vs the real login logic.
    return Response({
        "success": True,
        "method": request.method,
    })


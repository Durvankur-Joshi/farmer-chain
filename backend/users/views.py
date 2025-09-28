from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.conf import settings


class CookieTokenRefreshView(APIView):
    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token')
        
        if not refresh_token:
            return Response(
                {"error": "Refresh token not found in cookies"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)
            
            response = Response({"message": "Token refreshed successfully"})
            
            # Set new access token cookie
            response.set_cookie(
                key='access_token',
                value=access_token,
                httponly=True,
                secure=not settings.DEBUG,
                samesite='Lax',
                max_age=60 * 30  # 30 minutes
            )
            
            return response
            
        except TokenError as e:
            return Response(
                {"error": "Invalid refresh token"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )


class LogoutView(APIView):
    def post(self, request):
        response = Response({"message": "Logged out successfully"})
        
        # Clear cookies with path and samesite
        response.delete_cookie('access_token', path='/', samesite='Lax')
        response.delete_cookie('refresh_token', path='/', samesite='Lax')
        
        return response

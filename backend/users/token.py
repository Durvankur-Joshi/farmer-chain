from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from farmer.models import Farmer
from fpo.models import FPO
from retailer.models import Retailer
from admin_app.models import Admin
from rest_framework.response import Response
from django.conf import settings


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    role = serializers.CharField(required=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.username_field in self.fields:
            self.fields[self.username_field].required = False
            self.fields[self.username_field].allow_blank = True

    def validate(self, attrs):
        role = attrs.get("role", "").lower()
        user_identifier = attrs.get("email") or attrs.get("username")
        if not user_identifier:
            raise serializers.ValidationError("Email or username is required.")
        password = attrs.get("password")

        # Determine which model to authenticate against
        user = None
        user_data = {}
        
        if role == "farmer":
            try:
                user = Farmer.objects.get(email=user_identifier)
                user_data = {
                    'id': user.id,
                    'username': user.email,
                    'role': 'farmer',
                    'name': user.name
                }
            except Farmer.DoesNotExist:
                raise serializers.ValidationError("Farmer not found.")
        elif role == "fpo":
            try:
                user = FPO.objects.get(email=user_identifier)
                user_data = {
                    'id': user.id,
                    'username': user.email,
                    'role': 'fpo',
                    'name': user.name
                }
            except FPO.DoesNotExist:
                raise serializers.ValidationError("FPO not found.")
        elif role == "retailer":
            try:
                user = Retailer.objects.get(email=user_identifier)
                user_data = {
                    'id': user.id,
                    'username': user.email,
                    'role': 'retailer',
                    'name': user.name
                }
            except Retailer.DoesNotExist:
                raise serializers.ValidationError("Retailer not found.")
        elif role == "admin":
            try:
                user = Admin.objects.get(username=user_identifier)
                # Verify password for admin
                if not user.check_password(password):
                    raise serializers.ValidationError("Incorrect password.")
                user_data = {
                    'id': user.id,
                    'username': user.username,
                    'role': 'admin',
                    'name': user.username
                }
            except Admin.DoesNotExist:
                raise serializers.ValidationError("Admin not found.")
        else:
            raise serializers.ValidationError("Invalid role. Must be one of: farmer, fpo, retailer, admin.")

        # Verify password for non-admin users
        if role != "admin" and not user.check_password(password):
            raise serializers.ValidationError("Incorrect password.")

        # Create a custom token payload using the proper method
        refresh = self.get_token(user)
        refresh['user_id'] = user_data['id']
        refresh['username'] = user_data['username']
        refresh['role'] = user_data['role']
        refresh['name'] = user_data['name']

        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "role": user_data['role'],
            "user_id": user_data['id'],
            "name": user_data['name']
        }

        return data

    @classmethod
    def get_token(cls, user):
        return RefreshToken.for_user(user)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except Exception as e:
            err_msg = str(e)
            if hasattr(e, "detail"):
                if isinstance(e.detail, dict):
                    err_msg = next(iter(e.detail.values()))
                    if isinstance(err_msg, list):
                        err_msg = str(err_msg[0])
                elif isinstance(e.detail, list):
                    err_msg = str(e.detail[0])
                else:
                    err_msg = str(e.detail)
            return Response({"error": err_msg}, status=400)

        token_data = serializer.validated_data

        response_data = {
            "access": token_data['access'],
            "refresh": token_data['refresh'],
            "role": token_data['role'],
            "user_id": token_data['user_id'],
            "name": token_data['name'],
            "message": "Login successful"
        }

        # Provide role-specific IDs for frontend backward compatibility
        if token_data['role'] == 'farmer':
            response_data['farmer_id'] = token_data['user_id']
        elif token_data['role'] == 'fpo':
            response_data['fpo_id'] = token_data['user_id']
        elif token_data['role'] == 'retailer':
            response_data['retailer_id'] = token_data['user_id']

        response = Response(response_data)

        # Cross-site cookies require SameSite=None + Secure in production
        # (Vercel frontend and Render backend are different domains)
        cookie_samesite = 'Lax' if settings.DEBUG else 'None'
        cookie_secure = not settings.DEBUG

        # 🔹 Set tokens in cookies
        response.set_cookie(
            key='access_token',
            value=token_data['access'],
            httponly=True,
            secure=cookie_secure,
            samesite=cookie_samesite,
            max_age=60 * 30
        )
        
        response.set_cookie(
            key='refresh_token',
            value=token_data['refresh'],
            httponly=True,
            secure=cookie_secure,
            samesite=cookie_samesite,
            max_age=60 * 60 * 24
        )

        # 🔹 Always set role cookie (readable by frontend)
        response.set_cookie(
            key='role',
            value=token_data['role'],
            httponly=False,  # must be readable in JS for ProtectedRoute
            secure=cookie_secure,
            samesite=cookie_samesite,
            max_age=60 * 60 * 24
        )

        return response


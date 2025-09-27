from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from farmer.models import Farmer
from fpo.models import FPO
from retailer.models import Retailer
from admin_app.models import Admin


class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom authentication that reads JWT from cookies and builds user object.
    """

    def authenticate(self, request):
        # Try to get token from cookies first
        access_token = request.COOKIES.get('access_token')
        
        if not access_token:
            # Fall back to header for backward compatibility
            return super().authenticate(request)
        
        # Validate the token from cookie
        try:
            validated_token = self.get_validated_token(access_token)
            user = self.get_user(validated_token)
            return (user, validated_token)
        except InvalidToken:
            return None

    def get_user(self, validated_token):
        user_id = validated_token.get("user_id")
        role = validated_token.get("role")

        if not user_id or not role:
            raise InvalidToken("Token is missing required claims (user_id, role).")

        # Create a simple, dynamic user object compatible with Django's request.user
        user = type("User", (), {
            "id": user_id,
            "username": validated_token.get("username"),
            "role": role,
            "name": validated_token.get("name"),
            "is_authenticated": True,
            "is_active": True,
            "is_staff": False,
            "is_superuser": False,
            "has_perm": lambda self, perm: False,
            "has_module_perms": lambda self, app_label: False,
            "__str__": lambda self: self.username,
            "user_obj": None  # Placeholder for the real model instance
        })()
        
        try:
            # Fetch the real database object and attach it to our custom user
            if role == "farmer":
                user.user_obj = Farmer.objects.get(pk=user_id)
            elif role == "fpo":
                user.user_obj = FPO.objects.get(pk=user_id)
            elif role == "retailer":
                user.user_obj = Retailer.objects.get(pk=user_id)
            elif role == "admin":
                user.user_obj = Admin.objects.get(pk=user_id)
            else:
                raise InvalidToken(f"Invalid role '{role}' in token.")
            
            return user

        except (Farmer.DoesNotExist, FPO.DoesNotExist, Retailer.DoesNotExist, Admin.DoesNotExist):
            raise InvalidToken("User not found for the given token.")
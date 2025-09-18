from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom authentication that does not look up Django's default User model.
    Instead, it builds a lightweight user object directly from the JWT payload.
    """

    def get_user(self, validated_token):
        try:
            # Create a simple user object with all required Django attributes
            user = type("User", (), {
                "id": validated_token.get("user_id"),
                "username": validated_token.get("username"),
                "role": validated_token.get("role"),
                "name": validated_token.get("name"),
                # Required Django user attributes
                "is_authenticated": True,
                "is_active": True,
                "is_staff": False,
                "is_superuser": False,
                # Required methods
                "has_perm": lambda self, perm: False,
                "has_module_perms": lambda self, app_label: False,
                "_str_": lambda self: self.username
            })()
            
            return user
            
        except Exception:
            raise InvalidToken("Invalid token payload")
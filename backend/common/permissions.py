from rest_framework.permissions import BasePermission
# Note: Model imports are no longer needed here, making this file cleaner.

class IsFarmer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and getattr(user, "role", None) == "farmer")

class IsFPO(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and getattr(user, "role", None) == "fpo")

class IsRetailer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and getattr(user, "role", None) == "retailer")

class IsAdminApp(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and getattr(request.user, "role", None) == "admin")
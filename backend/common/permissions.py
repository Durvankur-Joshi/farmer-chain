from rest_framework.permissions import BasePermission
# Note: Model imports are no longer needed here, making this file cleaner.

class IsFarmer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not (user and getattr(user, "role", None) == "farmer"):
            return False
        
        # Check approval status on the attached user object, avoiding a DB query
        farmer = getattr(user, "user_obj", None)
        return farmer and farmer.approval_status == 'approved'

class IsFPO(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not (user and getattr(user, "role", None) == "fpo"):
            return False
        
        # Check approval status on the attached user object
        fpo = getattr(user, "user_obj", None)
        return fpo and fpo.approval_status == 'approved'

class IsRetailer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not (user and getattr(user, "role", None) == "retailer"):
            return False
        
        # Check approval status on the attached user object
        retailer = getattr(user, "user_obj", None)
        return retailer and retailer.approval_status == 'approved'

class IsAdminApp(BasePermission):
    def has_permission(self, request, view):
        return request.user and getattr(request.user, "role", None) == "admin"
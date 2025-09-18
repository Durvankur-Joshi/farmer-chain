from rest_framework.permissions import BasePermission
from farmer.models import Farmer
from fpo.models import FPO
from retailer.models import Retailer

class IsFarmer(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and getattr(request.user, "role", None) == "farmer"):
            return False
        
        # Check if the farmer is approved
        try:
            farmer = Farmer.objects.get(id=request.user.user_id)
            return farmer.approval_status == 'approved'
        except Farmer.DoesNotExist:
            return False

class IsFPO(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and getattr(request.user, "role", None) == "fpo"):
            return False
        
        # Check if the FPO is approved
        try:
            fpo = FPO.objects.get(id=request.user.user_id)
            return fpo.approval_status == 'approved'
        except FPO.DoesNotExist:
            return False

class IsRetailer(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and getattr(request.user, "role", None) == "retailer"):
            return False
        
        # Check if the retailer is approved
        try:
            retailer = Retailer.objects.get(id=request.user.user_id)
            return retailer.approval_status == 'approved'
        except Retailer.DoesNotExist:
            return False

class IsAdminApp(BasePermission):
    def has_permission(self, request, view):
        return request.user and getattr(request.user, "role", None) == "admin"
from django.urls import path
from .views import (
    AdminRegistrationView, 
    AdminListView, 
    AdminDetailView,
    pending_registrations,
    approve_farmer,
    reject_farmer,
    approve_fpo,
    reject_fpo,
    approve_retailer,
    reject_retailer,
    admin_login_check
)

urlpatterns = [
    path('register/', AdminRegistrationView.as_view(), name='admin-register'),
    path('login-check/', admin_login_check, name='admin-login-check'),
    path('', AdminListView.as_view(), name='admin-list'),
    path('<int:pk>/', AdminDetailView.as_view(), name='admin-detail'),
    
    # Admin approval routes
    path('pending-registrations/', pending_registrations, name='pending-registrations'),
    path('approve-farmer/<int:farmer_id>/', approve_farmer, name='approve-farmer'),
    path('reject-farmer/<int:farmer_id>/', reject_farmer, name='reject-farmer'),
    path('approve-fpo/<int:fpo_id>/', approve_fpo, name='approve-fpo'),
    path('reject-fpo/<int:fpo_id>/', reject_fpo, name='reject-fpo'),
    path('approve-retailer/<int:retailer_id>/', approve_retailer, name='approve-retailer'),
    path('reject-retailer/<int:retailer_id>/', reject_retailer, name='reject-retailer'),
]
from django.urls import path
from .views import FarmerRegistrationView, FarmerListView, FarmerDetailView, farmer_login_check

urlpatterns = [
    path('register/', FarmerRegistrationView.as_view(), name='farmer-register'),
    path('login-check/', farmer_login_check, name='farmer-login-check'),
    path('', FarmerListView.as_view(), name='farmer-list'),
    path('<int:pk>/', FarmerDetailView.as_view(), name='farmer-detail'),
]
from django.urls import path
from .views import FPORegistrationView, FPOListView, FPODetailView, fpo_login_check

urlpatterns = [
    path('register/', FPORegistrationView.as_view(), name='fpo-register'),
    path('login-check/', fpo_login_check, name='fpo-login-check'),
    path('', FPOListView.as_view(), name='fpo-list'),
    path('<int:pk>/', FPODetailView.as_view(), name='fpo-detail'),
]
from django.urls import path
from .views import RetailerRegistrationView, RetailerListView, RetailerDetailView, retailer_login_check

urlpatterns = [
    path('register/', RetailerRegistrationView.as_view(), name='retailer-register'),
    path('login-check/', retailer_login_check, name='retailer-login-check'),
    path('', RetailerListView.as_view(), name='retailer-list'),
    path('<int:pk>/', RetailerDetailView.as_view(), name='retailer-detail'),
]
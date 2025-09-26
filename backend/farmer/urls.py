from django.urls import path
from .views import FarmerRegistrationView, FarmerListView, FarmerDetailView, farmer_login_check
from .views import (
    # ... existing imports
    farmer_dashboard,
    OpenQuoteListView,
    FarmerBidCreateView
)

urlpatterns = [
    path('register/', FarmerRegistrationView.as_view(), name='farmer-register'),
    path('login-check/', farmer_login_check, name='farmer-login-check'),
    path('', FarmerListView.as_view(), name='farmer-list'),
    path('<int:pk>/', FarmerDetailView.as_view(), name='farmer-detail'),
    path('dashboard/', farmer_dashboard, name='farmer-dashboard'),
    path('quotes/open/', OpenQuoteListView.as_view(), name='farmer-open-quotes'),
    path('quotes/<int:quote_pk>/bids/', FarmerBidCreateView.as_view(), name='farmer-create-bid'),
]
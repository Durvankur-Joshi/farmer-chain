from django.urls import path
from .views import (
    FPORegistrationView, FPOListView, FPODetailView, fpo_login_check,
    fpo_dashboard, FarmerOpenQuoteListView, FPOBidCreateView, 
    FPOQuoteListCreateView, accept_retailer_bid
)

urlpatterns = [
    path('register/', FPORegistrationView.as_view(), name='fpo-register'),
    path('login-check/', fpo_login_check, name='fpo-login-check'),
    path('', FPOListView.as_view(), name='fpo-list'),
    path('<int:pk>/', FPODetailView.as_view(), name='fpo-detail'),
    path('dashboard/', fpo_dashboard, name='fpo-dashboard'),
    path('quotes/farmer/open/', FarmerOpenQuoteListView.as_view(), name='fpo-farmer-open-quotes'),
    path('quotes/farmer/<int:quote_pk>/bids/', FPOBidCreateView.as_view(), name='fpo-create-bid-on-farmer-quote'),
    path('quotes/', FPOQuoteListCreateView.as_view(), name='fpo-quote-list'),
    path('bids/retailer/<int:bid_pk>/accept/', accept_retailer_bid, name='fpo-accept-retailer-bid'),
]
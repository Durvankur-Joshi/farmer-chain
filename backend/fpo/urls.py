from django.urls import path
from .views import FPORegistrationView, FPOListView, FPODetailView, fpo_login_check
from .views import (
    # ... existing imports
    fpo_dashboard,
    FPOQuoteRequestListCreateView,
    FPOQuoteRequestDetailView,
    accept_farmer_bid,
)

from .views import (
    # ... existing imports
    RetailerOpenQuoteListView,
    FPOBidCreateView
)

urlpatterns = [
    path('register/', FPORegistrationView.as_view(), name='fpo-register'),
    path('login-check/', fpo_login_check, name='fpo-login-check'),
    path('', FPOListView.as_view(), name='fpo-list'),
    path('<int:pk>/', FPODetailView.as_view(), name='fpo-detail'),
    path('dashboard/', fpo_dashboard, name='fpo-dashboard'),
    path('quotes/', FPOQuoteRequestListCreateView.as_view(), name='fpo-quote-list-create'),
    path('quotes/<int:pk>/', FPOQuoteRequestDetailView.as_view(), name='fpo-quote-detail'),
    path('bids/farmer/<int:bid_pk>/accept/', accept_farmer_bid, name='fpo-accept-farmer-bid'),
    path('quotes/retailer/open/', RetailerOpenQuoteListView.as_view(), name='fpo-retailer-open-quotes'),
    path('quotes/retailer/<int:quote_pk>/bids/', FPOBidCreateView.as_view(), name='fpo-create-bid-on-retailer-quote'),
]
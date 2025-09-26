from django.urls import path
from .views import RetailerRegistrationView, RetailerListView, RetailerDetailView, retailer_login_check
from .views import (
    # ... existing ...
    retailer_dashboard,
    RetailerQuoteRequestListCreateView,
    RetailerQuoteRequestDetailView,
    accept_fpo_bid,
    confirm_fpo_bid_payment
)

urlpatterns = [
    path('register/', RetailerRegistrationView.as_view(), name='retailer-register'),
    path('login-check/', retailer_login_check, name='retailer-login-check'),
    path('', RetailerListView.as_view(), name='retailer-list'),
    path('<int:pk>/', RetailerDetailView.as_view(), name='retailer-detail'),
    path('dashboard/', retailer_dashboard, name='retailer-dashboard'),
    path('quotes/', RetailerQuoteRequestListCreateView.as_view(), name='retailer-quote-list-create'),
    path('quotes/<int:pk>/', RetailerQuoteRequestDetailView.as_view(), name='retailer-quote-detail'),
    path('bids/fpo/<int:bid_pk>/accept/', accept_fpo_bid, name='retailer-accept-fpo-bid'),
    path('bids/fpo/<int:bid_pk>/confirm-payment/', confirm_fpo_bid_payment, name='retailer-confirm-payment'),
]
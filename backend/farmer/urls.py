from django.urls import path
from .views import (
    FarmerRegistrationView, FarmerListView, FarmerDetailView, farmer_login_check,
    farmer_dashboard, FarmerQuoteListCreateView, FarmerQuoteDetailView, accept_fpo_bid, update_contract_address, get_contract_details
)

urlpatterns = [
    path('register/', FarmerRegistrationView.as_view(), name='farmer-register'),
    path('login-check/', farmer_login_check, name='farmer-login-check'),
    path('', FarmerListView.as_view(), name='farmer-list'),
    path('<int:pk>/', FarmerDetailView.as_view(), name='farmer-detail'),
    path('dashboard/', farmer_dashboard, name='farmer-dashboard'),
    path('quotes/', FarmerQuoteListCreateView.as_view(), name='farmer-quote-list'),
    path('quotes/<int:pk>/', FarmerQuoteDetailView.as_view(), name='farmer-quote-detail'),
    path('bids/fpo/<int:bid_pk>/accept/', accept_fpo_bid, name='farmer-accept-fpo-bid'),
    path('quotes/<int:quote_id>/update-contract/', update_contract_address, name='update-contract-address'),# he don aahet ha ani hecha khalcha
    path('contract/<str:contract_address>/', get_contract_details, name='contract-details'),  # Public contract view
]
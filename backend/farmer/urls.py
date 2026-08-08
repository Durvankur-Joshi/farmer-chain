from django.urls import path
from .views import (
    # ── Existing ────────────────────────────────────────────────────
    FarmerRegistrationView, FarmerListView, FarmerDetailView, farmer_login_check,
    farmer_dashboard, FarmerQuoteListCreateView, FarmerQuoteDetailView,
    accept_fpo_bid, update_contract_address, get_contract_details,
    # ── Phase 2.2 Crop Passport ─────────────────────────────────────
    CropPassportListCreateView, CropPassportDetailView,
    prepare_mint_view, confirm_mint_view, public_crop_passport_view,
)

urlpatterns = [
    # ── Existing routes (unchanged) ─────────────────────────────────
    path('register/', FarmerRegistrationView.as_view(), name='farmer-register'),
    path('login-check/', farmer_login_check, name='farmer-login-check'),
    path('', FarmerListView.as_view(), name='farmer-list'),
    path('<int:pk>/', FarmerDetailView.as_view(), name='farmer-detail'),
    path('dashboard/', farmer_dashboard, name='farmer-dashboard'),
    path('quotes/', FarmerQuoteListCreateView.as_view(), name='farmer-quote-list'),
    path('quotes/<int:pk>/', FarmerQuoteDetailView.as_view(), name='farmer-quote-detail'),
    path('bids/fpo/<int:bid_pk>/accept/', accept_fpo_bid, name='farmer-accept-fpo-bid'),
    path('quotes/<int:quote_id>/update-contract/', update_contract_address, name='update-contract-address'),
    path('contract/<str:contract_address>/', get_contract_details, name='contract-details'),

    # ── Phase 2.2: Crop Passport routes ─────────────────────────────
    # Note: 'public/' is declared before '<int:pk>/' to avoid URL collision
    path('crops/public/<int:crop_id>/', public_crop_passport_view, name='crop-passport-public'),
    path('crops/', CropPassportListCreateView.as_view(), name='crop-passport-list'),
    path('crops/<int:pk>/', CropPassportDetailView.as_view(), name='crop-passport-detail'),
    path('crops/<int:crop_id>/mint/', prepare_mint_view, name='crop-passport-mint'),
    path('crops/<int:crop_id>/confirm-mint/', confirm_mint_view, name='crop-passport-confirm-mint'),
]
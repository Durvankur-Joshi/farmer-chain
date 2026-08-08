from django.urls import path
from .views import (
    # ── Existing (unchanged) ─────────────────────────────────────────
    FarmerRegistrationView, FarmerListView, FarmerDetailView, farmer_login_check,
    farmer_dashboard, FarmerQuoteListCreateView, FarmerQuoteDetailView,
    accept_fpo_bid, update_contract_address, get_contract_details,
    # ── Phase 2.2: Crop Passport ─────────────────────────────────────
    CropPassportListCreateView, CropPassportDetailView,
    prepare_mint_view, confirm_mint_view, public_crop_passport_view,
    # ── Phase 2.3: IPFS Documents ────────────────────────────────────
    upload_document, list_documents, document_detail,
    # ── Phase 2.4: AI Quality Verification ───────────────────────────
    verify_crop_view, get_verification_view, public_verification_view,
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

    # ── Phase 2.2: Crop Passport ─────────────────────────────────────
    # 'public/' declared before <int:pk>/ to avoid URL collision
    path('crops/public/<int:crop_id>/', public_crop_passport_view, name='crop-passport-public'),
    path('crops/', CropPassportListCreateView.as_view(), name='crop-passport-list'),
    path('crops/<int:pk>/', CropPassportDetailView.as_view(), name='crop-passport-detail'),
    path('crops/<int:crop_id>/mint/', prepare_mint_view, name='crop-passport-mint'),
    path('crops/<int:crop_id>/confirm-mint/', confirm_mint_view, name='crop-passport-confirm-mint'),

    # ── Phase 2.3: IPFS Document endpoints ──────────────────────────
    path('crops/<int:crop_id>/documents/', upload_document,  name='crop-document-upload'),
    path('crops/<int:crop_id>/documents/list/', list_documents, name='crop-document-list'),
    path('crops/<int:crop_id>/documents/<int:document_id>/', document_detail, name='crop-document-detail'),

    # ── Phase 2.4: AI Quality Verification ──────────────────────────
    # POST → start AI verification
    path('crops/<int:crop_id>/verify/', verify_crop_view, name='crop-ai-verify'),
    # GET  → latest verification (farmer-scoped)
    path('crops/<int:crop_id>/verification/', get_verification_view, name='crop-ai-verification'),
    # GET  → public verification result (AllowAny)
    path('crops/public/<int:crop_id>/verification/', public_verification_view, name='crop-ai-verification-public'),
]
from rest_framework import generics, status
from common.events import emit_event
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import Farmer, FarmerQuote, CropPassport, CropPassportDocument, AIQualityVerification
from django.utils import timezone
from .serializers import (
    FarmerSerializer, FarmerRegistrationSerializer, FarmerQuoteSerializer,
    CropPassportSerializer, PublicCropPassportSerializer,
    CropPassportDocumentSerializer, PublicDocumentSerializer,
    AIQualityVerificationSerializer, PublicVerificationSerializer,
)
from common.permissions import IsFarmer
from fpo.models import FPOBid
from fpo.serializers import FPOBidSerializer
import re
import logging

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────
# Existing views (unchanged)
# ─────────────────────────────────────────────────────────────────

class FarmerRegistrationView(generics.CreateAPIView):
    queryset = Farmer.objects.all()
    serializer_class = FarmerRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {"message": "Registration successful.", "data": serializer.data},
            status=status.HTTP_201_CREATED,
            headers=headers
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def farmer_login_check(request):
    email = request.data.get('email')
    
    try:
        farmer = Farmer.objects.get(email=email)
        if farmer.approval_status == 'pending':
            return Response({
                'message': 'Your account is pending admin approval. Please wait for approval to login.',
                'approved': False,
                'status': 'pending'
            }, status=status.HTTP_200_OK)
        elif farmer.approval_status == 'rejected':
            return Response({
                'message': 'Your account has been rejected by admin. Please contact support.',
                'approved': False,
                'status': 'rejected'
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'message': 'Account is approved. You can proceed to login.',
                'approved': True,
                'status': 'approved'
            }, status=status.HTTP_200_OK)
    except Farmer.DoesNotExist:
        return Response({
            'message': 'Farmer not found with this email.',
            'approved': False,
            'status': 'not_found'
        }, status=status.HTTP_404_NOT_FOUND)

class FarmerListView(generics.ListAPIView):
    queryset = Farmer.objects.all()
    serializer_class = FarmerSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

class FarmerDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FarmerSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

    def get_queryset(self):
        farmer = getattr(self.request.user, 'user_obj', None)
        if farmer:
            return Farmer.objects.filter(pk=farmer.pk)
        return Farmer.objects.none()

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFarmer])
def farmer_dashboard(request):
    farmer = request.user.user_obj
    
    my_quotes = FarmerQuote.objects.filter(farmer=farmer)
    bids_received = FPOBid.objects.filter(quote__in=my_quotes)

    data = {
        "my_quotes_count": my_quotes.count(),
        "bids_received_count": bids_received.count(),
        "active_quotes": my_quotes.filter(status='open').count(),
        "awarded_quotes": my_quotes.filter(status='awarded').count(),
    }
    return Response(data)

class FarmerQuoteListCreateView(generics.ListCreateAPIView):
    serializer_class = FarmerQuoteSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

    def get_queryset(self):
        farmer = self.request.user.user_obj
        qs = FarmerQuote.objects.filter(farmer=farmer)

        q = self.request.query_params.get('search') or self.request.query_params.get('q')
        if q:
            q = q.strip()
            from django.db.models import Q
            qs = qs.filter(
                Q(product_name__icontains=q) |
                Q(category__icontains=q) |
                Q(crop_passport__crop_category__icontains=q) |
                Q(description__icontains=q)
            )

        category = self.request.query_params.get('category')
        if category and category.strip() and category.lower() != 'all':
            qs = qs.filter(
                Q(category__iexact=category.strip()) |
                Q(crop_passport__crop_category__iexact=category.strip())
            )

        unit = self.request.query_params.get('unit')
        if unit and unit.strip() and unit.lower() != 'all':
            qs = qs.filter(unit__iexact=unit.strip())

        status_param = self.request.query_params.get('status')
        if status_param and status_param.strip() and status_param.lower() != 'all':
            qs = qs.filter(status=status_param.strip())

        min_qty = self.request.query_params.get('min_qty')
        if min_qty:
            try:
                min_val = float(min_qty)
                if min_val >= 0:
                    qs = qs.filter(quantity__gte=min_val)
            except (ValueError, TypeError):
                pass

        max_qty = self.request.query_params.get('max_qty')
        if max_qty:
            try:
                max_val = float(max_qty)
                if max_val >= 0:
                    qs = qs.filter(quantity__lte=max_val)
            except (ValueError, TypeError):
                pass

        harvest_from = self.request.query_params.get('harvest_from')
        if harvest_from:
            qs = qs.filter(crop_passport__harvest_date__gte=harvest_from)

        harvest_to = self.request.query_params.get('harvest_to')
        if harvest_to:
            qs = qs.filter(crop_passport__harvest_date__lte=harvest_to)

        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        from decimal import Decimal
        from rest_framework import serializers
        farmer = self.request.user.user_obj
        
        # Check passport available quantity before saving
        passport = serializer.validated_data.get('crop_passport')
        quote_qty = serializer.validated_data.get('quantity')
        if passport:
            avail = passport.available_quantity if passport.available_quantity is not None else passport.quantity
            if avail is not None and Decimal(str(avail)) < Decimal(str(quote_qty)):
                raise serializers.ValidationError(
                    f"Quote quantity ({quote_qty} {passport.unit}) exceeds remaining passport available stock ({avail} {passport.unit})."
                )

        quote = serializer.save(farmer=farmer)

        if passport:
            avail = passport.available_quantity if passport.available_quantity is not None else passport.quantity
            passport.available_quantity = max(Decimal('0'), Decimal(str(avail)) - Decimal(str(quote.quantity)))
            passport.sold_quantity = Decimal(str(passport.sold_quantity or '0')) + Decimal(str(quote.quantity))
            if passport.available_quantity <= Decimal('0') and passport.status != 'minted':
                passport.status = 'sold'
            passport.save()

        emit_event("quote_updated", {"quote_id": quote.id, "farmer_id": farmer.pk})

class FarmerQuoteDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = FarmerQuoteSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

    def get_queryset(self):
        farmer = getattr(self.request.user, 'user_obj', None)
        if farmer:
            return FarmerQuote.objects.filter(farmer=farmer)
        return FarmerQuote.objects.none()

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def accept_fpo_bid(request, bid_pk):
    bid = get_object_or_404(FPOBid, pk=bid_pk)
    quote = bid.quote

    if quote.farmer != request.user.user_obj:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    
    if quote.status != 'open':
        return Response({"error": "Quote is not open for bidding."}, status=status.HTTP_400_BAD_REQUEST)

    # Accept this bid
    bid.status = 'accepted'
    bid.save()

    # Reject other bids
    quote.bids.exclude(pk=bid.pk).update(status='rejected')

    # Update quote status to 'accepted' (contract will be created in frontend)
    quote.status = 'accepted'
    quote.accepted_bid = bid
    quote.save()

    # Phase 1 — Create FPO Inventory Lot preserving Farmer & Crop Passport provenance
    try:
        from fpo.services import create_fpo_inventory_lot_from_deal
        create_fpo_inventory_lot_from_deal(quote, bid)
    except Exception as exc:
        logger.warning("Could not auto-create FPO inventory lot on bid accept: %s", exc)

    emit_event("bid_updated", {"bid_id": bid.pk, "quote_id": quote.id})
    emit_event("deal_updated", {"quote_id": quote.id})

    return Response({
        "message": "Bid accepted successfully. You can now create the smart contract.",
        "bid_id": bid.pk,
        "quote_id": quote.id,
        "quote_status": quote.status,
        "next_step": "create_smart_contract"
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def update_contract_address(request, quote_id):
    """Update the contract address after smart contract creation"""
    quote = get_object_or_404(FarmerQuote, id=quote_id)
    
    if quote.farmer != request.user.user_obj:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    
    contract_address = request.data.get('contract_address')
    if not contract_address:
        return Response({"error": "Contract address is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    if not contract_address.startswith('0x') or len(contract_address) != 42:
        return Response({"error": "Invalid contract address format"}, status=status.HTTP_400_BAD_REQUEST)
    
    quote.contract_address = contract_address
    quote.status = 'contract_created'
    quote.contract_created_at = timezone.now()
    quote.save()
    
    return Response({
        "message": "Contract address updated successfully",
        "contract_address": contract_address,
        "quote_id": quote.id
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_contract_details(request, contract_address):
    """Get contract details for public viewing"""
    quote = get_object_or_404(FarmerQuote, contract_address=contract_address)
    
    serializer = FarmerQuoteSerializer(quote)
    
    response_data = {
        'quote': serializer.data,
        'contract_address': contract_address,
        'farmer_info': {
            'name': quote.farmer.name,
            'location': f"{quote.farmer.city}, {quote.farmer.state}"
        },
        'fpo_info': None,
        'retailer_info': None
    }
    
    if quote.accepted_bid:
        response_data['fpo_info'] = {
            'name': quote.accepted_bid.fpo.name,
            'email': quote.accepted_bid.fpo.email
        }
    
    return Response(response_data)


# ─────────────────────────────────────────────────────────────────
# Phase 2.2 — Crop Passport views
# ─────────────────────────────────────────────────────────────────

def _is_valid_eth_address(addr: str) -> bool:
    """Basic Ethereum address format check: 0x + 40 hex chars."""
    return bool(addr and re.fullmatch(r'0x[0-9a-fA-F]{40}', addr))


def _is_valid_tx_hash(txhash: str) -> bool:
    """Basic tx hash format check: 0x + 64 hex chars."""
    return bool(txhash and re.fullmatch(r'0x[0-9a-fA-F]{64}', txhash))


def _is_valid_ipfs_uri(uri: str) -> bool:
    """Accept ipfs://<CID> or https://gateway.pinata.cloud/ipfs/<CID>."""
    return bool(uri and (uri.startswith('ipfs://') or '/ipfs/' in uri))


class CropPassportListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/farmer/crops/  — list farmer's own crops
    POST /api/farmer/crops/  — create a new crop passport
    """
    serializer_class = CropPassportSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

    def get_queryset(self):
        return CropPassport.objects.filter(farmer=self.request.user.user_obj)

    def perform_create(self, serializer):
        # farmer is always derived from the authenticated request, never request.data
        serializer.save(farmer=self.request.user.user_obj)


class CropPassportDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/farmer/crops/<id>/  — retrieve one crop (owner only)
    PATCH  /api/farmer/crops/<id>/  — update crop (only before minting)
    DELETE /api/farmer/crops/<id>/  — delete crop passport (owner only, not active in quotes/escrow)
    """
    serializer_class = CropPassportSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

    def get_queryset(self):
        # Scoped to logged-in farmer only
        return CropPassport.objects.filter(farmer=self.request.user.user_obj)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_minted:
            return Response(
                {"error": "A minted Crop Passport cannot be modified."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_minted:
            return Response(
                {"error": "A minted Crop Passport cannot be modified."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # Check if linked to active quotes
        active_quotes = instance.quotes.filter(status__in=['open', 'accepted', 'contract_created', 'awarded'])
        if active_quotes.exists():
            return Response(
                {"error": f"Cannot delete Crop Passport because it is currently referenced by an active supply quote (Quote #{active_quotes.first().id}). Please close or cancel the quote first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if linked to active escrow transactions
        from escrow.models import EscrowTransaction
        active_escrows = EscrowTransaction.objects.filter(
            quote__crop_passport=instance
        ).exclude(status__in=['released', 'refunded'])
        if active_escrows.exists():
            return Response(
                {"error": f"Cannot delete Crop Passport because it is linked to an active escrow agreement (Escrow #{active_escrows.first().id})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        was_minted = instance.is_minted
        instance.delete()

        msg = "Crop Passport successfully deleted from FarmerChain."
        if was_minted:
            msg += " Note: Historical on-chain NFT token records remain recorded on the blockchain ledger."

        emit_event("crop_updated", {"crop_id": instance.pk})

        return Response(
            {"message": msg, "is_minted": was_minted},
            status=status.HTTP_200_OK,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def prepare_mint_view(request, crop_id):
    """
    POST /api/farmer/crops/<id>/mint/

    Validates the crop, builds NFT metadata, uploads it to IPFS via
    server-side Pinata credentials, and returns the token_uri + wallet
    for the frontend to use when calling MetaMask.

    Enforces mandatory fields, required IPFS image upload, and AI quality verification.
    """
    farmer = request.user.user_obj
    crop = get_object_or_404(CropPassport, pk=crop_id)

    # Ownership check — never trust the URL parameter alone
    if crop.farmer_id != farmer.pk:
        return Response(
            {"error": "You do not own this Crop Passport."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Double-mint guard
    if crop.is_minted:
        return Response(
            {"error": "This Crop Passport has already been minted as an NFT."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── 1. Validate mandatory fields ─────────────────────────────────
    if not crop.crop_name or not crop.crop_category or not crop.quantity or crop.quantity <= 0 or not crop.unit or not crop.cultivation_date or not crop.harvest_date:
        return Response(
            {"error": "All mandatory crop fields (crop name, category, quantity > 0, unit, cultivation date, harvest date) must be complete before generating Crop Passport."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if crop.cultivation_date > crop.harvest_date:
        return Response(
            {"error": "Cultivation date cannot be after harvest date."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── 2. Validate Primary Crop Image & AI Quality Verification ──────
    verifications = crop.ai_verifications.filter(verification_status='verified')
    if not crop.primary_image_url or not verifications.exists():
        return Response(
            {"error": "Primary crop image and successful AI Quality Verification are required before generating the Crop Passport."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── 3. (Evidence documents are optional supporting proof — not required for minting)

    # Build W3C-style NFT metadata (no sensitive fields)
    metadata = {
        "name": f"FarmerChain Crop Passport — {crop.crop_name}",
        "description": (
            f"Blockchain-backed digital crop passport issued by FarmerChain. "
            f"Crop: {crop.crop_name} | Category: {crop.crop_category} | "
            f"Farmer DID: {farmer.did or 'N/A'}"
        ),
        "image": "",   # placeholder — no image for MVP
        "attributes": [
            {"trait_type": "Crop", "value": crop.crop_name},
            {"trait_type": "Category", "value": crop.crop_category},
            {"trait_type": "Quantity", "value": str(crop.quantity)},
            {"trait_type": "Unit", "value": crop.unit},
            {"trait_type": "Cultivation Date", "value": str(crop.cultivation_date)},
            {"trait_type": "Harvest Date", "value": str(crop.harvest_date)},
            {"trait_type": "Location", "value": crop.location or f"{farmer.city}, {farmer.state}"},
            {"trait_type": "Farmer DID", "value": farmer.did or ""},
            {"trait_type": "Farmer Wallet", "value": farmer.wallet_address or ""},
            {"trait_type": "FarmerChain Crop ID", "value": str(crop.pk)},
            # Explicitly excluded: aadhaar, email, password, GSTIN, CIN
        ],
    }

    # Upload to IPFS via server-side Pinata credentials
    try:
        from services.ipfs_service import upload_json_to_ipfs, IPFSUploadError
        token_uri = upload_json_to_ipfs(
            metadata,
            name=f"crop-passport-{crop.pk}.json",
        )
    except IPFSUploadError as exc:
        logger.warning("IPFS upload failed for crop %s: %s", crop.pk, exc)
        return Response(
            {"error": f"IPFS upload failed: {str(exc)}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response({
        "crop_id": crop.pk,
        "crop_name": crop.crop_name,
        "token_uri": token_uri,
        "farmer_wallet": farmer.wallet_address,
        "farmer_did": farmer.did,
        "metadata": metadata,        # returned for transparency / debugging
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def confirm_mint_view(request, crop_id):
    """
    POST /api/farmer/crops/<id>/confirm-mint/

    Called by the frontend AFTER the blockchain tx is confirmed.
    Validates format of all inputs before persisting.

    Body: { token_id, contract_address, tx_hash, token_uri }

    Limitations (documented):
    - We validate format (ETH address, tx hash, IPFS URI) but do NOT
      perform a live RPC call to Sepolia here because the ETH_RPC_URL
      in .env contains a placeholder Infura key. Once a real Infura key
      is configured, on-chain verification can be added here.
    """
    farmer = request.user.user_obj
    crop = get_object_or_404(CropPassport, pk=crop_id)

    if crop.farmer_id != farmer.pk:
        return Response(
            {"error": "You do not own this Crop Passport."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if crop.is_minted:
        return Response(
            {"error": "This Crop Passport is already minted."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    token_id = str(request.data.get("token_id", "")).strip()
    contract_address = str(request.data.get("contract_address", "")).strip()
    tx_hash = str(request.data.get("tx_hash", "")).strip()
    token_uri = str(request.data.get("token_uri", "")).strip()

    # ── Format validation ──────────────────────────────────────────
    errors = {}
    if not token_id:
        errors["token_id"] = "token_id is required."
    if not _is_valid_eth_address(contract_address):
        errors["contract_address"] = "Must be a valid Ethereum address (0x + 40 hex chars)."
    if not _is_valid_tx_hash(tx_hash):
        errors["tx_hash"] = "Must be a valid transaction hash (0x + 64 hex chars)."
    if not _is_valid_ipfs_uri(token_uri):
        errors["token_uri"] = "Must be a valid IPFS URI (ipfs://...)."
    if errors:
        return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

    # ── Persist ────────────────────────────────────────────────────
    crop.nft_token_id = token_id
    crop.nft_contract_address = contract_address.lower()   # normalise
    crop.nft_transaction_hash = tx_hash.lower()
    crop.nft_token_uri = token_uri
    crop.status = CropPassport.STATUS_MINTED
    crop.nft_minted_at = timezone.now()
    crop.save()

    serializer = CropPassportSerializer(crop)

    emit_event("crop_updated", {"crop_id": crop.pk})

    return Response({
        "message": "Crop Passport NFT successfully recorded.",
        "crop": serializer.data,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def public_crop_passport_view(request, crop_id):
    """
    GET /api/farmer/crops/public/<id>/

    Public, unauthenticated. Returns only non-sensitive fields.
    No email, aadhaar, password, GSTIN, CIN.
    Phase 2.3: includes public documents list.
    """
    crop = get_object_or_404(CropPassport, pk=crop_id)
    serializer = PublicCropPassportSerializer(crop)
    documents  = crop.documents.all()
    doc_serializer = PublicDocumentSerializer(documents, many=True)
    data = serializer.data
    data['documents'] = doc_serializer.data
    return Response(data)


# ─────────────────────────────────────────────────────────────────
# Phase 2.3 — IPFS Document views
# ─────────────────────────────────────────────────────────────────

MAX_UPLOAD_BYTES = 10 * 1024 * 1024   # 10 MB
ALLOWED_CONTENT_TYPES = {
    'image/jpeg', 'image/jpg', 'image/png',
    'image/webp', 'application/pdf',
}
ALLOWED_DOC_TYPES = {
    'crop_image', 'soil_report', 'quality_report',
    'certification', 'harvest_document', 'other',
}


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def upload_document(request, crop_id):
    """
    POST /api/farmer/crops/<crop_id>/documents/

    Uploads a file to Pinata IPFS and stores the CID in Django.
    Farmer is always derived from the JWT cookie (never from request body).
    """
    farmer = request.user.user_obj
    crop   = get_object_or_404(CropPassport, pk=crop_id)

    # ── Ownership check ──────────────────────────────────────────
    if crop.farmer_id != farmer.pk:
        return Response(
            {'error': 'You do not own this Crop Passport.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # ── File presence check ─────────────────────────────────────
    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return Response(
            {'error': 'No file provided. Send the file as multipart/form-data with key "file".'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Size validation ───────────────────────────────────────
    if uploaded_file.size > MAX_UPLOAD_BYTES:
        return Response(
            {'error': f'File too large. Maximum allowed size is 10 MB.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── MIME type validation ─────────────────────────────────
    content_type = uploaded_file.content_type.lower().split(';')[0].strip()
    if content_type not in ALLOWED_CONTENT_TYPES:
        return Response(
            {'error': f'File type "{content_type}" is not allowed. '
                      f'Allowed types: JPG, PNG, WEBP, PDF.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Document type validation ────────────────────────────
    document_type = request.data.get('document_type', 'other').strip()
    if document_type not in ALLOWED_DOC_TYPES:
        return Response(
            {'error': f'Invalid document_type "{document_type}". '
                      f'Allowed: {sorted(ALLOWED_DOC_TYPES)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Upload to IPFS via server-side Pinata ───────────────────
    try:
        from services.ipfs_service import upload_file_to_ipfs, IPFSUploadError
        cid, ipfs_uri = upload_file_to_ipfs(
            file_obj=uploaded_file,
            file_name=uploaded_file.name,
            pin_name=f'crop-{crop_id}-{uploaded_file.name}',
        )
    except IPFSUploadError as exc:
        logger.warning('IPFS file upload failed for crop %s: %s', crop_id, exc)
        return Response(
            {'error': f'Unable to upload file to IPFS: {str(exc)}'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    # ── Persist CID reference in DB ──────────────────────────
    doc = CropPassportDocument.objects.create(
        crop_passport=crop,
        uploaded_by=farmer,
        file_name=uploaded_file.name,
        file_type=content_type,
        file_size=uploaded_file.size,
        document_type=document_type,
        ipfs_cid=cid,
        ipfs_uri=ipfs_uri,
    )

    serializer = CropPassportDocumentSerializer(doc)

    emit_event("crop_updated", {"crop_id": crop.pk})

    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFarmer])
def list_documents(request, crop_id):
    """
    GET /api/farmer/crops/<crop_id>/documents/

    Lists documents belonging to the authenticated farmer's crop.
    """
    farmer = request.user.user_obj
    crop   = get_object_or_404(CropPassport, pk=crop_id)

    if crop.farmer_id != farmer.pk:
        return Response(
            {'error': 'You do not own this Crop Passport.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    docs = CropPassportDocument.objects.filter(crop_passport=crop)
    serializer = CropPassportDocumentSerializer(docs, many=True)
    return Response(serializer.data)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated, IsFarmer])
def document_detail(request, crop_id, document_id):
    """
    GET    /api/farmer/crops/<crop_id>/documents/<document_id>/
    DELETE /api/farmer/crops/<crop_id>/documents/<document_id>/

    GET:    Return document metadata (farmer-scoped).
    DELETE: Remove DB record and attempt to unpin from Pinata.
            IPFS content may still be accessible via other gateways/nodes.
    """
    farmer = request.user.user_obj
    crop   = get_object_or_404(CropPassport, pk=crop_id)

    if crop.farmer_id != farmer.pk:
        return Response(
            {'error': 'You do not own this Crop Passport.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    doc = get_object_or_404(CropPassportDocument, pk=document_id, crop_passport=crop)

    if request.method == 'GET':
        serializer = CropPassportDocumentSerializer(doc)
        return Response(serializer.data)

    # DELETE
    cid = doc.ipfs_cid
    doc.delete()

    # Attempt Pinata unpin (best-effort; does not guarantee IPFS removal)
    unpin_result = 'not_attempted'
    try:
        from services.ipfs_service import unpin_from_ipfs, IPFSUploadError
        unpinned = unpin_from_ipfs(cid)
        unpin_result = 'unpinned' if unpinned else 'not_found_in_pinata'
    except Exception as exc:
        logger.warning('Unpin attempt failed for CID %s: %s', cid, exc)
        unpin_result = 'unpin_failed'

    return Response({
        'message': 'Document record deleted.',
        'ipfs_cid': cid,
        'pinata_unpin': unpin_result,
        'note': (
            'The IPFS content may still be accessible via public gateways '
            'if other nodes have cached or pinned it.'
        ),
    })


# ────────────────────────────────────────────────────────────────
# Phase 2.4 — AI Crop Quality Verification views
# ────────────────────────────────────────────────────────────────

AI_ALLOWED_MIME_TYPES = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp'}
AI_MAX_UPLOAD_BYTES   = 10 * 1024 * 1024   # 10 MB


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def verify_crop_view(request, crop_id):
    """
    POST /api/farmer/crops/<crop_id>/verify/

    Complete AI verification flow:
      1. Validate file (image type, size)
      2. Upload image to IPFS via existing Pinata service
      3. Read image bytes and send to Gemini Vision
      4. Validate AI JSON response
      5. Crop mismatch check (detected vs registered)
      6. Persist AIQualityVerification record
      7. Return structured result (no API keys, no PII)

    Security:
      - Farmer derived from JWT cookie (never from request body)
      - crop.farmer_id == farmer.pk checked before any processing
      - Gemini API key never returned
    """
    farmer = request.user.user_obj
    crop   = get_object_or_404(CropPassport, pk=crop_id)

    # ── Ownership check ─────────────────────────────────────────
    if crop.farmer_id != farmer.pk:
        return Response(
            {'error': 'You do not own this Crop Passport.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # ── File presence ────────────────────────────────────────
    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return Response(
            {'error': 'No image provided. Send the image as multipart/form-data with key "file".'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Size validation ─────────────────────────────────────
    if uploaded_file.size > AI_MAX_UPLOAD_BYTES:
        return Response(
            {'error': 'Image too large. Maximum is 10 MB.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── MIME type validation (images only, no PDFs) ──────────────
    content_type = uploaded_file.content_type.lower().split(';')[0].strip()
    if content_type not in AI_ALLOWED_MIME_TYPES:
        return Response(
            {'error': f'File type "{content_type}" is not accepted for AI verification. '
                      f'Upload a JPEG, PNG, or WEBP image.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Step 1: Upload image to IPFS ──────────────────────────
    try:
        from services.ipfs_service import upload_file_to_ipfs, IPFSUploadError
        cid, image_uri = upload_file_to_ipfs(
            file_obj=uploaded_file,
            file_name=uploaded_file.name,
            pin_name=f'ai-verify-crop-{crop_id}-{uploaded_file.name}',
        )
    except IPFSUploadError as exc:
        logger.warning('IPFS upload failed during AI verify for crop %s: %s', crop_id, exc)
        return Response(
            {'error': f'Image upload to IPFS failed: {str(exc)}'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    # ── Step 2: Read image bytes for Gemini (rewind after IPFS upload) ─
    uploaded_file.seek(0)
    image_bytes = uploaded_file.read()

    # ── Step 3: AI analysis ───────────────────────────────
    try:
        from services.ai_service import analyze_crop_image, AIAnalysisError
        ai_result = analyze_crop_image(
            image_bytes=image_bytes,
            mime_type=content_type,
            crop_name=crop.crop_name,
        )
    except AIAnalysisError as exc:
        error_msg = str(exc)
        logger.warning('Gemini analysis failed for crop %s: %s', crop_id, error_msg)

        # If output was truncated (MAX_TOKENS), do NOT save a record —
        # there is no valid result to store.  Return a clean 502 with
        # retry guidance so the farmer can try again.
        is_truncation = 'incomplete' in error_msg.lower() or 'truncated' in error_msg.lower()
        if is_truncation:
            return Response(
                {
                    'error': error_msg,
                    'can_retry': True,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # For other AI failures, save a failed record so farmer can
        # see the error history and the IPFS image is not lost.
        failed_record = AIQualityVerification.objects.create(
            crop_passport=crop,
            verified_by=farmer,
            image_cid=cid,
            image_uri=image_uri,
            verification_status=AIQualityVerification.STATUS_FAILED,
            failure_reason=error_msg,
        )
        serializer = AIQualityVerificationSerializer(failed_record)
        return Response(
            {
                'error': f'AI analysis failed: {error_msg}',
                'verification': serializer.data,
            },
            status=status.HTTP_502_BAD_GATEWAY,

        )

    # ── Step 4: Crop mismatch check ───────────────────────────
    detected  = ai_result.get('crop_detected', '').lower().strip()
    expected  = crop.crop_name.lower().strip()
    # Accept if detected name contains the expected crop or vice versa
    crop_match = (
        detected == expected
        or detected in expected
        or expected in detected
        or detected == 'unknown'
    )

    if not crop_match:
        mismatch_reason = (
            f"Image appears to show '{ai_result['crop_detected']}' "
            f"but the registered crop is '{crop.crop_name}'."
        )
        failed_record = AIQualityVerification.objects.create(
            crop_passport=crop,
            verified_by=farmer,
            image_cid=cid,
            image_uri=image_uri,
            crop_detected=ai_result.get('crop_detected', ''),
            confidence_score=ai_result.get('confidence_score'),
            ai_summary=ai_result.get('summary', ''),
            verification_status=AIQualityVerification.STATUS_FAILED,
            failure_reason=mismatch_reason,
            ai_provider='gemini-1.5-flash',
        )
        serializer = AIQualityVerificationSerializer(failed_record)
        return Response(
            {
                'error': mismatch_reason,
                'verification': serializer.data,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Step 5: Save verified record ──────────────────────────
    verification = AIQualityVerification.objects.create(
        crop_passport=crop,
        verified_by=farmer,
        image_cid=cid,
        image_uri=image_uri,
        crop_detected=ai_result.get('crop_detected', ''),
        quality_grade=ai_result.get('quality_grade', ''),
        quality_score=ai_result.get('quality_score'),
        confidence_score=ai_result.get('confidence_score'),
        disease_detected=ai_result.get('disease_detected', False),
        disease_name=ai_result.get('disease_name'),
        visible_defects=ai_result.get('visible_defects', ''),
        ai_summary=ai_result.get('summary', ''),
        verification_status=AIQualityVerification.STATUS_VERIFIED,
        ai_provider='gemini-1.5-flash',
    )

    serializer = AIQualityVerificationSerializer(verification)

    emit_event("crop_updated", {"crop_id": crop.pk})

    return Response(
        {
            'message': 'AI quality verification complete.',
            'disclaimer': (
                'This is an AI-assisted visual assessment. '
                'It is NOT an agricultural laboratory certification.'
            ),
            'verification': serializer.data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFarmer])
def get_verification_view(request, crop_id):
    """
    GET /api/farmer/crops/<crop_id>/verification/

    Returns the latest AI verification for the authenticated farmer's crop.
    """
    farmer = request.user.user_obj
    crop   = get_object_or_404(CropPassport, pk=crop_id)

    if crop.farmer_id != farmer.pk:
        return Response(
            {'error': 'You do not own this Crop Passport.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    verifications = AIQualityVerification.objects.filter(crop_passport=crop)
    if not verifications.exists():
        return Response(
            {'message': 'No AI verification has been run for this crop yet.'},
            status=status.HTTP_200_OK,
        )

    serializer = AIQualityVerificationSerializer(verifications, many=True)
    return Response({'verifications': serializer.data})


@api_view(['GET'])
@permission_classes([AllowAny])
def public_verification_view(request, crop_id):
    """
    GET /api/farmer/crops/public/<crop_id>/verification/

    Public endpoint. Returns the latest verified AI result for consumer trust.
    Does NOT expose farmer PII (name, email, aadhaar, wallet, password).
    """
    crop = get_object_or_404(CropPassport, pk=crop_id)
    latest = (
        AIQualityVerification.objects
        .filter(crop_passport=crop, verification_status=AIQualityVerification.STATUS_VERIFIED)
        .first()
    )
    if not latest:
        return Response(
            {'message': 'No verified AI assessment available for this crop.'},
            status=status.HTTP_200_OK,
        )

    serializer = PublicVerificationSerializer(latest)
    return Response({
        'disclaimer': (
            'AI-assisted visual assessment only. '
            'Not an agricultural laboratory certification.'
        ),
        'verification': serializer.data,
    })


# ─────────────────────────────────────────────────────────────────
# Phase 2.7 — Supply-Chain Traceability Timeline (public)
# ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def crop_timeline_view(request, crop_id):
    """
    GET /api/farmer/crops/public/<crop_id>/timeline/

    Returns a chronological list of supply-chain events for a Crop Passport.
    Public endpoint — no authentication required.
    No sensitive data (email, aadhaar, password, API keys) is exposed.
    """
    crop = get_object_or_404(CropPassport, pk=crop_id)
    events = []
    SEPOLIA = "https://sepolia.etherscan.io"

    # 1. Crop Registered
    events.append({
        'type': 'crop_registered',
        'title': 'Crop Registered',
        'timestamp': crop.created_at.isoformat(),
        'status': 'completed',
        'details': {
            'crop_name': crop.crop_name,
            'category': crop.crop_category,
            'quantity': f"{crop.quantity} {crop.unit}",
        },
    })

    # 2. IPFS Documents
    docs = crop.documents.order_by('uploaded_at')
    for doc in docs:
        events.append({
            'type': 'document_uploaded',
            'title': f'Document Stored on IPFS — {doc.get_document_type_display()}',
            'timestamp': doc.uploaded_at.isoformat(),
            'status': 'completed',
            'details': {
                'file_name': doc.file_name,
                'ipfs_cid': doc.ipfs_cid,
                'gateway_url': doc.gateway_url,
            },
        })

    # 3. AI Quality Verification (latest verified)
    ai = (
        crop.ai_verifications
        .filter(verification_status=AIQualityVerification.STATUS_VERIFIED)
        .order_by('-created_at')
        .first()
    )
    if ai:
        events.append({
            'type': 'ai_verified',
            'title': 'AI Quality Verification',
            'timestamp': ai.created_at.isoformat(),
            'status': 'completed',
            'details': {
                'quality_grade': ai.quality_grade,
                'quality_score': str(ai.quality_score),
                'confidence_score': str(ai.confidence_score),
                'crop_detected': ai.crop_detected,
                'disease_detected': ai.disease_detected,
            },
        })

    # 4. NFT Minted
    if crop.is_minted and crop.nft_minted_at:
        events.append({
            'type': 'nft_minted',
            'title': 'NFT Crop Passport Minted',
            'timestamp': crop.nft_minted_at.isoformat(),
            'status': 'completed',
            'details': {
                'token_id': crop.nft_token_id,
                'contract_address': crop.nft_contract_address,
                'tx_hash': crop.nft_transaction_hash,
                'etherscan_url': f"{SEPOLIA}/tx/{crop.nft_transaction_hash}" if crop.nft_transaction_hash else None,
            },
        })

    # 5–10. Quote → Bid → Escrow chain
    from escrow.models import EscrowTransaction
    quote = crop.quotes.exclude(status='open').order_by('-created_at').first()
    if not quote:
        quote = (
            FarmerQuote.objects
            .filter(farmer=crop.farmer, product_name__iexact=crop.crop_name)
            .exclude(status='open')
            .order_by('-created_at')
            .first()
        )

    if quote:
        # 5. Quote Created
        events.append({
            'type': 'quote_created',
            'title': 'Supply Quote Created',
            'timestamp': quote.created_at.isoformat(),
            'status': 'completed',
            'details': {
                'product': quote.product_name,
                'quantity': f"{quote.quantity} {quote.unit}",
            },
        })

        # 6. Bid Accepted
        if quote.accepted_bid:
            bid = quote.accepted_bid
            events.append({
                'type': 'bid_accepted',
                'title': 'FPO Bid Accepted',
                'timestamp': bid.submitted_at.isoformat() if bid.submitted_at else quote.created_at.isoformat(),
                'status': 'completed',
                'details': {
                    'fpo_name': bid.fpo.name,
                    'bid_amount': str(bid.bid_amount),
                },
            })

            # 7–10. Escrow stages
            try:
                escrow = quote.escrow
            except EscrowTransaction.DoesNotExist:
                escrow = None

            if escrow:
                # 7. Escrow Created
                events.append({
                    'type': 'escrow_created',
                    'title': 'Escrow Created',
                    'timestamp': escrow.created_at.isoformat(),
                    'status': 'completed',
                    'details': {
                        'amount_eth': str(escrow.amount_eth),
                        'contract_address': escrow.contract_address,
                        'etherscan_url': escrow.etherscan_contract_url,
                    },
                })

                # 8. Escrow Funded
                if escrow.funded_at:
                    events.append({
                        'type': 'escrow_funded',
                        'title': 'Escrow Funded',
                        'timestamp': escrow.funded_at.isoformat(),
                        'status': 'completed',
                        'details': {
                            'tx_hash': escrow.deposit_tx_hash,
                            'etherscan_url': escrow.etherscan_deposit_url,
                        },
                    })

                # 9. Delivery Confirmed
                if escrow.delivery_confirmed_at:
                    events.append({
                        'type': 'delivery_confirmed',
                        'title': 'Delivery Confirmed',
                        'timestamp': escrow.delivery_confirmed_at.isoformat(),
                        'status': 'completed',
                        'details': {
                            'tx_hash': escrow.delivery_tx_hash,
                        },
                    })

                # 10. Payment Released
                if escrow.released_at:
                    events.append({
                        'type': 'payment_released',
                        'title': 'Payment Released',
                        'timestamp': escrow.released_at.isoformat(),
                        'status': 'completed',
                        'details': {
                            'tx_hash': escrow.release_tx_hash,
                            'etherscan_url': escrow.etherscan_release_url,
                        },
                    })

    # Sort by timestamp
    events.sort(key=lambda e: e['timestamp'])

    return Response({
        'crop_id': crop.id,
        'crop_name': crop.crop_name,
        'events': events,
    })
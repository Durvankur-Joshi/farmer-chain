from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import Farmer, FarmerQuote, CropPassport, CropPassportDocument
from django.utils import timezone
from .serializers import (
    FarmerSerializer, FarmerRegistrationSerializer, FarmerQuoteSerializer,
    CropPassportSerializer, PublicCropPassportSerializer,
    CropPassportDocumentSerializer, PublicDocumentSerializer,
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
            {"message": "Registration successful. Please wait for admin approval.", "data": serializer.data},
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
    queryset = Farmer.objects.all()
    serializer_class = FarmerSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

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
        return FarmerQuote.objects.filter(farmer=self.request.user.user_obj)

    def perform_create(self, serializer):
        serializer.save(farmer=self.request.user.user_obj)

class FarmerQuoteDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = FarmerQuoteSerializer
    permission_classes = [IsAuthenticated, IsFarmer]
    queryset = FarmerQuote.objects.all()

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


class CropPassportDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/farmer/crops/<id>/  — retrieve one crop (owner only)
    PATCH /api/farmer/crops/<id>/  — update crop (only before minting)
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


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def prepare_mint_view(request, crop_id):
    """
    POST /api/farmer/crops/<id>/mint/

    Validates the crop, builds NFT metadata, uploads it to IPFS via
    server-side Pinata credentials, and returns the token_uri + wallet
    for the frontend to use when calling MetaMask.

    The frontend NEVER sees the Pinata secret.
    No private key is involved — the farmer signs via MetaMask.
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
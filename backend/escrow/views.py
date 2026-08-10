"""
Phase 2.5 — Escrow API views.

All 6 endpoints. None of them sign transactions or hold private keys.
MetaMask handles all on-chain operations; these endpoints only record
blockchain transaction data after the frontend confirms success.
"""

import os
import re
import logging
from decimal import Decimal

from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.permissions import IsFarmer, IsFPO
from farmer.models import FarmerQuote
from fpo.models import FPOBid
from .models import EscrowTransaction
from .serializers import EscrowTransactionSerializer

logger = logging.getLogger(__name__)

TX_HASH_RE = re.compile(r'^0x[a-fA-F0-9]{64}$')

ESCROW_CONTRACT = os.environ.get('ESCROW_CONTRACT_ADDRESS', '').strip()


def _validate_tx_hash(tx_hash: str) -> bool:
    """Validate Ethereum transaction hash format."""
    return bool(tx_hash and TX_HASH_RE.match(tx_hash))


# ── POST /api/escrow/create/ ──────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def create_escrow(request):
    """
    Create an escrow record for an accepted quote.

    Body: { "quote_id": <int> }

    Preconditions:
      - Quote exists and belongs to the farmer
      - Quote has an accepted bid
      - Both farmer and FPO have wallet addresses
      - No existing escrow for this quote
    """
    farmer = request.user.user_obj
    quote_id = request.data.get('quote_id')

    if not quote_id:
        return Response(
            {'error': 'quote_id is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    quote = get_object_or_404(FarmerQuote, pk=quote_id)

    # Ownership check
    if quote.farmer_id != farmer.pk:
        return Response(
            {'error': 'You do not own this quote.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Must have an accepted bid
    if not quote.accepted_bid:
        return Response(
            {'error': 'This quote does not have an accepted bid yet.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    bid = quote.accepted_bid
    fpo = bid.fpo

    # Wallet addresses required
    if not farmer.wallet_address:
        return Response(
            {'error': 'Farmer wallet address is not registered.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not fpo.wallet_address:
        return Response(
            {'error': 'FPO wallet address is not registered.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Prevent duplicate escrow
    if hasattr(quote, 'escrow'):
        existing = EscrowTransactionSerializer(quote.escrow).data
        return Response(
            {
                'error': 'An escrow already exists for this quote.',
                'escrow': existing,
            },
            status=status.HTTP_409_CONFLICT,
        )

    # Calculate amount: bid_amount (price per unit) × quantity
    amount_eth = Decimal(str(bid.bid_amount)) * Decimal(str(quote.quantity))

    contract_address = request.data.get('contract_address') or ESCROW_CONTRACT or os.environ.get('ESCROW_CONTRACT_ADDRESS', '').strip()
    if not contract_address:
        return Response(
            {'error': 'Escrow contract address is not configured on the server or provided in request.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    escrow = EscrowTransaction.objects.create(
        farmer=farmer,
        fpo=fpo,
        quote=quote,
        contract_address=contract_address,
        amount_eth=amount_eth,
        status=EscrowTransaction.STATUS_CREATED,
    )

    logger.info(
        'Escrow created: id=%d, farmer=%s, fpo=%s, quote=%d, amount=%s ETH',
        escrow.pk, farmer.name, fpo.name, quote.pk, amount_eth,
    )

    serializer = EscrowTransactionSerializer(escrow)
    return Response(
        {
            'message': 'Escrow created. Proceed to create on-chain escrow via MetaMask.',
            'escrow': serializer.data,
            'contract_address': contract_address,
            'farmer_wallet': farmer.wallet_address,
            'fpo_wallet': fpo.wallet_address,
            'amount_eth': str(amount_eth),
            'quote_id': quote.pk,
        },
        status=status.HTTP_201_CREATED,
    )


# ── POST /api/escrow/<id>/created-onchain/ ────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def escrow_created_onchain(request, escrow_pk):
    """
    Record the on-chain escrow creation tx hash and escrow ID.

    Body: { "tx_hash": "0x...", "escrow_id": <int>, "contract_address": "0x..." }
    """
    farmer = request.user.user_obj
    escrow = get_object_or_404(EscrowTransaction, pk=escrow_pk)

    if escrow.farmer_id != farmer.pk:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    tx_hash = request.data.get('tx_hash', '')
    escrow_id = request.data.get('escrow_id')
    contract_address = request.data.get('contract_address')

    if escrow.escrow_id is not None:
        if escrow_id is not None and int(escrow_id) == escrow.escrow_id:
            return Response(
                {'message': 'On-chain escrow already recorded.', 'escrow': EscrowTransactionSerializer(escrow).data},
                status=status.HTTP_200_OK,
            )
        return Response(
            {'error': 'On-chain escrow ID already recorded.', 'escrow': EscrowTransactionSerializer(escrow).data},
            status=status.HTTP_409_CONFLICT,
        )

    if not _validate_tx_hash(tx_hash):
        return Response(
            {'error': 'Invalid transaction hash format.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if escrow_id is None:
        return Response(
            {'error': 'escrow_id (on-chain) is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    escrow.escrow_id = int(escrow_id)
    escrow.create_tx_hash = tx_hash
    update_fields = ['escrow_id', 'create_tx_hash']
    if contract_address:
        escrow.contract_address = contract_address
        update_fields.append('contract_address')
    escrow.save(update_fields=update_fields)

    logger.info(
        'Escrow on-chain created: db_id=%d, chain_id=%d, tx=%s',
        escrow.pk, escrow.escrow_id, tx_hash,
    )

    serializer = EscrowTransactionSerializer(escrow)
    return Response({'message': 'On-chain escrow recorded.', 'escrow': serializer.data})


# ── POST /api/escrow/<id>/funded/ ─────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFPO])
def escrow_funded(request, escrow_pk):
    """
    Record the FPO deposit transaction.

    Body: { "tx_hash": "0x...", "escrow_id": <int (optional)> }
    """
    fpo = request.user.user_obj
    escrow = get_object_or_404(EscrowTransaction, pk=escrow_pk)

    if escrow.fpo_id != fpo.pk:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    if escrow.status != EscrowTransaction.STATUS_CREATED:
        return Response(
            {'error': f'Cannot fund escrow in "{escrow.status}" state.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    tx_hash = request.data.get('tx_hash', '')
    if not _validate_tx_hash(tx_hash):
        return Response(
            {'error': 'Invalid transaction hash format.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    req_escrow_id = request.data.get('escrow_id')
    if req_escrow_id is not None and escrow.escrow_id is None:
        escrow.escrow_id = int(req_escrow_id)

    if escrow.escrow_id is None:
        return Response(
            {'error': 'On-chain escrow ID is missing. Farmer must create on-chain escrow first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    escrow.status = EscrowTransaction.STATUS_FUNDED
    escrow.deposit_tx_hash = tx_hash
    escrow.funded_at = timezone.now()
    fields_to_update = ['status', 'deposit_tx_hash', 'funded_at']
    if req_escrow_id is not None:
        fields_to_update.append('escrow_id')
    escrow.save(update_fields=fields_to_update)

    logger.info('Escrow funded: id=%d, tx=%s', escrow.pk, tx_hash)

    serializer = EscrowTransactionSerializer(escrow)
    return Response({'message': 'Escrow funded successfully.', 'escrow': serializer.data})


# ── POST /api/escrow/<id>/delivery-confirm/ ───────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def escrow_delivery_confirm(request, escrow_pk):
    """
    Record the farmer's delivery confirmation transaction.

    Body: { "tx_hash": "0x..." }
    """
    farmer = request.user.user_obj
    escrow = get_object_or_404(EscrowTransaction, pk=escrow_pk)

    if escrow.farmer_id != farmer.pk:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    tx_hash = request.data.get('tx_hash', '')
    if not _validate_tx_hash(tx_hash):
        return Response(
            {'error': 'Invalid transaction hash format.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if escrow.status == EscrowTransaction.STATUS_DELIVERY_CONFIRMED:
        if tx_hash and not escrow.delivery_tx_hash:
            escrow.delivery_tx_hash = tx_hash
            escrow.save(update_fields=['delivery_tx_hash'])
        return Response({'message': 'Delivery already confirmed on-chain.', 'escrow': EscrowTransactionSerializer(escrow).data})

    if escrow.status != EscrowTransaction.STATUS_FUNDED:
        return Response(
            {'error': f'Cannot confirm delivery in "{escrow.status}" state.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    escrow.status = EscrowTransaction.STATUS_DELIVERY_CONFIRMED
    escrow.delivery_tx_hash = tx_hash
    escrow.delivery_confirmed_at = timezone.now()
    escrow.save(update_fields=['status', 'delivery_tx_hash', 'delivery_confirmed_at'])

    logger.info('Delivery confirmed: escrow=%d, tx=%s', escrow.pk, tx_hash)

    serializer = EscrowTransactionSerializer(escrow)
    return Response({'message': 'Delivery confirmed.', 'escrow': serializer.data})


# ── POST /api/escrow/<id>/released/ ───────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFPO])
def escrow_released(request, escrow_pk):
    """
    Record the payment release transaction.

    Body: { "tx_hash": "0x..." }
    """
    fpo = request.user.user_obj
    escrow = get_object_or_404(EscrowTransaction, pk=escrow_pk)

    if escrow.fpo_id != fpo.pk:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    if escrow.status != EscrowTransaction.STATUS_DELIVERY_CONFIRMED:
        return Response(
            {'error': f'Cannot release payment in "{escrow.status}" state.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    tx_hash = request.data.get('tx_hash', '')
    if not _validate_tx_hash(tx_hash):
        return Response(
            {'error': 'Invalid transaction hash format.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    escrow.status = EscrowTransaction.STATUS_RELEASED
    escrow.release_tx_hash = tx_hash
    escrow.released_at = timezone.now()
    escrow.save(update_fields=['status', 'release_tx_hash', 'released_at'])

    logger.info('Payment released: escrow=%d, tx=%s', escrow.pk, tx_hash)

    serializer = EscrowTransactionSerializer(escrow)
    return Response({'message': 'Payment released successfully.', 'escrow': serializer.data})


# ── GET /api/escrow/<id>/ ─────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def escrow_detail(request, escrow_pk):
    """
    Get escrow details. Only the farmer or FPO can view.
    """
    escrow = get_object_or_404(EscrowTransaction, pk=escrow_pk)
    user_obj = request.user.user_obj
    role = request.user.role

    if role == 'farmer' and escrow.farmer_id != user_obj.pk:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    if role == 'fpo' and escrow.fpo_id != user_obj.pk:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = EscrowTransactionSerializer(escrow)
    return Response({'escrow': serializer.data})


# ── GET /api/escrow/my/ ───────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def escrow_my_list(request):
    """
    List escrow transactions for the authenticated user.
    Farmers see their escrows, FPOs see theirs.
    """
    user_obj = request.user.user_obj
    role = request.user.role

    if role == 'farmer':
        qs = EscrowTransaction.objects.filter(farmer=user_obj)
    elif role == 'fpo':
        qs = EscrowTransaction.objects.filter(fpo=user_obj)
    else:
        return Response(
            {'error': 'Only farmers and FPOs have escrow transactions.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = EscrowTransactionSerializer(qs, many=True)
    return Response({'escrows': serializer.data})

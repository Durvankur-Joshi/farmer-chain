"""
Phase 2.8 — Reputation & Trust Score Calculation Service.

Deterministically calculates trust scores based strictly on real activity:
- Escrow transactions (funded, delivery confirmed, released)
- NFT Crop Passports minted
- AI Quality Verifications completed
- IPFS evidence documents uploaded
- Approved registration status
- Accepted quotes and bids
"""
from decimal import Decimal
from farmer.models import Farmer, CropPassport, CropPassportDocument, AIQualityVerification, FarmerQuote
from fpo.models import FPO, FPOBid, FPOQuote
from retailer.models import Retailer, RetailerBid
from escrow.models import EscrowTransaction
from .models import Reputation


def calculate_farmer_reputation(farmer: Farmer) -> dict:
    """
    Computes reputation signals for a Farmer.
    """
    # 1. Base verification
    is_approved = (farmer.approval_status == 'approved')
    base_score = 50 if is_approved else 10

    # 2. Crop Passports & Blockchain Minting
    crops = CropPassport.objects.filter(farmer=farmer)
    total_crops = crops.count()
    minted_crops = crops.filter(status=CropPassport.STATUS_MINTED).count()

    # 3. IPFS Evidence Documents
    ipfs_docs = CropPassportDocument.objects.filter(uploaded_by=farmer).count()

    # 4. AI Quality Verifications
    ai_verifs = AIQualityVerification.objects.filter(
        verified_by=farmer,
        verification_status=AIQualityVerification.STATUS_VERIFIED
    ).count()

    # 5. Escrow Transactions (highest trust signal)
    escrows = EscrowTransaction.objects.filter(farmer=farmer)
    completed_escrows = escrows.filter(status=EscrowTransaction.STATUS_RELEASED).count()
    active_escrows = escrows.filter(
        status__in=[EscrowTransaction.STATUS_FUNDED, EscrowTransaction.STATUS_DELIVERY_CONFIRMED]
    ).count()

    # 6. Accepted Quotes
    accepted_quotes = FarmerQuote.objects.filter(farmer=farmer, status__in=['accepted', 'awarded', 'contract_created']).count()

    # Calculations
    score = base_score
    score += min(15, total_crops * 3)
    score += min(20, minted_crops * 10)
    score += min(10, ipfs_docs * 2)
    score += min(15, ai_verifs * 5)
    score += min(30, completed_escrows * 15 + active_escrows * 5)
    score += min(10, accepted_quotes * 3)

    trust_score = max(0, min(100, score))
    completed_tx = completed_escrows + accepted_quotes
    verified_acts = (1 if is_approved else 0) + minted_crops + ai_verifs + ipfs_docs + completed_escrows

    return {
        'trust_score': trust_score,
        'completed_transactions': completed_tx,
        'verified_activities': verified_acts,
    }


def calculate_fpo_reputation(fpo: FPO) -> dict:
    """
    Computes reputation signals for an FPO.
    """
    is_approved = (fpo.approval_status == 'approved')
    base_score = 50 if is_approved else 10

    # 1. Bids submitted & accepted
    bids = FPOBid.objects.filter(fpo=fpo)
    total_bids = bids.count()
    accepted_bids = bids.filter(status='accepted').count()

    # 2. Escrows (Funded & Released payments)
    escrows = EscrowTransaction.objects.filter(fpo=fpo)
    completed_escrows = escrows.filter(status=EscrowTransaction.STATUS_RELEASED).count()
    funded_escrows = escrows.filter(status=EscrowTransaction.STATUS_FUNDED).count()

    # 3. FPO Quotes created for Retailers
    fpo_quotes = FPOQuote.objects.filter(fpo=fpo).count()

    # Score formula
    score = base_score
    score += min(15, total_bids * 2)
    score += min(25, accepted_bids * 8)
    score += min(30, completed_escrows * 15 + funded_escrows * 5)
    score += min(10, fpo_quotes * 3)

    trust_score = max(0, min(100, score))
    completed_tx = completed_escrows + accepted_bids
    verified_acts = (1 if is_approved else 0) + accepted_bids + completed_escrows + fpo_quotes

    return {
        'trust_score': trust_score,
        'completed_transactions': completed_tx,
        'verified_activities': verified_acts,
    }


def calculate_retailer_reputation(retailer: Retailer) -> dict:
    """
    Computes reputation signals for a Retailer.
    """
    is_approved = (retailer.approval_status == 'approved')
    base_score = 50 if is_approved else 10

    # 1. Bids placed on FPO Quotes
    bids = RetailerBid.objects.filter(retailer=retailer)
    total_bids = bids.count()
    accepted_bids = bids.filter(status='accepted').count()
    paid_bids = bids.filter(payment_status='paid').count()

    # Score formula
    score = base_score
    score += min(15, total_bids * 3)
    score += min(25, accepted_bids * 10)
    score += min(30, paid_bids * 15)

    trust_score = max(0, min(100, score))
    completed_tx = accepted_bids + paid_bids
    verified_acts = (1 if is_approved else 0) + total_bids + paid_bids

    return {
        'trust_score': trust_score,
        'completed_transactions': completed_tx,
        'verified_activities': verified_acts,
    }


def get_or_update_reputation(role: str, user_id: int, user_obj=None) -> Reputation:
    """
    Gets or recalculates the reputation object for any user role.
    """
    role = role.lower()

    if role == Reputation.ROLE_FARMER:
        if user_obj is None:
            user_obj = Farmer.objects.get(pk=user_id)
        stats = calculate_farmer_reputation(user_obj)
    elif role == Reputation.ROLE_FPO:
        if user_obj is None:
            user_obj = FPO.objects.get(pk=user_id)
        stats = calculate_fpo_reputation(user_obj)
    elif role == Reputation.ROLE_RETAILER:
        if user_obj is None:
            user_obj = Retailer.objects.get(pk=user_id)
        stats = calculate_retailer_reputation(user_obj)
    else:
        stats = {'trust_score': 50, 'completed_transactions': 0, 'verified_activities': 0}

    rep, _ = Reputation.objects.update_or_create(
        user_role=role,
        user_id=user_id,
        defaults={
            'trust_score': stats['trust_score'],
            'completed_transactions': stats['completed_transactions'],
            'verified_activities': stats['verified_activities'],
        }
    )
    return rep

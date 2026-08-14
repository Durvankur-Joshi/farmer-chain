from decimal import Decimal
import logging
from .models import FPOInventoryLot

logger = logging.getLogger(__name__)


def create_fpo_inventory_lot_from_deal(quote, bid=None):
    """
    Phase 1 — Creates an FPOInventoryLot for stock acquired from a farmer when a deal/bid is accepted.

    Idempotence: Checks if an inventory lot already exists for this quote/bid so duplicate lots
    are never created even if the acceptance/transaction trigger fires multiple times.

    Provenance Preservation:
      FPO → Farmer → Crop → Crop Passport (all relationships retained on the lot).
    """
    if not quote:
        return None

    farmer = quote.farmer
    crop_passport = quote.crop_passport

    if bid and hasattr(bid, 'fpo') and bid.fpo:
        fpo = bid.fpo
        acq_price = bid.bid_amount
    elif quote.accepted_bid:
        fpo = quote.accepted_bid.fpo
        acq_price = quote.accepted_bid.bid_amount
    else:
        return None

    # ── Idempotency Check ────────────────────────────────────────────────
    # Check if a lot already exists for this quote & fpo
    existing_lot = FPOInventoryLot.objects.filter(quote=quote, fpo=fpo).first()
    if existing_lot:
        return existing_lot

    category = quote.category or (crop_passport.crop_category if crop_passport else "")

    try:
        lot = FPOInventoryLot.objects.create(
            fpo=fpo,
            farmer=farmer,
            crop_passport=crop_passport,
            product_name=quote.product_name,
            crop_category=category,
            original_quantity=quote.quantity,
            available_quantity=quote.quantity,
            reserved_quantity=Decimal('0'),
            unit=quote.unit,
            acquisition_price=acq_price,
            status='available',
            quote=quote,
            bid=bid or quote.accepted_bid,
        )
        logger.info("Created FPO Inventory Lot #%s for FPO %s from Farmer %s (Quantity: %s %s)",
                    lot.id, fpo.name, farmer.name, lot.original_quantity, lot.unit)
        return lot
    except Exception as exc:
        logger.error("Failed to create FPO Inventory Lot for quote #%s: %s", quote.id, exc)
        return None

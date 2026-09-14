"""
Phase 2.5 — Escrow serializers.

Phase 1 INR Update:
  - amount_inr now returns agreed_price_inr (stored INR from the negotiated deal).
  - unit_price_inr, total_amount_inr, agreed_price_inr, payment_status are exposed.
  - conversion_rate is retained as a legacy/informational field (always 250000) so
    existing frontend code that reads it does not break.
  - The ETH×250000 conversion is NO LONGER used as the authoritative INR value.
"""

from rest_framework import serializers
from .models import EscrowTransaction, RetailerEscrowTransaction


class EscrowTransactionSerializer(serializers.ModelSerializer):
    """Full serializer for authenticated farmer/fpo views."""

    farmer_name    = serializers.CharField(source='farmer.name', read_only=True)
    farmer_wallet  = serializers.CharField(source='farmer.wallet_address', read_only=True)
    fpo_name       = serializers.CharField(source='fpo.name', read_only=True)
    fpo_wallet     = serializers.CharField(source='fpo.wallet_address', read_only=True)
    product_name   = serializers.CharField(source='quote.product_name', read_only=True)
    quantity       = serializers.DecimalField(
        source='quote.quantity', read_only=True, max_digits=18, decimal_places=8
    )
    unit           = serializers.CharField(source='quote.unit', read_only=True)
    quote_id       = serializers.IntegerField(source='quote.id', read_only=True)
    etherscan_deposit_url  = serializers.CharField(read_only=True)
    etherscan_release_url  = serializers.CharField(read_only=True)
    etherscan_contract_url = serializers.CharField(read_only=True)

    # Phase 1: amount_inr now sourced from stored INR fields, not ETH conversion.
    amount_inr     = serializers.SerializerMethodField()
    # Retained as legacy/informational — do not use as authoritative INR price.
    conversion_rate = serializers.SerializerMethodField()

    class Meta:
        model = EscrowTransaction
        fields = [
            'id', 'farmer', 'fpo', 'quote_id',
            'farmer_name', 'farmer_wallet',
            'fpo_name', 'fpo_wallet',
            'product_name', 'quantity', 'unit',
            'escrow_id', 'contract_address', 'amount_eth',
            # INR commercial fields (Phase 1 — source of truth)
            'unit_price_inr', 'total_amount_inr', 'agreed_price_inr',
            'payment_status',
            # Legacy computed field — prefer agreed_price_inr instead
            'amount_inr', 'conversion_rate',
            'status',
            'create_tx_hash', 'deposit_tx_hash',
            'delivery_tx_hash', 'release_tx_hash',
            'etherscan_deposit_url', 'etherscan_release_url',
            'etherscan_contract_url',
            'created_at', 'funded_at',
            'delivery_confirmed_at', 'released_at',
        ]
        read_only_fields = fields  # fully read-only — writes go through custom views

    def get_conversion_rate(self, obj):
        # Retained for backward compatibility. This is the Sepolia demo testnet rate
        # used for blockchain settlement only — not the authoritative commercial INR price.
        return 250000

    def get_amount_inr(self, obj):
        """
        Returns the stored agreed INR value.
        Phase 1: sourced from agreed_price_inr → total_amount_inr (both stored at creation).
        Falls back to ETH conversion only for legacy records that pre-date Phase 1.
        """
        if obj.agreed_price_inr is not None:
            return float(obj.agreed_price_inr)
        if obj.total_amount_inr is not None:
            return float(obj.total_amount_inr)
        # Legacy fallback for pre-Phase-1 records that only have amount_eth
        if obj.amount_eth is not None:
            return round(float(obj.amount_eth) * 250000, 2)
        return None


class RetailerEscrowTransactionSerializer(serializers.ModelSerializer):
    """Full serializer for authenticated FPO / Retailer escrow views."""

    fpo_name       = serializers.CharField(source='fpo.name', read_only=True)
    fpo_wallet     = serializers.CharField(source='fpo.wallet_address', read_only=True)
    retailer_name  = serializers.CharField(source='retailer.name', read_only=True)
    retailer_wallet = serializers.CharField(source='retailer.wallet_address', read_only=True)
    product_name   = serializers.CharField(source='quote.product_name', read_only=True)
    quantity       = serializers.DecimalField(
        source='quote.quantity', read_only=True, max_digits=18, decimal_places=8
    )
    unit           = serializers.CharField(source='quote.unit', read_only=True)
    quote_id       = serializers.IntegerField(source='quote.id', read_only=True)
    etherscan_deposit_url  = serializers.CharField(read_only=True)
    etherscan_release_url  = serializers.CharField(read_only=True)
    etherscan_contract_url = serializers.CharField(read_only=True)
    allocations    = serializers.SerializerMethodField()

    # Phase 1: amount_inr now sourced from stored INR fields, not ETH conversion.
    amount_inr     = serializers.SerializerMethodField()
    # Retained as legacy/informational — do not use as authoritative INR price.
    conversion_rate = serializers.SerializerMethodField()

    class Meta:
        model = RetailerEscrowTransaction
        fields = [
            'id', 'fpo', 'retailer', 'quote_id',
            'fpo_name', 'fpo_wallet',
            'retailer_name', 'retailer_wallet',
            'product_name', 'quantity', 'unit',
            'escrow_id', 'contract_address', 'amount_eth',
            # INR commercial fields (Phase 1 — source of truth)
            'unit_price_inr', 'total_amount_inr', 'agreed_price_inr',
            'payment_status',
            # Legacy computed field — prefer agreed_price_inr instead
            'amount_inr', 'conversion_rate',
            'status',
            'create_tx_hash', 'deposit_tx_hash',
            'delivery_tx_hash', 'release_tx_hash',
            'etherscan_deposit_url', 'etherscan_release_url',
            'etherscan_contract_url',
            'allocations',
            'created_at', 'funded_at',
            'delivery_confirmed_at', 'released_at',
        ]
        read_only_fields = fields

    def get_conversion_rate(self, obj):
        # Retained for backward compatibility. Sepolia demo rate only.
        return 250000

    def get_amount_inr(self, obj):
        """
        Returns the stored agreed INR value.
        Phase 1: sourced from agreed_price_inr → total_amount_inr (both stored at creation).
        Falls back to ETH conversion only for legacy records that pre-date Phase 1.
        """
        if obj.agreed_price_inr is not None:
            return float(obj.agreed_price_inr)
        if obj.total_amount_inr is not None:
            return float(obj.total_amount_inr)
        # Legacy fallback for pre-Phase-1 records that only have amount_eth
        if obj.amount_eth is not None:
            return round(float(obj.amount_eth) * 250000, 2)
        return None

    def get_allocations(self, obj):
        if not obj.quote or not hasattr(obj.quote, 'allocations'):
            return []
        res = []
        for alloc in obj.quote.allocations.all():
            res.append({
                'id': alloc.id,
                'farmer_name': alloc.farmer.name if alloc.farmer else "Unknown",
                'farmer_did': alloc.farmer.did if alloc.farmer else "",
                'crop_passport_id': alloc.crop_passport_id,
                'allocated_quantity': str(alloc.allocated_quantity),
                'unit': alloc.inventory_lot.unit if alloc.inventory_lot else "unit",
            })
        return res

"""
Phase 2.5 — Escrow serializers.
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
        source='quote.quantity', read_only=True, max_digits=10, decimal_places=2
    )
    unit           = serializers.CharField(source='quote.unit', read_only=True)
    quote_id       = serializers.IntegerField(source='quote.id', read_only=True)
    etherscan_deposit_url  = serializers.CharField(read_only=True)
    etherscan_release_url  = serializers.CharField(read_only=True)
    etherscan_contract_url = serializers.CharField(read_only=True)

    class Meta:
        model = EscrowTransaction
        fields = [
            'id', 'farmer', 'fpo', 'quote_id',
            'farmer_name', 'farmer_wallet',
            'fpo_name', 'fpo_wallet',
            'product_name', 'quantity', 'unit',
            'escrow_id', 'contract_address', 'amount_eth',
            'status',
            'create_tx_hash', 'deposit_tx_hash',
            'delivery_tx_hash', 'release_tx_hash',
            'etherscan_deposit_url', 'etherscan_release_url',
            'etherscan_contract_url',
            'created_at', 'funded_at',
            'delivery_confirmed_at', 'released_at',
        ]
        read_only_fields = fields  # fully read-only — writes go through custom views


class RetailerEscrowTransactionSerializer(serializers.ModelSerializer):
    """Full serializer for authenticated FPO / Retailer escrow views."""

    fpo_name       = serializers.CharField(source='fpo.name', read_only=True)
    fpo_wallet     = serializers.CharField(source='fpo.wallet_address', read_only=True)
    retailer_name  = serializers.CharField(source='retailer.name', read_only=True)
    retailer_wallet = serializers.CharField(source='retailer.wallet_address', read_only=True)
    product_name   = serializers.CharField(source='quote.product_name', read_only=True)
    quantity       = serializers.DecimalField(
        source='quote.quantity', read_only=True, max_digits=10, decimal_places=2
    )
    unit           = serializers.CharField(source='quote.unit', read_only=True)
    quote_id       = serializers.IntegerField(source='quote.id', read_only=True)
    etherscan_deposit_url  = serializers.CharField(read_only=True)
    etherscan_release_url  = serializers.CharField(read_only=True)
    etherscan_contract_url = serializers.CharField(read_only=True)

    class Meta:
        model = RetailerEscrowTransaction
        fields = [
            'id', 'fpo', 'retailer', 'quote_id',
            'fpo_name', 'fpo_wallet',
            'retailer_name', 'retailer_wallet',
            'product_name', 'quantity', 'unit',
            'escrow_id', 'contract_address', 'amount_eth',
            'status',
            'create_tx_hash', 'deposit_tx_hash',
            'delivery_tx_hash', 'release_tx_hash',
            'etherscan_deposit_url', 'etherscan_release_url',
            'etherscan_contract_url',
            'created_at', 'funded_at',
            'delivery_confirmed_at', 'released_at',
        ]
        read_only_fields = fields

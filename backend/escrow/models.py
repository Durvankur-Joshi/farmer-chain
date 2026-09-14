"""
Phase 2.5 — Escrow Transaction Model.

Tracks the lifecycle of a smart-contract escrow between Farmer and FPO.
One escrow per accepted FarmerQuote (enforced by OneToOneField).

Phase 1 INR Update:
  INR is now the source of truth for commercial value.
  - unit_price_inr / total_amount_inr / agreed_price_inr store the negotiated INR price.
  - amount_eth is retained for Sepolia blockchain settlement (MetaMask).
  - payment_status tracks INR payment state independently of blockchain status.
"""

from django.db import models
from farmer.models import Farmer, FarmerQuote
from fpo.models import FPO


class EscrowTransaction(models.Model):
    """
    Off-chain record of an on-chain escrow.
    """

    STATUS_CREATED            = 'created'
    STATUS_FUNDED             = 'funded'
    STATUS_DELIVERY_CONFIRMED = 'delivery_confirmed'
    STATUS_RELEASED           = 'released'
    STATUS_CANCELLED          = 'cancelled'
    STATUS_DISPUTED           = 'disputed'

    STATUS_CHOICES = [
        (STATUS_CREATED,            'Created'),
        (STATUS_FUNDED,             'Funded'),
        (STATUS_DELIVERY_CONFIRMED, 'Delivery Confirmed'),
        (STATUS_RELEASED,           'Released'),
        (STATUS_CANCELLED,          'Cancelled'),
        (STATUS_DISPUTED,           'Disputed'),
    ]

    # ── Relationships ──────────────────────────────────────────────
    farmer = models.ForeignKey(
        Farmer,
        on_delete=models.CASCADE,
        related_name='escrow_transactions',
    )
    fpo = models.ForeignKey(
        FPO,
        on_delete=models.CASCADE,
        related_name='escrow_transactions',
    )
    quote = models.OneToOneField(
        FarmerQuote,
        on_delete=models.CASCADE,
        related_name='escrow',
        help_text='One escrow per accepted quote',
    )

    # ── Blockchain references ──────────────────────────────────────
    escrow_id = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='On-chain escrow ID from the smart contract',
    )
    contract_address = models.CharField(
        max_length=42, blank=True,
        help_text='Deployed FarmerChainEscrow contract address',
    )

    # ── Financial (Blockchain / ETH) ───────────────────────────────
    amount_eth = models.DecimalField(
        max_digits=18, decimal_places=8,
        help_text='Escrow amount in ETH — used for Sepolia blockchain settlement only',
    )

    # ── Financial (INR — Commercial Source of Truth) ────────────────
    # Phase 1: store the actual negotiated INR price at transaction creation.
    # These values come directly from the accepted bid/negotiation; they are
    # never derived from amount_eth.
    unit_price_inr = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        help_text='Agreed price per unit in INR from the accepted bid',
    )
    total_amount_inr = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        help_text='quantity × unit_price_inr — gross commercial value in INR',
    )
    agreed_price_inr = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        help_text='Final agreed total INR amount (may differ if negotiated discount applied; '
                  'defaults to total_amount_inr)',
    )

    # ── INR Payment Status ──────────────────────────────────────────
    PAYMENT_STATUS_PENDING    = 'pending'
    PAYMENT_STATUS_PROCESSING = 'processing'
    PAYMENT_STATUS_PAID       = 'paid'
    PAYMENT_STATUS_FAILED     = 'failed'

    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_STATUS_PENDING,    'Pending'),
        (PAYMENT_STATUS_PROCESSING, 'Processing'),
        (PAYMENT_STATUS_PAID,       'Paid'),
        (PAYMENT_STATUS_FAILED,     'Failed'),
    ]

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default=PAYMENT_STATUS_PENDING,
        help_text='INR commercial payment status — independent of blockchain escrow status',
    )

    # ── Status ─────────────────────────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_CREATED,
    )

    # ── Transaction hashes ─────────────────────────────────────────
    create_tx_hash = models.CharField(
        max_length=66, blank=True, null=True,
        help_text='Tx hash from createEscrow()',
    )
    deposit_tx_hash = models.CharField(
        max_length=66, blank=True, null=True,
        help_text='Tx hash from depositEscrow()',
    )
    delivery_tx_hash = models.CharField(
        max_length=66, blank=True, null=True,
        help_text='Tx hash from confirmDelivery()',
    )
    release_tx_hash = models.CharField(
        max_length=66, blank=True, null=True,
        help_text='Tx hash from releasePayment()',
    )

    # ── Timestamps ─────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    funded_at = models.DateTimeField(null=True, blank=True)
    delivery_confirmed_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Escrow Transaction'
        verbose_name_plural = 'Escrow Transactions'

    def __str__(self):
        inr_display = f"₹{self.agreed_price_inr}" if self.agreed_price_inr else f"{self.amount_eth} ETH"
        return (
            f"Escrow #{self.escrow_id or '?'} — "
            f"{self.farmer.name} ↔ {self.fpo.name} — "
            f"{inr_display} [{self.status}]"
        )

    @property
    def etherscan_deposit_url(self):
        if self.deposit_tx_hash:
            return f"https://sepolia.etherscan.io/tx/{self.deposit_tx_hash}"
        return None

    @property
    def etherscan_release_url(self):
        if self.release_tx_hash:
            return f"https://sepolia.etherscan.io/tx/{self.release_tx_hash}"
        return None

    @property
    def etherscan_contract_url(self):
        if self.contract_address:
            return f"https://sepolia.etherscan.io/address/{self.contract_address}"
        return None


class RetailerEscrowTransaction(models.Model):
    """
    Off-chain record of an on-chain escrow between FPO (Seller) and Retailer (Buyer).
    One escrow per awarded/accepted FPOQuote.
    """

    STATUS_CREATED            = 'created'
    STATUS_FUNDED             = 'funded'
    STATUS_DELIVERY_CONFIRMED = 'delivery_confirmed'
    STATUS_RELEASED           = 'released'
    STATUS_CANCELLED          = 'cancelled'
    STATUS_DISPUTED           = 'disputed'

    STATUS_CHOICES = [
        (STATUS_CREATED,            'Created'),
        (STATUS_FUNDED,             'Funded'),
        (STATUS_DELIVERY_CONFIRMED, 'Delivery Confirmed'),
        (STATUS_RELEASED,           'Released'),
        (STATUS_CANCELLED,          'Cancelled'),
        (STATUS_DISPUTED,           'Disputed'),
    ]

    # ── Relationships ──────────────────────────────────────────────
    fpo = models.ForeignKey(
        'fpo.FPO',
        on_delete=models.CASCADE,
        related_name='retailer_escrows',
    )
    retailer = models.ForeignKey(
        'retailer.Retailer',
        on_delete=models.CASCADE,
        related_name='retailer_escrows',
    )
    quote = models.OneToOneField(
        'fpo.FPOQuote',
        on_delete=models.CASCADE,
        related_name='escrow',
        help_text='One escrow per accepted FPO quote',
    )

    # ── Blockchain references ──────────────────────────────────────
    escrow_id = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='On-chain escrow ID from the smart contract',
    )
    contract_address = models.CharField(
        max_length=42, blank=True,
        help_text='Deployed FarmerChainEscrow contract address',
    )

    # ── Financial (Blockchain / ETH) ───────────────────────────────
    amount_eth = models.DecimalField(
        max_digits=18, decimal_places=8,
        help_text='Escrow amount in ETH — used for Sepolia blockchain settlement only',
    )

    # ── Financial (INR — Commercial Source of Truth) ────────────────
    # Phase 1: store the actual negotiated INR price at transaction creation.
    # These values come directly from the accepted bid/negotiation; they are
    # never derived from amount_eth.
    unit_price_inr = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        help_text='Agreed price per unit in INR from the accepted retailer bid',
    )
    total_amount_inr = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        help_text='quantity × unit_price_inr — gross commercial value in INR',
    )
    agreed_price_inr = models.DecimalField(
        max_digits=14, decimal_places=2,
        null=True, blank=True,
        help_text='Final agreed total INR amount (may differ if negotiated discount applied; '
                  'defaults to total_amount_inr)',
    )

    # ── INR Payment Status ──────────────────────────────────────────
    PAYMENT_STATUS_PENDING    = 'pending'
    PAYMENT_STATUS_PROCESSING = 'processing'
    PAYMENT_STATUS_PAID       = 'paid'
    PAYMENT_STATUS_FAILED     = 'failed'

    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_STATUS_PENDING,    'Pending'),
        (PAYMENT_STATUS_PROCESSING, 'Processing'),
        (PAYMENT_STATUS_PAID,       'Paid'),
        (PAYMENT_STATUS_FAILED,     'Failed'),
    ]

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default=PAYMENT_STATUS_PENDING,
        help_text='INR commercial payment status — independent of blockchain escrow status',
    )

    # ── Status ─────────────────────────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_CREATED,
    )

    # ── Transaction hashes ─────────────────────────────────────────
    create_tx_hash = models.CharField(
        max_length=66, blank=True, null=True,
        help_text='Tx hash from createEscrow() by FPO',
    )
    deposit_tx_hash = models.CharField(
        max_length=66, blank=True, null=True,
        help_text='Tx hash from depositEscrow() by Retailer',
    )
    delivery_tx_hash = models.CharField(
        max_length=66, blank=True, null=True,
        help_text='Tx hash from confirmDelivery() by FPO',
    )
    release_tx_hash = models.CharField(
        max_length=66, blank=True, null=True,
        help_text='Tx hash from releasePayment() by Retailer',
    )

    # ── Timestamps ─────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    funded_at = models.DateTimeField(null=True, blank=True)
    delivery_confirmed_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Retailer Escrow Transaction'
        verbose_name_plural = 'Retailer Escrow Transactions'

    def __str__(self):
        inr_display = f"₹{self.agreed_price_inr}" if self.agreed_price_inr else f"{self.amount_eth} ETH"
        return (
            f"Retailer Escrow #{self.escrow_id or '?'} — "
            f"{self.fpo.name} ↔ {self.retailer.name} — "
            f"{inr_display} [{self.status}]"
        )

    @property
    def etherscan_deposit_url(self):
        if self.deposit_tx_hash:
            return f"https://sepolia.etherscan.io/tx/{self.deposit_tx_hash}"
        return None

    @property
    def etherscan_release_url(self):
        if self.release_tx_hash:
            return f"https://sepolia.etherscan.io/tx/{self.release_tx_hash}"
        return None

    @property
    def etherscan_contract_url(self):
        if self.contract_address:
            return f"https://sepolia.etherscan.io/address/{self.contract_address}"
        return None

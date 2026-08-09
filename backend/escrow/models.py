"""
Phase 2.5 — Escrow Transaction Model.

Tracks the lifecycle of a smart-contract escrow between Farmer and FPO.
One escrow per accepted FarmerQuote (enforced by OneToOneField).
Blockchain is the source of truth; this model is the application/indexing layer.
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

    # ── Financial ──────────────────────────────────────────────────
    amount_eth = models.DecimalField(
        max_digits=18, decimal_places=8,
        help_text='Escrow amount in ETH',
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
        return (
            f"Escrow #{self.escrow_id or '?'} — "
            f"{self.farmer.name} ↔ {self.fpo.name} — "
            f"{self.amount_eth} ETH [{self.status}]"
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

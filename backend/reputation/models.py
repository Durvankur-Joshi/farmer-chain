from django.db import models


class Reputation(models.Model):
    """
    Phase 2.8 — Minimal Reputation Model.
    Tracks reputation score, completed transactions, and verified activities
    derived deterministically from genuine on-chain and database activity.
    """

    ROLE_FARMER = 'farmer'
    ROLE_FPO = 'fpo'
    ROLE_RETAILER = 'retailer'
    ROLE_CHOICES = [
        (ROLE_FARMER, 'Farmer'),
        (ROLE_FPO, 'FPO'),
        (ROLE_RETAILER, 'Retailer'),
    ]

    user_role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    user_id = models.PositiveIntegerField()
    trust_score = models.IntegerField(default=50, help_text="Calculated Trust Score (0-100)")
    completed_transactions = models.PositiveIntegerField(default=0)
    verified_activities = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user_role', 'user_id')
        ordering = ['-trust_score', '-updated_at']
        verbose_name = 'Reputation'
        verbose_name_plural = 'Reputations'

    def __str__(self):
        return (
            f"[{self.user_role.upper()} #{self.user_id}] "
            f"Trust: {self.trust_score}/100 | Tx: {self.completed_transactions} | "
            f"Verified: {self.verified_activities}"
        )

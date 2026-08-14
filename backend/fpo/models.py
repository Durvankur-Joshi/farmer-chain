import uuid
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone

class FPO(models.Model):
    APPROVAL_STATUS = [('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')]
    
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)
    corporate_identification_number = models.CharField(max_length=21, unique=True)
    wallet_address = models.CharField(max_length=100, unique=True)
    city = models.CharField(max_length=50)
    state = models.CharField(max_length=50)
    approval_status = models.CharField(max_length=10, choices=APPROVAL_STATUS, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    did = models.CharField(max_length=100, unique=True, null=True, blank=True)
    did_created_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name

    def set_password(self, raw_password):
        self.password = make_password(raw_password)
    
    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    def save(self, *args, **kwargs):
        if not self.did:
            self.did = f"did:farmerchain:fpo:{uuid.uuid4()}"
            self.did_created_at = timezone.now()
        super().save(*args, **kwargs)

class FPOBid(models.Model):
    STATUS_CHOICES = [('submitted', 'Submitted'), ('accepted', 'Accepted'), ('rejected', 'Rejected')]
    PAYMENT_STATUS_CHOICES = [('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed')]

    fpo = models.ForeignKey(FPO, on_delete=models.CASCADE, related_name='bids')
    quote = models.ForeignKey('farmer.FarmerQuote', on_delete=models.CASCADE, related_name='bids')
    bid_amount = models.DecimalField(max_digits=18, decimal_places=8, help_text="Price per unit")
    delivery_time_days = models.PositiveIntegerField()
    comments = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='pending')
    transaction_hash = models.CharField(max_length=66, blank=True, null=True)

    def __str__(self):
        return f"Bid from {self.fpo.name} for {self.quote.product_name}"

class FPOQuote(models.Model):
    STATUS_CHOICES = [('open', 'Open'), ('closed', 'Closed'), ('awarded', 'Awarded')]
    
    fpo = models.ForeignKey(FPO, on_delete=models.CASCADE, related_name='quotes')
    product_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    description = models.TextField()
    quantity = models.DecimalField(max_digits=18, decimal_places=8)
    unit = models.CharField(max_length=20, help_text="e.g., kg, quintal, ton")
    price_per_unit = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    deadline = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    accepted_bid = models.ForeignKey(
        'retailer.RetailerBid', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='accepted_for_fpo_quote'
    )
    
    def __str__(self):
        return f"{self.product_name} quote by {self.fpo.name}"


class FPOInventoryLot(models.Model):
    """
    Phase 1 — FPO Inventory Foundation.
    Represents stock acquired/held by an FPO from a specific farmer.
    Permanently retains the source farmer and crop passport provenance.
    """
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('reserved', 'Reserved'),
        ('depleted', 'Depleted'),
    ]

    UNIT_CHOICES = [
        ('kg', 'Kilogram (kg)'),
        ('quintal', 'Quintal (quintal)'),
        ('caret', 'Caret (caret)'),
        ('piece', 'Piece (piece)'),
        ('acre', 'Acre (acre)'),
        ('ton', 'Metric Ton (ton)'),
        ('litre', 'Litre (litre)'),
        ('dozen', 'Dozen (dozen)'),
    ]

    fpo = models.ForeignKey(FPO, on_delete=models.CASCADE, related_name='inventory_lots')
    farmer = models.ForeignKey('farmer.Farmer', on_delete=models.CASCADE, related_name='fpo_inventory_lots')
    crop_passport = models.ForeignKey(
        'farmer.CropPassport',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fpo_inventory_lots'
    )
    product_name = models.CharField(max_length=200)
    crop_category = models.CharField(max_length=100, blank=True)
    original_quantity = models.DecimalField(max_digits=18, decimal_places=8)
    available_quantity = models.DecimalField(max_digits=18, decimal_places=8)
    reserved_quantity = models.DecimalField(max_digits=18, decimal_places=8, default=0)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='kg')
    acquisition_price = models.DecimalField(
        max_digits=18,
        decimal_places=8,
        null=True,
        blank=True,
        help_text="Acquisition price per unit in ETH paid to farmer"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')

    # Provenance tracking to source deal
    quote = models.ForeignKey(
        'farmer.FarmerQuote',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_lots'
    )
    bid = models.ForeignKey(
        FPOBid,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_lots'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Inventory Lot #{self.id} — {self.product_name} ({self.available_quantity}/{self.original_quantity} {self.unit}) held by {self.fpo.name}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.original_quantity is None or self.original_quantity <= 0:
            raise ValidationError("Original quantity must be greater than zero.")
        if self.available_quantity is None or self.available_quantity < 0:
            raise ValidationError("Available quantity cannot be negative.")
        if self.available_quantity > self.original_quantity:
            raise ValidationError("Available quantity cannot exceed original quantity.")
        if self.reserved_quantity is None or self.reserved_quantity < 0:
            raise ValidationError("Reserved quantity cannot be negative.")
        if self.reserved_quantity > self.available_quantity:
            raise ValidationError("Reserved quantity cannot exceed available quantity.")

    def save(self, *args, **kwargs):
        if self.available_quantity is not None:
            if self.available_quantity <= 0:
                self.status = 'depleted'
            elif self.reserved_quantity and self.reserved_quantity == self.available_quantity:
                self.status = 'reserved'
            elif self.available_quantity > 0 and self.status == 'depleted':
                self.status = 'available'
        self.clean()
        super().save(*args, **kwargs)
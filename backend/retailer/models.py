import uuid
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone

class Retailer(models.Model):
    APPROVAL_STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)
    gstin = models.CharField(max_length=15, unique=True)
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
            self.did = f"did:farmerchain:retailer:{uuid.uuid4()}"
            self.did_created_at = timezone.now()
        super().save(*args, **kwargs)

class RetailerBid(models.Model):
    STATUS_CHOICES = [('submitted', 'Submitted'), ('accepted', 'Accepted'), ('rejected', 'Rejected')]
    PAYMENT_STATUS_CHOICES = [('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed')]

    retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE, related_name='bids')
    quote = models.ForeignKey('fpo.FPOQuote', on_delete=models.CASCADE, related_name='bids')
    bid_amount = models.DecimalField(max_digits=18, decimal_places=8, help_text="Price per unit")
    delivery_time_days = models.PositiveIntegerField()
    comments = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='pending')
    transaction_hash = models.CharField(max_length=66, blank=True, null=True)

    def __str__(self):
        return f"Bid from {self.retailer.name} for {self.quote.product_name}"


class RetailerCartItem(models.Model):
    """
    Phase 4 — Retailer Cart Item.
    Stores selected partial stock quantity reserved by a Retailer from an FPOQuote
    before placing a commercial order.
    Preserves complete link to FPOQuote and its underlying multi-farmer provenance allocations.
    """
    retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE, related_name='cart_items')
    quote = models.ForeignKey('fpo.FPOQuote', on_delete=models.CASCADE, related_name='retailer_cart_items')
    selected_quantity = models.DecimalField(max_digits=18, decimal_places=8)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('retailer', 'quote')

    def __str__(self):
        return f"Retailer Cart Item #{self.id} — Quote #{self.quote_id} ({self.selected_quantity} {self.quote.unit}) for {self.retailer.name}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.selected_quantity is None or self.selected_quantity <= 0:
            raise ValidationError("Selected quantity must be greater than zero.")


class RetailerOrder(models.Model):
    """
    Phase 4 — Retailer Order Foundation.
    Represents a commercial order placed by a Retailer for an FPOQuote from their Retailer Cart.
    Preserves order metadata, total lot value, and links to detailed multi-farmer provenance allocations.
    """
    STATUS_CHOICES = [
        ('created', 'Created'),
        ('pending', 'Pending Confirmation'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
    ]

    order_number = models.CharField(max_length=64, unique=True)
    retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE, related_name='orders')
    fpo = models.ForeignKey('fpo.FPO', on_delete=models.CASCADE, related_name='retailer_orders')
    quote = models.ForeignKey('fpo.FPOQuote', on_delete=models.CASCADE, related_name='retailer_orders')
    product_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=18, decimal_places=8)
    unit = models.CharField(max_length=20)
    price_per_unit = models.DecimalField(max_digits=18, decimal_places=8)
    total_price = models.DecimalField(max_digits=18, decimal_places=8)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='created')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {self.order_number} — {self.product_name} ({self.quantity} {self.unit}) by {self.retailer.name}"


class RetailerOrderAllocation(models.Model):
    """
    Phase 4 — Retailer Order Provenance Allocation.
    Links a RetailerOrder to the exact FPOInventoryLot, Farmer, and CropPassport source allocations,
    preserving full provenance traceability through the entire supply chain.
    """
    order = models.ForeignKey(RetailerOrder, on_delete=models.CASCADE, related_name='allocations')
    inventory_lot = models.ForeignKey('fpo.FPOInventoryLot', on_delete=models.CASCADE, related_name='retailer_order_allocations')
    farmer = models.ForeignKey('farmer.Farmer', on_delete=models.CASCADE, related_name='retailer_order_allocations')
    crop_passport = models.ForeignKey('farmer.CropPassport', on_delete=models.SET_NULL, null=True, blank=True, related_name='retailer_order_allocations')
    allocated_quantity = models.DecimalField(max_digits=18, decimal_places=8)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order Allocation #{self.id} — Order {self.order.order_number} | Farmer: {self.farmer.name} | Qty: {self.allocated_quantity}"


class RetailerInventoryLot(models.Model):
    """
    Represents inventory stock acquired by a Retailer after successful Sepolia escrow payment release.
    Permanently retains complete provenance: Retailer -> FPO -> Farmer -> CropPassport -> Escrow.
    """
    retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE, related_name='inventory_lots')
    fpo = models.ForeignKey('fpo.FPO', on_delete=models.CASCADE, related_name='retailer_inventory_lots')
    farmer = models.ForeignKey('farmer.Farmer', on_delete=models.CASCADE, related_name='retailer_inventory_lots')
    crop_passport = models.ForeignKey('farmer.CropPassport', on_delete=models.SET_NULL, null=True, blank=True, related_name='retailer_inventory_lots')
    inventory_lot = models.ForeignKey('fpo.FPOInventoryLot', on_delete=models.SET_NULL, null=True, blank=True, related_name='retailer_acquired_inventory_lots')
    escrow = models.ForeignKey('escrow.RetailerEscrowTransaction', on_delete=models.SET_NULL, null=True, blank=True, related_name='retailer_inventory_lots')
    product_name = models.CharField(max_length=200)
    crop_category = models.CharField(max_length=100, blank=True)
    quantity = models.DecimalField(max_digits=18, decimal_places=8)
    unit = models.CharField(max_length=20)
    purchase_price_per_unit = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)
    total_price = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)
    status = models.CharField(max_length=20, default='in_stock')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Retailer Inventory #{self.id} — {self.product_name} ({self.quantity} {self.unit}) owned by {self.retailer.name}"
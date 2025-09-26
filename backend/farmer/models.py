from django.db import models
from django.contrib.auth.hashers import make_password, check_password

class Farmer(models.Model):
    APPROVAL_STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)
    aadhaar_number = models.CharField(max_length=12, unique=True)
    wallet_address = models.CharField(max_length=100, unique=True)
    city = models.CharField(max_length=50)
    state = models.CharField(max_length=50)
    approval_status = models.CharField(max_length=10, choices=APPROVAL_STATUS, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def set_password(self, raw_password):
        self.password = make_password(raw_password)
    
    def check_password(self, raw_password):
        return check_password(raw_password, self.password)
    
# Add these new models to your existing farmer/models.py
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from fpo.models import FPOQuoteRequest, FPO

# ... Farmer model is already here ...

class FarmerBid(models.Model):
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    ]

    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='bids')
    quote = models.ForeignKey(FPOQuoteRequest, on_delete=models.CASCADE, related_name='bids')
    bid_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price per unit")
    delivery_time_days = models.PositiveIntegerField()
    comments = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)

    # Blockchain fields
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='pending')
    transaction_hash = models.CharField(max_length=66, blank=True, null=True)

    def __str__(self):
        return f"Bid from {self.farmer.name} for {self.quote.product_name}"

class FPOReviewOfFarmer(models.Model):
    RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='reviews_from_fpos')
    fpo = models.ForeignKey(FPO, on_delete=models.CASCADE)
    bid = models.OneToOneField(FarmerBid, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(choices=RATING_CHOICES)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
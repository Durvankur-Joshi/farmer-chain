from django.db import models
from django.contrib.auth.hashers import make_password, check_password

class FPO(models.Model):
    APPROVAL_STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)
    corporate_identification_number = models.CharField(max_length=21, unique=True)
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
    
    
    
# Add this to your existing fpo/models.py
from django.db import models
from django.contrib.auth.hashers import make_password, check_password

# ... FPO model is already here ...

class FPOQuoteRequest(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('awarded', 'Awarded'),
    ]
    
    fpo = models.ForeignKey(FPO, on_delete=models.CASCADE, related_name='quote_requests')
    product_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100) # e.g., 'Grains', 'Vegetables', 'Fruits'
    description = models.TextField()
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20, help_text="e.g., kg, quintal, ton")
    deadline = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_bid = models.ForeignKey(
        'farmer.FarmerBid', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='accepted_for_quote'
    )
    
    def __str__(self):
        return f"{self.product_name} request by {self.fpo.name}"
    
    
# Add these new models to your existing fpo/models.py
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from retailer.models import Retailer, RetailerQuoteRequest

# ... FPO model is already here ...

class FPOBid(models.Model):
    STATUS_CHOICES = [('submitted', 'Submitted'), ('accepted', 'Accepted'), ('rejected', 'Rejected')]
    PAYMENT_STATUS_CHOICES = [('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed')]

    fpo = models.ForeignKey(FPO, on_delete=models.CASCADE, related_name='bids')
    quote = models.ForeignKey(RetailerQuoteRequest, on_delete=models.CASCADE, related_name='bids')
    bid_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price per unit")
    delivery_time_days = models.PositiveIntegerField()
    comments = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS_CHOICES, default='pending')
    transaction_hash = models.CharField(max_length=66, blank=True, null=True)

    def __str__(self):
        return f"Bid from {self.fpo.name} for {self.quote.product_name}"

class RetailerReviewOfFPO(models.Model):
    RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

    fpo = models.ForeignKey(FPO, on_delete=models.CASCADE, related_name='reviews_from_retailers')
    retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE)
    bid = models.OneToOneField(FPOBid, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(choices=RATING_CHOICES)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
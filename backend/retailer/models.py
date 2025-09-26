from django.db import models
from django.contrib.auth.hashers import make_password, check_password

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

    def __str__(self):
        return self.name

    def set_password(self, raw_password):
        self.password = make_password(raw_password)
    
    def check_password(self, raw_password):
        return check_password(raw_password, self.password)
    
# Add this new model to your existing retailer/models.py
from django.db import models
from django.contrib.auth.hashers import make_password, check_password

# ... Retailer model is already here ...

class RetailerQuoteRequest(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('awarded', 'Awarded'),
    ]
    
    retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE, related_name='quote_requests')
    product_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100) # e.g., 'Processed Grains', 'Packaged Vegetables'
    description = models.TextField()
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20, help_text="e.g., kg, quintal, ton")
    deadline = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_bid = models.ForeignKey(
        'fpo.FPOBid', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='accepted_for_retailer_quote'
    )
    
    def __str__(self):
        return f"{self.product_name} request by {self.retailer.name}"
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

class FarmerQuote(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('awarded', 'Awarded'),
        ('accepted', 'Accepted'),
        ('contract_created', 'Contract Created'),  # Add new status
    ]
    
    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name='quotes')
    product_name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    description = models.TextField()
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20, help_text="e.g., kg, quintal, ton")
    price_per_unit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')  # Increased max_length
    deadline = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    accepted_bid = models.ForeignKey(
        'fpo.FPOBid', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='accepted_for_farmer_quote'
    )
    
    # Add contract fields
    contract_address = models.CharField(max_length=42, blank=True, null=True)  # Ethereum address length
    contract_created_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.product_name} quote from {self.farmer.name}"
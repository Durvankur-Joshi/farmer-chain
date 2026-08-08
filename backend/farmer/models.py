import uuid
from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone

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
            self.did = f"did:farmerchain:farmer:{uuid.uuid4()}"
            self.did_created_at = timezone.now()
        super().save(*args, **kwargs)

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


class CropPassport(models.Model):
    """
    Phase 2.2 — NFT Crop Passport.
    Separate from FarmerQuote. Represents a single crop lot
    that can be minted as an ERC-721 NFT on Sepolia.
    """

    STATUS_REGISTERED = 'registered'
    STATUS_MINTED = 'minted'
    STATUS_CHOICES = [
        (STATUS_REGISTERED, 'Registered'),
        (STATUS_MINTED, 'Minted'),
    ]

    UNIT_CHOICES = [
        ('kg', 'Kilogram'),
        ('quintal', 'Quintal'),
        ('ton', 'Ton'),
        ('litre', 'Litre'),
        ('piece', 'Piece'),
        ('dozen', 'Dozen'),
    ]

    # ── Core crop information ──────────────────────────────────────
    farmer = models.ForeignKey(
        Farmer,
        on_delete=models.CASCADE,
        related_name='crop_passports'
    )
    crop_name = models.CharField(max_length=200)
    crop_category = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='kg')
    cultivation_date = models.DateField()
    harvest_date = models.DateField()
    location = models.CharField(
        max_length=200,
        blank=True,
        help_text='Auto-filled from farmer city+state if left empty'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_REGISTERED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ── NFT / blockchain fields (all nullable until minted) ────────
    nft_token_id = models.CharField(max_length=78, null=True, blank=True)
    nft_contract_address = models.CharField(max_length=42, null=True, blank=True)
    nft_token_uri = models.CharField(max_length=500, null=True, blank=True)
    nft_transaction_hash = models.CharField(max_length=66, null=True, blank=True)
    nft_minted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Crop Passport'
        verbose_name_plural = 'Crop Passports'

    def __str__(self):
        return f"{self.crop_name} — {self.farmer.name} [{self.status}]"

    def save(self, *args, **kwargs):
        # Auto-fill location from farmer profile if not supplied
        if not self.location and self.farmer_id:
            try:
                f = self.farmer
                self.location = f"{f.city}, {f.state}"
            except Exception:
                pass
        super().save(*args, **kwargs)

    @property
    def is_minted(self):
        return self.status == self.STATUS_MINTED


class CropPassportDocument(models.Model):
    """
    Phase 2.3 — IPFS Decentralized Storage.
    Stores a reference to a file that has been uploaded to IPFS via Pinata.
    The actual binary is NEVER stored on the Django server — only the CID
    and metadata are persisted here.
    """

    DOCUMENT_TYPE_CHOICES = [
        ('crop_image',        'Crop Image'),
        ('soil_report',       'Soil Report'),
        ('quality_report',    'Quality Report'),
        ('certification',     'Certification'),
        ('harvest_document',  'Harvest Document'),
        ('other',             'Other'),
    ]

    crop_passport = models.ForeignKey(
        CropPassport,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    uploaded_by = models.ForeignKey(
        Farmer,
        on_delete=models.CASCADE,
        related_name='uploaded_documents',
    )
    file_name     = models.CharField(max_length=255)
    file_type     = models.CharField(max_length=100)
    file_size     = models.PositiveIntegerField(help_text='File size in bytes')
    document_type = models.CharField(
        max_length=50,
        choices=DOCUMENT_TYPE_CHOICES,
        default='other',
    )
    ipfs_cid = models.CharField(max_length=255)
    ipfs_uri = models.CharField(max_length=300)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Crop Passport Document'
        verbose_name_plural = 'Crop Passport Documents'

    def __str__(self):
        return f"{self.document_type} — {self.file_name} [{self.crop_passport}]"

    @property
    def gateway_url(self):
        """Convenience HTTPS gateway URL for browser access."""
        return f"https://gateway.pinata.cloud/ipfs/{self.ipfs_cid}"
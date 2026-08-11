from django.contrib import admin
from .models import Farmer, FarmerQuote, CropPassport, CropPassportDocument, AIQualityVerification


@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'approval_status', 'city', 'state', 'did', 'did_created_at', 'created_at')
    list_filter = ('approval_status', 'state', 'city')
    search_fields = ('name', 'email', 'aadhaar_number', 'wallet_address', 'did')
    readonly_fields = ('did', 'did_created_at', 'created_at')


@admin.register(FarmerQuote)
class FarmerQuoteAdmin(admin.ModelAdmin):
    list_display = ('product_name', 'farmer', 'quantity', 'unit', 'status', 'deadline')
    list_filter = ('status', 'crop_passport__crop_category')
    search_fields = ('product_name', 'farmer__name')


@admin.register(CropPassport)
class CropPassportAdmin(admin.ModelAdmin):
    list_display = (
        'crop_name', 'crop_category', 'farmer', 'quantity', 'unit',
        'status', 'nft_token_id', 'nft_contract_address', 'nft_minted_at', 'created_at',
    )
    list_filter = ('status', 'crop_category', 'unit')
    search_fields = (
        'crop_name', 'crop_category',
        'farmer__name', 'farmer__wallet_address',
        'nft_token_id', 'nft_contract_address', 'nft_transaction_hash',
    )
    readonly_fields = (
        'nft_token_id', 'nft_contract_address',
        'nft_token_uri', 'nft_transaction_hash', 'nft_minted_at',
        'created_at', 'updated_at',
    )
    fieldsets = (
        ('Crop Information', {
            'fields': (
                'farmer', 'crop_name', 'crop_category', 'description',
                'quantity', 'unit', 'cultivation_date', 'harvest_date',
                'location', 'status',
            )
        }),
        ('NFT Blockchain Record (read-only)', {
            'fields': (
                'nft_token_id', 'nft_contract_address',
                'nft_token_uri', 'nft_transaction_hash', 'nft_minted_at',
            ),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(CropPassportDocument)
class CropPassportDocumentAdmin(admin.ModelAdmin):
    list_display = (
        'file_name', 'document_type', 'crop_passport', 'uploaded_by',
        'file_size_kb', 'ipfs_cid', 'uploaded_at',
    )
    list_filter = ('document_type',)
    search_fields = (
        'file_name', 'ipfs_cid',
        'crop_passport__crop_name',
        'uploaded_by__name',
    )
    # CID and timestamps must be read-only in admin —
    # admins should never manually forge IPFS references.
    readonly_fields = ('ipfs_cid', 'ipfs_uri', 'uploaded_at')

    def file_size_kb(self, obj):
        return f"{obj.file_size / 1024:.1f} KB"
    file_size_kb.short_description = 'Size'


@admin.register(AIQualityVerification)
class AIQualityVerificationAdmin(admin.ModelAdmin):
    list_display = (
        'crop_passport', 'get_farmer', 'crop_detected',
        'quality_grade', 'quality_score', 'confidence_score',
        'disease_detected', 'verification_status', 'ai_provider', 'created_at',
    )
    list_filter = ('verification_status', 'quality_grade', 'disease_detected', 'ai_provider')
    search_fields = (
        'crop_passport__crop_name',
        'crop_passport__farmer__name',
        'crop_detected', 'image_cid',
    )
    # All AI result + IPFS fields are read-only — admins should NOT forge results
    readonly_fields = (
        'image_cid', 'image_uri',
        'crop_detected', 'quality_grade', 'quality_score', 'confidence_score',
        'disease_detected', 'disease_name', 'visible_defects', 'ai_summary',
        'verification_status', 'failure_reason', 'ai_provider',
        'created_at', 'updated_at',
    )
    fieldsets = (
        ('Crop Passport', {
            'fields': ('crop_passport', 'verified_by'),
        }),
        ('Image Reference (IPFS)', {
            'fields': ('image_cid', 'image_uri'),
        }),
        ('AI Assessment Result (read-only)', {
            'fields': (
                'crop_detected',
                'quality_grade', 'quality_score', 'confidence_score',
                'disease_detected', 'disease_name', 'visible_defects',
                'ai_summary',
            ),
        }),
        ('Verification Status', {
            'fields': ('verification_status', 'failure_reason', 'ai_provider'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def get_farmer(self, obj):
        return obj.crop_passport.farmer.name
    get_farmer.short_description = 'Farmer'

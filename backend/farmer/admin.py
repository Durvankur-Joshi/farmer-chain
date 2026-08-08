from django.contrib import admin
from .models import Farmer, FarmerQuote, CropPassport


@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'approval_status', 'city', 'state', 'did', 'did_created_at', 'created_at')
    list_filter = ('approval_status', 'state', 'city')
    search_fields = ('name', 'email', 'aadhaar_number', 'wallet_address', 'did')
    readonly_fields = ('did', 'did_created_at', 'created_at')


@admin.register(FarmerQuote)
class FarmerQuoteAdmin(admin.ModelAdmin):
    list_display = ('product_name', 'farmer', 'quantity', 'unit', 'status', 'deadline')
    list_filter = ('status', 'category')
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
    # NFT blockchain fields must NOT be manually editable in admin
    # to prevent admins from forging blockchain records.
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

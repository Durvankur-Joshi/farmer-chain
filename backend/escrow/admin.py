"""
Phase 2.5 — Escrow Admin.
"""
from django.contrib import admin
from .models import EscrowTransaction


@admin.register(EscrowTransaction)
class EscrowTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'escrow_id', 'get_farmer', 'get_fpo',
        'get_product', 'amount_eth', 'status',
        'contract_address', 'created_at',
    )
    list_filter = ('status',)
    search_fields = (
        'farmer__name', 'fpo__name',
        'quote__product_name',
        'contract_address', 'deposit_tx_hash', 'release_tx_hash',
    )
    readonly_fields = (
        'escrow_id', 'contract_address',
        'create_tx_hash', 'deposit_tx_hash',
        'delivery_tx_hash', 'release_tx_hash',
        'created_at', 'funded_at',
        'delivery_confirmed_at', 'released_at',
    )
    fieldsets = (
        ('Parties', {
            'fields': ('farmer', 'fpo', 'quote'),
        }),
        ('Blockchain', {
            'fields': (
                'escrow_id', 'contract_address', 'amount_eth', 'status',
            ),
        }),
        ('Transaction Hashes (read-only)', {
            'fields': (
                'create_tx_hash', 'deposit_tx_hash',
                'delivery_tx_hash', 'release_tx_hash',
            ),
        }),
        ('Timestamps', {
            'fields': (
                'created_at', 'funded_at',
                'delivery_confirmed_at', 'released_at',
            ),
            'classes': ('collapse',),
        }),
    )

    def get_farmer(self, obj):
        return obj.farmer.name
    get_farmer.short_description = 'Farmer'

    def get_fpo(self, obj):
        return obj.fpo.name
    get_fpo.short_description = 'FPO'

    def get_product(self, obj):
        return obj.quote.product_name
    get_product.short_description = 'Product'

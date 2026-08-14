from django.contrib import admin
from .models import FPO, FPOBid, FPOQuote, FPOInventoryLot, FPOStockCartItem

@admin.register(FPO)
class FPOAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'approval_status', 'city', 'state', 'did', 'did_created_at', 'created_at')
    list_filter = ('approval_status', 'state', 'city')
    search_fields = ('name', 'email', 'corporate_identification_number', 'wallet_address', 'did')
    readonly_fields = ('did', 'did_created_at', 'created_at')

@admin.register(FPOBid)
class FPOBidAdmin(admin.ModelAdmin):
    list_display = ('fpo', 'quote', 'bid_amount', 'status', 'payment_status', 'submitted_at')
    list_filter = ('status', 'payment_status')

@admin.register(FPOQuote)
class FPOQuoteAdmin(admin.ModelAdmin):
    list_display = ('product_name', 'fpo', 'quantity', 'unit', 'status', 'deadline')
    list_filter = ('status', 'category')
    search_fields = ('product_name', 'fpo__name')

@admin.register(FPOInventoryLot)
class FPOInventoryLotAdmin(admin.ModelAdmin):
    list_display = ('id', 'product_name', 'fpo', 'farmer', 'available_quantity', 'original_quantity', 'unit', 'status', 'created_at')
    list_filter = ('status', 'crop_category', 'unit')
    search_fields = ('product_name', 'farmer__name', 'fpo__name')

@admin.register(FPOStockCartItem)
class FPOStockCartItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'fpo', 'inventory_lot', 'selected_quantity', 'created_at')
    search_fields = ('fpo__name', 'inventory_lot__product_name')

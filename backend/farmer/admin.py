from django.contrib import admin
from .models import Farmer, FarmerQuote

@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'approval_status', 'city', 'state', 'created_at')
    list_filter = ('approval_status', 'state', 'city')
    search_fields = ('name', 'email', 'aadhaar_number', 'wallet_address')

@admin.register(FarmerQuote)
class FarmerQuoteAdmin(admin.ModelAdmin):
    list_display = ('product_name', 'farmer', 'quantity', 'unit', 'status', 'deadline')
    list_filter = ('status', 'category')
    search_fields = ('product_name', 'farmer__name')

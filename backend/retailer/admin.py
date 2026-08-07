from django.contrib import admin
from .models import Retailer, RetailerBid

@admin.register(Retailer)
class RetailerAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'approval_status', 'city', 'state', 'created_at')
    list_filter = ('approval_status', 'state', 'city')
    search_fields = ('name', 'email', 'gstin', 'wallet_address')

@admin.register(RetailerBid)
class RetailerBidAdmin(admin.ModelAdmin):
    list_display = ('retailer', 'quote', 'bid_amount', 'status', 'payment_status', 'submitted_at')
    list_filter = ('status', 'payment_status')

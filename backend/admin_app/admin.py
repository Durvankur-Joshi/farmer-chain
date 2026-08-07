from django.contrib import admin
from .models import Admin

@admin.register(Admin)
class AdminModelAdmin(admin.ModelAdmin):
    list_display = ('username', 'wallet_address', 'created_at')
    search_fields = ('username', 'wallet_address')

from django.contrib import admin
from .models import Negotiation, NegotiationMessage

@admin.register(Negotiation)
class NegotiationAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'content_type', 'object_id', 'created_at')
    list_filter = ('status', 'content_type')

@admin.register(NegotiationMessage)
class NegotiationMessageAdmin(admin.ModelAdmin):
    list_display = ('negotiation', 'sender_role', 'sender_name', 'created_at')
    list_filter = ('sender_role',)

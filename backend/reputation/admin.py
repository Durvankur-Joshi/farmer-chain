from django.contrib import admin
from .models import Reputation


@admin.register(Reputation)
class ReputationAdmin(admin.ModelAdmin):
    list_display = (
        'user_role',
        'user_id',
        'trust_score',
        'completed_transactions',
        'verified_activities',
        'updated_at',
    )
    list_filter = ('user_role',)
    search_fields = ('user_id', 'user_role')
    readonly_fields = (
        'user_role',
        'user_id',
        'trust_score',
        'completed_transactions',
        'verified_activities',
        'created_at',
        'updated_at',
    )

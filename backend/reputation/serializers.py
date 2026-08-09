from rest_framework import serializers
from .models import Reputation


class ReputationSerializer(serializers.ModelSerializer):
    """
    Serializer for authenticated user's own reputation view.
    """
    class Meta:
        model = Reputation
        fields = [
            'user_role',
            'user_id',
            'trust_score',
            'completed_transactions',
            'verified_activities',
            'updated_at',
        ]
        read_only_fields = fields


class PublicReputationSerializer(serializers.Serializer):
    """
    Safe public reputation profile.
    Strictly excludes email, password, aadhaar, gstin, CIN, JWT, private keys.
    """
    role = serializers.CharField()
    user_id = serializers.IntegerField()
    display_name = serializers.CharField()
    did = serializers.CharField()
    wallet_address = serializers.CharField()
    trust_score = serializers.IntegerField()
    completed_transactions = serializers.IntegerField()
    verified_activities = serializers.IntegerField()
    trust_tier = serializers.SerializerMethodField()
    updated_at = serializers.DateTimeField()

    def get_trust_tier(self, obj):
        score = obj.get('trust_score', 50)
        if score >= 90:
            return "Champion Partner ⭐⭐⭐"
        elif score >= 75:
            return "Trusted Partner ⭐⭐"
        elif score >= 60:
            return "Verified Member ⭐"
        else:
            return "Building Trust 🌱"

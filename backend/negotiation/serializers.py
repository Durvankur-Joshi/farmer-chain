from rest_framework import serializers
from .models import Negotiation, NegotiationMessage

class NegotiationMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = NegotiationMessage
        fields = '__all__'

# --- THIS IS THE CORRECTED SERIALIZER ---
class NegotiationSerializer(serializers.ModelSerializer):
    messages = NegotiationMessageSerializer(many=True, read_only=True)
    # Explicitly define fields to represent the GenericForeignKey
    bid_id = serializers.IntegerField(source='object_id', read_only=True)
    bid_type = serializers.CharField(source='content_type.model', read_only=True)

    class Meta:
        model = Negotiation
        # Replace the problematic 'bid' field with our explicit ones
        fields = ('id', 'bid_id', 'bid_type', 'status', 'created_at', 'messages')
# --- END OF CORRECTION ---

class CounterOfferSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True)
    counter_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    counter_delivery_time_days = serializers.IntegerField(min_value=1, required=True)
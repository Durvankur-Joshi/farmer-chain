from rest_framework import serializers
from .models import Negotiation, NegotiationMessage

class NegotiationMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = NegotiationMessage
        fields = [
            'id', 'negotiation', 'sender_role', 'sender_id', 'sender_name',
            'message', 'counter_amount', 'counter_quantity',
            'counter_delivery_time_days', 'created_at'
        ]

class NegotiationSerializer(serializers.ModelSerializer):
    messages = NegotiationMessageSerializer(many=True, read_only=True)
    bid_id = serializers.IntegerField(source='object_id', read_only=True)
    bid_type = serializers.CharField(source='content_type.model', read_only=True)
    details = serializers.SerializerMethodField()

    class Meta:
        model = Negotiation
        fields = (
            'id', 'bid_id', 'bid_type', 'status', 'agreed_price_per_unit',
            'agreed_quantity', 'created_at', 'updated_at', 'details', 'messages'
        )

    def get_details(self, obj):
        bid = obj.bid
        if not bid:
            return None
        quote = getattr(bid, 'quote', None)
        if not quote:
            return None

        # Bidder details
        bidder_obj = getattr(bid, 'fpo', None) or getattr(bid, 'retailer', None)
        bidder_type = 'FPO' if hasattr(bid, 'fpo') else 'Retailer'
        bidder_name = bidder_obj.name if bidder_obj else "Unknown"

        # Quote owner details
        quote_owner = getattr(quote, 'farmer', None) or getattr(quote, 'fpo', None)
        owner_type = 'Farmer' if hasattr(quote, 'farmer') else 'FPO'
        owner_name = quote_owner.name if quote_owner else "Unknown"

        # Allocations provenance if FPOQuote
        allocations_data = []
        if hasattr(quote, 'allocations'):
            for alloc in quote.allocations.all():
                allocations_data.append({
                    'id': alloc.id,
                    'farmer_name': alloc.farmer.name if alloc.farmer else "Unknown",
                    'farmer_did': alloc.farmer.did if alloc.farmer else "",
                    'crop_passport_id': alloc.crop_passport_id,
                    'allocated_quantity': str(alloc.allocated_quantity),
                    'unit': alloc.inventory_lot.unit if alloc.inventory_lot else "unit",
                })

        return {
            'product_name': quote.product_name,
            'category': getattr(quote, 'category', ''),
            'unit': quote.unit,
            'quote_quantity': str(quote.quantity),
            'quote_price_per_unit': str(quote.price_per_unit) if quote.price_per_unit else None,
            'bid_amount': str(bid.bid_amount) if getattr(bid, 'bid_amount', None) else None,
            'bid_delivery_days': getattr(bid, 'delivery_time_days', None),
            'bidder_name': bidder_name,
            'bidder_type': bidder_type,
            'owner_name': owner_name,
            'owner_type': owner_type,
            'allocations': allocations_data,
        }

class CounterOfferSerializer(serializers.Serializer):
    message = serializers.CharField(required=False, allow_blank=True, default="")
    counter_amount = serializers.DecimalField(max_digits=18, decimal_places=8, required=False, allow_null=True)
    counter_quantity = serializers.DecimalField(max_digits=18, decimal_places=8, required=False, allow_null=True)
    counter_delivery_time_days = serializers.IntegerField(min_value=1, required=False, allow_null=True)
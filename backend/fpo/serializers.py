from rest_framework import serializers
from .models import FPO, FPOBid, FPOQuote

class FPOSerializer(serializers.ModelSerializer):
    class Meta:
        model = FPO
        fields = '__all__'
        extra_kwargs = {'password': {'write_only': True}}

class FPORegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FPO
        fields = ['name', 'email', 'password', 'corporate_identification_number', 'wallet_address', 'city', 'state']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password')
        fpo = FPO.objects.create(**validated_data)
        fpo.set_password(password)
        fpo.save()
        return fpo

class FPOBidSerializer(serializers.ModelSerializer):
    fpo_name = serializers.CharField(source='fpo.name', read_only=True)
    fpo_email = serializers.CharField(source='fpo.email', read_only=True)
    quote_product_name = serializers.CharField(source='quote.product_name', read_only=True)
    quote_farmer_name = serializers.CharField(source='quote.farmer.name', read_only=True)
    quote_quantity = serializers.DecimalField(source='quote.quantity', read_only=True, max_digits=10, decimal_places=2)
    quote_unit = serializers.CharField(source='quote.unit', read_only=True)
    
    class Meta:
        model = FPOBid
        fields = [
            'id', 'fpo', 'quote', 'bid_amount', 'delivery_time_days', 
            'comments', 'status', 'submitted_at', 'payment_status', 
            'transaction_hash', 'fpo_name', 'fpo_email',
            'quote_product_name', 'quote_farmer_name', 'quote_quantity', 'quote_unit'
        ]
        read_only_fields = ('fpo', 'quote', 'status', 'submitted_at', 'payment_status', 'transaction_hash')

    def validate_bid_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Bid amount must be greater than zero.")
        return value

    def validate_delivery_time_days(self, value):
        if value <= 0:
            raise serializers.ValidationError("Delivery time must be greater than zero.")
        return value

class FPOQuoteSerializer(serializers.ModelSerializer):
    fpo_name = serializers.CharField(source='fpo.name', read_only=True)
    fpo_email = serializers.CharField(source='fpo.email', read_only=True)
    bids = serializers.SerializerMethodField()
    
    class Meta:
        model = FPOQuote
        fields = [
            'id', 'fpo', 'product_name', 'category', 'description', 
            'quantity', 'unit', 'price_per_unit', 'status', 'deadline', 
            'created_at', 'accepted_bid', 'fpo_name', 'fpo_email',
            'bids'
        ]
        read_only_fields = ('fpo', 'status', 'created_at', 'accepted_bid')
    
    def get_bids(self, obj):
        """
        Custom method to get and serialize the bids for this quote.
        """
        bids_data = []
        for bid in obj.bids.all():
            bids_data.append({
                'id': bid.id,
                'retailer_name': bid.retailer.name,
                'bid_amount': str(bid.bid_amount),
                'delivery_time_days': bid.delivery_time_days,
                'status': bid.status,
                'submitted_at': bid.submitted_at
            })
        return bids_data

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_deadline(self, value):
        from django.utils import timezone
        if value <= timezone.now().date():
            raise serializers.ValidationError("Deadline must be in the future.")
        return value
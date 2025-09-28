from rest_framework import serializers
from .models import Retailer, RetailerBid
from fpo.serializers import FPOQuoteSerializer

class RetailerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Retailer
        fields = '__all__'
        extra_kwargs = {'password': {'write_only': True}}

class RetailerRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Retailer
        fields = ['name', 'email', 'password', 'gstin', 'wallet_address', 'city', 'state']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password')
        retailer = Retailer.objects.create(**validated_data)
        retailer.set_password(password)
        retailer.save()
        return retailer

class MyBidSerializer(serializers.ModelSerializer):
    quote = FPOQuoteSerializer(read_only=True)  # include all quote details
    retailer_name = serializers.CharField(source='retailer.name', read_only=True)
    retailer_email = serializers.CharField(source='retailer.email', read_only=True)

    class Meta:
        model = RetailerBid
        fields = [
            'id', 'bid_amount', 'delivery_time_days', 'status', 'submitted_at',
            'retailer_name', 'retailer_email', 'quote'
        ]
        
class RetailerBidSerializer(serializers.ModelSerializer):
    retailer_name = serializers.CharField(source='retailer.name', read_only=True)
    retailer_email = serializers.CharField(source='retailer.email', read_only=True)
    quote_product_name = serializers.CharField(source='quote.product_name', read_only=True)
    quote_quantity = serializers.DecimalField(source='quote.quantity', read_only=True, max_digits=10, decimal_places=2)
    quote_unit = serializers.CharField(source='quote.unit', read_only=True)
    
    class Meta:
        model = RetailerBid
        fields = [
            'id', 'retailer', 'quote', 'bid_amount', 'delivery_time_days', 
            'comments', 'status', 'submitted_at', 'payment_status', 
            'transaction_hash', 'retailer_name', 'retailer_email',
            'quote_product_name', 'quote_quantity', 'quote_unit'
        ]
        read_only_fields = ('retailer', 'quote', 'status', 'submitted_at', 'payment_status', 'transaction_hash')

    def validate_bid_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Bid amount must be greater than zero.")
        return value

    def validate_delivery_time_days(self, value):
        if value <= 0:
            raise serializers.ValidationError("Delivery time must be greater than zero.")
        return value
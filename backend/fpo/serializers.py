from rest_framework import serializers
from .models import FPO

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
    
from rest_framework import serializers
from .models import FPO, FPOQuoteRequest
from farmer.serializers import FarmerBidSerializer # Import FarmerBidSerializer
# Add these new serializers

class FPOQuoteRequestSerializer(serializers.ModelSerializer):
    bids = FarmerBidSerializer(many=True, read_only=True)

    class Meta:
        model = FPOQuoteRequest
        fields = '__all__'
        read_only_fields = ('fpo', 'status', 'accepted_bid')
        
        
# Add these new serializers to fpo/serializers.py
from .models import FPO, FPOBid, RetailerReviewOfFPO
# ... existing FPOSerializer and FPORegistrationSerializer ...

class FPOBidSerializer(serializers.ModelSerializer):
    class Meta:
        model = FPOBid
        fields = '__all__'
        read_only_fields = ('fpo', 'quote','status', 'submitted_at', 'payment_status', 'transaction_hash')

class RetailerReviewOfFPOSerializer(serializers.ModelSerializer):
    class Meta:
        model = RetailerReviewOfFPO
        fields = '__all__'
        read_only_fields = ('retailer', 'bid')
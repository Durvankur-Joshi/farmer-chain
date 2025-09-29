from rest_framework import serializers
from .models import Farmer, FarmerQuote

class FarmerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Farmer
        fields = '__all__'
        extra_kwargs = {'password': {'write_only': True}}

class FarmerRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Farmer
        fields = ['name', 'email', 'password', 'aadhaar_number', 'wallet_address', 'city', 'state']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password')
        farmer = Farmer.objects.create(**validated_data)
        farmer.set_password(password)
        farmer.save()
        return farmer

class FarmerQuoteSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source='farmer.name', read_only=True)
    farmer_email = serializers.CharField(source='farmer.email', read_only=True)
    bids = serializers.SerializerMethodField()

    class Meta:
        model = FarmerQuote
        fields = [
            'id', 'farmer', 'product_name', 'category', 'description', 
            'quantity', 'unit', 'price_per_unit', 'status', 'deadline', 
            'created_at', 'accepted_bid', 'farmer_name', 'farmer_email',
            'bids', 'contract_address'
        ]
        read_only_fields = ('farmer', 'status', 'created_at', 'accepted_bid')

    def get_bids(self, obj):
        """
        Custom method to get and serialize the bids for this quote.
        This avoids the circular import issue at startup.
        """
        # Use a simple serializer to avoid circular imports
        bids_data = []
        for bid in obj.bids.all():
            bids_data.append({
                'id': bid.id,
                'fpo_name': bid.fpo.name,
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
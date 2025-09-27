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
    # --- FIX START ---
    bids = serializers.SerializerMethodField()
    # --- FIX END ---

    class Meta:
        model = FarmerQuote
        fields = [
            'id', 'farmer', 'product_name', 'category', 'description', 
            'quantity', 'unit', 'price_per_unit', 'status', 'deadline', 
            'created_at', 'accepted_bid', 'farmer_name', 'farmer_email',
            'bids'  # <-- Add 'bids' to the fields list
        ]
        read_only_fields = ('farmer', 'status', 'created_at', 'accepted_bid')

    # --- FIX START ---
    def get_bids(self, obj):
        """
        Custom method to get and serialize the bids for this quote.
        This avoids the circular import issue at startup.
        """
        # Import the serializer only when this method is called
        from fpo.serializers import FPOBidSerializer
        # We access bids through the related_name 'bids' on the FarmerQuote object 'obj'
        bids_queryset = obj.bids.all()
        serializer = FPOBidSerializer(bids_queryset, many=True)
        return serializer.data
    # --- FIX END ---

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_deadline(self, value):
        from django.utils import timezone
        if value <= timezone.now().date():
            raise serializers.ValidationError("Deadline must be in the future.")
        return value
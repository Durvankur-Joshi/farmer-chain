from rest_framework import serializers
from .models import Farmer

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
    
    
from rest_framework import serializers
from .models import Farmer, FarmerBid, FPOReviewOfFarmer
# Add these new serializers

class FarmerBidSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmerBid
        fields = '__all__'
        read_only_fields = ('farmer', 'quote','status', 'submitted_at', 'payment_status', 'transaction_hash')

class FPOReviewOfFarmerSerializer(serializers.ModelSerializer):
    class Meta:
        model = FPOReviewOfFarmer
        fields = '__all__'
        read_only_fields = ('fpo', 'bid')
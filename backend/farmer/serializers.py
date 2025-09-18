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
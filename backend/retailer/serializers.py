from rest_framework import serializers
from .models import Retailer

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
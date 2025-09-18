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
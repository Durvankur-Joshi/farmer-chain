from rest_framework import serializers
from .models import Farmer, FarmerQuote, CropPassport


class FarmerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Farmer
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True},
            'did': {'read_only': True},
            'did_created_at': {'read_only': True},
        }

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


# ──────────────────────────────────────────────────────────────────────────────
# Phase 2.2 — Crop Passport serializers
# ──────────────────────────────────────────────────────────────────────────────

class CropPassportSerializer(serializers.ModelSerializer):
    """
    Full serializer for authenticated farmer CRUD.
    - farmer is always set server-side, never accepted from request data.
    - NFT/blockchain fields are read-only; the frontend confirms mint via
      the /confirm-mint/ endpoint which validates format before writing.
    """
    farmer_name = serializers.CharField(source='farmer.name', read_only=True)
    farmer_did = serializers.CharField(source='farmer.did', read_only=True)
    farmer_wallet = serializers.CharField(source='farmer.wallet_address', read_only=True)
    is_minted = serializers.BooleanField(read_only=True)

    class Meta:
        model = CropPassport
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_did', 'farmer_wallet',
            'crop_name', 'crop_category', 'description',
            'quantity', 'unit',
            'cultivation_date', 'harvest_date', 'location',
            'status', 'is_minted', 'created_at', 'updated_at',
            'nft_token_id', 'nft_contract_address',
            'nft_token_uri', 'nft_transaction_hash', 'nft_minted_at',
        ]
        read_only_fields = (
            'farmer', 'status', 'is_minted',
            'created_at', 'updated_at',
            # All NFT/blockchain fields are read-only through this serializer.
            # They are written only by confirm_mint_view after format validation.
            'nft_token_id', 'nft_contract_address',
            'nft_token_uri', 'nft_transaction_hash', 'nft_minted_at',
        )

    def validate(self, data):
        cultivation = data.get('cultivation_date') or (self.instance.cultivation_date if self.instance else None)
        harvest = data.get('harvest_date') or (self.instance.harvest_date if self.instance else None)
        if cultivation and harvest and cultivation > harvest:
            raise serializers.ValidationError(
                "cultivation_date cannot be after harvest_date."
            )
        return data

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value


class PublicCropPassportSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for the public verification endpoint.
    Exposes only non-sensitive fields. No email/aadhaar/password.
    """
    farmer_did = serializers.CharField(source='farmer.did', read_only=True)
    farmer_wallet = serializers.CharField(source='farmer.wallet_address', read_only=True)
    farmer_location = serializers.SerializerMethodField()

    class Meta:
        model = CropPassport
        fields = [
            'id', 'crop_name', 'crop_category', 'description',
            'quantity', 'unit',
            'cultivation_date', 'harvest_date', 'location',
            'farmer_did', 'farmer_wallet', 'farmer_location',
            'status',
            'nft_token_id', 'nft_contract_address',
            'nft_token_uri', 'nft_transaction_hash', 'nft_minted_at',
        ]

    def get_farmer_location(self, obj):
        return f"{obj.farmer.city}, {obj.farmer.state}"
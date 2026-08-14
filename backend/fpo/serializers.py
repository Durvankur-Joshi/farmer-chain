from rest_framework import serializers
from .models import FPO, FPOBid, FPOQuote, FPOInventoryLot

class FPOSerializer(serializers.ModelSerializer):
    class Meta:
        model = FPO
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True},
            'did': {'read_only': True},
            'did_created_at': {'read_only': True},
        }

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
    quote_quantity = serializers.DecimalField(source='quote.quantity', read_only=True, max_digits=18, decimal_places=8)
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
        if value is None or value <= 0:
            raise serializers.ValidationError("Bid amount must be greater than zero.")
        return value

    def validate_delivery_time_days(self, value):
        if value is None or value <= 0:
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
        if value is None or value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_price_per_unit(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Price per unit must be greater than zero.")
        return value

    def validate_unit(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Unit is required.")
        valid_units = ['kg', 'quintal', 'caret', 'piece', 'acre', 'ton', 'litre', 'dozen']
        val = str(value).strip().lower()
        if val not in valid_units:
            raise serializers.ValidationError(f"Invalid unit '{value}'. Supported units: {', '.join(valid_units)}.")
        return val

    def validate_category(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Category is required.")
        valid_categories = ['grains', 'vegetables', 'fruits', 'pulses', 'oilseeds', 'dairy']
        val = str(value).strip().lower()
        if val not in valid_categories:
            raise serializers.ValidationError(f"Invalid category '{value}'. Supported categories: Grains, Vegetables, Fruits, Pulses, Oilseeds, Dairy.")
        return val.capitalize()

    def validate_deadline(self, value):
        from django.utils import timezone
        if value <= timezone.now().date():
            raise serializers.ValidationError("Deadline must be in the future.")
        return value


class FPOInventoryLotSerializer(serializers.ModelSerializer):
    """
    Phase 1 — FPO Inventory Lot Serializer.
    Provides complete lot details and provenance tracking (FPO -> Farmer -> Crop -> Passport).
    """
    fpo_name = serializers.CharField(source='fpo.name', read_only=True)
    farmer_name = serializers.CharField(source='farmer.name', read_only=True)
    farmer_email = serializers.CharField(source='farmer.email', read_only=True)
    farmer_city = serializers.CharField(source='farmer.city', read_only=True)
    farmer_state = serializers.CharField(source='farmer.state', read_only=True)
    farmer_did = serializers.CharField(source='farmer.did', read_only=True)

    farmer_details = serializers.SerializerMethodField()
    crop_passport_details = serializers.SerializerMethodField()
    provenance = serializers.SerializerMethodField()

    class Meta:
        model = FPOInventoryLot
        fields = [
            'id', 'fpo', 'fpo_name', 'farmer', 'farmer_name', 'farmer_email',
            'farmer_city', 'farmer_state', 'farmer_did', 'farmer_details',
            'crop_passport', 'crop_passport_details', 'provenance',
            'product_name', 'crop_category', 'original_quantity',
            'available_quantity', 'reserved_quantity', 'unit',
            'acquisition_price', 'status', 'quote', 'bid',
            'created_at', 'updated_at'
        ]
        read_only_fields = fields

    def get_farmer_details(self, obj):
        if not obj.farmer:
            return None
        f = obj.farmer
        return {
            'id': f.id,
            'name': f.name,
            'email': f.email,
            'city': f.city,
            'state': f.state,
            'did': f.did,
            'wallet_address': f.wallet_address,
        }

    def get_crop_passport_details(self, obj):
        if not obj.crop_passport:
            return None
        cp = obj.crop_passport
        ai = cp.latest_ai_verification
        return {
            'id': cp.id,
            'crop_name': cp.crop_name,
            'crop_category': cp.crop_category,
            'description': cp.description,
            'status': cp.status,
            'is_minted': cp.is_minted,
            'cultivation_date': str(cp.cultivation_date),
            'harvest_date': str(cp.harvest_date),
            'location': cp.location,
            'nft_token_id': cp.nft_token_id,
            'primary_image_url': cp.primary_image_url,
            'ai_verification': {
                'quality_grade': ai.quality_grade,
                'quality_score': float(ai.quality_score) if ai.quality_score is not None else None,
                'confidence_score': float(ai.confidence_score) if ai.confidence_score is not None else None,
                'crop_detected': ai.crop_detected,
                'verification_status': ai.verification_status,
                'image_gateway_url': ai.image_gateway_url,
            } if ai else None,
        }

    def get_provenance(self, obj):
        cp = obj.crop_passport
        return {
            'fpo_name': obj.fpo.name,
            'fpo_did': obj.fpo.did,
            'farmer_name': obj.farmer.name,
            'farmer_did': obj.farmer.did,
            'farmer_location': f"{obj.farmer.city}, {obj.farmer.state}",
            'crop_name': obj.product_name,
            'crop_category': obj.crop_category,
            'passport_id': cp.id if cp else None,
            'passport_status': cp.status if cp else 'no_passport',
            'nft_minted': cp.is_minted if cp else False,
            'nft_token_id': cp.nft_token_id if cp else None,
            'ai_grade': cp.latest_ai_verification.quality_grade if (cp and cp.latest_ai_verification) else None,
            'acquired_at': str(obj.created_at),
            'acquisition_price_eth': str(obj.acquisition_price) if obj.acquisition_price else None,
        }
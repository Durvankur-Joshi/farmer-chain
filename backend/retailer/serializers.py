from rest_framework import serializers
from .models import Retailer, RetailerBid, RetailerCartItem, RetailerOrder, RetailerOrderAllocation, RetailerInventoryLot
from fpo.serializers import FPOQuoteSerializer

class RetailerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Retailer
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True},
            'did': {'read_only': True},
            'did_created_at': {'read_only': True},
        }

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
    quote_quantity = serializers.DecimalField(source='quote.quantity', read_only=True, max_digits=18, decimal_places=8)
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
        if value is None or value <= 0:
            raise serializers.ValidationError("Bid amount must be greater than zero.")
        return value


class RetailerCartItemSerializer(serializers.ModelSerializer):
    """
    Phase 4 — Retailer Cart Item Serializer.
    Exposes quote details, price per unit, total price, and remaining unreserved stock.
    """
    quote_details = FPOQuoteSerializer(source='quote', read_only=True)
    item_total_price = serializers.SerializerMethodField()
    available_remaining_quantity = serializers.SerializerMethodField()

    class Meta:
        model = RetailerCartItem
        fields = [
            'id', 'retailer', 'quote', 'quote_details', 'selected_quantity',
            'available_remaining_quantity', 'item_total_price',
            'created_at', 'updated_at'
        ]
        read_only_fields = ('retailer', 'created_at', 'updated_at')

    def get_item_total_price(self, obj):
        if obj.quote and obj.quote.price_per_unit and obj.selected_quantity:
            total = obj.quote.price_per_unit * obj.selected_quantity
            return str(total)
        return "0"

    def get_available_remaining_quantity(self, obj):
        if obj.quote:
            avail = obj.quote.available_quantity
            return str(avail if avail is not None else obj.quote.quantity)
        return "0"


class RetailerOrderAllocationSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source='farmer.name', read_only=True)
    farmer_did = serializers.CharField(source='farmer.did', read_only=True)
    farmer_location = serializers.SerializerMethodField()
    crop_passport_details = serializers.SerializerMethodField()
    unit = serializers.ReadOnlyField(source='inventory_lot.unit')

    class Meta:
        model = RetailerOrderAllocation
        fields = [
            'id', 'order', 'inventory_lot', 'farmer', 'farmer_name', 'farmer_did',
            'farmer_location', 'crop_passport', 'crop_passport_details',
            'allocated_quantity', 'unit', 'created_at'
        ]

    def get_farmer_location(self, obj):
        if obj.farmer:
            return f"{obj.farmer.city}, {obj.farmer.state}"
        return ""

    def get_crop_passport_details(self, obj):
        cp = obj.crop_passport
        if not cp:
            return None
        ai = cp.latest_ai_verification
        return {
            'id': cp.id,
            'crop_name': cp.crop_name,
            'crop_category': cp.crop_category,
            'status': cp.status,
            'is_minted': cp.is_minted,
            'harvest_date': str(cp.harvest_date),
            'location': cp.location,
            'nft_token_id': cp.nft_token_id,
            'primary_image_url': cp.primary_image_url,
            'ai_verification': {
                'quality_grade': ai.quality_grade,
                'quality_score': float(ai.quality_score) if ai.quality_score is not None else None,
                'verification_status': ai.verification_status,
                'image_gateway_url': ai.image_gateway_url,
            } if ai else None,
        }


class RetailerOrderSerializer(serializers.ModelSerializer):
    fpo_name = serializers.CharField(source='fpo.name', read_only=True)
    fpo_email = serializers.CharField(source='fpo.email', read_only=True)
    fpo_did = serializers.CharField(source='fpo.did', read_only=True)
    fpo_location = serializers.SerializerMethodField()
    retailer_name = serializers.CharField(source='retailer.name', read_only=True)
    allocations = RetailerOrderAllocationSerializer(many=True, read_only=True)
    provenance_summary = serializers.SerializerMethodField()

    class Meta:
        model = RetailerOrder
        fields = [
            'id', 'order_number', 'retailer', 'retailer_name', 'fpo', 'fpo_name',
            'fpo_email', 'fpo_did', 'fpo_location', 'quote', 'product_name',
            'category', 'quantity', 'unit', 'price_per_unit', 'total_price',
            'status', 'notes', 'created_at', 'updated_at', 'allocations', 'provenance_summary'
        ]
        read_only_fields = ('order_number', 'retailer', 'fpo', 'quote', 'created_at', 'updated_at')

    def get_fpo_location(self, obj):
        if obj.fpo:
            return f"{obj.fpo.city}, {obj.fpo.state}"
        return ""

    def get_provenance_summary(self, obj):
        allocations = obj.allocations.all()
        farmers_set = set()
        passports_set = set()
        farmers_list = []
        passports_list = []

        for alloc in allocations:
            if alloc.farmer:
                farmers_set.add(alloc.farmer_id)
                farmers_list.append({
                    'id': alloc.farmer.id,
                    'name': alloc.farmer.name,
                    'did': alloc.farmer.did,
                    'location': f"{alloc.farmer.city}, {alloc.farmer.state}",
                    'allocated_quantity': str(alloc.allocated_quantity),
                })
            if alloc.crop_passport:
                passports_set.add(alloc.crop_passport_id)
                passports_list.append({
                    'id': alloc.crop_passport.id,
                    'crop_name': alloc.crop_passport.crop_name,
                    'is_minted': alloc.crop_passport.is_minted,
                    'ai_grade': alloc.crop_passport.latest_ai_verification.quality_grade if alloc.crop_passport.latest_ai_verification else None,
                    'allocated_quantity': str(alloc.allocated_quantity),
                })

        return {
            'total_farmers_count': len(farmers_set),
            'total_passports_count': len(passports_set),
            'farmers_list': farmers_list,
            'passports_list': passports_list,
        }

    def validate_delivery_time_days(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Delivery time must be greater than zero.")
        return value


class RetailerInventoryLotSerializer(serializers.ModelSerializer):
    """
    Exposes retailer purchased stock lots with full multi-step provenance
    (Retailer -> FPO -> Farmer -> CropPassport -> Escrow).
    """
    fpo_name = serializers.CharField(source='fpo.name', read_only=True)
    farmer_name = serializers.CharField(source='farmer.name', read_only=True)
    farmer_did = serializers.CharField(source='farmer.did', read_only=True)
    farmer_location = serializers.SerializerMethodField()
    crop_passport_details = serializers.SerializerMethodField()

    class Meta:
        model = RetailerInventoryLot
        fields = [
            'id', 'retailer', 'fpo', 'fpo_name', 'farmer', 'farmer_name',
            'farmer_did', 'farmer_location', 'crop_passport', 'crop_passport_details',
            'inventory_lot', 'escrow', 'product_name', 'crop_category',
            'quantity', 'unit', 'purchase_price_per_unit', 'total_price',
            'status', 'created_at'
        ]

    def get_farmer_location(self, obj):
        if obj.farmer:
            return f"{obj.farmer.city}, {obj.farmer.state}"
        return ""

    def get_crop_passport_details(self, obj):
        cp = obj.crop_passport
        if not cp:
            return None
        ai = cp.latest_ai_verification
        return {
            'id': cp.id,
            'crop_name': cp.crop_name,
            'crop_category': cp.crop_category,
            'status': cp.status,
            'is_minted': cp.is_minted,
            'harvest_date': str(cp.harvest_date),
            'location': cp.location,
            'nft_token_id': cp.nft_token_id,
            'primary_image_url': cp.primary_image_url,
            'ai_verification': {
                'quality_grade': ai.quality_grade,
                'quality_score': float(ai.quality_score) if ai.quality_score is not None else None,
                'verification_status': ai.verification_status,
                'image_gateway_url': ai.image_gateway_url,
            } if ai else None,
        }
from rest_framework import serializers
from .models import Farmer, FarmerQuote, CropPassport, CropPassportDocument, AIQualityVerification


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
    crop_passport = serializers.PrimaryKeyRelatedField(
        queryset=CropPassport.objects.all(),
        required=True,
        error_messages={"required": "Select a completed Crop Passport before creating a quote."}
    )
    crop_passport_details = serializers.SerializerMethodField()

    class Meta:
        model = FarmerQuote
        fields = [
            'id', 'farmer', 'crop_passport', 'crop_passport_details',
            'product_name', 'category', 'description', 
            'quantity', 'unit', 'price_per_unit', 'status', 'deadline', 
            'created_at', 'accepted_bid', 'farmer_name', 'farmer_email',
            'bids', 'contract_address'
        ]
        read_only_fields = ('farmer', 'status', 'created_at', 'accepted_bid')
        extra_kwargs = {
            'product_name': {'required': False},
            'category': {'required': False},
            'description': {'required': False, 'allow_blank': True},
            'quantity': {'required': False},
            'unit': {'required': False},
            'price_per_unit': {'required': True},
            'deadline': {'required': True},
        }

    def get_bids(self, obj):
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

    def get_crop_passport_details(self, obj):
        if not obj.crop_passport:
            return None
        cp = obj.crop_passport
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
                'confidence_score': float(ai.confidence_score) if ai.confidence_score is not None else None,
                'crop_detected': ai.crop_detected,
                'verification_status': ai.verification_status,
                'image_gateway_url': ai.image_gateway_url,
            } if ai else None,
        }

    def validate(self, attrs):
        request = self.context.get('request')
        farmer = getattr(request.user, 'user_obj', None) if request and hasattr(request, 'user') else None

        crop_passport = attrs.get('crop_passport')

        # If this is a new quote creation
        if not self.instance:
            if not crop_passport:
                raise serializers.ValidationError({
                    "crop_passport": "Select a completed Crop Passport before creating a quote."
                })

            # Validate ownership
            if farmer and crop_passport.farmer_id != farmer.pk:
                raise serializers.ValidationError({
                    "crop_passport": "You do not own this Crop Passport."
                })

            # Validate passport required information
            if not crop_passport.crop_name or not crop_passport.quantity or crop_passport.quantity <= 0:
                raise serializers.ValidationError({
                    "crop_passport": "Selected Crop Passport is incomplete or has invalid quantity."
                })

            # Populate model fields automatically from the crop passport
            attrs['product_name'] = crop_passport.crop_name
            attrs['category'] = crop_passport.crop_category
            attrs['description'] = crop_passport.description or ''
            attrs['quantity'] = crop_passport.quantity
            attrs['unit'] = crop_passport.unit

        return super().validate(attrs)

    def validate_quantity(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_price_per_unit(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Price per unit must be greater than zero.")
        return value

    def validate_unit(self, value):
        if value:
            valid_units = ['kg', 'quintal', 'caret', 'piece', 'acre', 'ton', 'litre', 'dozen']
            val = str(value).strip().lower()
            if val not in valid_units:
                raise serializers.ValidationError(f"Invalid unit '{value}'. Supported units: {', '.join(valid_units)}.")
            return val
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
    primary_image_url = serializers.ReadOnlyField()
    latest_ai_verification = serializers.SerializerMethodField()

    class Meta:
        model = CropPassport
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_did', 'farmer_wallet',
            'crop_name', 'crop_category', 'description',
            'quantity', 'available_quantity', 'sold_quantity', 'unit',
            'cultivation_date', 'harvest_date', 'location',
            'status', 'is_minted', 'created_at', 'updated_at',
            'nft_token_id', 'nft_contract_address',
            'nft_token_uri', 'nft_transaction_hash', 'nft_minted_at',
            'primary_image_url', 'latest_ai_verification',
        ]
        read_only_fields = (
            'farmer', 'status', 'is_minted',
            'created_at', 'updated_at',
            # All NFT/blockchain fields are read-only through this serializer.
            # They are written only by confirm_mint_view after format validation.
            'nft_token_id', 'nft_contract_address',
            'nft_token_uri', 'nft_transaction_hash', 'nft_minted_at',
        )

    def get_latest_ai_verification(self, obj):
        v = obj.latest_ai_verification
        if not v:
            return None
        return {
            'id': v.id,
            'verification_status': v.verification_status,
            'crop_detected': v.crop_detected,
            'quality_grade': v.quality_grade,
            'quality_score': float(v.quality_score) if v.quality_score is not None else None,
            'confidence_score': float(v.confidence_score) if v.confidence_score is not None else None,
            'image_cid': v.image_cid,
            'image_gateway_url': v.image_gateway_url,
            'disease_detected': v.disease_detected,
            'disease_name': v.disease_name,
            'visible_defects': v.visible_defects,
            'ai_summary': v.ai_summary,
        }

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
    primary_image_url = serializers.ReadOnlyField()

    class Meta:
        model = CropPassport
        fields = [
            'id', 'crop_name', 'crop_category', 'description',
            'quantity', 'available_quantity', 'sold_quantity', 'unit',
            'cultivation_date', 'harvest_date', 'location',
            'farmer_did', 'farmer_wallet', 'farmer_location',
            'status',
            'nft_token_id', 'nft_contract_address',
            'nft_token_uri', 'nft_transaction_hash', 'nft_minted_at',
            'primary_image_url',
        ]

    def get_farmer_location(self, obj):
        return f"{obj.farmer.city}, {obj.farmer.state}"


# ──────────────────────────────────────────────────────────────────────────────
# Phase 2.3 — IPFS Document serializers
# ──────────────────────────────────────────────────────────────────────────────

class CropPassportDocumentSerializer(serializers.ModelSerializer):
    """
    Full serializer for authenticated farmer document management.
    - uploaded_by and ipfs fields are always set server-side.
    - gateway_url is a computed convenience field.
    - Frontend CANNOT submit: farmer_id, uploaded_by, ipfs_cid, ipfs_uri.
    """
    gateway_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)

    class Meta:
        model = CropPassportDocument
        fields = [
            'id', 'crop_passport',
            'uploaded_by', 'uploaded_by_name',
            'file_name', 'file_type', 'file_size',
            'document_type',
            'ipfs_cid', 'ipfs_uri', 'gateway_url',
            'uploaded_at',
        ]
        read_only_fields = (
            'id', 'crop_passport', 'uploaded_by',
            'ipfs_cid', 'ipfs_uri', 'uploaded_at',
        )

    def get_gateway_url(self, obj):
        return obj.gateway_url


class PublicDocumentSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for the public Crop Passport page.
    Exposes only non-sensitive information.
    """
    gateway_url = serializers.SerializerMethodField()

    class Meta:
        model = CropPassportDocument
        fields = [
            'id', 'file_name', 'file_type', 'file_size',
            'document_type', 'ipfs_cid', 'ipfs_uri', 'gateway_url',
            'uploaded_at',
        ]

    def get_gateway_url(self, obj):
        return obj.gateway_url


# ──────────────────────────────────────────────────────────────────────────────
# Phase 2.4 — AI Quality Verification serializers
# ──────────────────────────────────────────────────────────────────────────────

class AIQualityVerificationSerializer(serializers.ModelSerializer):
    """
    Full serializer for authenticated farmer view.
    All AI result fields and IPFS reference are read-only (set server-side).
    No API key, no Pinata secret, no Aadhaar, no password exposed.
    """
    image_gateway_url = serializers.SerializerMethodField()
    verified_by_name  = serializers.CharField(source='verified_by.name', read_only=True)
    crop_name         = serializers.CharField(source='crop_passport.crop_name', read_only=True)

    class Meta:
        model = AIQualityVerification
        fields = [
            'id', 'crop_passport', 'crop_name',
            'verified_by', 'verified_by_name',
            'image_cid', 'image_uri', 'image_gateway_url',
            'crop_detected',
            'quality_grade', 'quality_score', 'confidence_score',
            'disease_detected', 'disease_name', 'visible_defects',
            'ai_summary',
            'verification_status', 'failure_reason',
            'ai_provider',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'crop_passport', 'verified_by',
            'image_cid', 'image_uri',
            'crop_detected', 'quality_grade', 'quality_score', 'confidence_score',
            'disease_detected', 'disease_name', 'visible_defects', 'ai_summary',
            'verification_status', 'failure_reason', 'ai_provider',
            'created_at', 'updated_at',
        ]

    def get_image_gateway_url(self, obj):
        return obj.image_gateway_url


class PublicVerificationSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for public consumer-facing verification endpoint.
    Excludes farmer identity (name/email/aadhaar) and internal fields.
    """
    image_gateway_url = serializers.SerializerMethodField()
    crop_name         = serializers.CharField(source='crop_passport.crop_name', read_only=True)

    class Meta:
        model = AIQualityVerification
        fields = [
            'id', 'crop_name',
            'image_cid', 'image_uri', 'image_gateway_url',
            'crop_detected',
            'quality_grade', 'quality_score', 'confidence_score',
            'disease_detected', 'disease_name', 'visible_defects',
            'ai_summary',
            'verification_status',
            'ai_provider',
            'created_at',
        ]

    def get_image_gateway_url(self, obj):
        return obj.image_gateway_url

from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import FPO, FPOBid, FPOQuote, FPOInventoryLot
from .serializers import FPOSerializer, FPORegistrationSerializer, FPOBidSerializer, FPOQuoteSerializer, FPOInventoryLotSerializer
from common.permissions import IsFPO
from farmer.models import FarmerQuote
from farmer.serializers import FarmerQuoteSerializer
from retailer.models import RetailerBid
from retailer.serializers import RetailerBidSerializer

class FPORegistrationView(generics.CreateAPIView):
    queryset = FPO.objects.all()
    serializer_class = FPORegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {"message": "Registration successful. Please wait for admin approval.", "data": serializer.data},
            status=status.HTTP_201_CREATED,
            headers=headers
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def fpo_login_check(request):
    email = request.data.get('email')
    
    try:
        fpo = FPO.objects.get(email=email)
        if fpo.approval_status == 'pending':
            return Response({
                'message': 'Your account is pending admin approval. Please wait for approval to login.',
                'approved': False,
                'status': 'pending'
            }, status=status.HTTP_200_OK)
        elif fpo.approval_status == 'rejected':
            return Response({
                'message': 'Your account has been rejected by admin. Please contact support.',
                'approved': False,
                'status': 'rejected'
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'message': 'Account is approved. You can proceed to login.',
                'approved': True,
                'status': 'approved'
            }, status=status.HTTP_200_OK)
    except FPO.DoesNotExist:
        return Response({
            'message': 'FPO not found with this email.',
            'approved': False,
            'status': 'not_found'
        }, status=status.HTTP_404_NOT_FOUND)

class FPOListView(generics.ListAPIView):
    queryset = FPO.objects.all()
    serializer_class = FPOSerializer
    permission_classes = [IsAuthenticated, IsFPO]

class FPODetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FPOSerializer
    permission_classes = [IsAuthenticated, IsFPO]

    def get_queryset(self):
        fpo = getattr(self.request.user, 'user_obj', None)
        if fpo:
            return FPO.objects.filter(pk=fpo.pk)
        return FPO.objects.none()

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFPO])
def fpo_dashboard(request):
    fpo = request.user.user_obj

    farmer_quotes = FarmerQuote.objects.filter(status='open')
    my_bids = FPOBid.objects.filter(fpo=fpo)
    my_quotes = FPOQuote.objects.filter(fpo=fpo)
    retailer_bids = RetailerBid.objects.filter(quote__in=my_quotes)
    
    data = {
        "available_farmer_quotes_count": farmer_quotes.count(),
        "my_bids_count": my_bids.count(),
        "my_quotes_count": my_quotes.count(),
        "retailer_bids_count": retailer_bids.count(),
    }
    return Response(data)

class FarmerOpenQuoteListView(generics.ListAPIView):
    serializer_class = FarmerQuoteSerializer
    permission_classes = [IsAuthenticated, IsFPO]

    def get_queryset(self):
        fpo = self.request.user.user_obj

        # Safely clean up any auto-generated quotes that have no asking price and no bids
        FarmerQuote.objects.filter(price_per_unit__isnull=True, bids__isnull=True).delete()

        # Exclude quotes where FPO has already bid
        qs = FarmerQuote.objects.filter(status='open').exclude(bids__fpo=fpo)

        # Keyword search (crop/product name, category, description)
        q = self.request.query_params.get('search') or self.request.query_params.get('q')
        if q:
            q = q.strip()
            from django.db.models import Q
            qs = qs.filter(
                Q(product_name__icontains=q) |
                Q(category__icontains=q) |
                Q(crop_passport__crop_category__icontains=q) |
                Q(description__icontains=q)
            )

        # Category filter
        category = self.request.query_params.get('category')
        if category and category.strip() and category.lower() != 'all':
            qs = qs.filter(
                Q(category__iexact=category.strip()) |
                Q(crop_passport__crop_category__iexact=category.strip())
            )

        # Unit filter
        unit = self.request.query_params.get('unit')
        if unit and unit.strip() and unit.lower() != 'all':
            qs = qs.filter(unit__iexact=unit.strip())

        # Quantity range filter
        min_qty = self.request.query_params.get('min_qty')
        if min_qty:
            try:
                min_val = float(min_qty)
                if min_val >= 0:
                    qs = qs.filter(quantity__gte=min_val)
            except (ValueError, TypeError):
                pass

        max_qty = self.request.query_params.get('max_qty')
        if max_qty:
            try:
                max_val = float(max_qty)
                if max_val >= 0:
                    qs = qs.filter(quantity__lte=max_val)
            except (ValueError, TypeError):
                pass

        # Harvest date filter (via CropPassport)
        harvest_from = self.request.query_params.get('harvest_from')
        if harvest_from:
            qs = qs.filter(crop_passport__harvest_date__gte=harvest_from)

        harvest_to = self.request.query_params.get('harvest_to')
        if harvest_to:
            qs = qs.filter(crop_passport__harvest_date__lte=harvest_to)

        return qs.order_by('-created_at')

class FPOBidCreateView(generics.CreateAPIView):
    serializer_class = FPOBidSerializer
    permission_classes = [IsAuthenticated, IsFPO]

    def perform_create(self, serializer):
        quote = get_object_or_404(FarmerQuote, pk=self.kwargs['quote_pk'])
        if quote.status != 'open':
            raise serializers.ValidationError("This quote is no longer open for bidding.")
        
        # Additional check to prevent duplicate bids
        fpo = self.request.user.user_obj
        if quote.bids.filter(fpo=fpo).exists():
            raise serializers.ValidationError("You have already placed a bid on this quote.")
            
        serializer.save(fpo=self.request.user.user_obj, quote=quote)

class FPOQuoteListCreateView(generics.ListCreateAPIView):
    serializer_class = FPOQuoteSerializer
    permission_classes = [IsAuthenticated, IsFPO]

    def get_queryset(self):
        return FPOQuote.objects.filter(fpo=self.request.user.user_obj)

    def perform_create(self, serializer):
        serializer.save(fpo=self.request.user.user_obj)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFPO])
def accept_retailer_bid(request, bid_pk):
    bid = get_object_or_404(RetailerBid, pk=bid_pk)
    quote = bid.quote

    if quote.fpo != request.user.user_obj:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    
    if quote.status != 'open':
        return Response({"error": "Quote is not open."}, status=status.HTTP_400_BAD_REQUEST)

    bid.status = 'accepted'
    bid.save()
    quote.bids.exclude(pk=bid.pk).update(status='rejected')
    quote.status = 'awarded'
    quote.accepted_bid = bid
    quote.save()
    
    return Response({
        "message": "Retailer bid accepted successfully.",
        "bid_id": bid.pk,
        "quote_id": quote.id
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFPO])
def fpo_inventory_list_view(request):
    """
    GET /api/fpo/inventory/

    Phase 1 — Returns inventory stock lots owned by the authenticated FPO.
    Supports filtering by search query (q/search), crop_category, and status.
    Ensures backfilling for any accepted farmer deals that have not created a lot yet.
    """
    fpo = request.user.user_obj

    # Backfill lots for any accepted farmer quotes where inventory lot wasn't created yet
    from farmer.models import FarmerQuote
    from .services import create_fpo_inventory_lot_from_deal
    accepted_quotes = FarmerQuote.objects.filter(
        accepted_bid__fpo=fpo,
        status__in=['accepted', 'contract_created', 'closed', 'awarded']
    )
    for q_obj in accepted_quotes:
        create_fpo_inventory_lot_from_deal(q_obj, q_obj.accepted_bid)

    qs = FPOInventoryLot.objects.filter(fpo=fpo)

    # Search filter
    q = request.query_params.get('search') or request.query_params.get('q')
    if q:
        q = q.strip()
        from django.db.models import Q
        qs = qs.filter(
            Q(product_name__icontains=q) |
            Q(crop_category__icontains=q) |
            Q(farmer__name__icontains=q) |
            Q(farmer__city__icontains=q)
        )

    # Category filter
    category = request.query_params.get('category')
    if category and category.strip() and category.lower() != 'all':
        qs = qs.filter(crop_category__iexact=category.strip())

    # Status filter
    status_param = request.query_params.get('status')
    if status_param and status_param.strip() and status_param.lower() != 'all':
        qs = qs.filter(status=status_param.strip())

    serializer = FPOInventoryLotSerializer(qs, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFPO])
def fpo_inventory_detail_view(request, lot_id):
    """
    GET /api/fpo/inventory/<lot_id>/

    Phase 1 — Returns detailed inventory lot record with full provenance data.
    Enforces ownership check so FPOs can only view their own inventory.
    """
    fpo = request.user.user_obj
    lot = get_object_or_404(FPOInventoryLot, pk=lot_id)

    if lot.fpo_id != fpo.pk:
        return Response(
            {'error': 'You do not own this inventory lot.'},
            status=status.HTTP_403_FORBIDDEN
        )

    serializer = FPOInventoryLotSerializer(lot)
    return Response(serializer.data, status=status.HTTP_200_OK)
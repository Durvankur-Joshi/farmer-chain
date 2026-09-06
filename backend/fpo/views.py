from rest_framework import generics, status
from common.events import emit_event
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import FPO, FPOBid, FPOQuote, FPOQuoteAllocation, FPOInventoryLot, FPOStockCartItem
from .serializers import (
    FPOSerializer, FPORegistrationSerializer, FPOBidSerializer,
    FPOQuoteSerializer, FPOQuoteAllocationSerializer,
    FPOInventoryLotSerializer, FPOStockCartItemSerializer
)
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
            {"message": "Registration successful.", "data": serializer.data},
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
        emit_event("bid_updated", {"quote_id": quote.pk})

class FPOQuoteListCreateView(generics.ListCreateAPIView):
    serializer_class = FPOQuoteSerializer
    permission_classes = [IsAuthenticated, IsFPO]

    def get_queryset(self):
        return FPOQuote.objects.filter(fpo=self.request.user.user_obj).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        # Delegate quote creation to Phase 3 provenance-aware cart allocation service
        return create_fpo_quote_from_cart_view(request)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFPO])
def create_fpo_quote_from_cart_view(request):
    """
    POST /api/fpo/quotes/from-cart/

    Phase 3 — Creates a wholesale FPOQuote for retailers exclusively from active FPOStockCartItem allocations.
    Validates cart is non-empty, calculates total quantity, creates individual FPOQuoteAllocation records for each lot,
    preserves full multi-farmer provenance, and clears the cart items.
    """
    from django.db import transaction
    from decimal import Decimal, InvalidOperation

    fpo = request.user.user_obj
    price_raw = request.data.get('price_per_unit')
    deadline_raw = request.data.get('deadline')
    custom_product_name = request.data.get('product_name')
    description = request.data.get('description', '')

    if not price_raw:
        return Response({'error': 'Asking price per unit (price_per_unit) is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not deadline_raw:
        return Response({'error': 'Bidding deadline is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        price_per_unit = Decimal(str(price_raw))
        if price_per_unit <= Decimal('0'):
            return Response({'error': 'Asking price must be a positive number greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)
    except (TypeError, ValueError, InvalidOperation):
        return Response({'error': 'Invalid price_per_unit format.'}, status=status.HTTP_400_BAD_REQUEST)

    cart_items = FPOStockCartItem.objects.filter(fpo=fpo).select_related('inventory_lot', 'inventory_lot__farmer', 'inventory_lot__crop_passport')
    if not cart_items.exists():
        return Response({
            'error': 'Your Stock Cart is empty. You must reserve inventory lots in your cart before publishing a wholesale market quote.'
        }, status=status.HTTP_400_BAD_REQUEST)

    first_lot = cart_items.first().inventory_lot
    product_name = custom_product_name.strip() if (custom_product_name and custom_product_name.strip()) else first_lot.product_name
    category = first_lot.crop_category or 'General'
    unit = first_lot.unit

    total_quantity = sum((item.selected_quantity for item in cart_items), Decimal('0'))

    with transaction.atomic():
        quote = FPOQuote.objects.create(
            fpo=fpo,
            product_name=product_name,
            category=category,
            description=description,
            quantity=total_quantity,
            unit=unit,
            price_per_unit=price_per_unit,
            status='open',
            deadline=deadline_raw
        )

        for item in cart_items:
            lot = item.inventory_lot
            FPOQuoteAllocation.objects.create(
                quote=quote,
                inventory_lot=lot,
                farmer=lot.farmer,
                crop_passport=lot.crop_passport,
                allocated_quantity=item.selected_quantity
            )
            item.delete()

    serializer = FPOQuoteSerializer(quote)

    emit_event("quote_updated", {"quote_id": quote.pk})
    emit_event("inventory_updated", {"fpo_id": fpo.pk})

    return Response({
        'message': f'Wholesale market quote published successfully to retailers with {quote.allocations.count()} provenance allocations.',
        'quote': serializer.data
    }, status=status.HTTP_201_CREATED)

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
    
    emit_event("bid_updated", {"bid_id": bid.pk, "quote_id": quote.id})
    emit_event("deal_updated", {"quote_id": quote.id})

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


# ── Phase 2 — FPO Stock Cart Views ──────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFPO])
def fpo_stock_cart_get_view(request):
    """
    GET /api/fpo/cart/

    Phase 2 — Retrieves the authenticated FPO's current Stock Cart items and summary.
    Preserves individual lot & farmer provenance per allocation.
    """
    fpo = request.user.user_obj
    cart_items = FPOStockCartItem.objects.filter(fpo=fpo).select_related('inventory_lot', 'inventory_lot__farmer', 'inventory_lot__crop_passport')
    
    serialized_items = FPOStockCartItemSerializer(cart_items, many=True).data

    from decimal import Decimal
    total_selected_qty = Decimal('0')
    unique_farmers = set()
    unique_passports = set()
    unique_crops = set()
    units_set = set()

    for item in cart_items:
        lot = item.inventory_lot
        total_selected_qty += item.selected_quantity
        if lot.farmer_id:
            unique_farmers.add(lot.farmer_id)
        if lot.crop_passport_id:
            unique_passports.add(lot.crop_passport_id)
        if lot.product_name:
            unique_crops.add(lot.product_name)
        if lot.unit:
            units_set.add(lot.unit)

    summary = {
        "total_selected_quantity": str(total_selected_qty),
        "total_items_count": cart_items.count(),
        "unique_farmers_count": len(unique_farmers),
        "unique_passports_count": len(unique_passports),
        "unique_crops_count": len(unique_crops),
        "units": list(units_set),
    }

    return Response({
        "items": serialized_items,
        "summary": summary,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFPO])
def fpo_stock_cart_add_item_view(request):
    """
    POST /api/fpo/cart/items/

    Phase 2 — Adds an inventory lot allocation or updates quantity in the FPO Stock Cart.
    Atomically reserves the selected stock on the FPOInventoryLot.
    Body: { "inventory_lot_id": <int>, "selected_quantity": <decimal> }
    """
    from django.db import transaction
    from decimal import Decimal, InvalidOperation

    fpo = request.user.user_obj
    lot_id = request.data.get('inventory_lot_id')
    raw_qty = request.data.get('selected_quantity')

    if not lot_id:
        return Response({'error': 'inventory_lot_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        requested_qty = Decimal(str(raw_qty))
        if requested_qty <= Decimal('0'):
            return Response({'error': 'selected_quantity must be a positive number greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)
    except (TypeError, ValueError, InvalidOperation):
        return Response({'error': 'Invalid selected_quantity format.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        lot = get_object_or_404(FPOInventoryLot.objects.select_for_update(), pk=lot_id)

        if lot.fpo_id != fpo.pk:
            return Response({'error': 'You do not own this inventory lot.'}, status=status.HTTP_403_FORBIDDEN)

        existing_item = FPOStockCartItem.objects.filter(fpo=fpo, inventory_lot=lot).first()
        old_selected_qty = existing_item.selected_quantity if existing_item else Decimal('0')
        diff = requested_qty - old_selected_qty

        if diff > Decimal('0') and diff > lot.available_quantity:
            max_selectable = lot.available_quantity + old_selected_qty
            return Response({
                'error': f'Cannot select {requested_qty} {lot.unit}. Maximum available stock for this lot is {max_selectable} {lot.unit}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update inventory lot reservation atomically
        lot.available_quantity -= diff
        lot.reserved_quantity += diff
        lot.save()

        if existing_item:
            existing_item.selected_quantity = requested_qty
            existing_item.save()
            cart_item = existing_item
        else:
            cart_item = FPOStockCartItem.objects.create(
                fpo=fpo,
                inventory_lot=lot,
                selected_quantity=requested_qty
            )

    serializer = FPOStockCartItemSerializer(cart_item)

    emit_event("inventory_updated", {"fpo_id": fpo.pk})

    return Response({
        'message': f'Reserved {requested_qty} {lot.unit} in stock cart.',
        'cart_item': serializer.data
    }, status=status.HTTP_201_CREATED if not existing_item else status.HTTP_200_OK)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsFPO])
def fpo_stock_cart_update_item_view(request, item_id):
    """
    PATCH /api/fpo/cart/items/<item_id>/

    Phase 2 — Updates selected partial quantity for an existing cart item.
    Body: { "selected_quantity": <decimal> }
    """
    from django.db import transaction
    from decimal import Decimal, InvalidOperation

    fpo = request.user.user_obj
    raw_qty = request.data.get('selected_quantity')

    try:
        requested_qty = Decimal(str(raw_qty))
        if requested_qty <= Decimal('0'):
            return Response({'error': 'selected_quantity must be a positive number greater than 0.'}, status=status.HTTP_400_BAD_REQUEST)
    except (TypeError, ValueError, InvalidOperation):
        return Response({'error': 'Invalid selected_quantity format.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        item = get_object_or_404(FPOStockCartItem.objects.select_for_update(), pk=item_id)
        if item.fpo_id != fpo.pk:
            return Response({'error': 'You do not own this cart item.'}, status=status.HTTP_403_FORBIDDEN)

        lot = get_object_or_404(FPOInventoryLot.objects.select_for_update(), pk=item.inventory_lot_id)
        old_selected_qty = item.selected_quantity
        diff = requested_qty - old_selected_qty

        if diff > Decimal('0') and diff > lot.available_quantity:
            max_selectable = lot.available_quantity + old_selected_qty
            return Response({
                'error': f'Cannot select {requested_qty} {lot.unit}. Maximum available stock for this lot is {max_selectable} {lot.unit}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        lot.available_quantity -= diff
        lot.reserved_quantity += diff
        lot.save()

        item.selected_quantity = requested_qty
        item.save()

    serializer = FPOStockCartItemSerializer(item)

    emit_event("inventory_updated", {"fpo_id": fpo.pk})

    return Response({
        'message': 'Cart item quantity updated.',
        'cart_item': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsFPO])
def fpo_stock_cart_delete_item_view(request, item_id):
    """
    DELETE /api/fpo/cart/items/<item_id>/

    Phase 2 — Removes a cart item and releases its reserved stock back to available inventory.
    """
    from django.db import transaction

    fpo = request.user.user_obj

    with transaction.atomic():
        item = get_object_or_404(FPOStockCartItem.objects.select_for_update(), pk=item_id)
        if item.fpo_id != fpo.pk:
            return Response({'error': 'You do not own this cart item.'}, status=status.HTTP_403_FORBIDDEN)

        lot = get_object_or_404(FPOInventoryLot.objects.select_for_update(), pk=item.inventory_lot_id)
        qty_to_release = item.selected_quantity

        lot.available_quantity += qty_to_release
        lot.reserved_quantity -= qty_to_release
        lot.save()

        item.delete()

    emit_event("inventory_updated", {"fpo_id": fpo.pk})

    return Response({
        'message': f'Removed lot from stock cart and released {qty_to_release} {lot.unit} back to available inventory.'
    }, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsFPO])
def fpo_stock_cart_clear_view(request):
    """
    DELETE /api/fpo/cart/clear/

    Phase 2 — Clears all cart items for the authenticated FPO and releases all reservations.
    """
    from django.db import transaction

    fpo = request.user.user_obj

    with transaction.atomic():
        cart_items = FPOStockCartItem.objects.filter(fpo=fpo).select_for_update()
        for item in cart_items:
            lot = FPOInventoryLot.objects.select_for_update().get(pk=item.inventory_lot_id)
            lot.available_quantity += item.selected_quantity
            lot.reserved_quantity -= item.selected_quantity
            lot.save()
            item.delete()

    emit_event("inventory_updated", {"fpo_id": fpo.pk})

    return Response({'message': 'Stock cart cleared and all reserved inventory released.'}, status=status.HTTP_200_OK)
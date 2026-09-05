from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import Retailer, RetailerBid
from .serializers import RetailerSerializer, RetailerRegistrationSerializer, RetailerBidSerializer
from common.permissions import IsRetailer
from fpo.models import FPOQuote
from fpo.serializers import FPOQuoteSerializer
from .serializers import MyBidSerializer

class RetailerRegistrationView(generics.CreateAPIView):
    queryset = Retailer.objects.all()
    serializer_class = RetailerRegistrationSerializer
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
def retailer_login_check(request):
    email = request.data.get('email')
    
    try:
        retailer = Retailer.objects.get(email=email)
        if retailer.approval_status == 'pending':
            return Response({
                'message': 'Your account is pending admin approval. Please wait for approval to login.',
                'approved': False,
                'status': 'pending'
            }, status=status.HTTP_200_OK)
        elif retailer.approval_status == 'rejected':
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
    except Retailer.DoesNotExist:
        return Response({
            'message': 'Retailer not found with this email.',
            'approved': False,
            'status': 'not_found'
        }, status=status.HTTP_404_NOT_FOUND)

class RetailerListView(generics.ListAPIView):
    queryset = Retailer.objects.all()
    serializer_class = RetailerSerializer
    permission_classes = [IsAuthenticated, IsRetailer]

class RetailerDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RetailerSerializer
    permission_classes = [IsAuthenticated, IsRetailer]

    def get_queryset(self):
        retailer = getattr(self.request.user, 'user_obj', None)
        if retailer:
            return Retailer.objects.filter(pk=retailer.pk)
        return Retailer.objects.none()

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_dashboard(request):
    retailer = request.user.user_obj

    fpo_quotes = FPOQuote.objects.filter(status='open')
    my_bids = RetailerBid.objects.filter(retailer=retailer)
    
    data = {
        "available_fpo_quotes_count": fpo_quotes.count(),
        "my_bids_count": my_bids.count(),
        "accepted_bids_count": my_bids.filter(status='accepted').count(),
    }
    return Response(data)

class FPOOpenQuoteListView(generics.ListAPIView):
    serializer_class = FPOQuoteSerializer
    permission_classes = [IsAuthenticated, IsRetailer]

    def get_queryset(self):
        retailer = self.request.user.user_obj
        qs = FPOQuote.objects.filter(status='open').exclude(bids__retailer=retailer)

        q = self.request.query_params.get('search') or self.request.query_params.get('q')
        if q:
            q = q.strip()
            from django.db.models import Q
            qs = qs.filter(
                Q(product_name__icontains=q) |
                Q(category__icontains=q) |
                Q(description__icontains=q)
            )

        category = self.request.query_params.get('category')
        if category and category.strip() and category.lower() != 'all':
            qs = qs.filter(category__iexact=category.strip())

        unit = self.request.query_params.get('unit')
        if unit and unit.strip() and unit.lower() != 'all':
            qs = qs.filter(unit__iexact=unit.strip())

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

        return qs.order_by('-created_at')

class RetailerBidCreateView(generics.CreateAPIView):
    serializer_class = RetailerBidSerializer
    permission_classes = [IsAuthenticated, IsRetailer]

    def perform_create(self, serializer):
        quote = get_object_or_404(FPOQuote, pk=self.kwargs['quote_pk'])
        if quote.status != 'open':
            raise serializers.ValidationError("This quote is no longer open for bidding.")
            
        retailer = self.request.user.user_obj
        if quote.bids.filter(retailer=retailer).exists():
            raise serializers.ValidationError("You have already placed a bid on this quote.")
            
        serializer.save(retailer=retailer, quote=quote)

class MyBidsListView(generics.ListAPIView):
    serializer_class = MyBidSerializer
    permission_classes = [IsAuthenticated, IsRetailer]

    def get_queryset(self):
        retailer = self.request.user.user_obj
        return RetailerBid.objects.filter(retailer=retailer).order_by('-submitted_at')


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_cart_get_view(request):
    """
    GET /api/retailer/cart/

    Phase 4 — Retrieves active cart items and summary for authenticated Retailer.
    """
    from decimal import Decimal
    from .models import RetailerCartItem
    from .serializers import RetailerCartItemSerializer

    retailer = request.user.user_obj
    cart_items = RetailerCartItem.objects.filter(retailer=retailer).select_related(
        'quote', 'quote__fpo'
    ).prefetch_related('quote__allocations', 'quote__allocations__farmer', 'quote__allocations__crop_passport')

    serializer = RetailerCartItemSerializer(cart_items, many=True)
    
    total_selected_quantity = Decimal('0')
    total_cart_value_eth = Decimal('0')
    unique_fpos = set()
    unique_farmers = set()
    unique_passports = set()
    units_set = set()

    for item in cart_items:
        total_selected_quantity += item.selected_quantity
        if item.quote:
            unique_fpos.add(item.quote.fpo_id)
            if item.quote.unit:
                units_set.add(item.quote.unit)
            if item.quote.price_per_unit:
                total_cart_value_eth += (item.quote.price_per_unit * item.selected_quantity)
            for alloc in item.quote.allocations.all():
                if alloc.farmer_id:
                    unique_farmers.add(alloc.farmer_id)
                if alloc.crop_passport_id:
                    unique_passports.add(alloc.crop_passport_id)

    summary = {
        'total_items_count': cart_items.count(),
        'total_selected_quantity': str(total_selected_quantity),
        'total_cart_value_eth': str(total_cart_value_eth),
        'unique_fpos_count': len(unique_fpos),
        'unique_farmers_count': len(unique_farmers),
        'unique_passports_count': len(unique_passports),
        'units': list(units_set),
    }

    return Response({
        'items': serializer.data,
        'summary': summary
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_cart_add_item_view(request):
    """
    POST /api/retailer/cart/items/

    Phase 4 — Adds or updates a quantity reservation in Retailer Cart.
    Body: { "quote_id": <int>, "selected_quantity": <decimal> }
    """
    from django.db import transaction
    from decimal import Decimal, InvalidOperation
    from .models import RetailerCartItem
    from .serializers import RetailerCartItemSerializer

    retailer = request.user.user_obj
    quote_id = request.data.get('quote_id')
    qty_raw = request.data.get('selected_quantity')

    if not quote_id:
        return Response({'error': 'quote_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if qty_raw is None:
        return Response({'error': 'selected_quantity is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        requested_qty = Decimal(str(qty_raw))
        if requested_qty <= Decimal('0'):
            return Response({'error': 'selected_quantity must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
    except (TypeError, ValueError, InvalidOperation):
        return Response({'error': 'Invalid selected_quantity format.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        quote = get_object_or_404(FPOQuote.objects.select_for_update(), pk=quote_id)
        if quote.status != 'open':
            return Response({'error': 'This FPO quote is no longer open for purchase.'}, status=status.HTTP_400_BAD_REQUEST)

        if quote.available_quantity is None:
            quote.available_quantity = quote.quantity - (quote.reserved_quantity or Decimal('0'))

        existing_item = RetailerCartItem.objects.filter(retailer=retailer, quote=quote).first()
        existing_qty = existing_item.selected_quantity if existing_item else Decimal('0')
        diff = requested_qty - existing_qty

        if diff > quote.available_quantity:
            return Response({
                'error': f'Cannot reserve {requested_qty} {quote.unit}. Only {quote.available_quantity} {quote.unit} remaining available on quote.'
            }, status=status.HTTP_400_BAD_REQUEST)

        quote.available_quantity -= diff
        quote.reserved_quantity += diff
        quote.save()

        if existing_item:
            existing_item.selected_quantity = requested_qty
            existing_item.save()
            cart_item = existing_item
        else:
            cart_item = RetailerCartItem.objects.create(
                retailer=retailer,
                quote=quote,
                selected_quantity=requested_qty
            )

    serializer = RetailerCartItemSerializer(cart_item)
    return Response({
        'message': f'Reserved {requested_qty} {quote.unit} from Quote #{quote.id} into your cart.',
        'item': serializer.data
    }, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_cart_update_item_view(request, item_id):
    """
    PATCH /api/retailer/cart/items/<item_id>/

    Phase 4 — Updates quantity reserved for a cart item.
    Body: { "selected_quantity": <decimal> }
    """
    from django.db import transaction
    from decimal import Decimal, InvalidOperation
    from .models import RetailerCartItem
    from .serializers import RetailerCartItemSerializer

    retailer = request.user.user_obj
    qty_raw = request.data.get('selected_quantity')

    if qty_raw is None:
        return Response({'error': 'selected_quantity is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        new_qty = Decimal(str(qty_raw))
        if new_qty <= Decimal('0'):
            return Response({'error': 'selected_quantity must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
    except (TypeError, ValueError, InvalidOperation):
        return Response({'error': 'Invalid selected_quantity format.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        cart_item = get_object_or_404(RetailerCartItem.objects.select_related('quote'), pk=item_id, retailer=retailer)
        quote = FPOQuote.objects.select_for_update().get(pk=cart_item.quote_id)

        if quote.available_quantity is None:
            quote.available_quantity = quote.quantity - (quote.reserved_quantity or Decimal('0'))

        diff = new_qty - cart_item.selected_quantity

        if diff > quote.available_quantity:
            return Response({
                'error': f'Cannot increase quantity to {new_qty} {quote.unit}. Only {quote.available_quantity} {quote.unit} unreserved stock remaining on quote.'
            }, status=status.HTTP_400_BAD_REQUEST)

        quote.available_quantity -= diff
        quote.reserved_quantity += diff
        quote.save()

        cart_item.selected_quantity = new_qty
        cart_item.save()

    serializer = RetailerCartItemSerializer(cart_item)
    return Response({
        'message': f'Cart item updated to {new_qty} {quote.unit}.',
        'item': serializer.data
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_cart_delete_item_view(request, item_id):
    """
    DELETE /api/retailer/cart/items/<item_id>/delete/

    Phase 4 — Removes an item from Retailer Cart and releases reserved stock back to FPOQuote.
    """
    from django.db import transaction
    from decimal import Decimal
    from .models import RetailerCartItem

    retailer = request.user.user_obj

    with transaction.atomic():
        cart_item = get_object_or_404(RetailerCartItem.objects.select_related('quote'), pk=item_id, retailer=retailer)
        quote = FPOQuote.objects.select_for_update().get(pk=cart_item.quote_id)

        quote.available_quantity += cart_item.selected_quantity
        quote.reserved_quantity = max(Decimal('0'), quote.reserved_quantity - cart_item.selected_quantity)
        quote.save()

        cart_item.delete()

    return Response({'message': 'Item removed from cart and reserved stock released.'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_cart_clear_view(request):
    """
    DELETE /api/retailer/cart/clear/

    Phase 4 — Clears all cart items for authenticated Retailer and releases reserved stock.
    """
    from django.db import transaction
    from decimal import Decimal
    from .models import RetailerCartItem

    retailer = request.user.user_obj

    with transaction.atomic():
        cart_items = RetailerCartItem.objects.filter(retailer=retailer).select_related('quote')
        for item in cart_items:
            quote = FPOQuote.objects.select_for_update().get(pk=item.quote_id)
            if quote.available_quantity is None:
                quote.available_quantity = quote.quantity - (quote.reserved_quantity or Decimal('0'))
            quote.available_quantity += item.selected_quantity
            quote.reserved_quantity = max(Decimal('0'), quote.reserved_quantity - item.selected_quantity)
            quote.save()
            item.delete()

    return Response({'message': 'Retailer cart cleared successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_order_create_from_cart_view(request):
    """
    POST /api/retailer/orders/create-from-cart/

    Phase 4 — Converts active Retailer Cart items into commercial RetailerOrder records with complete multi-farmer provenance.
    Body: { "notes": <optional notes> }
    """
    from django.db import transaction
    from decimal import Decimal
    import uuid
    from .models import RetailerCartItem, RetailerOrder, RetailerOrderAllocation
    from .serializers import RetailerOrderSerializer

    retailer = request.user.user_obj
    notes = request.data.get('notes', '')

    cart_items = RetailerCartItem.objects.filter(retailer=retailer).select_related(
        'quote', 'quote__fpo'
    ).prefetch_related('quote__allocations', 'quote__allocations__farmer', 'quote__allocations__crop_passport')

    if not cart_items.exists():
        return Response({'error': 'Your Retailer Cart is empty. Please add items to your cart before proceeding to order.'}, status=status.HTTP_400_BAD_REQUEST)

    created_orders = []

    with transaction.atomic():
        for item in cart_items:
            quote = item.quote
            fpo = quote.fpo
            total_price = (quote.price_per_unit or Decimal('0')) * item.selected_quantity
            order_num = f"ORD-RET-{uuid.uuid4().hex[:10].upper()}"

            order = RetailerOrder.objects.create(
                order_number=order_num,
                retailer=retailer,
                fpo=fpo,
                quote=quote,
                product_name=quote.product_name,
                category=quote.category or 'General',
                quantity=item.selected_quantity,
                unit=quote.unit,
                price_per_unit=quote.price_per_unit or Decimal('0'),
                total_price=total_price,
                status='created',
                notes=notes
            )

            # Copy multi-farmer provenance allocations to RetailerOrderAllocation
            quote_allocations = quote.allocations.all()
            if quote_allocations.exists():
                quote_total_qty = quote.quantity if quote.quantity > Decimal('0') else item.selected_quantity
                ratio = item.selected_quantity / quote_total_qty

                for alloc in quote_allocations:
                    allocated_order_qty = alloc.allocated_quantity * ratio
                    RetailerOrderAllocation.objects.create(
                        order=order,
                        inventory_lot=alloc.inventory_lot,
                        farmer=alloc.farmer,
                        crop_passport=alloc.crop_passport,
                        allocated_quantity=allocated_order_qty
                    )

            item.delete()
            created_orders.append(order)

    serializer = RetailerOrderSerializer(created_orders, many=True)
    return Response({
        'message': f'Created {len(created_orders)} order(s) successfully with full multi-farmer provenance!',
        'orders': serializer.data
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_orders_my_view(request):
    """
    GET /api/retailer/orders/my/

    Phase 4 — Lists all commercial orders placed by authenticated Retailer.
    """
    from .models import RetailerOrder
    from .serializers import RetailerOrderSerializer

    retailer = request.user.user_obj
    orders = RetailerOrder.objects.filter(retailer=retailer).select_related(
        'fpo', 'quote'
    ).prefetch_related(
        'allocations', 'allocations__farmer', 'allocations__crop_passport'
    ).order_by('-created_at')

    serializer = RetailerOrderSerializer(orders, many=True)
    return Response({'orders': serializer.data})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_inventory_my_view(request):
    """
    GET /api/retailer/inventory/

    Lists all purchased crop inventory lots owned by the authenticated Retailer
    with complete multi-step supply chain provenance.
    """
    from .models import RetailerInventoryLot
    from .serializers import RetailerInventoryLotSerializer

    retailer = request.user.user_obj
    lots = RetailerInventoryLot.objects.filter(retailer=retailer).select_related(
        'fpo', 'farmer', 'crop_passport', 'inventory_lot', 'escrow'
    ).order_by('-created_at')

    serializer = RetailerInventoryLotSerializer(lots, many=True)
    return Response({'inventory': serializer.data})
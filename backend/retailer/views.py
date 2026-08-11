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
            {"message": "Registration successful. Please wait for admin approval.", "data": serializer.data},
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
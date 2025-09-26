from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import FPO
from .serializers import FPOSerializer, FPORegistrationSerializer
from common.permissions import IsFPO


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
    queryset = FPO.objects.all()
    serializer_class = FPOSerializer
    permission_classes = [IsAuthenticated, IsFPO]
    
    
# ... existing imports ...
from rest_framework.decorators import api_view, permission_classes
from common.permissions import IsFPO
from .models import FPOQuoteRequest
from .serializers import FPOQuoteRequestSerializer
from farmer.models import FarmerBid
from farmer.serializers import FarmerBidSerializer

# ... existing FPO views ...

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFPO])
def fpo_dashboard(request):
    fpo = request.user.user_obj

    my_quotes = FPOQuoteRequest.objects.filter(fpo=fpo)
    bids_received = FarmerBid.objects.filter(quote__in=my_quotes)
    
    data = {
        "my_quotes_count": my_quotes.count(),
        "bids_received_count": bids_received.count(),
        "my_quotes": FPOQuoteRequestSerializer(my_quotes, many=True).data,
    }
    return Response(data)

class FPOQuoteRequestListCreateView(generics.ListCreateAPIView):
    """
    For FPOs to list their own quotes or create a new one.
    """
    serializer_class = FPOQuoteRequestSerializer
    permission_classes = [IsAuthenticated, IsFPO]

    def get_queryset(self):
        return FPOQuoteRequest.objects.filter(fpo=self.request.user.user_obj)

    def perform_create(self, serializer):
        serializer.save(fpo=self.request.user.user_obj)

class FPOQuoteRequestDetailView(generics.RetrieveUpdateAPIView):
    """
    View or update a specific quote request. Includes all bids.
    """
    serializer_class = FPOQuoteRequestSerializer
    permission_classes = [IsAuthenticated, IsFPO]
    queryset = FPOQuoteRequest.objects.all()

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFPO])
def accept_farmer_bid(request, bid_pk):
    bid = get_object_or_404(FarmerBid, pk=bid_pk)
    quote = bid.quote

    if quote.fpo != request.user.user_obj:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    
    if quote.status != 'open':
        return Response({"error": "Quote is not open."}, status=status.HTTP_400_BAD_REQUEST)

    # Accept this bid
    bid.status = 'accepted'
    bid.save()

    # Reject other bids
    quote.bids.exclude(pk=bid.pk).update(status='rejected')
    
    # Award quote
    quote.status = 'awarded'
    quote.accepted_bid = bid
    quote.save()
    
    # Return data needed for frontend to initiate payment
    payment_details = {
        "recipient_address": bid.farmer.wallet_address,
        "amount": str(bid.bid_amount * quote.quantity), # Total amount
        "bid_id": bid.pk
    }
    
    return Response({
        "message": "Bid accepted. Please proceed with payment.",
        "payment_details": payment_details
    })
    
    
# Add these views to fpo/views.py
from retailer.models import RetailerQuoteRequest
from retailer.serializers import RetailerQuoteRequestSerializer
from .models import FPOBid
from .serializers import FPOBidSerializer

# ... existing FPO views ...

class RetailerOpenQuoteListView(generics.ListAPIView):
    """
    Lists all open quotes from Retailers that this FPO has not bid on yet.
    """
    serializer_class = RetailerQuoteRequestSerializer
    permission_classes = [IsAuthenticated, IsFPO]

    def get_queryset(self):
        fpo = self.request.user.user_obj
        return RetailerQuoteRequest.objects.filter(status='open').exclude(bids__fpo=fpo)

class FPOBidCreateView(generics.CreateAPIView):
    """
    Allows an FPO to create a bid on a specific retailer quote.
    """
    serializer_class = FPOBidSerializer
    permission_classes = [IsAuthenticated, IsFPO]

    def perform_create(self, serializer):
        quote = get_object_or_404(RetailerQuoteRequest, pk=self.kwargs['quote_pk'])
        if quote.status != 'open':
            raise serializers.ValidationError("This quote is no longer open for bidding.")
        serializer.save(fpo=self.request.user.user_obj, quote=quote)
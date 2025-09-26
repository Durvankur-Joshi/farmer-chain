from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import Retailer
from .serializers import RetailerSerializer, RetailerRegistrationSerializer
from common.permissions import IsRetailer


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
    queryset = Retailer.objects.all()
    serializer_class = RetailerSerializer
    permission_classes = [IsAuthenticated, IsRetailer]
    
    
# Update retailer/views.py with dashboard and quote management views
from fpo.models import FPOBid
from .models import RetailerQuoteRequest
from .serializers import RetailerQuoteRequestSerializer

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsRetailer])
def retailer_dashboard(request):
    retailer = request.user.user_obj

    my_quotes = RetailerQuoteRequest.objects.filter(retailer=retailer)
    bids_received = FPOBid.objects.filter(quote__in=my_quotes)
    
    data = {
        "my_quotes_count": my_quotes.count(),
        "bids_received_count": bids_received.count(),
        "my_quotes": RetailerQuoteRequestSerializer(my_quotes, many=True).data,
    }
    return Response(data)

class RetailerQuoteRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = RetailerQuoteRequestSerializer
    permission_classes = [IsAuthenticated, IsRetailer]

    def get_queryset(self):
        return RetailerQuoteRequest.objects.filter(retailer=self.request.user.user_obj)

    def perform_create(self, serializer):
        serializer.save(retailer=self.request.user.user_obj)

class RetailerQuoteRequestDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = RetailerQuoteRequestSerializer
    permission_classes = [IsAuthenticated, IsRetailer]
    queryset = RetailerQuoteRequest.objects.all()

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsRetailer])
def accept_fpo_bid(request, bid_pk):
    bid = get_object_or_404(FPOBid, pk=bid_pk)
    quote = bid.quote

    if quote.retailer != request.user.user_obj:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    
    bid.status = 'accepted'
    bid.save()
    quote.bids.exclude(pk=bid.pk).update(status='rejected')
    quote.status = 'awarded'
    quote.accepted_bid = bid
    quote.save()
    
    payment_details = {
        "recipient_address": bid.fpo.wallet_address,
        "amount": str(bid.bid_amount * quote.quantity),
        "bid_id": bid.pk,
        "content_type": "fpo.fpobid" # For payment confirmation endpoint
    }
    
    return Response({
        "message": "Bid accepted. Please proceed with payment.",
        "payment_details": payment_details
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsRetailer]) # Only retailer can confirm payment for an FPO bid
def confirm_fpo_bid_payment(request, bid_pk):
    bid = get_object_or_404(FPOBid, pk=bid_pk)
    if bid.quote.retailer != request.user.user_obj:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        
    transaction_hash = request.data.get('transaction_hash')
    if not transaction_hash:
        return Response({"error": "Transaction hash is required."}, status=status.HTTP_400_BAD_REQUEST)
        
    bid.transaction_hash = transaction_hash
    bid.payment_status = 'paid'
    bid.save()
    return Response({"message": "Payment confirmed and hash recorded."})
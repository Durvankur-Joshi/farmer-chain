from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import FPO, FPOBid, FPOQuote
from .serializers import FPOSerializer, FPORegistrationSerializer, FPOBidSerializer, FPOQuoteSerializer
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
    queryset = FPO.objects.all()
    serializer_class = FPOSerializer
    permission_classes = [IsAuthenticated, IsFPO]

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
        # Exclude quotes where FPO has already bid
        return FarmerQuote.objects.filter(status='open').exclude(bids__fpo=fpo)

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
        "bid_id": bid.pk
    })
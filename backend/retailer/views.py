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
    queryset = Retailer.objects.all()
    serializer_class = RetailerSerializer
    permission_classes = [IsAuthenticated, IsRetailer]

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
        return FPOQuote.objects.filter(status='open').exclude(bids__retailer=retailer)

class RetailerBidCreateView(generics.CreateAPIView):
    serializer_class = RetailerBidSerializer
    permission_classes = [IsAuthenticated, IsRetailer]

    def perform_create(self, serializer):
        quote = get_object_or_404(FPOQuote, pk=self.kwargs['quote_pk'])
        if quote.status != 'open':
            raise serializers.ValidationError("This quote is no longer open for bidding.")
        serializer.save(retailer=self.request.user.user_obj, quote=quote)

class MyBidsListView(generics.ListAPIView):
    serializer_class = MyBidSerializer
    permission_classes = [IsAuthenticated, IsRetailer]

    def get_queryset(self):
        retailer = self.request.user.user_obj
        return RetailerBid.objects.filter(retailer=retailer).order_by('-submitted_at')
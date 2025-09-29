from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import Farmer, FarmerQuote
from django.utils import timezone
from .serializers import FarmerSerializer, FarmerRegistrationSerializer, FarmerQuoteSerializer
from common.permissions import IsFarmer
from fpo.models import FPOBid
from fpo.serializers import FPOBidSerializer


class FarmerRegistrationView(generics.CreateAPIView):
    queryset = Farmer.objects.all()
    serializer_class = FarmerRegistrationSerializer
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
def farmer_login_check(request):
    email = request.data.get('email')
    
    try:
        farmer = Farmer.objects.get(email=email)
        if farmer.approval_status == 'pending':
            return Response({
                'message': 'Your account is pending admin approval. Please wait for approval to login.',
                'approved': False,
                'status': 'pending'
            }, status=status.HTTP_200_OK)
        elif farmer.approval_status == 'rejected':
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
    except Farmer.DoesNotExist:
        return Response({
            'message': 'Farmer not found with this email.',
            'approved': False,
            'status': 'not_found'
        }, status=status.HTTP_404_NOT_FOUND)

class FarmerListView(generics.ListAPIView):
    queryset = Farmer.objects.all()
    serializer_class = FarmerSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

class FarmerDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Farmer.objects.all()
    serializer_class = FarmerSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFarmer])
def farmer_dashboard(request):
    farmer = request.user.user_obj
    
    my_quotes = FarmerQuote.objects.filter(farmer=farmer)
    bids_received = FPOBid.objects.filter(quote__in=my_quotes)

    data = {
        "my_quotes_count": my_quotes.count(),
        "bids_received_count": bids_received.count(),
        "active_quotes": my_quotes.filter(status='open').count(),
        "awarded_quotes": my_quotes.filter(status='awarded').count(),
    }
    return Response(data)

class FarmerQuoteListCreateView(generics.ListCreateAPIView):
    serializer_class = FarmerQuoteSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

    def get_queryset(self):
        return FarmerQuote.objects.filter(farmer=self.request.user.user_obj)

    def perform_create(self, serializer):
        serializer.save(farmer=self.request.user.user_obj)

class FarmerQuoteDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = FarmerQuoteSerializer
    permission_classes = [IsAuthenticated, IsFarmer]
    queryset = FarmerQuote.objects.all()

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def accept_fpo_bid(request, bid_pk):
    bid = get_object_or_404(FPOBid, pk=bid_pk)
    quote = bid.quote

    if quote.farmer != request.user.user_obj:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    
    if quote.status != 'open':
        return Response({"error": "Quote is not open for bidding."}, status=status.HTTP_400_BAD_REQUEST)

    # Accept this bid
    bid.status = 'accepted'
    bid.save()

    # Update quote status to 'accepted' (contract will be created in frontend)
    quote.status = 'accepted'
    quote.accepted_bid = bid
    quote.save()
    
    return Response({
        "message": "Bid accepted successfully. You can now create the smart contract.",
        "bid_id": bid.pk,
        "quote_id": quote.id,
        "quote_status": quote.status,
        "next_step": "create_smart_contract"  # Indicate next step
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsFarmer])
def update_contract_address(request, quote_id):
    """Update the contract address after smart contract creation"""
    quote = get_object_or_404(FarmerQuote, id=quote_id)
    
    # Check if the farmer owns this quote
    if quote.farmer != request.user.user_obj:
        return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    
    contract_address = request.data.get('contract_address')
    if not contract_address:
        return Response({"error": "Contract address is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate Ethereum address format
    if not contract_address.startswith('0x') or len(contract_address) != 42:
        return Response({"error": "Invalid contract address format"}, status=status.HTTP_400_BAD_REQUEST)
    
    quote.contract_address = contract_address
    quote.status = 'contract_created'
    quote.contract_created_at = timezone.now()
    quote.save()
    
    return Response({
        "message": "Contract address updated successfully",
        "contract_address": contract_address,
        "quote_id": quote.id
    })


@api_view(['GET'])
@permission_classes([AllowAny])  # Public access
def get_contract_details(request, contract_address):
    """Get contract details for public viewing"""
    quote = get_object_or_404(FarmerQuote, contract_address=contract_address)
    
    serializer = FarmerQuoteSerializer(quote)
    
    # Include additional contract information
    response_data = {
        'quote': serializer.data,
        'contract_address': contract_address,
        'farmer_info': {
            'name': quote.farmer.name,
            'location': f"{quote.farmer.city}, {quote.farmer.state}"
        },
        'fpo_info': None,
        'retailer_info': None
    }
    
    # If there's an accepted bid, include FPO info
    if quote.accepted_bid:
        response_data['fpo_info'] = {
            'name': quote.accepted_bid.fpo.name,
            'email': quote.accepted_bid.fpo.email
        }
    
    return Response(response_data)
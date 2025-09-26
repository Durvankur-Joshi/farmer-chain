from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import Farmer
from .serializers import FarmerSerializer, FarmerRegistrationSerializer
from common.permissions import IsFarmer


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
    
    
# ... existing imports ...
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from common.permissions import IsFarmer
from fpo.models import FPOQuoteRequest
from .models import FarmerBid
from .serializers import FarmerBidSerializer
from fpo.serializers import FPOQuoteRequestSerializer

# ... existing Farmer views ...

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFarmer])
def farmer_dashboard(request):
    farmer = request.user.user_obj # Assuming custom auth sets this
    
    # Open quotes farmer can bid on
    open_quotes = FPOQuoteRequest.objects.filter(status='open').exclude(bids__farmer=farmer)
    
    # Farmer's active bids
    my_bids = FarmerBid.objects.filter(farmer=farmer)

    data = {
        "open_quotes_count": open_quotes.count(),
        "my_bids_count": my_bids.count(),
        "my_bids": FarmerBidSerializer(my_bids, many=True).data,
    }
    return Response(data)

class OpenQuoteListView(generics.ListAPIView):
    """
    Lists all open quotes from FPOs that this farmer has not bid on yet.
    """
    serializer_class = FPOQuoteRequestSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

    def get_queryset(self):
        farmer = self.request.user.user_obj
        return FPOQuoteRequest.objects.filter(status='open').exclude(bids__farmer=farmer)

class FarmerBidCreateView(generics.CreateAPIView):
    """
    Allows a farmer to create a bid on a specific FPO quote.
    """
    serializer_class = FarmerBidSerializer
    permission_classes = [IsAuthenticated, IsFarmer]

    def perform_create(self, serializer):
        quote = get_object_or_404(FPOQuoteRequest, pk=self.kwargs['quote_pk'])
        if quote.status != 'open':
            raise serializers.ValidationError("This quote is no longer open for bidding.")
        serializer.save(farmer=self.request.user.user_obj, quote=quote)
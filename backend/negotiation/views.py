# backend/negotiation/views.py

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import get_object_or_404
from .models import Negotiation, NegotiationMessage
from .serializers import NegotiationSerializer, CounterOfferSerializer

def get_bid_and_user_type(content_type_str, object_id):
    """Helper to get bid object and validate user type."""
    try:
        app_label, model = content_type_str.split('.')
        content_type = ContentType.objects.get(app_label=app_label, model=model)
        ModelClass = content_type.model_class()
        bid = get_object_or_404(ModelClass, pk=object_id)
        return bid
    except (ContentType.DoesNotExist, ValueError):
        return None

class StartNegotiationView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        content_type_str = request.data.get('content_type') # e.g., 'farmer.farmerbid'
        object_id = request.data.get('object_id')
        
        bid = get_bid_and_user_type(content_type_str, object_id)
        if not bid:
            return Response({"error": "Invalid bid type."}, status=status.HTTP_400_BAD_REQUEST)

        # Check permissions: only the buyer can start a negotiation
        buyer = bid.quote.fpo if hasattr(bid.quote, 'fpo') else bid.quote.retailer
        
        # --- FIX #1: Changed request.user.user_id to request.user.id ---
        if buyer.id != request.user.id:
            return Response({"error": "Only the quote creator can start a negotiation."}, status=status.HTTP_403_FORBIDDEN)
            
        negotiation, created = Negotiation.objects.get_or_create(
            content_type=ContentType.objects.get_for_model(bid),
            object_id=bid.id
        )

        if not created:
            return Response({"message": "Negotiation already exists.", "negotiation_id": negotiation.id})
            
        # Create initial message
        NegotiationMessage.objects.create(
            negotiation=negotiation,
            sender_role=request.user.role,
            # --- FIX #2: Changed request.user.user_id to request.user.id ---
            sender_id=request.user.id,
            sender_name=request.user.name,
            message=f"Negotiation started for bid amount {bid.bid_amount}."
        )

        serializer = NegotiationSerializer(negotiation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class NegotiationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        negotiation = get_object_or_404(Negotiation, pk=pk)
        # Add permission check here
        serializer = NegotiationSerializer(negotiation)
        return Response(serializer.data)

    def post(self, request, pk):
        negotiation = get_object_or_404(Negotiation, pk=pk)
        serializer = CounterOfferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        NegotiationMessage.objects.create(
            negotiation=negotiation,
            sender_role=request.user.role,
            # --- FIX #3: Changed request.user.user_id to request.user.id ---
            sender_id=request.user.id,
            sender_name=request.user.name,
            **serializer.validated_data
        )
        return Response(NegotiationSerializer(negotiation).data, status=status.HTTP_201_CREATED)
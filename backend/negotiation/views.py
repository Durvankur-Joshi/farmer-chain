from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import get_object_or_404
from .models import Negotiation, NegotiationMessage
from .serializers import NegotiationSerializer, CounterOfferSerializer
from rest_framework import serializers  # Add this import

def get_bid_model_instance(content_type_str, object_id):
    """Helper to get a bid object instance from its content type string and ID."""
    try:
        app_label, model = content_type_str.split('.')
        content_type = ContentType.objects.get(app_label=app_label, model=model)
        ModelClass = content_type.model_class()
        bid = get_object_or_404(ModelClass, pk=object_id)
        return bid
    except (ContentType.DoesNotExist, ValueError):
        return None

def check_negotiation_permission(user, negotiation):
    """Checks if a user is part of a negotiation (either bidder or quote owner)."""
    bid = negotiation.bid
    quote = bid.quote
    
    current_user_obj = user.user_obj
    
    # Identify the bidder (FPO or Retailer)
    bidder = getattr(bid, 'fpo', None) or getattr(bid, 'retailer', None)
    
    # Identify the quote owner (Farmer or FPO)
    quote_owner = getattr(quote, 'farmer', None) or getattr(quote, 'fpo', None)

    return current_user_obj == bidder or current_user_obj == quote_owner


class StartNegotiationView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        content_type_str = request.data.get('content_type') # e.g., 'retailer.retailerbid'
        object_id = request.data.get('object_id')
        
        bid = get_bid_model_instance(content_type_str, object_id)
        if not bid:
            return Response({"error": "Invalid bid type or ID."}, status=status.HTTP_400_BAD_REQUEST)

        # Correctly identify the owner of the quote the bid was placed on
        quote = bid.quote
        quote_owner = getattr(quote, 'farmer', None) or getattr(quote, 'fpo', None)

        if not quote_owner:
            return Response({"error": "Could not determine the quote owner."}, status=status.HTTP_400_BAD_REQUEST)

        # Check permissions: only the quote owner can start a negotiation.
        if quote_owner.id != request.user.user_obj.id:
            return Response({"error": "Only the quote creator can start a negotiation."}, status=status.HTTP_403_FORBIDDEN)
            
        negotiation, created = Negotiation.objects.get_or_create(
            content_type=ContentType.objects.get_for_model(bid),
            object_id=bid.id
        )

        if not created:
            serializer = NegotiationSerializer(negotiation)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        # Create initial message
        sender_user = request.user.user_obj
        NegotiationMessage.objects.create(
            negotiation=negotiation,
            sender_role=request.user.role,
            sender_id=sender_user.id,
            sender_name=sender_user.name,
            message=f"Negotiation started for bid on '{bid.quote.product_name}'."
        )

        serializer = NegotiationSerializer(negotiation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class NegotiationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        negotiation = get_object_or_404(Negotiation, pk=pk)
        
        if not check_negotiation_permission(request.user, negotiation):
            return Response({"error": "You do not have permission to view this negotiation."}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = NegotiationSerializer(negotiation)
        return Response(serializer.data)

    def post(self, request, pk):
        negotiation = get_object_or_404(Negotiation, pk=pk)
        
        if not check_negotiation_permission(request.user, negotiation):
            return Response({"error": "You do not have permission to post in this negotiation."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CounterOfferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        sender_user = request.user.user_obj
        NegotiationMessage.objects.create(
            negotiation=negotiation,
            sender_role=request.user.role,
            sender_id=sender_user.id,
            sender_name=sender_user.name,
            **serializer.validated_data
        )
        return Response(NegotiationSerializer(negotiation).data, status=status.HTTP_201_CREATED)
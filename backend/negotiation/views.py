from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import get_object_or_404
from .models import Negotiation, NegotiationMessage
from .serializers import NegotiationSerializer, CounterOfferSerializer
from rest_framework import serializers  # Add this import
from common.events import emit_event

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
    if not bid:
        return False
    quote = getattr(bid, 'quote', None)
    if not quote:
        return False
    
    current_user_obj = getattr(user, 'user_obj', None)
    if not current_user_obj:
        return False
    
    bidder = getattr(bid, 'fpo', None) or getattr(bid, 'retailer', None)
    quote_owner = getattr(quote, 'farmer', None) or getattr(quote, 'fpo', None)

    return (current_user_obj.id == getattr(bidder, 'id', None)) or (current_user_obj.id == getattr(quote_owner, 'id', None))


class StartNegotiationView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        content_type_str = request.data.get('content_type') # e.g., 'retailer.retailerbid' or 'fpo.fpobid'
        object_id = request.data.get('object_id')
        
        bid = get_bid_model_instance(content_type_str, object_id)
        if not bid:
            return Response({"error": "Invalid bid type or ID."}, status=status.HTTP_400_BAD_REQUEST)

        quote = bid.quote
        quote_owner = getattr(quote, 'farmer', None) or getattr(quote, 'fpo', None)
        bidder = getattr(bid, 'fpo', None) or getattr(bid, 'retailer', None)

        user_obj = request.user.user_obj
        if user_obj.id != getattr(quote_owner, 'id', None) and user_obj.id != getattr(bidder, 'id', None):
            return Response({"error": "Only negotiation participants can initiate chat/negotiation."}, status=status.HTTP_403_FORBIDDEN)
            
        negotiation, created = Negotiation.objects.get_or_create(
            content_type=ContentType.objects.get_for_model(bid),
            object_id=bid.id
        )

        if created:
            NegotiationMessage.objects.create(
                negotiation=negotiation,
                sender_role=request.user.role,
                sender_id=user_obj.id,
                sender_name=user_obj.name,
                message=f"Negotiation channel opened for bid on '{bid.quote.product_name}'."
            )

        serializer = NegotiationSerializer(negotiation)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class NegotiationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        negotiation = get_object_or_404(Negotiation, pk=pk)
        
        if not check_negotiation_permission(request.user, negotiation):
            return Response({"error": "You do not have permission to view this negotiation."}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = NegotiationSerializer(negotiation)
        return Response(serializer.data)

    def post(self, request, pk):
        from django.db import transaction
        negotiation = get_object_or_404(Negotiation, pk=pk)
        
        if not check_negotiation_permission(request.user, negotiation):
            return Response({"error": "You do not have permission to post in this negotiation."}, status=status.HTTP_403_FORBIDDEN)

        if negotiation.status != 'active':
            return Response({"error": f"Negotiation is currently '{negotiation.status}' and closed to new offers."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CounterOfferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user_obj = request.user.user_obj
        with transaction.atomic():
            msg = NegotiationMessage.objects.create(
                negotiation=negotiation,
                sender_role=request.user.role,
                sender_id=user_obj.id,
                sender_name=user_obj.name,
                **serializer.validated_data
            )
            negotiation.save()

        emit_event("bid_updated", {"negotiation_id": negotiation.pk})
        return Response(NegotiationSerializer(negotiation).data, status=status.HTTP_201_CREATED)


class AcceptNegotiationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.db import transaction
        from decimal import Decimal

        negotiation = get_object_or_404(Negotiation, pk=pk)
        if not check_negotiation_permission(request.user, negotiation):
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        if negotiation.status != 'active':
            return Response({"error": f"Negotiation is already {negotiation.status}."}, status=status.HTTP_400_BAD_REQUEST)

        user_obj = request.user.user_obj
        bid = negotiation.bid

        # Find latest counter offer or default to bid amount
        last_counter = negotiation.messages.filter(counter_amount__isnull=False).last()
        final_price = last_counter.counter_amount if last_counter and last_counter.counter_amount else getattr(bid, 'bid_amount', None)
        final_qty = last_counter.counter_quantity if last_counter and last_counter.counter_quantity else getattr(bid.quote, 'quantity', None)

        with transaction.atomic():
            negotiation.status = 'accepted'
            negotiation.agreed_price_per_unit = final_price
            negotiation.agreed_quantity = final_qty
            negotiation.save()

            if hasattr(bid, 'status'):
                bid.status = 'accepted'
                bid.save()

            NegotiationMessage.objects.create(
                negotiation=negotiation,
                sender_role=request.user.role,
                sender_id=user_obj.id,
                sender_name=user_obj.name,
                message=f"🤝 Agreement Accepted! Final price locked at {final_price} ETH per unit."
            )

        emit_event("deal_updated", {"negotiation_id": negotiation.pk, "status": "accepted"})
        emit_event("bid_updated", {"negotiation_id": negotiation.pk, "status": "accepted"})
        return Response({
            "message": "Negotiation accepted successfully. Price and quantity locked.",
            "negotiation": NegotiationSerializer(negotiation).data
        })


class RejectNegotiationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.db import transaction

        negotiation = get_object_or_404(Negotiation, pk=pk)
        if not check_negotiation_permission(request.user, negotiation):
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        if negotiation.status != 'active':
            return Response({"error": f"Negotiation is already {negotiation.status}."}, status=status.HTTP_400_BAD_REQUEST)

        user_obj = request.user.user_obj
        with transaction.atomic():
            negotiation.status = 'rejected'
            negotiation.save()

            NegotiationMessage.objects.create(
                negotiation=negotiation,
                sender_role=request.user.role,
                sender_id=user_obj.id,
                sender_name=user_obj.name,
                message="❌ Negotiation rejected."
            )

        emit_event("bid_updated", {"negotiation_id": negotiation.pk, "status": "rejected"})
        return Response({
            "message": "Negotiation rejected.",
            "negotiation": NegotiationSerializer(negotiation).data
        })


class WithdrawNegotiationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.db import transaction

        negotiation = get_object_or_404(Negotiation, pk=pk)
        if not check_negotiation_permission(request.user, negotiation):
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        if negotiation.status != 'active':
            return Response({"error": f"Negotiation is already {negotiation.status}."}, status=status.HTTP_400_BAD_REQUEST)

        user_obj = request.user.user_obj
        with transaction.atomic():
            negotiation.status = 'withdrawn'
            negotiation.save()

            NegotiationMessage.objects.create(
                negotiation=negotiation,
                sender_role=request.user.role,
                sender_id=user_obj.id,
                sender_name=user_obj.name,
                message="⚠️ Negotiation withdrawn."
            )

        emit_event("bid_updated", {"negotiation_id": negotiation.pk, "status": "withdrawn"})
        return Response({
            "message": "Negotiation withdrawn.",
            "negotiation": NegotiationSerializer(negotiation).data
        })
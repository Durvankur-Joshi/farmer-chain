from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from farmer.models import Farmer
from fpo.models import FPO
from retailer.models import Retailer
from .models import Reputation
from .services import get_or_update_reputation
from .serializers import PublicReputationSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_reputation_view(request):
    """
    GET /api/reputation/me/

    Returns the authenticated user's trust score and reputation summary.
    Never trusts user ID or role from request body.
    """
    user_obj = getattr(request.user, 'user_obj', None)
    role = getattr(request.user, 'role', None)

    if not user_obj or not role:
        return Response(
            {'error': 'Authentication context missing user object or role.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if role not in [Reputation.ROLE_FARMER, Reputation.ROLE_FPO, Reputation.ROLE_RETAILER]:
        return Response(
            {'error': f"Reputation tracking is not available for role '{role}'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    rep = get_or_update_reputation(role=role, user_id=user_obj.pk, user_obj=user_obj)

    # Determine Tier
    score = rep.trust_score
    if score >= 90:
        tier = "Champion Partner ⭐⭐⭐"
    elif score >= 75:
        tier = "Trusted Partner ⭐⭐"
    elif score >= 60:
        tier = "Verified Member ⭐"
    else:
        tier = "Building Trust 🌱"

    return Response({
        'role': role,
        'user_id': user_obj.pk,
        'display_name': getattr(user_obj, 'name', 'User'),
        'did': getattr(user_obj, 'did', None),
        'wallet_address': getattr(user_obj, 'wallet_address', None),
        'trust_score': rep.trust_score,
        'completed_transactions': rep.completed_transactions,
        'verified_activities': rep.verified_activities,
        'trust_tier': tier,
        'updated_at': rep.updated_at,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def public_reputation_view(request, role, user_id):
    """
    GET /api/reputation/<role>/<id>/

    Public profile reputation view.
    Returns only safe public information (no email, aadhaar, password, private keys).
    """
    role = role.lower()

    if role == Reputation.ROLE_FARMER:
        user_obj = get_object_or_404(Farmer, pk=user_id)
    elif role == Reputation.ROLE_FPO:
        user_obj = get_object_or_404(FPO, pk=user_id)
    elif role == Reputation.ROLE_RETAILER:
        user_obj = get_object_or_404(Retailer, pk=user_id)
    else:
        return Response(
            {'error': f"Invalid role '{role}'. Expected 'farmer', 'fpo', or 'retailer'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    rep = get_or_update_reputation(role=role, user_id=user_obj.pk, user_obj=user_obj)

    payload = {
        'role': role,
        'user_id': user_obj.pk,
        'display_name': user_obj.name,
        'did': getattr(user_obj, 'did', None),
        'wallet_address': getattr(user_obj, 'wallet_address', None),
        'trust_score': rep.trust_score,
        'completed_transactions': rep.completed_transactions,
        'verified_activities': rep.verified_activities,
        'updated_at': rep.updated_at,
    }

    serializer = PublicReputationSerializer(payload)
    return Response(serializer.data)

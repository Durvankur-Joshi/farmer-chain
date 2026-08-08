"""
DID App Views
=============
Provides two endpoints:

1.  GET /api/did/me/
    Authenticated (JWT cookie). Returns the logged-in user's DID,
    wallet address, role, and DID creation timestamp.
    Works for Farmer, FPO, Retailer, and Admin via the project's
    existing CustomJWTAuthentication that sets request.user.user_obj.

2.  GET /api/did/<did>/
    Public (no auth). Resolves any valid DID to its public
    identity document. Returns 404 if the DID is unknown.
    NEVER exposes: password, email, aadhaar, GSTIN, CIN.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from farmer.models import Farmer
from fpo.models import FPO
from retailer.models import Retailer
from admin_app.models import Admin


# ---------------------------------------------------------------------------
# Helper: extract did + wallet from the attached user_obj
# ---------------------------------------------------------------------------
def _did_info_from_user(request):
    """
    Return (did, wallet_address) from the custom user object injected
    by CustomJWTAuthentication.  Returns None, None if not available.
    """
    user_obj = getattr(request.user, 'user_obj', None)
    if user_obj is None:
        return None, None
    did = getattr(user_obj, 'did', None)
    wallet = getattr(user_obj, 'wallet_address', None)
    created_at = getattr(user_obj, 'did_created_at', None)
    return did, wallet, created_at


# ---------------------------------------------------------------------------
# GET /api/did/me/
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def did_me(request):
    """
    Returns the current authenticated user's DID identity document.
    Works for all four roles: farmer, fpo, retailer, admin.
    """
    user = request.user
    user_obj = getattr(user, 'user_obj', None)

    if user_obj is None:
        return Response(
            {'error': 'User identity could not be resolved.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    did = getattr(user_obj, 'did', None)
    if not did:
        return Response(
            {'error': 'DID not found for this account. Contact support.'},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response({
        'did': did,
        'wallet_address': getattr(user_obj, 'wallet_address', None),
        'role': getattr(user, 'role', None),
        'created_at': getattr(user_obj, 'did_created_at', None),
    })


# ---------------------------------------------------------------------------
# GET /api/did/<did>/   (public — no auth required)
# ---------------------------------------------------------------------------
@api_view(['GET'])
@permission_classes([AllowAny])
def did_resolve(request, did):
    """
    Public DID resolution endpoint.
    Searches all four user tables for the given DID.
    Returns only non-sensitive public identity fields.
    """
    # Normalise: trim whitespace
    did = did.strip()

    # Try Farmer
    try:
        farmer = Farmer.objects.get(did=did)
        return Response({
            'did': farmer.did,
            'role': 'farmer',
            'name': farmer.name,
            'wallet_address': farmer.wallet_address,
            'city': farmer.city,
            'state': farmer.state,
            'created_at': farmer.did_created_at,
        })
    except Farmer.DoesNotExist:
        pass

    # Try FPO
    try:
        fpo = FPO.objects.get(did=did)
        return Response({
            'did': fpo.did,
            'role': 'fpo',
            'name': fpo.name,
            'wallet_address': fpo.wallet_address,
            'city': fpo.city,
            'state': fpo.state,
            'created_at': fpo.did_created_at,
        })
    except FPO.DoesNotExist:
        pass

    # Try Retailer
    try:
        retailer = Retailer.objects.get(did=did)
        return Response({
            'did': retailer.did,
            'role': 'retailer',
            'name': retailer.name,
            'wallet_address': retailer.wallet_address,
            'city': retailer.city,
            'state': retailer.state,
            'created_at': retailer.did_created_at,
        })
    except Retailer.DoesNotExist:
        pass

    # Try Admin
    try:
        admin = Admin.objects.get(did=did)
        return Response({
            'did': admin.did,
            'role': 'admin',
            'name': admin.username,
            'wallet_address': admin.wallet_address,
            'created_at': admin.did_created_at,
        })
    except Admin.DoesNotExist:
        pass

    # Nothing found
    return Response(
        {'error': f'DID not found: {did}'},
        status=status.HTTP_404_NOT_FOUND
    )

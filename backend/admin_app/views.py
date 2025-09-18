from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import Admin
from .serializers import AdminSerializer, AdminRegistrationSerializer
from common.permissions import IsAdminApp
from farmer.models import Farmer
from fpo.models import FPO
from retailer.models import Retailer
from farmer.serializers import FarmerSerializer
from fpo.serializers import FPOSerializer
from retailer.serializers import RetailerSerializer


class AdminRegistrationView(generics.CreateAPIView):
    queryset = Admin.objects.all()
    serializer_class = AdminRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {"message": "Admin registered successfully", "data": serializer.data},
            status=status.HTTP_201_CREATED,
            headers=headers
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login_check(request):
    username = request.data.get('username')
    
    try:
        admin = Admin.objects.get(username=username)
        return Response({
            'message': 'Admin account found. You can proceed to login.',
            'approved': True,
            'status': 'approved'
        }, status=status.HTTP_200_OK)
    except Admin.DoesNotExist:
        return Response({
            'message': 'Admin not found with this username.',
            'approved': False,
            'status': 'not_found'
        }, status=status.HTTP_404_NOT_FOUND)


class AdminListView(generics.ListAPIView):
    queryset = Admin.objects.all()
    serializer_class = AdminSerializer
    permission_classes = [IsAuthenticated, IsAdminApp]


class AdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Admin.objects.all()
    serializer_class = AdminSerializer
    permission_classes = [IsAuthenticated, IsAdminApp]


# New views for admin approval system
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminApp])
def pending_registrations(request):
    pending_farmers = Farmer.objects.filter(approval_status='pending')
    pending_fpos = FPO.objects.filter(approval_status='pending')
    pending_retailers = Retailer.objects.filter(approval_status='pending')
    
    farmer_serializer = FarmerSerializer(pending_farmers, many=True)
    fpo_serializer = FPOSerializer(pending_fpos, many=True)
    retailer_serializer = RetailerSerializer(pending_retailers, many=True)
    
    return Response({
        'farmers': farmer_serializer.data,
        'fpos': fpo_serializer.data,
        'retailers': retailer_serializer.data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminApp])
def approve_farmer(request, farmer_id):
    farmer = get_object_or_404(Farmer, id=farmer_id)
    farmer.approval_status = 'approved'
    farmer.save()
    return Response({'message': 'Farmer approved successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminApp])
def reject_farmer(request, farmer_id):
    farmer = get_object_or_404(Farmer, id=farmer_id)
    farmer.approval_status = 'rejected'
    farmer.save()
    return Response({'message': 'Farmer rejected successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminApp])
def approve_fpo(request, fpo_id):
    fpo = get_object_or_404(FPO, id=fpo_id)
    fpo.approval_status = 'approved'
    fpo.save()
    return Response({'message': 'FPO approved successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminApp])
def reject_fpo(request, fpo_id):
    fpo = get_object_or_404(FPO, id=fpo_id)
    fpo.approval_status = 'rejected'
    fpo.save()
    return Response({'message': 'FPO rejected successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminApp])
def approve_retailer(request, retailer_id):
    retailer = get_object_or_404(Retailer, id=retailer_id)
    retailer.approval_status = 'approved'
    retailer.save()
    return Response({'message': 'Retailer approved successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminApp])
def reject_retailer(request, retailer_id):
    retailer = get_object_or_404(Retailer, id=retailer_id)
    retailer.approval_status = 'rejected'
    retailer.save()
    return Response({'message': 'Retailer rejected successfully'})
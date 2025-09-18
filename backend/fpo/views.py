from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from .models import FPO
from .serializers import FPOSerializer, FPORegistrationSerializer
from common.permissions import IsFPO


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
from django.urls import path
from .views import (
    StartNegotiationView, NegotiationDetailView,
    AcceptNegotiationView, RejectNegotiationView, WithdrawNegotiationView
)

urlpatterns = [
    path('start/', StartNegotiationView.as_view(), name='start-negotiation'),
    path('<int:pk>/', NegotiationDetailView.as_view(), name='negotiation-detail'),
    path('<int:pk>/accept/', AcceptNegotiationView.as_view(), name='accept-negotiation'),
    path('<int:pk>/reject/', RejectNegotiationView.as_view(), name='reject-negotiation'),
    path('<int:pk>/withdraw/', WithdrawNegotiationView.as_view(), name='withdraw-negotiation'),
]
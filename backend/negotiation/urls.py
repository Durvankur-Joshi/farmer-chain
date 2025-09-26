from django.urls import path
from .views import StartNegotiationView, NegotiationDetailView

urlpatterns = [
    path('start/', StartNegotiationView.as_view(), name='start-negotiation'),
    path('<int:pk>/', NegotiationDetailView.as_view(), name='negotiation-detail'),
    # You would add accept/reject views here as well, similar to the bid acceptance logic
]
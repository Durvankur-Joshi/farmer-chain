from django.urls import path
from .views import my_reputation_view, public_reputation_view

urlpatterns = [
    path('me/', my_reputation_view, name='reputation-me'),
    path('<str:role>/<int:user_id>/', public_reputation_view, name='reputation-public'),
]

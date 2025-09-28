from django.urls import path
from .views import (
    RetailerRegistrationView, RetailerListView, RetailerDetailView,MyBidsListView, retailer_login_check,
    retailer_dashboard, FPOOpenQuoteListView, RetailerBidCreateView
)

urlpatterns = [
    path('register/', RetailerRegistrationView.as_view(), name='retailer-register'),
    path('login-check/', retailer_login_check, name='retailer-login-check'),
    path('', RetailerListView.as_view(), name='retailer-list'),
    path('<int:pk>/', RetailerDetailView.as_view(), name='retailer-detail'),
    path('dashboard/', retailer_dashboard, name='retailer-dashboard'),
    path('quotes/fpo/open/', FPOOpenQuoteListView.as_view(), name='retailer-fpo-open-quotes'),
    path('quotes/fpo/<int:quote_pk>/bids/', RetailerBidCreateView.as_view(), name='retailer-create-bid-on-fpo-quote'),
    path('bids/my/', MyBidsListView.as_view(), name='retailer-my-bids'),
]
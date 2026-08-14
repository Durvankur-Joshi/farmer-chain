from django.urls import path
from .views import (
    RetailerRegistrationView, RetailerListView, RetailerDetailView, MyBidsListView, retailer_login_check,
    retailer_dashboard, FPOOpenQuoteListView, RetailerBidCreateView,
    retailer_cart_get_view, retailer_cart_add_item_view, retailer_cart_update_item_view,
    retailer_cart_delete_item_view, retailer_cart_clear_view,
    retailer_order_create_from_cart_view, retailer_orders_my_view,
    retailer_inventory_my_view
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
    path('cart/', retailer_cart_get_view, name='retailer-cart-get'),
    path('cart/items/', retailer_cart_add_item_view, name='retailer-cart-add-item'),
    path('cart/items/<int:item_id>/', retailer_cart_update_item_view, name='retailer-cart-update-item'),
    path('cart/items/<int:item_id>/delete/', retailer_cart_delete_item_view, name='retailer-cart-delete-item'),
    path('cart/clear/', retailer_cart_clear_view, name='retailer-cart-clear'),
    path('orders/create-from-cart/', retailer_order_create_from_cart_view, name='retailer-order-create-from-cart'),
    path('orders/my/', retailer_orders_my_view, name='retailer-orders-my'),
    path('inventory/', retailer_inventory_my_view, name='retailer-inventory-my'),
]
"""
Phase 2.5 — Escrow URL routing.
"""
from django.urls import path
from .views import (
    create_escrow,
    escrow_created_onchain,
    escrow_funded,
    escrow_delivery_confirm,
    escrow_released,
    escrow_detail,
    escrow_my_list,
    # Retailer escrow views
    create_retailer_escrow,
    retailer_escrow_created_onchain,
    retailer_escrow_funded,
    retailer_escrow_delivery_confirm,
    retailer_escrow_released,
    retailer_escrow_detail,
    retailer_escrow_my_list,
)

urlpatterns = [
    # Farmer ↔ FPO Escrow
    path('create/',                         create_escrow,          name='escrow-create'),
    path('<int:escrow_pk>/created-onchain/', escrow_created_onchain, name='escrow-created-onchain'),
    path('<int:escrow_pk>/funded/',          escrow_funded,          name='escrow-funded'),
    path('<int:escrow_pk>/delivery-confirm/', escrow_delivery_confirm, name='escrow-delivery-confirm'),
    path('<int:escrow_pk>/released/',        escrow_released,        name='escrow-released'),
    path('<int:escrow_pk>/',                 escrow_detail,          name='escrow-detail'),
    path('my/',                              escrow_my_list,         name='escrow-my-list'),

    # FPO ↔ Retailer Escrow
    path('retailer/create/',                         create_retailer_escrow,          name='retailer-escrow-create'),
    path('retailer/<int:escrow_pk>/created-onchain/', retailer_escrow_created_onchain, name='retailer-escrow-created-onchain'),
    path('retailer/<int:escrow_pk>/funded/',          retailer_escrow_funded,          name='retailer-escrow-funded'),
    path('retailer/<int:escrow_pk>/delivery-confirm/', retailer_escrow_delivery_confirm, name='retailer-escrow-delivery-confirm'),
    path('retailer/<int:escrow_pk>/released/',        retailer_escrow_released,        name='retailer-escrow-released'),
    path('retailer/<int:escrow_pk>/',                 retailer_escrow_detail,          name='retailer-escrow-detail'),
    path('retailer/my/',                              retailer_escrow_my_list,         name='retailer-escrow-my-list'),
]

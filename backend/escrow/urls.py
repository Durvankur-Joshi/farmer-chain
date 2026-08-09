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
)

urlpatterns = [
    path('create/',                         create_escrow,          name='escrow-create'),
    path('<int:escrow_pk>/created-onchain/', escrow_created_onchain, name='escrow-created-onchain'),
    path('<int:escrow_pk>/funded/',          escrow_funded,          name='escrow-funded'),
    path('<int:escrow_pk>/delivery-confirm/', escrow_delivery_confirm, name='escrow-delivery-confirm'),
    path('<int:escrow_pk>/released/',        escrow_released,        name='escrow-released'),
    path('<int:escrow_pk>/',                 escrow_detail,          name='escrow-detail'),
    path('my/',                              escrow_my_list,         name='escrow-my-list'),
]

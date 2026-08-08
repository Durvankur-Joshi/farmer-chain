from django.urls import path
from .views import did_me, did_resolve

urlpatterns = [
    # GET /api/did/me/  — authenticated, returns own DID
    path('me/', did_me, name='did-me'),

    # GET /api/did/<did>/  — public DID resolution
    # The DID contains colons (did:farmerchain:role:uuid), so we use
    # a custom path converter pattern that matches everything except '/'.
    path('<path:did>/', did_resolve, name='did-resolve'),
]

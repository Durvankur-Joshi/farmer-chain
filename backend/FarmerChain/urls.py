from django.urls import path, include
from django.contrib import admin
from rest_framework_simplejwt.views import TokenRefreshView

from users.token import CustomTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/farmer/', include('farmer.urls')),
    path('api/fpo/', include('fpo.urls')),
    path('api/retailer/', include('retailer.urls')),
    path('api/admin/', include('admin_app.urls')),

    # JWT Auth
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

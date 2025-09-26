from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class Negotiation(models.Model):
    STATUS_CHOICES = [('active', 'Active'), ('accepted', 'Accepted'), ('rejected', 'Rejected')]
    
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    bid = GenericForeignKey('content_type', 'object_id')
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

class NegotiationMessage(models.Model):
    negotiation = models.ForeignKey(Negotiation, related_name='messages', on_delete=models.CASCADE)
    
    # Storing sender info directly due to multiple user models
    sender_role = models.CharField(max_length=20)
    sender_id = models.PositiveIntegerField()
    sender_name = models.CharField(max_length=100)
    
    message = models.TextField()
    counter_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    counter_delivery_time_days = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
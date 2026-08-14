from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class Negotiation(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('withdrawn', 'Withdrawn'),
    ]
    
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    bid = GenericForeignKey('content_type', 'object_id')
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    agreed_price_per_unit = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)
    agreed_quantity = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Negotiation #{self.id} on Bid #{self.object_id} ({self.status})"

class NegotiationMessage(models.Model):
    negotiation = models.ForeignKey(Negotiation, related_name='messages', on_delete=models.CASCADE)
    
    # Storing sender info directly due to multiple user models
    sender_role = models.CharField(max_length=20)
    sender_id = models.PositiveIntegerField()
    sender_name = models.CharField(max_length=100)
    
    message = models.TextField(blank=True)
    counter_amount = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)
    counter_quantity = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)
    counter_delivery_time_days = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message #{self.id} by {self.sender_name} ({self.sender_role}) in Neg #{self.negotiation_id}"
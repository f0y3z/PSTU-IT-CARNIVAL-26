import uuid
from django.db import models
from django.conf import settings

class Transaction(models.Model):
    TYPE_CHOICES = (
        ('send', 'Send'),
        ('request', 'Request'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('declined', 'Declined'),
        ('cancelled', 'Cancelled'),
        ('failed', 'Failed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    
    initiator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='initiated_transactions')
    counterparty = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='counterparty_transactions')
    
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    note = models.TextField(blank=True, null=True)
    idempotency_key = models.UUIDField(unique=True)
    
    risk_flagged = models.BooleanField(default=False)
    risk_reason = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['initiator']),
            models.Index(fields=['counterparty']),
            models.Index(fields=['status']),
        ]
from rest_framework import serializers
from .models import Transaction

class TransactionSerializer(serializers.ModelSerializer):
    initiator = serializers.ReadOnlyField(source='initiator.username')
    counterparty = serializers.ReadOnlyField(source='counterparty.username')

    class Meta:
        model = Transaction
        fields = '__all__'

class CreateSendSerializer(serializers.Serializer):
    recipient_username = serializers.CharField()
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.UUIDField()

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value

class CreateRequestSerializer(serializers.Serializer):
    payer_username = serializers.CharField()
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.UUIDField()

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value
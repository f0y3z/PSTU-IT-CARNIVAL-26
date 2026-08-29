from django.db import transaction
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

User = get_user_model()

def execute_transfer(payer_id, payee_id, amount):
    if amount <= 0:
        raise ValidationError("Amount must be strictly greater than zero.")

    # Sort PKs to lock accounts in consistent order
    first_id, second_id = sorted([payer_id, payee_id])
    
    with transaction.atomic():
        users = {
            u.id: u for u in User.objects.filter(id__in=[first_id, second_id]).select_for_update()
        }
        
        payer = users[payer_id]
        payee = users[payee_id]

        if payer.balance < amount:
            raise ValidationError("Insufficient balance.")

        payer.balance -= amount
        payee.balance += amount
        payer.save()
        payee.save()

    return True
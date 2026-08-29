"""Celery tasks that keep fraud scoring out of the HTTP request path."""

from celery import shared_task
from django.utils import timezone

from ledger.fraud import run_fraud_check
from ledger.models import Transaction


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def check_fraud_transaction(self, transaction_id):
    """Score a completed transaction after its database commit succeeds."""
    try:
        transaction = Transaction.objects.select_related("initiator", "counterparty").get(pk=transaction_id)
    except Transaction.DoesNotExist:
        return {"status": "missing"}

    if transaction.status != "completed":
        return {"status": "skipped"}

    payer = transaction.initiator if transaction.type == "send" else transaction.counterparty
    result = run_fraud_check(transaction, payer)
    transaction.risk_status = "flagged" if result["risk_flagged"] else "clear"
    transaction.risk_checked_at = timezone.now()
    transaction.save(update_fields=[
        "risk_flagged", "risk_reason", "risk_score", "risk_status", "risk_checked_at",
    ])
    return {"status": transaction.risk_status, "risk_score": result["risk_score"]}

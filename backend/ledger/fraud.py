"""
Fraud check for the ledger app. Calls the Isolation Forest model
(fraud_ml.predict_fraud) with real data pulled from this transaction and
the payer's recent history, then stores the result on the Transaction row.
"""

from django.utils import timezone
from datetime import timedelta
from fraud_ml.predict_fraud import check_transaction


def run_fraud_check(transaction, payer):
    """
    Call this AFTER execute_transfer() succeeds and tx.status is set to
    'completed', right before the final tx.save().

    `transaction` = the Transaction row that was just completed
    `payer`       = whoever's balance actually went down:
                       - in SendMoneyView:      request.user
                       - in ApproveRequestView: tx.counterparty
    """
    five_min_ago = timezone.now() - timedelta(minutes=5)
    recent_count = (
        payer.initiated_transactions
        .filter(created_at__gte=five_min_ago)
        .exclude(id=transaction.id)
        .count()
    )

    round_trip_window = timezone.now() - timedelta(minutes=10)
    other_party = transaction.counterparty if payer == transaction.initiator else transaction.initiator
    is_round_trip = (
        payer.counterparty_transactions
        .filter(initiator=other_party, created_at__gte=round_trip_window, status="completed")
        .exists()
    )

    past_amounts = list(
        payer.initiated_transactions.filter(status="completed")
        .exclude(id=transaction.id)
        .values_list("amount", flat=True)
    )
    avg_amount = sum(past_amounts) / len(past_amounts) if past_amounts else None

    result = check_transaction(
        amount=float(transaction.amount),
        sender_balance_before=float(payer.balance) + float(transaction.amount),
        sender_tx_count_last_5min=recent_count,
        is_round_trip=is_round_trip,
        sender_avg_historical_amount=avg_amount,
    )

    transaction.risk_flagged = result["risk_flagged"]
    transaction.risk_reason = result["risk_reason"]
    # no .save() here -- the calling view saves tx right after this runs

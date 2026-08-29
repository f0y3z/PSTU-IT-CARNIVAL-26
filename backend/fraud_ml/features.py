"""Feature engineering shared by model training and live scoring."""

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import timedelta


FEATURES = (
    "amount_to_balance_ratio",
    "sender_tx_count_last_5min",
    "is_round_trip",
    "amount_vs_user_avg_ratio",
)


def feature_row(amount, balance_before, recent_count, is_round_trip, average_amount):
    """Return model features in the stable order declared by ``FEATURES``."""
    amount = float(amount)
    safe_balance = max(float(balance_before), 1.0)
    safe_average = float(average_amount) if average_amount else amount
    return [
        amount / safe_balance,
        int(recent_count),
        int(bool(is_round_trip)),
        amount / max(safe_average, 1.0),
    ]


@dataclass(frozen=True)
class LedgerFeature:
    transaction_id: object
    values: list


def payer_for(transaction):
    """The sender is the initiator for sends and counterparty for requests."""
    return transaction.initiator_id if transaction.type == "send" else transaction.counterparty_id


def receiver_for(transaction):
    return transaction.counterparty_id if transaction.type == "send" else transaction.initiator_id


def build_ledger_features(transactions, starting_balance=100000.0):
    """Build point-in-time features from completed transactions in time order."""
    histories = defaultdict(list)
    recent = defaultdict(deque)
    inbound = defaultdict(deque)
    balances = defaultdict(lambda: float(starting_balance))
    rows = []

    for tx in transactions:
        payer_id = payer_for(tx)
        receiver_id = receiver_for(tx)
        timestamp = tx.created_at
        amount = float(tx.amount)
        five_minutes_ago = timestamp - timedelta(minutes=5)
        while recent[payer_id] and recent[payer_id][0] < five_minutes_ago:
            recent[payer_id].popleft()
        ten_minutes_ago = timestamp - timedelta(minutes=10)
        while inbound[payer_id] and inbound[payer_id][0][0] < ten_minutes_ago:
            inbound[payer_id].popleft()
        is_round_trip = any(sender_id == receiver_id for _, sender_id in inbound[payer_id])
        history = histories[payer_id]
        average = sum(history) / len(history) if history else None
        rows.append(LedgerFeature(
            transaction_id=tx.id,
            values=feature_row(amount, balances[payer_id], len(recent[payer_id]), is_round_trip, average),
        ))
        balances[payer_id] -= amount
        balances[receiver_id] += amount
        history.append(amount)
        recent[payer_id].append(timestamp)
        inbound[receiver_id].append((timestamp, payer_id))
    return rows



import joblib
import os
import pandas as pd
import numpy as np

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "fraud_model.joblib")
_model = joblib.load(_MODEL_PATH)

FEATURES = [
    "amount_to_balance_ratio",
    "sender_tx_count_last_5min",
    "is_round_trip",
    "amount_vs_user_avg_ratio",
]


def check_transaction(amount, sender_balance_before, sender_tx_count_last_5min,
                       is_round_trip, sender_avg_historical_amount):
    """
    Score a single transaction and decide whether to flag it.

    Parameters map directly onto values your Django `ledger` app already
    has available at the moment a transfer completes:

      amount                          -> the transaction amount
      sender_balance_before           -> sender's balance BEFORE this transfer
      sender_tx_count_last_5min       -> count of sender's transactions in the
                                          last 5 minutes (a simple DB query)
      is_round_trip                   -> 1 if the counterparty sent money TO
                                          the sender within the last few minutes,
                                          else 0
      sender_avg_historical_amount    -> average amount of sender's past
                                          transactions (0 or None if this is
                                          their first transaction)

    Returns a dict ready to store on the Transaction model:
      {
        "risk_flagged": bool,          # the model's own inlier/outlier call
        "risk_score": float (0-1),     # higher = more anomalous
        "risk_reason": str             # human-readable explanation
      }
    """
    # Guard against divide-by-zero for brand-new users with no history yet
    safe_balance = max(sender_balance_before, 1)
    safe_avg = sender_avg_historical_amount if sender_avg_historical_amount else amount

    features = {
        "amount_to_balance_ratio": amount / safe_balance,
        "sender_tx_count_last_5min": sender_tx_count_last_5min,
        "is_round_trip": int(bool(is_round_trip)),
        "amount_vs_user_avg_ratio": amount / safe_avg,
    }

    X = pd.DataFrame([[features[f] for f in FEATURES]], columns=FEATURES)

    # predict(): -1 = anomaly (flag it), 1 = normal. This is the model's own
    # built-in decision, using the contamination rate set at training time.
    is_anomaly = _model.predict(X)[0] == -1

    # decision_function(): continuous score, positive = normal, negative =
    # anomalous. We flip the sign and squash it into roughly [0, 1] so it
    # reads like a "risk score" in the UI. This rescaling is just for
    # display -- the actual flag decision above already happened.
    raw_score = _model.decision_function(X)[0]
    risk_score = float(np.clip(0.5 - raw_score, 0, 1))

    reason = _explain(features, risk_score) if is_anomaly else ""

    return {
        "risk_flagged": bool(is_anomaly),
        "risk_score": round(risk_score, 3),
        "risk_reason": reason,
    }


def _explain(features, score):
    """Turn the strongest feature into a plain-English reason, so the
    history view can show something more useful than just a number. This
    is a simple post-hoc check on the raw feature values -- it doesn't rely
    on any Isolation-Forest-specific internals, so it stays accurate no
    matter how the model itself is retrained later."""
    reasons = []
    if features["amount_to_balance_ratio"] > 0.5:
        reasons.append("large relative to sender's balance")
    if features["sender_tx_count_last_5min"] >= 5:
        reasons.append("high transaction frequency")
    if features["is_round_trip"] == 1:
        reasons.append("possible round-trip pattern")
    if features["amount_vs_user_avg_ratio"] > 3:
        reasons.append("unusual amount vs. sender's own history")

    if not reasons:
        reasons.append("flagged as an outlier by the anomaly-detection model")

    return f"Anomaly score {score:.2f} — " + ", ".join(reasons)


if __name__ == "__main__":
    # Quick manual sanity check with a few example transactions
    examples = [
        dict(amount=500, sender_balance_before=50000, sender_tx_count_last_5min=1,
             is_round_trip=0, sender_avg_historical_amount=450),
        dict(amount=45000, sender_balance_before=50000, sender_tx_count_last_5min=0,
             is_round_trip=0, sender_avg_historical_amount=1000),
        dict(amount=1000, sender_balance_before=50000, sender_tx_count_last_5min=7,
             is_round_trip=0, sender_avg_historical_amount=900),
        dict(amount=2000, sender_balance_before=50000, sender_tx_count_last_5min=1,
             is_round_trip=1, sender_avg_historical_amount=1800),
    ]

    for i, tx in enumerate(examples, 1):
        result = check_transaction(**tx)
        print(f"Example {i}: {tx}")
        print(f"  -> {result}\n")

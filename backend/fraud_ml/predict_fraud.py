"""Load and run the versioned Isolation Forest fraud model."""

from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

from .features import FEATURES, feature_row


MODEL_PATH = Path(__file__).with_name("fraud_model.joblib")


@lru_cache(maxsize=1)
def load_model():
    """Load lazily, so migrations and server startup do not require a model."""
    if not MODEL_PATH.exists():
        return None
    artifact = joblib.load(MODEL_PATH)
    if not isinstance(artifact, dict) or artifact.get("features") != list(FEATURES):
        raise RuntimeError("Fraud model is incompatible. Run: python manage.py train_fraud_model")
    return artifact


def reload_model():
    load_model.cache_clear()


def check_transaction(amount, sender_balance_before, sender_tx_count_last_5min,
                      is_round_trip, sender_avg_historical_amount):
    values = feature_row(
        amount, sender_balance_before, sender_tx_count_last_5min,
        is_round_trip, sender_avg_historical_amount,
    )
    artifact = load_model()
    if artifact is None:
        return {"risk_flagged": False, "risk_score": 0.0,
                "risk_reason": "Fraud model has not been trained yet."}

    model = artifact["model"]
    matrix = np.asarray([values], dtype=float)
    is_anomaly = model.predict(matrix)[0] == -1
    raw_score = float(model.decision_function(matrix)[0])
    risk_score = float(np.clip(0.5 - raw_score, 0.0, 1.0))
    reason = _explain(dict(zip(FEATURES, values)), risk_score) if is_anomaly else ""
    return {"risk_flagged": bool(is_anomaly), "risk_score": round(risk_score, 3),
            "risk_reason": reason}


def _explain(features, score):
    reasons = []
    if features["amount_to_balance_ratio"] > 0.5:
        reasons.append("large relative to sender's balance")
    if features["sender_tx_count_last_5min"] >= 5:
        reasons.append("high transaction frequency")
    if features["is_round_trip"]:
        reasons.append("possible round-trip pattern")
    if features["amount_vs_user_avg_ratio"] > 3:
        reasons.append("unusual amount vs. sender's history")
    if not reasons:
        reasons.append("outlier pattern across ledger features")
    return f"Anomaly score {score:.2f} — " + ", ".join(reasons)

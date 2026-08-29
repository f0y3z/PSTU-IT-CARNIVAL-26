from pathlib import Path

import joblib
import numpy as np
from django.core.management.base import BaseCommand, CommandError
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

from fraud_ml.features import FEATURES, build_ledger_features
from fraud_ml.predict_fraud import MODEL_PATH, reload_model
from ledger.models import Transaction


class Command(BaseCommand):
    help = "Train a versioned Isolation Forest from completed ledger transactions."

    def add_arguments(self, parser):
        parser.add_argument("--contamination", type=float, default=0.08)
        parser.add_argument("--include-flagged", action="store_true")

    def handle(self, *args, **options):
        contamination = options["contamination"]
        if not 0 < contamination <= 0.5:
            raise CommandError("--contamination must be greater than 0 and at most 0.5")
        transactions = Transaction.objects.filter(status="completed").select_related(
            "initiator", "counterparty"
        ).order_by("created_at", "id")
        if not options["include_flagged"]:
            transactions = transactions.filter(risk_flagged=False)
        features = build_ledger_features(list(transactions))
        if len(features) < 20:
            raise CommandError("Need at least 20 completed baseline transactions to train.")
        matrix = np.asarray([item.values for item in features], dtype=float)
        model = Pipeline([
            ("scaler", RobustScaler()),
            ("isolation_forest", IsolationForest(n_estimators=300, contamination=contamination,
                random_state=42, n_jobs=-1)),
        ])
        model.fit(matrix)
        artifact = {"artifact_version": 1, "features": list(FEATURES), "model": model,
                    "training_rows": len(features), "contamination": contamination}
        Path(MODEL_PATH).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(artifact, MODEL_PATH)
        reload_model()
        self.stdout.write(self.style.SUCCESS(
            f"Trained Isolation Forest on {len(features)} baseline transactions; saved {MODEL_PATH}."))

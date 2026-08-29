import csv

from django.core.management.base import BaseCommand

from fraud_ml.features import FEATURES, build_ledger_features
from fraud_ml.predict_fraud import MODEL_PATH
from ledger.models import Transaction


class Command(BaseCommand):
    help = "Export the completed normal ledger rows used to train the fraud model as CSV."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default=str(MODEL_PATH.with_name("fraud_training_data.csv")),
            help="Destination CSV path (default: backend/fraud_ml/fraud_training_data.csv).",
        )

    def handle(self, *args, **options):
        all_transactions = list(
            Transaction.objects.filter(status="completed").select_related(
                "initiator", "counterparty"
            ).order_by("created_at", "id")
        )
        features_by_id = {
            item.transaction_id: item.values
            for item in build_ledger_features(all_transactions)
        }
        training_rows = [tx for tx in all_transactions if not tx.risk_flagged]
        with open(options["output"], "w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=[
                "transaction_id", "created_at", "transaction_type", "amount",
                "initiator", "counterparty", "risk_flagged", *FEATURES,
            ])
            writer.writeheader()
            for tx in training_rows:
                values = features_by_id[tx.id]
                writer.writerow({
                    "transaction_id": tx.id,
                    "created_at": tx.created_at.isoformat(),
                    "transaction_type": tx.type,
                    "amount": tx.amount,
                    "initiator": tx.initiator.username,
                    "counterparty": tx.counterparty.username,
                    "risk_flagged": tx.risk_flagged,
                    **dict(zip(FEATURES, values)),
                })
        self.stdout.write(self.style.SUCCESS(
            f"Exported {len(training_rows)} training rows to {options['output']}."
        ))

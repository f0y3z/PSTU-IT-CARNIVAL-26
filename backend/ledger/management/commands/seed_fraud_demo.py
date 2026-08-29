import random
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from ledger.models import Transaction


class Command(BaseCommand):
    help = "Create deterministic demo users and normal/anomalous ledger transactions."

    def add_arguments(self, parser):
        parser.add_argument("--users", type=int, default=40)
        parser.add_argument("--transactions-per-user", type=int, default=35)
        parser.add_argument("--seed", type=int, default=42)
        parser.add_argument("--reset", action="store_true",
                            help="Remove only transactions previously created by this command.")

    def handle(self, *args, **options):
        user_count = options["users"]
        tx_per_user = options["transactions_per_user"]
        if user_count < 2 or tx_per_user < 1:
            raise CommandError("--users must be at least 2 and --transactions-per-user at least 1")
        rng = random.Random(options["seed"])
        User = get_user_model()
        if options["reset"]:
            deleted, _ = Transaction.objects.filter(note="Demo ledger transaction").delete()
            self.stdout.write(f"Removed {deleted} previously generated demo transactions.")
        users = []
        for index in range(user_count):
            username = f"fraud_demo_{index + 1:03d}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": f"{username}@example.test", "balance": Decimal("500000.00")},
            )
            if created:
                user.set_password("demo-pass-123")
                user.save(update_fields=["password"])
            users.append(user)

        normal_count = user_count * tx_per_user
        anomaly_count = max(12, normal_count // 12)
        start = timezone.now() - timedelta(days=30)
        rows = []

        def add_row(sender, receiver, amount, created_at, flagged=False, reason=""):
            rows.append(Transaction(
                type="send", status="completed", initiator=sender, counterparty=receiver,
                amount=Decimal(str(round(amount, 2))), note="Demo ledger transaction",
                idempotency_key=uuid.uuid4(), risk_flagged=flagged, risk_reason=reason,
                created_at=created_at, resolved_at=created_at + timedelta(seconds=2),
            ))

        for index in range(normal_count):
            sender = users[index % len(users)]
            receiver = rng.choice([u for u in users if u.id != sender.id])
            amount = max(25, rng.lognormvariate(6.8, 0.55))
            created_at = start + timedelta(minutes=index * 24 + rng.randint(0, 18))
            add_row(sender, receiver, amount, created_at)

        # Known suspicious cases stay excluded from the normal training baseline.
        for index in range(anomaly_count):
            sender = users[index % len(users)]
            receiver = users[(index + 1) % len(users)]
            created_at = timezone.now() - timedelta(hours=24) + timedelta(seconds=index * 18)
            if index % 3 == 0:
                add_row(sender, receiver, rng.uniform(75000, 160000), created_at, True,
                        "Synthetic testing scenario: unusually large transfer")
            elif index % 3 == 1:
                add_row(sender, receiver, rng.uniform(9000, 18000), created_at, True,
                        "Synthetic testing scenario: high-frequency transfer burst")
            else:
                add_row(sender, receiver, rng.uniform(7000, 14000), created_at, True,
                        "Synthetic testing scenario: rapid round-trip transfer")
                add_row(receiver, sender, rng.uniform(7000, 14000), created_at + timedelta(seconds=30), True,
                        "Synthetic testing scenario: rapid round-trip transfer")

        simulated_times = [(row.created_at, row.resolved_at) for row in rows]
        Transaction.objects.bulk_create(rows, batch_size=500)
        # auto_now_add runs during bulk_create, so restore our simulated
        # history afterwards. UUID primary keys are assigned before insertion.
        for row, (created_at, resolved_at) in zip(rows, simulated_times):
            row.created_at = created_at
            row.resolved_at = resolved_at
        Transaction.objects.bulk_update(rows, ["created_at", "resolved_at"], batch_size=500)
        self.stdout.write(self.style.SUCCESS(
            f"Created/reused {len(users)} demo users and added {len(rows)} completed transactions "
            f"({sum(row.risk_flagged for row in rows)} marked synthetic suspicious)."))

# Fraud-Aware Money Movement

A full-stack peer-to-peer money-transfer application built for PSTU IT Carnival. Users can send money, request money, review history, and receive asynchronous fraud-risk alerts for completed transactions.

Fraud detection uses an Isolation Forest model. Redis and Celery run the model in a background worker, so transfers are not delayed by ML scoring.

## Features

- Django REST API with token authentication
- React dashboard for transfers, requests, history, and risk alerts
- Atomic balance transfers with idempotency-key protection
- Request approval, decline, and cancellation
- Isolation Forest anomaly detection for completed transfers
- Redis + Celery asynchronous fraud scoring
- UI states: **Reviewing**, **Clear**, and **Flagged**
- Reproducible demo data, model training, and CSV export

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, React Router |
| Backend | Django, Django REST Framework |
| Database | SQLite (local development) |
| Background jobs | Celery, Redis |
| ML | scikit-learn Isolation Forest, RobustScaler |

## Structure

```text
.
├── backend/
│   ├── accounts/     # Authentication and user balance model
│   ├── ledger/       # Transaction API, transfer logic, Celery task
│   ├── fraud_ml/     # Features, trained model, CSV export
│   ├── core/         # Django and Celery configuration
│   └── requirements.txt
└── frontend/         # React application
```

## Setup

### 1. Start Redis

On macOS with Homebrew:

```bash
brew install redis
brew services start redis
redis-cli ping
```

`redis-cli ping` should return `PONG`.

### 2. Configure the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
```

### 3. Create demo data and train the model

```bash
python manage.py seed_fraud_demo --reset
python manage.py train_fraud_model
python manage.py export_fraud_training_data
```

This creates 40 demo users, normal history, synthetic suspicious scenarios, a trained model at `backend/fraud_ml/fraud_model.joblib`, and an inspectable CSV at `backend/fraud_ml/fraud_training_data.csv`.

### 4. Run the API and background worker

Use two terminals. Activate `backend/.venv` in both.

```bash
# Terminal 1: Django API
cd backend
source .venv/bin/activate
python manage.py runserver
```

```bash
# Terminal 2: Celery fraud worker
cd backend
source .venv/bin/activate
celery -A core worker --loglevel=INFO
```

### 5. Run the frontend

```bash
cd frontend
npm install
npm start
```

Open `http://localhost:3000`. By default, the frontend uses `http://localhost:8000/api`.

## Demo accounts

After seeding, use:

```text
Username: fraud_demo_001
Password: demo-pass-123
```

Accounts `fraud_demo_002` through `fraud_demo_040` use the same password.

## Fraud detection

### Model features

| Feature | Description |
| --- | --- |
| `amount_to_balance_ratio` | Transfer amount divided by sender balance before transfer |
| `sender_tx_count_last_5min` | Sender's transfer count in the last five minutes |
| `is_round_trip` | Recipient recently sent money back to the sender |
| `amount_vs_user_avg_ratio` | Transfer amount relative to sender's historical average |

`train_fraud_model` trains a `RobustScaler` and 300-tree Isolation Forest from normal completed transactions (`risk_flagged=False`).

### Asynchronous flow

```text
Completed send / approved request
          ↓
Database transaction commits
          ↓
Celery task queued in Redis
          ↓
Worker calculates features and calls Isolation Forest
          ↓
Transaction saved as clear or flagged
```

The transaction is queued in `backend/ledger/views.py`. The worker is in `backend/ledger/tasks.py`; feature calculation and prediction are in `backend/ledger/fraud.py` and `backend/fraud_ml/predict_fraud.py`.

### Judge demonstration

1. Log in as `fraud_demo_001`.
2. Send `120000` to `fraud_demo_002`.
3. The transaction displays **Reviewing** while Celery processes it.
4. Refresh after the worker completes. The transfer should show **Flagged** because it is unusually large for that account.

## Useful commands

```bash
# Verify configuration
python manage.py check

# Recreate generated transaction data
python manage.py seed_fraud_demo --reset

# Train the model from database history
python manage.py train_fraud_model

# Export training rows and engineered features as CSV
python manage.py export_fraud_training_data

# Verify Redis and Celery worker
redis-cli ping
celery -A core inspect ping --timeout=3
```

## API overview

All endpoints are prefixed with `/api/`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/register/` | Register a user |
| POST | `/auth/login/` | Obtain an auth token |
| POST | `/auth/logout/` | Invalidate the token |
| GET | `/accounts/me/` | Get current account details |
| POST | `/transactions/send/` | Send money and queue fraud review |
| POST | `/transactions/request/` | Create a money request |
| POST | `/transactions/<id>/approve/` | Approve request and queue fraud review |
| GET | `/transactions/` | Get transaction history |

Authenticated requests require:

```http
Authorization: Token <token>
```

## Notes

- SQLite and the default Redis URLs are intended for local development.
- A fraud flag is an anomaly-review signal, not proof of fraud.
- Keep Redis and the Celery worker running to demonstrate live fraud detection.

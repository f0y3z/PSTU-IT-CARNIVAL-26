from django.urls import path
from .views import (
    SendMoneyView, RequestMoneyView, ApproveRequestView,
    DeclineRequestView, CancelRequestView, HistoryListView,
    TransactionDetailView, PendingIncomingRequestsView, PendingOutgoingRequestsView
)

urlpatterns = [
    path('transactions/send/', SendMoneyView.as_view(), name='send-money'),
    path('transactions/request/', RequestMoneyView.as_view(), name='request-money'),
    path('transactions/<uuid:pk>/approve/', ApproveRequestView.as_view(), name='approve-request'),
    path('transactions/<uuid:pk>/decline/', DeclineRequestView.as_view(), name='decline-request'),
    path('transactions/<uuid:pk>/cancel/', CancelRequestView.as_view(), name='cancel-request'),
    path('transactions/', HistoryListView.as_view(), name='transaction-history'),
    path('transactions/<uuid:pk>/', TransactionDetailView.as_view(), name='transaction-detail'),
    path('transactions/pending/incoming/', PendingIncomingRequestsView.as_view(), name='pending-incoming'),
    path('transactions/pending/outgoing/', PendingOutgoingRequestsView.as_view(), name='pending-outgoing'),
]
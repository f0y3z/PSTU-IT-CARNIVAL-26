from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import Q

from .models import Transaction
from .serializers import TransactionSerializer, CreateSendSerializer, CreateRequestSerializer
from .services import execute_transfer
from .fraud import run_fraud_check

User = get_user_model()

class BaseLedgerView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

class SendMoneyView(BaseLedgerView):
    def post(self, request):
        serializer = CreateSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        existing = Transaction.objects.filter(idempotency_key=data['idempotency_key']).first()
        if existing:
            return Response(TransactionSerializer(existing).data, status=status.HTTP_200_OK)

        if data['recipient_username'] == request.user.username:
            return Response({"error": "Cannot send money to yourself."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            recipient = User.objects.get(username=data['recipient_username'])
        except User.DoesNotExist:
            return Response({"error": "Recipient user does not exist."}, status=status.HTTP_404_NOT_FOUND)

        try:
            with transaction.atomic():
                tx = Transaction.objects.create(
                    type='send',
                    status='pending',
                    initiator=request.user,
                    counterparty=recipient,
                    amount=data['amount'],
                    note=data.get('note', ''),
                    idempotency_key=data['idempotency_key']
                )
                
                execute_transfer(request.user.id, recipient.id, data['amount'])
                
                tx.status = 'completed'
                tx.resolved_at = timezone.now()
                run_fraud_check(tx, payer=request.user)
                tx.save()

        except IntegrityError:
            tx = Transaction.objects.get(idempotency_key=data['idempotency_key'])
            return Response(TransactionSerializer(tx).data, status=status.HTTP_200_OK)
        except ValidationError as e:
            if 'tx' in locals():
                tx.status = 'failed'
                tx.resolved_at = timezone.now()
                tx.save()
            return Response({"error": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TransactionSerializer(tx).data, status=status.HTTP_201_CREATED)


class RequestMoneyView(BaseLedgerView):
    def post(self, request):
        serializer = CreateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        existing = Transaction.objects.filter(idempotency_key=data['idempotency_key']).first()
        if existing:
            return Response(TransactionSerializer(existing).data, status=status.HTTP_200_OK)

        if data['payer_username'] == request.user.username:
            return Response({"error": "Cannot request money from yourself."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payer = User.objects.get(username=data['payer_username'])
        except User.DoesNotExist:
            return Response({"error": "Payer user does not exist."}, status=status.HTTP_404_NOT_FOUND)

        try:
            tx = Transaction.objects.create(
                type='request',
                status='pending',
                initiator=request.user,
                counterparty=payer,
                amount=data['amount'],
                note=data.get('note', ''),
                idempotency_key=data['idempotency_key']
            )
        except IntegrityError:
            tx = Transaction.objects.get(idempotency_key=data['idempotency_key'])
            return Response(TransactionSerializer(tx).data, status=status.HTTP_200_OK)

        return Response(TransactionSerializer(tx).data, status=status.HTTP_201_CREATED)


class ApproveRequestView(BaseLedgerView):
    def post(self, request, pk):
        try:
            tx = Transaction.objects.get(pk=pk)
        except Transaction.DoesNotExist:
            return Response({"error": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        if tx.counterparty != request.user:
            return Response({"error": "Unauthorized action."}, status=status.HTTP_403_FORBIDDEN)

        if tx.status != 'pending' or tx.type != 'request':
            return Response({"error": "Transaction is not pending or not a request."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                execute_transfer(payer_id=tx.counterparty.id, payee_id=tx.initiator.id, amount=tx.amount)
                tx.status = 'completed'
                tx.resolved_at = timezone.now()
                run_fraud_check(tx, payer=tx.counterparty)
                tx.save()
        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TransactionSerializer(tx).data)


class DeclineRequestView(BaseLedgerView):
    def post(self, request, pk):
        try:
            tx = Transaction.objects.get(pk=pk)
        except Transaction.DoesNotExist:
            return Response({"error": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        if tx.counterparty != request.user:
            return Response({"error": "Unauthorized action."}, status=status.HTTP_403_FORBIDDEN)

        if tx.status != 'pending':
            return Response({"error": "Transaction is not pending."}, status=status.HTTP_400_BAD_REQUEST)

        tx.status = 'declined'
        tx.resolved_at = timezone.now()
        tx.save()

        return Response(TransactionSerializer(tx).data)


class CancelRequestView(BaseLedgerView):
    def post(self, request, pk):
        try:
            tx = Transaction.objects.get(pk=pk)
        except Transaction.DoesNotExist:
            return Response({"error": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        if tx.initiator != request.user:
            return Response({"error": "Unauthorized action."}, status=status.HTTP_403_FORBIDDEN)

        if tx.status != 'pending':
            return Response({"error": "Transaction is not pending."}, status=status.HTTP_400_BAD_REQUEST)

        tx.status = 'cancelled'
        tx.resolved_at = timezone.now()
        tx.save()

        return Response(TransactionSerializer(tx).data)


class HistoryListView(generics.ListAPIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = TransactionSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Transaction.objects.filter(Q(initiator=user) | Q(counterparty=user)).order_by('-created_at')
        
        status_param = self.request.query_params.get('status')
        type_param = self.request.query_params.get('type')

        if status_param:
            queryset = queryset.filter(status=status_param)
        if type_param:
            queryset = queryset.filter(type=type_param)

        return queryset


class TransactionDetailView(generics.RetrieveAPIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = TransactionSerializer

    def get_queryset(self):
        user = self.request.user
        return Transaction.objects.filter(Q(initiator=user) | Q(counterparty=user))


class PendingIncomingRequestsView(generics.ListAPIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = TransactionSerializer

    def get_queryset(self):
        return Transaction.objects.filter(
            counterparty=self.request.user,
            type='request',
            status='pending'
        ).order_by('-created_at')


class PendingOutgoingRequestsView(generics.ListAPIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = TransactionSerializer

    def get_queryset(self):
        return Transaction.objects.filter(
            initiator=self.request.user,
            type='request',
            status='pending'
        ).order_by('-created_at')
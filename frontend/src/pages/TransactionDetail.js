import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatMoney, formatDate, statusLabel } from '../utils/format';

export default function TransactionDetail() {
  const { id } = useParams();
  const { user, refreshMe } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.detail(id);
      setTx(res);
    } catch (err) {
      setError(err.message || 'Could not load this transaction.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action) => {
    setActing(true);
    try {
      await api[action](id);
      if (action === 'approve') await refreshMe();
      showToast(
        action === 'approve' ? 'Request approved.' : action === 'decline' ? 'Request declined.' : 'Request cancelled.'
      );
      await load();
    } catch (err) {
      showToast(err.message || 'Something went wrong.');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <div className="page">Loading…</div>;

  if (error || !tx) {
    return (
      <div className="page">
        <div className="card card-pad">
          <div className="form-error-banner">{error || 'Transaction not found.'}</div>
          <Link to="/history" className="link-small">← Back to history</Link>
        </div>
      </div>
    );
  }

  const isOut = tx.direction === 'out';
  const otherParty = isOut ? tx.counterparty : tx.initiator;
  const canRespond = tx.status === 'pending' && tx.counterparty === user.username;
  const canCancel = tx.status === 'pending' && tx.initiator === user.username;

  return (
    <div className="page">
      <button className="link-small" onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
        ← Back
      </button>

      <div className="card card-pad">
        <p className="eyebrow">{tx.type === 'send' ? 'Direct transfer' : 'Money request'}</p>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          {isOut ? '−' : '+'}${formatMoney(tx.amount)}
        </h1>
        <span className={`status-pill status-${tx.status}`}>{statusLabel(tx.status)}</span>

        <div className="detail-grid">
          <div className="detail-item">
            <div className="label">Counterparty</div>
            <div className="value">{otherParty}</div>
          </div>
          <div className="detail-item">
            <div className="label">Direction</div>
            <div className="value">{isOut ? 'Outgoing' : 'Incoming'}</div>
          </div>
          <div className="detail-item">
            <div className="label">Created</div>
            <div className="value">{formatDate(tx.created_at)}</div>
          </div>
          <div className="detail-item">
            <div className="label">Resolved</div>
            <div className="value">{tx.resolved_at ? formatDate(tx.resolved_at) : 'Still pending'}</div>
          </div>
          {tx.note && (
            <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
              <div className="label">Note</div>
              <div className="value">{tx.note}</div>
            </div>
          )}
        </div>

        {(canRespond || canCancel) && (
          <div className="detail-actions">
            {canRespond && (
              <>
                <button className="btn btn-emerald" disabled={acting} onClick={() => act('approve')}>
                  Approve
                </button>
                <button className="btn btn-danger" disabled={acting} onClick={() => act('decline')}>
                  Decline
                </button>
              </>
            )}
            {canCancel && (
              <button className="btn btn-secondary" disabled={acting} onClick={() => act('cancel')}>
                Cancel request
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

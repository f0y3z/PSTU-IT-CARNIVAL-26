import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { splitAmount } from '../utils/format';
import TransactionRow from '../components/TransactionRow';
import SendModal from '../components/SendModal';
import RequestModal from '../components/RequestModal';

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [recent, setRecent] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incomingCount, setIncomingCount] = useState(0);
  const [modal, setModal] = useState(null); // 'send' | 'request' | null

  const showWelcome = searchParams.get('welcome') === '1';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, incoming] = await Promise.all([
        api.history({ page: 1, pageSize: 100 }),
        api.pendingIncoming(),
      ]);
      setRecent(historyRes.results.slice(0, 5));
      setSuspicious(historyRes.results.filter((tx) => tx.risk_flagged));
      setIncomingCount(incoming.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dismissWelcome = () => {
    searchParams.delete('welcome');
    setSearchParams(searchParams, { replace: true });
  };

  const balance = splitAmount(user?.balance);

  return (
    <div className="page">
      {showWelcome && (
        <div className="credit-banner">
          You've been credited $100,000.00 to get started.{' '}
          <button className="btn-ghost" style={{ textDecoration: 'underline', padding: 0 }} onClick={dismissWelcome}>
            Dismiss
          </button>
        </div>
      )}

      {suspicious.length > 0 && (
        <Link to="/history" className="security-alert" aria-label="View suspicious activity in transaction history">
          <span className="security-alert-icon" aria-hidden="true">⚠</span>
          <span>
            <strong>Suspicious activity detected</strong>
            <span className="security-alert-copy">
              {suspicious.length} transaction{suspicious.length === 1 ? '' : 's'} need{suspicious.length === 1 ? 's' : ''} review.
            </span>
          </span>
          <span className="security-alert-action">Review activity →</span>
        </Link>
      )}

      <div className="card balance-hero">
        <p className="eyebrow">Your balance</p>
        <div className="balance-value amount">
          ${balance.whole}
          <span className="cents">.{balance.cents}</span>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setModal('send')}>
            Send money
          </button>
          <button className="btn btn-secondary" onClick={() => setModal('request')}>
            Request money
          </button>
          {incomingCount > 0 && (
            <Link to="/requests" className="btn btn-ghost" style={{ marginLeft: 'auto' }}>
              {incomingCount} pending {incomingCount === 1 ? 'request' : 'requests'} →
            </Link>
          )}
        </div>
      </div>

      <div className="card card-pad">
        <div className="dashboard-recent-head">
          <p className="section-title">Recent activity</p>
          <Link to="/history" className="link-small">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="empty-state">No transactions yet. Send or request money to get started.</div>
        ) : (
          <div className="tx-list">
            {recent.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>

      {modal === 'send' && (
        <SendModal
          onClose={() => setModal(null)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
      {modal === 'request' && (
        <RequestModal
          onClose={() => setModal(null)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}

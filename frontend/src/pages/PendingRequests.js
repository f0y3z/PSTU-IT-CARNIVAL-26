import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatMoney, formatDate } from '../utils/format';

export default function PendingRequests() {
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const { refreshMe } = useAuth();
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out] = await Promise.all([api.pendingIncoming(), api.pendingOutgoing()]);
      setIncoming(inc);
      setOutgoing(out);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, action) => {
    setActingId(id);
    try {
      await api[action](id);
      if (action === 'approve') {
        await refreshMe();
        showToast('Request approved.');
      } else if (action === 'decline') {
        showToast('Request declined.');
      } else {
        showToast('Request cancelled.');
      }
      await load();
    } catch (err) {
      showToast(err.message || 'Something went wrong.');
    } finally {
      setActingId(null);
    }
  };

  const list = tab === 'incoming' ? incoming : outgoing;

  return (
    <div className="page">
      <p className="eyebrow">Requests</p>
      <h1 className="page-title">Pending requests</h1>

      <div className="card card-pad">
        <div className="tabs">
          <button className={tab === 'incoming' ? 'active' : ''} onClick={() => setTab('incoming')}>
            Incoming ({incoming.length})
          </button>
          <button className={tab === 'outgoing' ? 'active' : ''} onClick={() => setTab('outgoing')}>
            Outgoing ({outgoing.length})
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            {tab === 'incoming'
              ? 'No one is requesting money from you right now.'
              : "You don't have any outgoing requests."}
          </div>
        ) : (
          <div className="tx-list">
            {list.map((tx) => (
              <div key={tx.id} className="tx-row" style={{ cursor: 'default' }}>
                <div className="tx-left">
                  <div className="tx-dir in">$</div>
                  <div className="tx-meta">
                    <div className="party">{tab === 'incoming' ? tx.initiator : tx.counterparty}</div>
                    <div className="sub">
                      {tab === 'incoming' ? 'requests' : 'requested from'} · {formatDate(tx.created_at)}
                      {tx.note ? ` · "${tx.note}"` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="amount" style={{ fontWeight: 600 }}>
                    ${formatMoney(tx.amount)}
                  </div>
                  {tab === 'incoming' ? (
                    <>
                      <button
                        className="btn btn-emerald btn-sm"
                        disabled={actingId === tx.id}
                        onClick={() => act(tx.id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actingId === tx.id}
                        onClick={() => act(tx.id, 'decline')}
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={actingId === tx.id}
                      onClick={() => act(tx.id, 'cancel')}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

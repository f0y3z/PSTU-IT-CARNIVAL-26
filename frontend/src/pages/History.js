import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import TransactionRow from '../components/TransactionRow';

export default function History() {
  const [data, setData] = useState({ results: [], total_pages: 1, count: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.history({ page, status: status || undefined, type: type || undefined });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, status, type]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="page">
      <p className="eyebrow">Full record</p>
      <h1 className="page-title">Transaction history</h1>

      <div className="card card-pad">
        <div className="filters">
          <select value={type} onChange={handleFilterChange(setType)}>
            <option value="">All types</option>
            <option value="send">Sent / received</option>
            <option value="request">Requests</option>
          </select>
          <select value={status} onChange={handleFilterChange(setStatus)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : data.results.length === 0 ? (
          <div className="empty-state">No transactions match these filters.</div>
        ) : (
          <div className="tx-list">
            {data.results.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}

        <div className="pager">
          <button
            className="btn btn-ghost btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Previous
          </button>
          <span className="page-info">
            Page {data.page || page} of {data.total_pages || 1} · {data.count || 0} total
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= (data.total_pages || 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

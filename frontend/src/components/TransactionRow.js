import React from 'react';
import { Link } from 'react-router-dom';
import { formatMoney, formatDate, statusLabel } from '../utils/format';

export default function TransactionRow({ tx }) {
  const isOut = tx.direction === 'out';
  const otherParty = isOut ? tx.counterparty : tx.initiator;
  const verb =
    tx.type === 'send'
      ? isOut
        ? 'Sent to'
        : 'Received from'
      : isOut
      ? 'Requested by'
      : 'Requested from';

  return (
    <Link to={`/transactions/${tx.id}`} className="tx-row">
      <div className="tx-left">
        <div className={`tx-dir ${isOut ? 'out' : 'in'}`}>{isOut ? '↑' : '↓'}</div>
        <div className="tx-meta">
          <div className="party">{otherParty}</div>
          <div className="sub">
            {verb} · {formatDate(tx.created_at)}
          </div>
        </div>
      </div>
      <div className="tx-right">
        <div className={`amount ${isOut ? 'out' : 'in'}`}>
          {isOut ? '−' : '+'}${formatMoney(tx.amount)}
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
          {tx.risk_status === 'pending' && tx.status === 'completed' && (
            <span className="review-badge">Reviewing</span>
          )}
          {tx.risk_flagged && <span className="risk-badge" title={tx.risk_reason}>⚠ Flagged</span>}
          <span className={`status-pill status-${tx.status}`}>{statusLabel(tx.status)}</span>
        </div>
      </div>
    </Link>
  );
}

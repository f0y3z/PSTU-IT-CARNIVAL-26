import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { generateIdempotencyKey } from '../utils/idempotency';

export default function RequestModal({ onClose, onSuccess }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [payer, setPayer] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const idempotencyKeyRef = useRef(generateIdempotencyKey());

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!payer.trim()) {
      setError('Enter a payer username.');
      return;
    }
    if (payer.trim() === user.username) {
      setError('You cannot request money from yourself.');
      return;
    }
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await api.requestMoney({
        payerUsername: payer.trim(),
        amount: amt,
        note: note.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      });
      showToast(`Requested $${amt.toFixed(2)} from ${payer.trim()}`);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Request money</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error-banner">{error}</div>}

          <div className="field">
            <label htmlFor="payer">Payer username</label>
            <input
              id="payer"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              placeholder="e.g. alice"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="req-amount">Amount</label>
            <input
              id="req-amount"
              className="amount-input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="field">
            <label htmlFor="req-note">Note (optional)</label>
            <input
              id="req-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's this for?"
            />
          </div>

          <button type="submit" className="btn btn-emerald btn-block" disabled={submitting}>
            {submitting ? 'Requesting…' : 'Request money'}
          </button>
        </form>
      </div>
    </div>
  );
}

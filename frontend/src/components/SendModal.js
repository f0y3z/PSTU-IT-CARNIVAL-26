import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { generateIdempotencyKey } from '../utils/idempotency';

export default function SendModal({ onClose, onSuccess }) {
  const { user, refreshMe } = useAuth();
  const { showToast } = useToast();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Key is generated once when the modal mounts (form opens) and reused
  // across retries of this same attempt — regenerated only if reopened.
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

    if (!recipient.trim()) {
      setError('Enter a recipient username.');
      return;
    }
    if (recipient.trim() === user.username) {
      setError('You cannot send money to yourself.');
      return;
    }
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await api.send({
        recipientUsername: recipient.trim(),
        amount: amt,
        note: note.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      });
      await refreshMe();
      showToast(`Sent $${amt.toFixed(2)} to ${recipient.trim()}`);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not send money. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Send money</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error-banner">{error}</div>}

          <div className="field">
            <label htmlFor="recipient">Recipient username</label>
            <input
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. bob"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              className="amount-input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="field">
            <label htmlFor="note">Note (optional)</label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's this for?"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send money'}
          </button>
        </form>
      </div>
    </div>
  );
}

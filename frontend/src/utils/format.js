export function splitAmount(value) {
  const n = Number(value || 0);
  const [whole, cents] = n.toFixed(2).split('.');
  return { whole: Number(whole).toLocaleString('en-US'), cents };
}

export function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

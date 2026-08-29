// Real backend client. Every function here matches the endpoint table in
// section 6 of the design doc. If your teammate's field names come out
// different from what's guessed here (marked below), this is the only
// file that needs to change — every page calls through api/index.js,
// never fetch() directly.

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

function getToken() {
  return localStorage.getItem('mm_token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Token ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // no body
  }

  if (!res.ok) {
    const message =
      (data && (data.detail || data.error || data.message)) ||
      'Something went wrong. Please try again.';
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const realApi = {
  register: (username, password) =>
    request('/auth/register/', { method: 'POST', body: { username, password }, auth: false }),

  login: (username, password) =>
    request('/auth/login/', { method: 'POST', body: { username, password }, auth: false }),

  logout: () => request('/auth/logout/', { method: 'POST' }),

  me: () => request('/accounts/me/'),

  // NOTE: field names (recipient_username / payer_username) are our best
  // reading of the doc — confirm exact keys with your backend teammate.
  send: ({ recipientUsername, amount, note, idempotencyKey }) =>
    request('/transactions/send/', {
      method: 'POST',
      body: {
        recipient_username: recipientUsername,
        amount,
        note,
        idempotency_key: idempotencyKey,
      },
    }),

  requestMoney: ({ payerUsername, amount, note, idempotencyKey }) =>
    request('/transactions/request/', {
      method: 'POST',
      body: {
        payer_username: payerUsername,
        amount,
        note,
        idempotency_key: idempotencyKey,
      },
    }),

  approve: (id) => request(`/transactions/${id}/approve/`, { method: 'POST' }),
  decline: (id) => request(`/transactions/${id}/decline/`, { method: 'POST' }),
  cancel: (id) => request(`/transactions/${id}/cancel/`, { method: 'POST' }),

  history: ({ page = 1, status, type } = {}) => {
    const params = new URLSearchParams({ page });
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    return request(`/transactions/?${params.toString()}`);
  },

  detail: (id) => request(`/transactions/${id}/`),

  pendingIncoming: () => request('/transactions/pending/incoming/'),
  pendingOutgoing: () => request('/transactions/pending/outgoing/'),
};
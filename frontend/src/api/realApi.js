// Real backend client. Every function here matches the endpoint table in
// section 6 of the design doc exactly. If your teammate's field names come
// out slightly different from what's guessed here (marked below), this is
// the only file that needs to change — every page calls through api/index.js,
// never fetch() directly.

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

function getToken() {
  return localStorage.getItem('mm_token');
}

// DRF's default validation errors (from serializer.is_valid(raise_exception=True))
// come back as { field_name: ["message", ...] } rather than a flat error string.
// Pull the first message out of whichever shape shows up.
function extractErrorMessage(data) {
  if (!data) return 'Something went wrong. Please try again.';
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  if (data.message) return data.message;
  // DRF field-error shape: { amount: ["Amount must be positive."], ... }
  const firstKey = Object.keys(data)[0];
  if (firstKey && Array.isArray(data[firstKey])) {
    return data[firstKey][0];
  }
  if (firstKey && typeof data[firstKey] === 'string') {
    return data[firstKey];
  }
  return 'Something went wrong. Please try again.';
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
    // no body (e.g. 204 on logout)
  }

  if (!res.ok) {
    const err = new Error(extractErrorMessage(data));
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// Backend sends initiator/counterparty as usernames but no "direction" field.
// Every page in this app reads tx.direction, so compute it once here for
// every transaction response, using whichever username is currently logged in.
function withDirection(tx) {
  if (!tx) return tx;
  const me = localStorage.getItem('mm_username');
  const direction = tx.initiator === me ? 'out' : tx.counterparty === me ? 'in' : 'out';
  return { ...tx, direction };
}

function withDirectionList(list) {
  return (list || []).map(withDirection);
}

// Backend nests the profile under "user": { token, user: { id, username, balance } }.
// Flatten it here so AuthContext can keep treating login/register as { token, username, balance }.
function flattenAuthResponse(data) {
  const flat = { token: data.token, username: data.user.username, balance: data.user.balance };
  localStorage.setItem('mm_username', flat.username);
  return flat;
}

export const realApi = {
  register: async (username, password) => {
    const data = await request('/auth/register/', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    return flattenAuthResponse(data);
  },

  login: async (username, password) => {
    const data = await request('/auth/login/', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    return flattenAuthResponse(data);
  },

  logout: () => request('/auth/logout/', { method: 'POST' }),

  me: () => request('/accounts/me/'),

  send: async ({ recipientUsername, amount, note, idempotencyKey }) => {
    const tx = await request('/transactions/send/', {
      method: 'POST',
      body: {
        recipient_username: recipientUsername,
        amount,
        note,
        idempotency_key: idempotencyKey,
      },
    });
    return withDirection(tx);
  },

  requestMoney: async ({ payerUsername, amount, note, idempotencyKey }) => {
    const tx = await request('/transactions/request/', {
      method: 'POST',
      body: {
        payer_username: payerUsername,
        amount,
        note,
        idempotency_key: idempotencyKey,
      },
    });
    return withDirection(tx);
  },

  approve: async (id) => withDirection(await request(`/transactions/${id}/approve/`, { method: 'POST' })),
  decline: async (id) => withDirection(await request(`/transactions/${id}/decline/`, { method: 'POST' })),
  cancel: async (id) => withDirection(await request(`/transactions/${id}/cancel/`, { method: 'POST' })),

  // The backend currently returns a plain array here — no pagination is
  // configured server-side. Slice it client-side so History.js's existing
  // pager UI keeps working; once the backend adds real pagination, this
  // can go back to just passing `page` straight through to the query string.
  history: async ({ page = 1, status, type, pageSize = 10 } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    const qs = params.toString();
    const data = await request(`/transactions/${qs ? `?${qs}` : ''}`);

    const items = Array.isArray(data) ? data : data.results || [];
    const count = items.length;
    const start = (page - 1) * pageSize;
    const pageItems = withDirectionList(items.slice(start, start + pageSize));

    return {
      count,
      page: Number(page),
      page_size: pageSize,
      total_pages: Math.max(1, Math.ceil(count / pageSize)),
      results: pageItems,
    };
  },

  detail: async (id) => withDirection(await request(`/transactions/${id}/`)),

  pendingIncoming: () => request('/transactions/pending/incoming/'),
  pendingOutgoing: () => request('/transactions/pending/outgoing/'),
};

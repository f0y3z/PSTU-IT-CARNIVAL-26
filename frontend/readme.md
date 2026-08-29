# Money Movement — Frontend

React frontend for the PSTU IT Carnival Money Movement challenge, built to match
the API contract in the design doc (section 6) so it can be pointed at the real
Django backend with a one-line change.

## Run it now (mock backend, no Django needed)

```bash
npm install
npm start
```

Opens at http://localhost:3000. A dark banner at the top confirms the mock API
is active. Two demo accounts are seeded so you can test the full request/approve
flow without two browser tabs:

- `alice` / `password123`
- `bob` / `password123`

Register a new account to get the fresh $100,000 starting balance too.

## Switching to the real backend

1. Open `.env`.
2. Set `REACT_APP_API_BASE_URL` to wherever Django is running (e.g. `http://localhost:8000/api`).
3. Set `REACT_APP_USE_MOCK=false`.
4. Restart `npm start`.

Nothing else changes — every page imports `api` from `src/api/index.js`, which is
the only file that decides mock vs. real.

## Files that matter for backend integration

- **`src/api/realApi.js`** — the real fetch client. Field names for the send/request
  bodies (`recipient_username`, `payer_username`) are a best guess from the doc —
  **confirm the exact keys with your backend teammate** and adjust this file only.
- **`src/api/mockApi.js`** — in-memory simulation of the backend rules from section 5
  of the doc: idempotency-key dedup, balance re-check at transfer time, one shared
  transfer path for sends and approved requests, no hard deletes.
- **`src/utils/idempotency.js`** — generates the key once per form-open and reuses it
  across retries, per section 7 of the doc.

## Known gaps to confirm with backend

- Exact request/response field names for every endpoint (this build assumes
  `snake_case` matching Django REST Framework conventions).
- Pagination response shape — assumed `{ count, page, page_size, total_pages, results }`.
- Error response shape — assumed `{ detail }` or `{ error }` or `{ message }`.

Once confirmed, only `realApi.js` needs edits.

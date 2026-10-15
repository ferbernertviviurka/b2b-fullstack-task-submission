# B2B full-stack task submission

Laravel 11 API + Nuxt 3 applicant review card.

## Layout

| Path | Contents |
| --- | --- |
| `backend/` | Laravel 11 API: `GET /api/v1/campaigns/{id}/applicant-summary` (JSON:API) |
| `frontend/` | Nuxt 3 app: `ApplicantReviewCard`, mock handlers in `server/` |
| `docs/` | Goals, PRDs, FRDs, `AI_LOG.md` (prompt and decision log) |
| `TASK_REPORT.md` | Submission report: Tasks 1–4 |

How the AI agent pipeline (implementer → reviewer → gate) works: [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed   # SQLite; answer "yes" to create database/database.sqlite
php artisan serve            # http://127.0.0.1:8000
php artisan test
```

Seed data: campaign 1 with 40 applicants, campaign 2 empty. Every request needs a
non-empty `X-Partner-Token` header (mock auth).

## Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npx vitest run
```

**Why explicit server routes over a `routeRules` proxy.** The Nitro proxy is a
hand-written server route, not a `routeRules: { '/api/**': { proxy: ... } }` entry,
because a blanket proxy rule forwards every request to one fixed target. It cannot
express two things this app needs: the conditional mock fallback (with
`NUXT_BACKEND_URL` unset, the summary GET is answered by the JSON:API fixture
instead) and server-side `X-Partner-Token` injection from runtime config, which keeps
the token out of the browser. The route also turns an unreachable backend into a
JSON:API `502`, and keeps `PATCH .../status` on the Nuxt server (see below).

## Frontend data source

The browser only talks to Nuxt server routes. The backend URL and token are server-only
runtime config and never reach the browser.

| Env var | Default | Effect |
| --- | --- | --- |
| `NUXT_BACKEND_URL` (BACKEND_URL) | empty | Set: `GET /api/v1/campaigns/{id}/applicant-summary` is proxied to `${NUXT_BACKEND_URL}/api/v1/...`, query string unchanged. Upstream status and body (including `errors[]`) pass through as-is. Backend unreachable: JSON:API `502`. |
| `NUXT_PARTNER_TOKEN` (PARTNER_TOKEN) | `demo-partner-token` | Sent as `X-Partner-Token` on proxied requests. |

- **Mock fallback:** when `NUXT_BACKEND_URL` is unset, the summary GET is served by a
  fixture that follows the same JSON:API contract. Tests and CI use this mode. There is
  no fallback when the backend is configured but down: you get a 502.
- **Status updates never reach Laravel:** `PATCH /api/v1/applicants/{id}/status` (Shortlist/Reject)
  is always handled by the Nuxt server, because no FR defines a backend write endpoint.
  Without `NUXT_BACKEND_URL` it updates the mock fixture. With it, Shortlist/Reject work for
  any applicant id (malformed ids get a `422`), but the new status is kept only in the Nuxt
  server's memory: it is never saved to Laravel and is lost when the Nuxt server restarts.
  The proxied summary GET passes Laravel's body through unchanged, so a refetch (for
  example moving the score filter) shows Laravel's status again.
- **Known limitation:** there are no pagination controls. The card requests a single page
  with `page[size]=100` (the API's maximum), so a campaign with more than 100 applicants
  shows only the first 100 applicants matching the filter.

```bash
cd backend && php artisan serve --port=8000
cd frontend && npm run build && NUXT_BACKEND_URL=http://127.0.0.1:8000 node .output/server/index.mjs
```

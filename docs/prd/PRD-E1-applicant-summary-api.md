# PRD E1 — Applicant Summary API (Task 1)

As an authenticated partner, I want to query a campaign's applicant summary so I can evaluate its performance without opening applicants one by one.

## Acceptance criteria

- `GET /api/v1/campaigns/{campaignId}/applicant-summary` returns JSON:API with `data[]`, `meta.summary` and pagination `links`.
- Request without the mock credential → 401; malformed `campaignId` → 422; non-existent campaign → 404 — all as JSON:API `errors[]`.
- `meta.summary` carries total applicants, eligible count, average AI score and top-tier highlights.
- `?min_score=`, `?page[size]=` and `?page[number]=` work combined.
- A campaign with no applicants returns 200 with zeroed aggregates — no division by zero.

**Functional spec:** `../frd/FRD-backend.md` (FR-B1 to FR-B9) · defaults in `../frd/FRD-00-overview.md`.

# FRD Backend — Laravel / PHP 8.2+ (FR-B1 to FR-B9)

Default decisions: see `FRD-00-overview.md`. API contract details: `.claude/skills/jsonapi-laravel/SKILL.md`.

| ID | Requirement | Detail |
| --- | --- | --- |
| FR-B1 | Route | `GET /api/v1/campaigns/{campaignId}/applicant-summary` in `routes/api.php`, thin controller in `app/Http/Controllers/`, logic in `app/Services/ApplicantSummaryService.php` |
| FR-B2 | Mock auth | Middleware requires a non-empty `X-Partner-Token` header; missing/invalid → 401 with JSON:API `errors[]` |
| FR-B3 | ID validation | `campaignId` is a positive integer; malformed → 422; campaign not found → 404 — both via FormRequest/exception handler, never 500 |
| FR-B4 | Metrics (`meta.summary`) | `total_applicants`, `eligible_applicants` (score ≥ 70), `average_ai_score` (float, 2 decimals; `0.0` on an empty list — guard against division by zero), `top_applicants` (up to 5 with score ≥ 90, desc) |
| FR-B5 | Filter | `?min_score=80` accepts 0–100; out of range or non-numeric → 422 |
| FR-B6 | Pagination | `page[size]` (default 10, max 100) and `page[number]` (default 1); response includes `meta.pagination` and first/last/prev/next `links` |
| FR-B7 | JSON:API format | `data[]` with `type: "applicants"`, `id`, `attributes`; errors always as `errors[{status, title, detail}]`; `Content-Type: application/vnd.api+json` |
| FR-B8 | Architecture | Controller → FormRequest → Service → Eloquent/Query; aggregation without N+1 (aggregate in the database, not in a PHP loop) |
| FR-B9 | PHPUnit tests | Feature: 200 with correct aggregates, 401, 404, 422 (ID and `min_score`), empty campaign with zeroed aggregates; Unit: the calculation service in isolation |

# FRD Overview — How to read + default decisions

Executable specification: each FR is a criterion Claude Code must implement and a test must prove. The split:

| File | Covers |
| --- | --- |
| `FRD-backend.md` | FR-B1 to FR-B9 — Laravel API (Task 1) |
| `FRD-frontend.md` | FR-F1 to FR-F9 — Nuxt component (Task 2) |
| `FRD-report.md` | FR-R1 to FR-R5 — TASK_REPORT.md (Tasks 3 and 4) |

## Default decisions (so the AI doesn't stall)

These resolve every ambiguity in the brief. Follow them; never invent alternatives without asking.

| Open point in the brief | Decision adopted |
| --- | --- |
| `campaignId` format | Positive auto-increment integer |
| Eligibility / top-tier thresholds | ≥ 70 eligible; ≥ 90 top-tier (max 5 highlights) |
| Test database | SQLite in-memory + factories and seeders |
| Data | Migrations + factories for `campaigns` and `applicants` (name, ai_score 0–100, status, applied_at, highlights JSON) |
| UI kit | Plain Tailwind (PrimeVue optional — avoids setup weight) |
| Frontend test | Vitest + @vue/test-utils (faster to run within the timebox than Playwright) |
| Frontend data source | Fixture/mocked handler following the FR-B7 JSON:API contract |

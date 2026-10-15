# GOALS — Objective and targets

Deliver a senior-level submission of the B2B challenge (Laravel + Nuxt) in up to 4 hours of effective work, within the 3-day deadline, using Claude Code as the executor and you as the critical reviewer — with documented evidence of the AI workflow, since Task 3 is graded as a crucial component.

## Measurable goals

| # | Goal | Definition of done |
| --- | --- | --- |
| G1 | Working Applicant Summary API | JSON:API endpoint returns 200/401/404/422; PHPUnit tests green, including a campaign with zero applicants |
| G2 | Applicant Review & Match Card component | Loading/empty/error states, optimistic actions, reactive filter; at least 1 Vitest or Playwright test passing |
| G3 | TASK_REPORT.md — AI showcase | ≥ 2 real prompts, raw vs. refactored diff, defects named and fixed, velocity analysis |
| G4 | Architecture triage (Task 4) | RCA, 1-hour mitigation, 50x-volume proposal and Mermaid diagram in the report |
| G5 | Deliverable repository | Required folder structure + README with local setup in < 5 min |
| G6 | Timebox | Sum of all phases ≤ 4 h (timeboxes defined in the execution guide) |
| G7 | Human-in-the-loop architecture | Zero unilateral architectural decisions: anything outside the FRD defaults paused the work and was presented as 3 alternatives with pros/cons for the human to choose (or override with their own); every outcome recorded in `docs/AI_LOG.md` |

## Evaluation map → evidence

| Evaluated area | Where the submission proves it |
| --- | --- |
| Backend API Engineering & Testing | Thin controller + Service + FormRequest; PHPUnit Feature and Unit tests covering success, validation and edge cases |
| Frontend UI & State | `<script setup lang="ts">` component, typed composable, optimistic update with rollback, skeleton/empty states |
| AI Tooling & Workflow | AI_LOG.md fed during development → becomes the Task 3 section of TASK_REPORT.md |
| Architecture & Triage | Task 4 section of the report: LRU/Nitro RCA, async queue, idempotency and billing reconciliation |

## Non-goals (deliberate scope cuts)

- Real OAuth2 — a mock middleware with an authorization header is enough (the brief allows it).
- Production database — SQLite in-memory + factories/seeders in tests.
- Pixel-perfect design or full PrimeVue — clean, accessible Tailwind is enough.
- Deploy, CI/CD or real infrastructure — outside the evaluated scope.

# PRD Overview — Product vision and index

The "product" is the assessment submission: a `b2b-fullstack-task-submission/` monorepo that demonstrates, to senior technical evaluators, clean architecture, test coverage and a verifiable AI-native development workflow.

**Users:** the evaluators for the role (they read code, run tests and judge the report) and, in the product's fiction, B2B partners who consume a campaign's applicant summary.

## Epics

| Epic | File | Spec |
| --- | --- | --- |
| E1 — Applicant Summary API | `PRD-E1-applicant-summary-api.md` | `../frd/FRD-backend.md` |
| E2 — Applicant Review & Match Card | `PRD-E2-review-match-card.md` | `../frd/FRD-frontend.md` |
| E3 — AI Showcase Report | `PRD-E3-ai-showcase-report.md` | `../frd/FRD-report.md` (FR-R1) |
| E4 — Architecture Triage | `PRD-E4-architecture-triage.md` | `../frd/FRD-report.md` (FR-R2–R5) |

## Deliverables

- `backend/` — Laravel: controller, service, routes, PHPUnit Feature/Unit tests.
- `frontend/` — Nuxt 3: component, `types/`, composable, tests.
- `TASK_REPORT.md` — Tasks 1–4, including the AI showcase and the triage.
- `README.md` — setup and how to run backend and frontend tests locally.

# PRD E2 — Applicant Review & Match Card (Task 2)

As a partner in the portal, I want to review applicants in cards with AI match summaries and act fast (Shortlist/Reject) without waiting on the server.

## Acceptance criteria

- The card shows name, a score badge color-coded by range, application date and AI evaluation bullets.
- Shortlist/Reject apply an optimistic update with a transition indicator and roll back if the call fails.
- Skeleton while loading; empty state when the filter returns no applicants.
- A minimum-score slider or dropdown re-filters the list reactively.
- 1+ automated test covers rendering and one interaction (filter or button) changing the DOM.

**Functional spec:** `../frd/FRD-frontend.md` (FR-F1 to FR-F9) · defaults in `../frd/FRD-00-overview.md`.

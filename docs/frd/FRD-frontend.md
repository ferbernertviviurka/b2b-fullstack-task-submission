# FRD Frontend — Nuxt 3 / Vue 3 / TypeScript (FR-F1 to FR-F9)

Default decisions: see `FRD-00-overview.md`. Optimistic-update pattern: `.claude/skills/optimistic-ui-vue/SKILL.md`.

| ID | Requirement | Detail |
| --- | --- | --- |
| FR-F1 | Component | `components/ApplicantReviewCard.vue` with `<script setup lang="ts">`, Composition API, Tailwind |
| FR-F2 | Types | JSON:API contract interfaces in `types/applicant.ts` (no `any`) |
| FR-F3 | Score badge | ≥ 90 green (top-tier), 70–89 amber (eligible), < 70 gray; color + text label (never color alone — a11y) |
| FR-F4 | Card content | Name, badge, formatted application date, 2–4 AI evaluation bullets |
| FR-F5 | Optimistic actions | Shortlist/Reject change state immediately, disable the buttons during the transition, and roll back + show a message on API error |
| FR-F6 | States | Animated skeleton while loading; empty state with copy and a clear-filter action when nothing passes the filter |
| FR-F7 | Reactive filter | Minimum-score slider or dropdown with ~300 ms debounce, refetching (or re-filtering the mock) |
| FR-F8 | State/fetch | `useApplicantSummary()` composable exposing `data`, `pending`, `error`; API mocked via fixture/handler if the backend isn't running |
| FR-F9 | Test | Vitest (component) or Playwright (E2E): data renders; interacting with the filter or a button changes the DOM |

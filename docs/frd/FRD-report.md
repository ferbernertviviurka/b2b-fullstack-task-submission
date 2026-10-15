# FRD Report — TASK_REPORT.md (FR-R1 to FR-R5)

Evidence source for FR-R1: `../AI_LOG.md` (append-only, filled during development — see `.claude/skills/ai-evidence-log/SKILL.md`).

| ID | Requirement | Detail |
| --- | --- | --- |
| FR-R1 | AI showcase | ≥ 2 verbatim prompts used; raw vs. refactored side-by-side snippet; AI defects named (N+1, null states, type checks, a11y) + the fix; velocity analysis |
| FR-R2 | RCA | LRU `MaxKeys: 50` suffers eviction churn under viral script variety → constant recompilation → CPU/memory at 100% → 502s; synchronous streaming to the warehouse without backpressure → events dropped at peak → divergence from billing |
| FR-R3 | 1-hour mitigation | Config only: raise `MaxKeys`/TTL, `Cache-Control` headers + CDN in front of the embed, local buffer with retry (or temporary sampling) on `/api/trk`, rate limiting and horizontal autoscaling of Nitro |
| FR-R4 | Long term (50x) | Immutable, versioned embed assets on an edge CDN; `/api/trk` writes to a queue (Redis Streams or Pub/Sub) with an idempotent consumer keyed by `event_id`; outbox + daily billing × events reconciliation job; idempotent webhooks with a dedupe key |
| FR-R5 | Diagram | Mermaid `sequenceDiagram` of the SDK → edge → queue → consumer → warehouse/billing flow, included in the report (baseline in `../EXECUTION_GUIDE.md`) |

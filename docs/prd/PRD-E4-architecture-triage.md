# PRD E4 — Architecture Triage (Task 4)

As a tech lead during a viral campaign, I want a stabilization plan and an architecture that handles 50x the event volume.

## Acceptance criteria

- RCA covering LRU cache exhaustion, the latency spike (120 ms → 4.5 s) and event loss on `/api/trk`.
- Mitigation executable within 1 hour (configuration, not a rewrite).
- Long-term proposal: CDN for embed assets, async ingestion pipeline, idempotent webhooks and billing × events reconciliation.
- Mermaid diagram (sequence or architecture) of the proposed event flow.

**Functional spec:** `../frd/FRD-report.md` (FR-R2 to FR-R5) · baseline diagram in `../EXECUTION_GUIDE.md`.

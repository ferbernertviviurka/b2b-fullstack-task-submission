# Why this kit exists — spec-driven AI development with quality gates

This folder is not boilerplate. It is a deliberate answer to the question the
assessment actually asks: **how do you use AI to go fast without lowering the bar?**
Every file here exists to remove one specific failure mode of AI-assisted
development. This document explains the reasoning; `docs/EXECUTION_GUIDE.md`
explains the operation.

## The problem being solved

AI coding assistants are a force multiplier with four predictable failure modes:

1. **They invent when scope is ambiguous.** Give a vague brief and the model fills
   the gaps with plausible-looking requirements nobody asked for.
2. **They drift when context is monolithic.** One giant prompt covering backend,
   frontend and reporting produces mediocre output in all three.
3. **They ship defects confidently.** N+1 queries, unhandled empty states, `any`
   types and color-only UI meaning are the classic signatures of unreviewed AI code.
4. **They leave no audit trail.** Without evidence captured *during* the work,
   any claim about "how AI was used" is reconstruction, not proof — and Task 3 of
   this assessment explicitly demands proof.

This kit attacks each failure mode with a structural countermeasure.

## Countermeasure 1 — Specs as contracts (`docs/`)

Development here is **spec-driven**: the AI never decides what to build, only how
to build what the spec already froze.

- **`GOALS.md`** defines what "done" means (G1–G6) and, just as important, what is
  deliberately *out* of scope — non-goals are what keep a 4-hour timebox honest.
- **`prd/` — one PRD per epic** captures user intent and acceptance criteria. Split
  per epic so each phase loads only its own "why".
- **`frd/` — one FRD per domain** turns intent into numbered, testable requirements
  (FR-B1…B9, FR-F1…F9, FR-R1…R5). Every FR id is a contract line: it can be
  referenced in a prompt, implemented in a file, proven by a test and cited in the
  report. That id is the thread that makes the whole submission traceable.
- **`frd/FRD-00-overview.md` centralizes the default decisions** — every ambiguity
  in the brief (ID format, score thresholds, test database, UI kit) is resolved
  once, up front. This is what stops the AI from stalling on questions or silently
  inventing answers.

Splitting the documents is not cosmetic: it is **context engineering**. The backend
agent reads `FRD-backend.md` and nothing about Vue; the frontend agent reads
`FRD-frontend.md` and nothing about Eloquent. Smaller, sharper context produces
measurably better output and makes every delegation prompt short and precise.

## Countermeasure 2 — A pipeline of specialists with gates (`.claude/agents/`)

The agent architecture mirrors how a real senior team ships software, because that
division of labor exists for a reason:

| Stage | Agent | Human-team equivalent |
| --- | --- | --- |
| Orchestration | main session | Tech lead — delegates, never implements |
| Implementation | `backend-laravel`, `frontend-nuxt` | Specialist developers |
| Gate 1 (qualitative) | `code-reviewer` | Senior code review |
| Gate 2 (deterministic) | `qa-gate` | QA — runs suites, verifies **every FR row** PASS/FAIL with evidence |
| Deep analysis | `architecture-analyst` | Staff engineer (Task 4) |
| Compilation | `report-writer` | Tech writer — may only cite logged evidence |

Two design decisions matter most:

- **No phase closes on trust.** AI output is treated as a draft until it survives
  both an adversarial review *and* a requirement-by-requirement verification with
  concrete evidence (file:line, test name, command output). A FAIL loops the work
  back to the implementer. "Probably fine" is a FAIL by definition.
- **Thinking and writing are separated.** The agent that produces the Task 4
  architecture analysis is not the agent that compiles the report — so the report
  stays a compilation of verified facts, never a generator of new claims.

`.claude/skills/` holds the shared knowledge that must stay consistent across
agents — the JSON:API contract, the optimistic-update pattern, the logging
protocol — so conventions are defined once and auto-trigger wherever relevant.

## Countermeasure 3 — Evidence as a first-class artifact (`docs/AI_LOG.md`)

`AI_LOG.md` is append-only and written **during** the work: verbatim prompt, raw
output *before* refactoring, refactor notes, review findings, gate verdicts.
Two rules give it teeth: past entries are never edited, and `TASK_REPORT.md` may
only cite what exists in the log. The result is that Task 3 — exact prompts,
raw vs. refactored, critical engineering judgment, velocity numbers — is written
from receipts, not from memory.

## The objective, in one paragraph

Compress 3–4 hours into senior-quality output by giving each concern its own
instrument: **specs for direction** (the AI builds only what was frozen),
**specialists for velocity** (small context, sharp prompts), **gates for quality**
(nothing ships on confidence alone), and **an evidence log for accountability**
(every claim in the final report traces back through
`PRD → FR id → code → test → gate verdict`). The human stays in the judgment
seat; the AI does the typing. That is what "AI-native engineering" means here —
not using AI more, but structuring the work so AI speed never outruns
engineering standards.

## Structure

```
├── CLAUDE.md                        # orchestration: pipeline, rules, agent table
├── .claude/
│   ├── agents/                      # 6 agents: 2 implementers, 2 gates, analyst, writer
│   └── skills/                      # 3 shared conventions (API contract, UI pattern, logging)
└── docs/
    ├── GOALS.md                     # success criteria + non-goals
    ├── EXECUTION_GUIDE.md           # phases P0–P4, timeboxes, kickoff prompts
    ├── AI_LOG.md                    # append-only Task 3 evidence
    ├── prd/                         # PRD-00 overview + one PRD per epic (E1–E4)
    └── frd/                         # FRD-00 defaults + one FRD per domain (B/F/R)
```

Run `/agents` inside Claude Code to confirm the six agents loaded, then start with
the kickoff prompt in `docs/EXECUTION_GUIDE.md`. (Linked from the root README.)

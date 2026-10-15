---
name: ai-evidence-log
description: Mandatory logging protocol that produces the Task 3 evidence. Use this skill EVERY time code is generated — before refactoring it — to append the verbatim prompt and raw output to docs/AI_LOG.md. Also use it when compiling or auditing TASK_REPORT.md. Skipping this log makes Task 3 impossible to write honestly.
---

# AI evidence log (feeds FR-R1 / Task 3)

The brief requires **real prompts** and a **raw vs. refactored** comparison. Those
can only come from a log written during the work, not reconstructed afterwards.

## Protocol

Append to `docs/AI_LOG.md` (create it if absent) one entry per meaningful generation:

```markdown
## 2026-10-15 14:32 — P1 backend — ApplicantSummaryService aggregation

**Prompt (verbatim):**
```text
<the exact prompt used, unedited>
```

**Raw output (before refactor):**
```php
<the generated code as produced>
```

**Refactor notes:** what changed and why — name defects technically
(N+1, missing zero-guard, `any`, color-only badge, missing disabled state).
```

## Rules

- Log **before** refactoring — the raw version is the valuable artifact.
- Never edit past entries; the log is append-only history.
- Review findings from the `code-reviewer` agent are appended under
  `## Review findings — <phase> — <date>`.
- Track rough timestamps per phase — they become the velocity analysis numbers.
- `TASK_REPORT.md` may only cite prompts/snippets that exist in this file.

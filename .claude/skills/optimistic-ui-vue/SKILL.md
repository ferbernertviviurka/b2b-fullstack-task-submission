---
name: optimistic-ui-vue
description: Pattern for optimistic status updates with rollback in Vue 3. Use this skill whenever implementing or reviewing the Shortlist/Reject actions, or any mutation that should give instant UI feedback with safe failure handling (FR-F5) — even if the task just says "make the buttons work".
---

# Optimistic update with rollback (FR-F5)

The sequence, always in this order:

1. **Snapshot** the current status before touching anything.
2. **Apply locally**: set the new status, flag `isTransitioning = true`, disable both
   action buttons.
3. **Call the API** (or the mock handler).
4. **Settle**: on success clear `isTransitioning`; on failure restore the snapshot,
   clear `isTransitioning`, and surface a visible error message.

## Composable sketch

```ts
import { ref } from 'vue'
import type { ApplicantStatus } from '~/types/applicant'

export function useApplicantActions(applicant: { id: string; status: ApplicantStatus }) {
  const isTransitioning = ref(false)
  const error = ref<string | null>(null)

  async function setStatus(next: ApplicantStatus) {
    const previous = applicant.status
    applicant.status = next            // optimistic
    isTransitioning.value = true
    error.value = null
    try {
      await $fetch(`/api/applicants/${applicant.id}/status`, {
        method: 'PATCH',
        body: { status: next },
      })
    } catch {
      applicant.status = previous      // rollback
      error.value = 'Could not update status. Please try again.'
    } finally {
      isTransitioning.value = false
    }
  }

  return { isTransitioning, error, setStatus }
}
```

## Non-negotiables

- Buttons carry `:disabled="isTransitioning"` — double submits are a defect.
- The card gets `aria-busy` while transitioning; the new status is announced with
  text, not only a color change.
- The rollback path is tested (mock a failing request and assert the status reverts
  and the error shows) — this is exactly the kind of edge AI output tends to skip,
  which makes it good Task 3 material.

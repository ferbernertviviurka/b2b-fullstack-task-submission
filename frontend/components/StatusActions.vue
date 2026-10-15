<template>
  <!-- Fragment root: the card footer is the layout (2-col grid below sm, flex from sm). Spinner keyed on the target being
       saved, not `status`: a refetch mid-PATCH may briefly reset the row to the server's value. -->
  <UiButton
    v-for="action in ACTIONS"
    :key="action.status"
    class="min-h-11 w-full sm:min-h-0 sm:w-auto"
    :label="action.label"
    :intent="action.intent"
    :loading="saving === action.status"
    :disabled="saving !== undefined || status === action.status"
    :data-test="action.status"
    @click="emit('change', action.status)"
  />
</template>

<script setup lang="ts">
import type { ApplicantStatus } from '~/types/applicant'

// `saving`: the status being PATCHed right now (undefined when idle); both buttons are disabled while it is set (FR-F27).
defineProps<{ status: ApplicantStatus; saving?: ApplicantStatus }>()
const emit = defineEmits<{ change: [status: ApplicantStatus] }>()

// Danger-soft Reject first (FR-F31), primary last (FR-F20); DOM order = visual order = tab order.
const ACTIONS = [
  { status: 'rejected', label: 'Reject', intent: 'danger-soft' },
  { status: 'shortlisted', label: 'Shortlist', intent: 'primary' },
] as const
</script>

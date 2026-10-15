<template>
  <article
    :aria-busy="saving !== undefined"
    :class="SHELLS[applicant.attributes.status]"
    class="group flex h-full flex-col rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0 max-sm:px-4 max-sm:shadow-none"
    data-test="applicant"
  >
    <div class="flex items-start justify-between gap-3 max-sm:flex-wrap max-sm:gap-y-2">
      <div :class="blur" class="flex min-w-0 items-center gap-3">
        <!-- FR-F38: engraved edge inside the same size-10 box (inset ring + inner shadow paint inside, no size change). -->
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-700 ring-1 ring-black/10 ring-inset inset-shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:ring-white/15"
          aria-hidden="true"
          data-test="avatar"
          v-text="initials(applicant.attributes.name)"
        />
        <div class="min-w-0">
          <h3
            :class="applicant.attributes.status === 'rejected' ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'"
            class="truncate text-sm font-semibold"
            :title="applicant.attributes.name"
            v-text="applicant.attributes.name"
          />
          <p class="text-xs text-gray-500">
            Applied <time :datetime="applicant.attributes.applied_at" :title="fullDate(applicant.attributes.applied_at)" v-text="relativeDate(applicant.attributes.applied_at, now)" />
          </p>
        </div>
      </div>
      <p class="flex shrink-0" aria-live="polite" data-test="status">
        <!-- FR-F28: keyed by status, so apply AND rollback mount a fresh chip that animates in. Leave is instant (done() at
             once), so the live region never holds the old and new chip together (one announcement, not two). -->
        <span class="sr-only">Status:</span> <Transition
          appear
          enter-active-class="motion-safe:transition motion-safe:duration-200 motion-safe:ease-out"
          enter-from-class="motion-safe:scale-90 motion-safe:opacity-0"
          enter-to-class="scale-100 opacity-100"
          @leave="(_el: Element, done: () => void) => done()"
        >
          <span
            :key="applicant.attributes.status"
            :class="STATUS_CHIPS[applicant.attributes.status]"
            class="rounded-full px-2.5 py-0.5 text-xs font-medium"
            data-test="status-chip"
            v-text="STATUS_LABELS[applicant.attributes.status]"
          />
        </Transition>
      </p>
    </div>

    <ScoreBadge :class="blur" class="mt-4" :score="applicant.attributes.ai_score" />

    <HighlightsList :class="blur" class="mt-4 flex-1" :highlights="applicant.attributes.highlights" :accent="tierFor(applicant.attributes.ai_score).accent" />

    <div :class="blur" class="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 sm:flex sm:justify-end dark:border-gray-800">
      <StatusActions :status="applicant.attributes.status" :saving="saving" @change="emit('change', $event)" />
    </div>
    <p v-if="error" role="alert" class="mt-2 text-sm text-red-700" v-text="error" />
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApplicantResource, ApplicantStatus } from '~/types/applicant'
import { fullDate, initials, relativeDate } from '~/utils/format'
import { tierFor } from '~/utils/tier'

// `now` comes from the container so the relative date is deterministic (tests, SSR).
// `saving`: the status being PATCHed for this applicant (undefined when idle).
const props = defineProps<{ applicant: ApplicantResource; now: number; saving?: ApplicantStatus; error?: string }>()
const emit = defineEmits<{ change: [status: ApplicantStatus] }>()

const STATUS_LABELS: Record<ApplicantStatus, string> = {
  pending: 'Pending review',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
}
// Rejected is muted by palette, not opacity (Decision — P2.2 rejected-state contrast, C): gray-50 card, every text ≥ 4.5:1;
// the red status chip carries the meaning.
const SHELLS: Record<ApplicantStatus, string> = {
  pending: 'bg-white dark:bg-gray-900',
  shortlisted: 'bg-white ring-1 ring-emerald-200 dark:bg-gray-900 dark:ring-emerald-900',
  rejected: 'bg-gray-50 dark:bg-gray-950',
}
// FR-F35 (Decision — FR-F35 blur vs P2.2 rejected-contrast decision, A): rejected blurs the content blocks only — the
// chip shares the header row, so the name block, score, highlights and footer each get it and the chip and the shell's
// border stay sharp. Hovering or focusing anywhere in the card (`group`) clears it; no opacity/saturate (AA palette).
// Hover-capable devices only (Decision — FR-F35 blur on touch devices, A): touch has no non-destructive way to clear it.
// The undo path stays live: Reject is natively disabled, Shortlist enabled, so no aria-disabled is needed.
const blur = computed(() => [
  'transition-[filter] duration-300 motion-reduce:transition-none',
  props.applicant.attributes.status === 'rejected' && '[@media(hover:hover)]:blur-[1px] group-hover:blur-none group-focus-within:blur-none',
])

const STATUS_CHIPS: Record<ApplicantStatus, string> = {
  pending: 'text-gray-600 ring-1 ring-inset ring-gray-300 dark:text-gray-400 dark:ring-gray-700',
  shortlisted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
}
</script>

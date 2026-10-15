<script setup lang="ts">
import { computed, ref } from 'vue'
import { useApplicantSummary } from '~/composables/useApplicantSummary'
import type { ApplicantResource, ApplicantStatus } from '~/types/applicant'

const props = defineProps<{ campaignId: number }>()

const minScore = ref(0)
const { data, pending, error, refresh } = useApplicantSummary(props.campaignId, minScore)

// Text-only so the aria-live region stays mounted and announces changes (finding #8).
const matchCount = computed(() => {
  if (!data.value || pending.value || error.value) return ''
  const { total } = data.value.meta.pagination
  const shown = data.value.data.length
  const count = `${total} matching applicant${total === 1 ? '' : 's'}`
  return shown < total ? `${count} · Showing ${shown} of ${total}` : count
})

// FR-F3: thresholds match FRD-00 (≥ 70 eligible, ≥ 90 top-tier); the label carries the meaning, color only reinforces it.
function tier(score: number): { label: string; classes: string } {
  if (score >= 90) return { label: 'Top-tier', classes: 'bg-green-100 text-green-800 ring-green-600/30' }
  if (score >= 70) return { label: 'Eligible', classes: 'bg-amber-100 text-amber-800 ring-amber-600/30' }
  return { label: 'Below threshold', classes: 'bg-gray-100 text-gray-700 ring-gray-500/30' }
}

const STATUS_LABELS: Record<ApplicantStatus, string> = {
  pending: 'Pending review',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
}

// UTC so server and client render the same string.
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

// FR-F5: optimistic update per applicant, following the optimistic-ui-vue skill.
const busy = ref<Record<string, boolean>>({})
const actionErrors = ref<Record<string, string>>({})

// A refetch may replace `data` while the PATCH is in flight, so settle onto the current row for that id.
function setCurrentStatus(id: string, status: ApplicantStatus): void {
  const current = data.value?.data.find(a => a.id === id)
  if (current) current.attributes.status = status
}

async function setStatus(applicant: ApplicantResource, next: ApplicantStatus): Promise<void> {
  const { id, attributes: { name, status: previous } } = applicant
  applicant.attributes.status = next
  busy.value[id] = true
  delete actionErrors.value[id]
  try {
    await $fetch(`/api/v1/applicants/${id}/status`, { method: 'PATCH', body: { status: next } })
    setCurrentStatus(id, next)
  } catch {
    setCurrentStatus(id, previous)
    actionErrors.value[id] = `Could not update ${name}'s status. Please try again.`
  } finally {
    delete busy.value[id]
  }
}
</script>

<template>
  <section aria-labelledby="applicant-review-title" class="mx-auto max-w-3xl space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <header class="space-y-4">
      <h2 id="applicant-review-title" class="text-xl font-semibold text-gray-900">Applicant review</h2>
      <dl v-if="data" class="grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt class="text-gray-500">Total applicants</dt>
          <dd class="text-lg font-semibold">{{ data.meta.summary.total_applicants }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Eligible (≥ 70)</dt>
          <dd class="text-lg font-semibold">{{ data.meta.summary.eligible_applicants }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Average AI score</dt>
          <dd class="text-lg font-semibold">{{ data.meta.summary.average_ai_score.toFixed(2) }}</dd>
        </div>
      </dl>
    </header>

    <div class="space-y-1">
      <label for="min-score" class="block text-sm font-medium text-gray-700">Minimum AI score: {{ minScore }}</label>
      <input id="min-score" v-model.number="minScore" type="range" min="0" max="100" step="5" class="w-full accent-gray-900">
      <p class="text-sm text-gray-500" aria-live="polite" data-test="match-count">{{ matchCount }}</p>
    </div>

    <div v-if="error" role="alert" class="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <span>{{ error }}</span>
      <button type="button" class="font-medium underline" @click="refresh">Retry</button>
    </div>

    <div v-else-if="pending" role="status" aria-busy="true" class="space-y-4" data-test="skeleton">
      <span class="sr-only">Loading applicants…</span>
      <div v-for="n in 3" :key="n" class="animate-pulse space-y-3 rounded-lg border border-gray-100 p-4" aria-hidden="true">
        <div class="h-4 w-1/3 rounded bg-gray-200" />
        <div class="h-3 w-1/4 rounded bg-gray-200" />
        <div class="h-3 w-2/3 rounded bg-gray-200" />
      </div>
    </div>

    <div v-else-if="data && data.meta.summary.total_applicants === 0" class="rounded-lg border border-dashed border-gray-300 p-8 text-center" data-test="empty">
      <p class="font-medium text-gray-900">No one has applied to this campaign yet.</p>
    </div>

    <div v-else-if="data && data.data.length === 0" class="rounded-lg border border-dashed border-gray-300 p-8 text-center" data-test="empty">
      <p class="font-medium text-gray-900">No applicants match this minimum score.</p>
      <p class="mt-1 text-sm text-gray-500">Lower the threshold or clear the filter to see everyone.</p>
      <button type="button" class="mt-4 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white" @click="minScore = 0">
        Clear filter
      </button>
    </div>

    <ul v-else-if="data" class="space-y-4">
      <li v-for="applicant in data.data" :key="applicant.id">
        <article :aria-busy="busy[applicant.id] === true" class="space-y-3 rounded-lg border border-gray-200 p-4" data-test="applicant">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="font-semibold text-gray-900">{{ applicant.attributes.name }}</h3>
              <p class="text-sm text-gray-500">
                Applied <time :datetime="applicant.attributes.applied_at">{{ dateFormat.format(new Date(applicant.attributes.applied_at)) }}</time>
              </p>
            </div>
            <span
              :class="tier(applicant.attributes.ai_score).classes"
              class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
              data-test="badge"
            >
              {{ tier(applicant.attributes.ai_score).label }} · <span class="sr-only">AI score</span> {{ applicant.attributes.ai_score }}
            </span>
          </div>

          <ul class="list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li v-for="(highlight, index) in applicant.attributes.highlights.slice(0, 4)" :key="index">{{ highlight }}</li>
          </ul>

          <div class="flex items-center justify-between gap-4">
            <p class="text-sm" aria-live="polite" data-test="status">
              Status: <strong>{{ STATUS_LABELS[applicant.attributes.status] }}</strong>
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                :disabled="busy[applicant.id] || applicant.attributes.status === 'shortlisted'"
                @click="setStatus(applicant, 'shortlisted')"
              >
                Shortlist
              </button>
              <button
                type="button"
                class="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
                :disabled="busy[applicant.id] || applicant.attributes.status === 'rejected'"
                @click="setStatus(applicant, 'rejected')"
              >
                Reject
              </button>
            </div>
          </div>
          <p v-if="actionErrors[applicant.id]" role="alert" class="text-sm text-red-700">{{ actionErrors[applicant.id] }}</p>
        </article>
      </li>
    </ul>
  </section>
</template>

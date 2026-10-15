import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { ApplicantSummaryDocument, JsonApiErrorDocument } from '~/types/applicant'

export const FILTER_DEBOUNCE_MS = 300
// ponytail: no pager UI, first 100 (backend max page[size]) filtered rows only; add a pager when a campaign outgrows that.
const PAGE_SIZE = 100

function isErrorDocument(value: unknown): value is JsonApiErrorDocument {
  return typeof value === 'object' && value !== null && 'errors' in value && Array.isArray(value.errors)
}

/** JSON:API `errors[0].detail` when the API sent one, otherwise a generic message. */
export function errorMessage(e: unknown, fallback: string): string {
  const body: unknown = typeof e === 'object' && e !== null && 'data' in e ? e.data : undefined
  return isErrorDocument(body) && body.errors[0] ? body.errors[0].detail : fallback
}

export function useApplicantSummary(campaignId: number, minScore: Ref<number>) {
  const data = ref<ApplicantSummaryDocument | null>(null)
  const pending = ref(true)
  const error = ref<string | null>(null)
  let latest = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function refresh(): Promise<void> {
    const request = ++latest
    pending.value = true
    error.value = null
    try {
      const document = await $fetch<ApplicantSummaryDocument>(`/api/v1/campaigns/${campaignId}/applicant-summary`, {
        query: { min_score: minScore.value, 'page[size]': PAGE_SIZE },
      })
      if (request === latest) data.value = document
    } catch (e) {
      if (request === latest) error.value = errorMessage(e, 'Could not load applicants.')
    } finally {
      // An older, slower response must not overwrite a newer filter's result.
      if (request === latest) pending.value = false
    }
  }

  watch(minScore, () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, FILTER_DEBOUNCE_MS)
  })
  onMounted(refresh)
  onBeforeUnmount(() => clearTimeout(timer))

  return { data, pending, error, refresh }
}

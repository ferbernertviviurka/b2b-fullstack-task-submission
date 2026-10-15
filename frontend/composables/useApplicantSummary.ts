import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { ApplicantSummaryDocument, JsonApiErrorDocument } from '~/types/applicant'

export const FILTER_DEBOUNCE_MS = 300
/** FR-F33: infinite scroll page size (FR-B6 `page[size]`), same in mock and proxy mode. */
export const PAGE_SIZE = 10

function isErrorDocument(value: unknown): value is JsonApiErrorDocument {
  return typeof value === 'object' && value !== null && 'errors' in value && Array.isArray(value.errors)
}

/** JSON:API `errors[0].detail` when the API sent one, otherwise a generic message. */
export function errorMessage(e: unknown, fallback: string): string {
  const body: unknown = typeof e === 'object' && e !== null && 'data' in e ? e.data : undefined
  return isErrorDocument(body) && body.errors[0] ? body.errors[0].detail : fallback
}

/**
 * FR-F8/F33. `data` holds every page loaded so far for the current filter (meta/links from the latest page).
 * `pending` = first page of a (re)load; `loadingMore` = an appended page.
 */
export function useApplicantSummary(campaignId: number, minScore: Ref<number>) {
  const data = ref<ApplicantSummaryDocument | null>(null)
  const pending = ref(true)
  const error = ref<string | null>(null)
  const loadingMore = ref(false)
  const loadMoreError = ref<string | null>(null)
  // Generation counter: every refresh bumps it, so any older response (first page OR appended page) is dropped.
  let latest = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  // Never follow `links.next` itself: in proxy mode it is an absolute Laravel URL that would skip the Nuxt route
  // (and the server-side token). Its presence plus meta.pagination decide; the page is fetched through our route.
  const hasNext = computed(() => {
    const doc = data.value
    return doc !== null && doc.links.next !== null && doc.meta.pagination.page < doc.meta.pagination.total_pages
  })

  const fetchPage = (page: number) =>
    $fetch<ApplicantSummaryDocument>(`/api/v1/campaigns/${campaignId}/applicant-summary`, {
      query: { 'min_score': minScore.value, 'page[size]': PAGE_SIZE, 'page[number]': page },
    })

  async function refresh(): Promise<void> {
    const request = ++latest
    pending.value = true
    error.value = null
    loadingMore.value = false
    loadMoreError.value = null
    try {
      const document = await fetchPage(1)
      if (request === latest) data.value = document
    } catch (e) {
      if (request === latest) error.value = errorMessage(e, 'Could not load applicants.')
    } finally {
      // An older, slower response must not overwrite a newer filter's result.
      if (request === latest) pending.value = false
    }
  }

  async function loadMore(): Promise<void> {
    const current = data.value
    if (!current || !hasNext.value || pending.value || loadingMore.value) return
    const request = latest
    loadingMore.value = true
    loadMoreError.value = null
    try {
      const document = await fetchPage(current.meta.pagination.page + 1)
      if (request !== latest || !data.value) return
      // Same row objects are kept (optimistic status edits survive); an id already shown is skipped.
      // ponytail: offset paging can still skip a row if the set shifts between pages; cursor paging if that matters.
      const seen = new Set(data.value.data.map(a => a.id))
      data.value = { ...document, data: [...data.value.data, ...document.data.filter(a => !seen.has(a.id))] }
    } catch (e) {
      if (request === latest) loadMoreError.value = errorMessage(e, 'Could not load more applicants.')
    } finally {
      if (request === latest) loadingMore.value = false
    }
  }

  watch(minScore, () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, FILTER_DEBOUNCE_MS)
  })
  onMounted(refresh)
  onBeforeUnmount(() => clearTimeout(timer))

  return { data, pending, error, refresh, hasNext, loadingMore, loadMoreError, loadMore }
}

// Decision B (scoped): proxy GET applicant-summary to Laravel when NUXT_BACKEND_URL is set.
// Pure (no h3/Nuxt runtime) so it is unit-testable; the route wires it to the event.
import type { JsonApiErrorDocument } from '~/types/applicant'

export interface ProxyResult {
  status: number
  contentType: string
  body: string
}

/** `null` when no backend is configured → caller serves the FR-B7 mock. */
export async function proxyApplicantSummary(
  { backendUrl, partnerToken }: { backendUrl: string, partnerToken: string },
  campaignId: string,
  search: string,
  fetchFn: typeof fetch = fetch,
): Promise<ProxyResult | null> {
  if (!backendUrl) return null
  const url = `${backendUrl.replace(/\/+$/, '')}/api/v1/campaigns/${encodeURIComponent(campaignId)}/applicant-summary${search}`
  try {
    const res = await fetchFn(url, {
      headers: { Accept: 'application/vnd.api+json', 'X-Partner-Token': partnerToken },
      signal: AbortSignal.timeout(10_000),
    })
    return {
      status: res.status,
      contentType: res.headers.get('content-type') ?? 'application/vnd.api+json',
      body: await res.text(),
    }
  } catch {
    const doc: JsonApiErrorDocument = {
      errors: [{ status: '502', title: 'Bad Gateway', detail: 'The applicant backend could not be reached.' }],
    }
    return { status: 502, contentType: 'application/vnd.api+json', body: JSON.stringify(doc) }
  }
}

import { describe, expect, it, vi } from 'vitest'
import { proxyApplicantSummary } from '~/server/utils/backend-proxy'

const config = { backendUrl: 'http://laravel.test/', partnerToken: 'secret-token' }

describe('proxyApplicantSummary', () => {
  it('forwards URL, raw query and token; passes upstream status and body through', async () => {
    const upstream = JSON.stringify({ errors: [{ status: '422', title: 'Invalid parameter', detail: 'x' }] })
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(upstream, {
      status: 422,
      headers: { 'content-type': 'application/vnd.api+json' },
    }))

    const res = await proxyApplicantSummary(config, '1', '?min_score=101&page%5Bsize%5D=100', fetchFn)

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('http://laravel.test/api/v1/campaigns/1/applicant-summary?min_score=101&page%5Bsize%5D=100')
    expect(new Headers(init?.headers).get('X-Partner-Token')).toBe('secret-token')
    expect(res).toEqual({ status: 422, contentType: 'application/vnd.api+json', body: upstream })
  })

  it('returns a JSON:API 502 when the backend is unreachable (no mock fallback)', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => { throw new TypeError('fetch failed') })

    const res = await proxyApplicantSummary(config, '1', '', fetchFn)

    expect(res?.status).toBe(502)
    expect(res?.contentType).toBe('application/vnd.api+json')
    expect(JSON.parse(res?.body ?? '')).toEqual({
      errors: [{ status: '502', title: 'Bad Gateway', detail: 'The applicant backend could not be reached.' }],
    })
  })

  it('returns null (route serves the mock) when backendUrl is unset, without fetching', async () => {
    const fetchFn = vi.fn<typeof fetch>()

    expect(await proxyApplicantSummary({ backendUrl: '', partnerToken: 'x' }, '1', '', fetchFn)).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

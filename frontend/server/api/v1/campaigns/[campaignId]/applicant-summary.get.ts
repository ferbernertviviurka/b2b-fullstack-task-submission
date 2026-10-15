// GET /api/v1/campaigns/{campaignId}/applicant-summary.
// NUXT_BACKEND_URL set → proxy to Laravel (token added server-side); unset → FR-B7 mock (FRD-00 default).
import { applicants, buildApplicantSummary, MOCK_CAMPAIGN_ID } from '~/server/mock/applicant-summary'
import { proxyApplicantSummary } from '~/server/utils/backend-proxy'

export default defineEventHandler(async (event) => {
  const campaignId = getRouterParam(event, 'campaignId') ?? ''
  const res = await proxyApplicantSummary(useRuntimeConfig(event), campaignId, getRequestURL(event).search)
  if (res) {
    setResponseStatus(event, res.status)
    setResponseHeader(event, 'content-type', res.contentType)
    return res.body
  }

  if (!/^[1-9]\d*$/.test(campaignId)) {
    return jsonApiError(event, 422, 'Invalid parameter', 'campaignId must be a positive integer.')
  }
  if (campaignId !== MOCK_CAMPAIGN_ID) {
    return jsonApiError(event, 404, 'Not Found', 'Campaign not found.')
  }

  const query = getQuery(event)
  const minScore = intParam(query.min_score, 0, 100, null)
  const size = intParam(query['page[size]'], 1, 100, 10)
  const number = intParam(query['page[number]'], 1, 1_000_000, 1)
  if (minScore === undefined) return jsonApiError(event, 422, 'Invalid parameter', 'min_score must be an integer between 0 and 100.')
  if (size === undefined || size === null) return jsonApiError(event, 422, 'Invalid parameter', 'page[size] must be an integer between 1 and 100.')
  if (number === undefined || number === null) return jsonApiError(event, 422, 'Invalid parameter', 'page[number] must be a positive integer.')

  setResponseHeader(event, 'content-type', JSON_API)
  return buildApplicantSummary(applicants, { minScore, size, number }, getRequestURL(event).pathname)
})

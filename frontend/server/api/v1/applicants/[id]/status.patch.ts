// FR-F5 status mutation; no backend route exists for it. Logic lives in server/utils/status-update.ts.
import { updateApplicantStatus } from '~/server/utils/status-update'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ status?: unknown }>(event)
  const res = updateApplicantStatus(useRuntimeConfig(event).backendUrl, getRouterParam(event, 'id'), body?.status)
  setResponseStatus(event, res.status)
  setResponseHeader(event, 'content-type', JSON_API)
  return res.body
})

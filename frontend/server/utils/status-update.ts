// FR-F5 PATCH status. Pure (no h3/Nuxt runtime) so both modes are unit-testable; the route wires it to the event.
// Decision A (proxy mode): no FR defines a backend write endpoint, so with backendUrl set the status is kept
// only in this server's memory, by id, and never reaches Laravel.
// ponytail: unbounded in-process map, lost on restart; replace with a real backend endpoint if an FR adds one.
import type { ApplicantDocument, ApplicantStatus, JsonApiErrorDocument } from '~/types/applicant'
import { applicants } from '~/server/mock/applicant-summary'

const STATUSES: ApplicantStatus[] = ['pending', 'shortlisted', 'rejected']

export const proxyStatuses = new Map<string, ApplicantStatus>()

export interface StatusUpdateResult {
  status: number
  body: ApplicantDocument | JsonApiErrorDocument
}

const error = (status: number, title: string, detail: string): StatusUpdateResult =>
  ({ status, body: { errors: [{ status: String(status), title, detail }] } })

export function updateApplicantStatus(
  backendUrl: string,
  id: string | undefined,
  rawStatus: unknown,
  store: Map<string, ApplicantStatus> = proxyStatuses,
): StatusUpdateResult {
  const status = STATUSES.find(s => s === rawStatus)
  const invalidStatus = () => error(422, 'Invalid parameter', 'status must be one of: pending, shortlisted, rejected.')

  if (backendUrl) {
    if (!id || !/^[1-9]\d*$/.test(id)) return error(422, 'Invalid parameter', 'id must be a positive integer.')
    if (!status) return invalidStatus()
    store.set(id, status)
    return { status: 200, body: { data: { type: 'applicants', id, attributes: { status } } } }
  }

  const applicant = applicants.find(a => a.id === id)
  if (!applicant) return error(404, 'Not Found', 'Applicant not found.')
  if (!status) return invalidStatus()
  applicant.attributes.status = status
  return { status: 200, body: { data: applicant } }
}

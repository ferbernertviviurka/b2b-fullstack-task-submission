// Mirrors the FR-B7 contract served by backend/ (ApplicantResource + ApplicantSummaryController).

export type ApplicantStatus = 'pending' | 'shortlisted' | 'rejected'

export interface ApplicantAttributes {
  name: string
  ai_score: number
  status: ApplicantStatus
  /** ISO-8601 UTC, e.g. "2026-10-01T14:30:00Z" */
  applied_at: string
  highlights: string[]
}

export interface ApplicantResource {
  type: 'applicants'
  id: string
  attributes: ApplicantAttributes
}

export interface TopApplicant {
  id: string
  name: string
  ai_score: number
}

/** Campaign-wide: does not change with min_score. */
export interface ApplicantSummary {
  total_applicants: number
  eligible_applicants: number
  average_ai_score: number
  top_applicants: TopApplicant[]
}

export interface Pagination {
  page: number
  size: number
  total_pages: number
  /** Count after min_score is applied. */
  total: number
}

export interface PaginationLinks {
  first: string
  last: string
  prev: string | null
  next: string | null
}

export interface ApplicantSummaryDocument {
  data: ApplicantResource[]
  meta: {
    summary: ApplicantSummary
    pagination: Pagination
  }
  links: PaginationLinks
}

/**
 * Response of the Nuxt-only PATCH status endpoint (not part of the backend).
 * Mock mode returns the full resource; proxy mode only knows id + status (JSON:API partial resource).
 */
export interface ApplicantDocument {
  data: Omit<ApplicantResource, 'attributes'> & { attributes: Partial<ApplicantAttributes> & Pick<ApplicantAttributes, 'status'> }
}

export interface JsonApiError {
  status: string
  title: string
  detail: string
}

export interface JsonApiErrorDocument {
  errors: JsonApiError[]
}

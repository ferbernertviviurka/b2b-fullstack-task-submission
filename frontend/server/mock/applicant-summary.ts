// Fixture + pure builder mirroring backend ApplicantSummaryController/Service (FR-B4–B7).
// Used by the Nitro mock routes and by the Vitest suite.
import type { ApplicantResource, ApplicantSummaryDocument } from '~/types/applicant'

export const MOCK_CAMPAIGN_ID = '1'

const ELIGIBLE_SCORE = 70
const TOP_SCORE = 90
const TOP_LIMIT = 5

const applicant = (id: number, name: string, ai_score: number, applied_at: string, highlights: string[]): ApplicantResource => ({
  type: 'applicants',
  id: String(id),
  attributes: { name, ai_score, status: 'pending', applied_at, highlights },
})

// Module state: the PATCH mock mutates it so a refetch keeps the new status (resets on server restart).
export const applicants: ApplicantResource[] = [
  applicant(1, 'Jane Doe', 96, '2026-10-01T14:30:00Z', ['Strong portfolio', 'Relevant internship', 'Excellent written English', 'Led a student design team', 'Published case study']),
  applicant(2, 'Carlos Mendes', 91, '2026-10-02T09:12:00Z', ['Two years of B2B sales', 'Fluent in Spanish and English', 'Exceeded quota three quarters running']),
  applicant(3, 'Aisha Khan', 90, '2026-10-03T16:45:00Z', ['Data analysis coursework', 'Built a dashboard used by 200 students']),
  applicant(4, 'Liam O\'Brien', 88, '2026-10-02T11:00:00Z', ['Customer support background', 'Clear and structured answers', 'Available immediately']),
  applicant(5, 'Mei Tanaka', 84, '2026-10-04T08:20:00Z', ['Marketing internship', 'Social media growth case', 'Bilingual']),
  applicant(6, 'Noah Schmidt', 77, '2026-10-05T13:05:00Z', ['Event coordination', 'Good teamwork examples']),
  applicant(7, 'Sofia Rossi', 70, '2026-10-05T19:40:00Z', ['Hospitality experience', 'Positive references']),
  applicant(8, 'Ethan Brown', 69, '2026-10-06T10:10:00Z', ['Enthusiastic cover letter', 'Limited relevant experience']),
  applicant(9, 'Fatima Ali', 58, '2026-10-07T07:55:00Z', ['Retail background', 'Answers lacked detail']),
  applicant(10, 'Lucas Silva', 42, '2026-10-08T15:30:00Z', ['Incomplete application', 'No portfolio provided']),
]

export interface SummaryParams {
  minScore: number | null
  size: number
  number: number
}

export function buildApplicantSummary(all: ApplicantResource[], params: SummaryParams, basePath: string): ApplicantSummaryDocument {
  const scores = all.map(a => a.attributes.ai_score)
  const filtered = all
    .filter(a => params.minScore === null || a.attributes.ai_score >= params.minScore)
    .sort((a, b) => b.attributes.ai_score - a.attributes.ai_score || Number(a.id) - Number(b.id))
  const totalPages = Math.max(1, Math.ceil(filtered.length / params.size))
  const url = (page: number) => {
    const query = new URLSearchParams()
    if (params.minScore !== null) query.set('min_score', String(params.minScore))
    query.set('page[number]', String(page))
    query.set('page[size]', String(params.size))
    return `${basePath}?${query}`
  }

  return {
    data: filtered.slice((params.number - 1) * params.size, params.number * params.size),
    meta: {
      // Campaign-wide: ignores min_score (AI_LOG decision "min_score scope vs meta.summary").
      summary: {
        total_applicants: all.length,
        eligible_applicants: scores.filter(s => s >= ELIGIBLE_SCORE).length,
        average_ai_score: all.length ? Math.round((scores.reduce((sum, s) => sum + s, 0) / all.length) * 100) / 100 : 0,
        top_applicants: all
          .filter(a => a.attributes.ai_score >= TOP_SCORE)
          .sort((a, b) => b.attributes.ai_score - a.attributes.ai_score || Number(a.id) - Number(b.id))
          .slice(0, TOP_LIMIT)
          .map(a => ({ id: a.id, name: a.attributes.name, ai_score: a.attributes.ai_score })),
      },
      pagination: { page: params.number, size: params.size, total_pages: totalPages, total: filtered.length },
    },
    links: {
      first: url(1),
      last: url(totalPages),
      prev: params.number > 1 ? url(Math.min(params.number - 1, totalPages)) : null,
      next: params.number < totalPages ? url(params.number + 1) : null,
    },
  }
}

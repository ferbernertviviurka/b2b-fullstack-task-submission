import { afterEach, describe, expect, it } from 'vitest'
import type { ApplicantStatus } from '~/types/applicant'
import { applicants } from '~/server/mock/applicant-summary'
import { updateApplicantStatus } from '~/server/utils/status-update'

const BACKEND = 'http://laravel.test'

describe('updateApplicantStatus', () => {
  afterEach(() => { applicants[0].attributes.status = 'pending' })

  it('proxy mode: accepts any well-formed id, stores the status, skips the fixture', () => {
    const store = new Map<string, ApplicantStatus>()

    const res = updateApplicantStatus(BACKEND, '25', 'shortlisted', store)

    expect(res).toEqual({ status: 200, body: { data: { type: 'applicants', id: '25', attributes: { status: 'shortlisted' } } } })
    expect(store.get('25')).toBe('shortlisted')
    updateApplicantStatus(BACKEND, '1', 'rejected', store)
    expect(applicants[0].attributes.status).toBe('pending')
  })

  it('proxy mode: malformed id or status gives a JSON:API 422 and stores nothing', () => {
    const store = new Map<string, ApplicantStatus>()

    for (const id of ['abc', '0', '01', '1e1', undefined]) {
      const res = updateApplicantStatus(BACKEND, id, 'shortlisted', store)
      expect(res.status).toBe(422)
      expect(res.body).toEqual({ errors: [{ status: '422', title: 'Invalid parameter', detail: 'id must be a positive integer.' }] })
    }
    expect(updateApplicantStatus(BACKEND, '25', 'hired', store).status).toBe(422)
    expect(store.size).toBe(0)
  })

  it('mock mode (no backendUrl): unchanged — fixture lookup, 404 for unknown ids, 422 for bad status', () => {
    expect(updateApplicantStatus('', '25', 'shortlisted').status).toBe(404)
    expect(updateApplicantStatus('', '1', 'hired').status).toBe(422)

    const res = updateApplicantStatus('', '1', 'shortlisted')

    expect(res).toEqual({ status: 200, body: { data: applicants[0] } })
    expect(applicants[0].attributes.status).toBe('shortlisted')
  })
})

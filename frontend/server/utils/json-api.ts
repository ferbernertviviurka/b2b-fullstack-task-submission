import type { H3Event } from 'h3'
import type { JsonApiErrorDocument } from '~/types/applicant'

export const JSON_API = 'application/vnd.api+json'

export function jsonApiError(event: H3Event, status: number, title: string, detail: string): JsonApiErrorDocument {
  setResponseStatus(event, status)
  setResponseHeader(event, 'content-type', JSON_API)
  return { errors: [{ status: String(status), title, detail }] }
}

/** Integer query param in [min, max]; `fallback` when absent, `undefined` when invalid (→ 422). */
export function intParam(value: unknown, min: number, max: number, fallback: number | null): number | null | undefined {
  if (value === undefined || value === '') return fallback
  // Digits only, like Laravel's `integer` rule: rejects '1e1', '0x10', ' 5' and repeated params (arrays).
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined
  const n = Number(value)
  return n >= min && n <= max ? n : undefined
}

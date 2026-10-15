import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApplicantReviewCard from '~/components/ApplicantReviewCard.vue'
import { FILTER_DEBOUNCE_MS } from '~/composables/useApplicantSummary'
import { applicants, buildApplicantSummary } from '~/server/mock/applicant-summary'
import { intParam } from '~/server/utils/json-api'

interface FetchOptions {
  method?: string
  query?: Record<string, number>
  body?: unknown
}

// Stands in for Nuxt's global $fetch: GETs are answered by the same builder the Nitro mock route uses.
const fetchMock = vi.fn((url: string, options?: FetchOptions): Promise<unknown> =>
  Promise.resolve(
    buildApplicantSummary(
      structuredClone(applicants),
      { minScore: options?.query?.min_score ?? null, size: options?.query?.['page[size]'] ?? 10, number: 1 },
      url,
    ),
  ),
)

const summary = (minScore: number | null, size = 100) =>
  buildApplicantSummary(structuredClone(applicants), { minScore, size, number: 1 }, '/api/v1/campaigns/1/applicant-summary')

const mountCard = () => mount(ApplicantReviewCard, { props: { campaignId: 1 } })
const names = (wrapper: ReturnType<typeof mountCard>) => wrapper.findAll('[data-test="applicant"] h3').map(h => h.text())

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('$fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ApplicantReviewCard', () => {
  it('shows a skeleton, then renders applicants with badge, date, bullets and summary', async () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-test="skeleton"]').exists()).toBe(true)

    await flushPromises()

    expect(wrapper.find('[data-test="skeleton"]').exists()).toBe(false)
    expect(names(wrapper)).toHaveLength(10)
    expect(names(wrapper)[0]).toBe('Jane Doe')
    expect(wrapper.findAll('dd').map(d => d.text())).toEqual(['10', '7', '76.50'])
    expect(wrapper.find('[data-test="match-count"]').text()).toBe('10 matching applicants')

    const first = wrapper.find('[data-test="applicant"]')
    expect(first.find('[data-test="badge"]').text()).toBe('Top-tier · AI score 96')
    expect(first.find('time').text()).toBe('Oct 1, 2026')
    expect(first.findAll('ul li')).toHaveLength(4) // fixture has 5 highlights, FR-F4 caps at 4

    // FR-F3: label and color both; Jane 96, Sofia 70, Ethan 69.
    const badges = wrapper.findAll('[data-test="badge"]')
    const badge = (score: string) => badges.find(b => b.text().endsWith(` ${score}`))
    expect(badge('96')?.text()).toBe('Top-tier · AI score 96')
    expect(badge('96')?.classes()).toContain('bg-green-100')
    expect(badge('70')?.text()).toBe('Eligible · AI score 70')
    expect(badge('70')?.classes()).toContain('bg-amber-100')
    expect(badge('69')?.text()).toBe('Below threshold · AI score 69')
    expect(badge('69')?.classes()).toContain('bg-gray-100')
    expect(badge('69')?.find('.sr-only').text()).toBe('AI score')
  })

  it('keeps the live match count mounted and says when rows are truncated', async () => {
    fetchMock.mockResolvedValueOnce(summary(null, 3))
    const wrapper = mountCard()
    const count = wrapper.find('[data-test="match-count"]')
    expect(count.exists()).toBe(true)
    expect(count.text()).toBe('')

    await flushPromises()
    expect(wrapper.find('[data-test="match-count"]').element).toBe(count.element) // same node, text swapped
    expect(count.text()).toBe('10 matching applicants · Showing 3 of 10')
    expect(names(wrapper)).toHaveLength(3)
  })

  it('discards an older filter response that resolves after a newer one', async () => {
    vi.useFakeTimers()
    const wrapper = mountCard()
    await flushPromises()

    let resolveOlder: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOlder = resolve }))
    await wrapper.find('#min-score').setValue('90')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS) // older request (min 90) in flight
    await wrapper.find('#min-score').setValue('95')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS) // newer request (min 95) resolves at once
    await flushPromises()
    expect(names(wrapper)).toEqual(['Jane Doe'])

    resolveOlder(summary(90))
    await flushPromises()
    expect(names(wrapper)).toEqual(['Jane Doe'])
    expect(wrapper.find('[data-test="match-count"]').text()).toBe('1 matching applicant')
  })

  it('keeps the new status when a refetch lands while the PATCH is in flight', async () => {
    vi.useFakeTimers()
    const wrapper = mountCard()
    await flushPromises()
    let resolvePatch: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePatch = resolve }))

    await wrapper.find('[data-test="applicant"] button:nth-of-type(1)').trigger('click')
    await wrapper.find('#min-score').setValue('90')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
    await flushPromises() // refetch replaces data with the server's still-pending row

    resolvePatch({})
    await flushPromises()
    const card = wrapper.find('[data-test="applicant"]')
    expect(card.find('h3').text()).toBe('Jane Doe')
    expect(card.find('[data-test="status"]').text()).toBe('Status: Shortlisted')
    expect(card.findAll('button').map(b => b.element.disabled)).toEqual([true, false])
  })

  it('accepts only plain digit strings as integer query params (mirrors Laravel `integer`)', () => {
    expect(intParam('5', 0, 100, null)).toBe(5)
    expect(intParam(undefined, 0, 100, null)).toBeNull()
    for (const bad of ['1e1', '0x10', ' 5', '-1', '101', ['5']]) expect(intParam(bad, 0, 100, null)).toBeUndefined()
  })

  it('debounces the min-score filter, refetches, and offers a clear-filter action when empty', async () => {
    vi.useFakeTimers()
    const wrapper = mountCard()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await wrapper.find('#min-score').setValue('90')
    await wrapper.find('#min-score').setValue('95')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.lastCall?.[1]?.query?.min_score).toBe(95)
    await flushPromises()

    expect(names(wrapper)).toEqual(['Jane Doe'])
    expect(wrapper.find('[data-test="match-count"]').text()).toBe('1 matching applicant')
    expect(wrapper.findAll('dd').map(d => d.text())).toEqual(['10', '7', '76.50']) // summary stays campaign-wide

    await wrapper.find('#min-score').setValue('100')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
    await flushPromises()
    expect(wrapper.find('[data-test="empty"]').exists()).toBe(true)

    await wrapper.find('[data-test="empty"] button').trigger('click')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
    await flushPromises()
    expect(names(wrapper)).toHaveLength(10)
  })

  it('shortlists optimistically and disables both buttons during the transition', async () => {
    const wrapper = mountCard()
    await flushPromises()
    let resolvePatch: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePatch = resolve }))

    const card = wrapper.find('[data-test="applicant"]')
    await card.get('button:nth-of-type(1)').trigger('click')

    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/applicants/1/status', { method: 'PATCH', body: { status: 'shortlisted' } })
    expect(card.find('[data-test="status"]').text()).toBe('Status: Shortlisted')
    expect(card.attributes('aria-busy')).toBe('true')
    expect(card.findAll('button').map(b => b.element.disabled)).toEqual([true, true])

    resolvePatch({})
    await flushPromises()
    expect(card.find('[data-test="status"]').text()).toBe('Status: Shortlisted')
    expect(card.findAll('button').map(b => b.element.disabled)).toEqual([true, false]) // already shortlisted; can still reject
    expect(card.find('[role="alert"]').exists()).toBe(false)
  })

  it('rolls back and shows a message when the status request fails', async () => {
    const wrapper = mountCard()
    await flushPromises()
    let rejectPatch: (reason: Error) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise((_, reject) => { rejectPatch = reject }))

    const card = wrapper.find('[data-test="applicant"]')
    await card.get('button:nth-of-type(2)').trigger('click')
    expect(card.find('[data-test="status"]').text()).toBe('Status: Rejected')
    expect(card.findAll('button').map(b => b.element.disabled)).toEqual([true, true])

    rejectPatch(new Error('503'))
    await flushPromises()
    expect(card.find('[data-test="status"]').text()).toBe('Status: Pending review')
    expect(card.find('[role="alert"]').text()).toBe('Could not update Jane Doe\'s status. Please try again.')
    expect(card.findAll('button').map(b => b.element.disabled)).toEqual([false, false])
  })

  it('shows the API error detail when loading fails', async () => {
    fetchMock.mockRejectedValueOnce({
      data: { errors: [{ status: '404', title: 'Not Found', detail: 'Campaign not found.' }] },
    })
    const wrapper = mountCard()
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Campaign not found.')
    await wrapper.find('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(names(wrapper)).toHaveLength(10)
  })
})

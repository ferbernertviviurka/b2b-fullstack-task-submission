import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ApplicantReviewCard from '~/components/ApplicantReviewCard.vue'
import { FILTER_DEBOUNCE_MS } from '~/composables/useApplicantSummary'
import { applicants, buildApplicantSummary } from '~/server/mock/applicant-summary'
import type { ApplicantResource } from '~/types/applicant'
import { intParam } from '~/server/utils/json-api'

interface FetchOptions {
  method?: string
  query?: Record<string, number>
  body?: unknown
}

// The rows the mock "server" pages through; a test may swap in a longer list (FR-F33).
let rows: ApplicantResource[] = applicants
// Stands in for Nuxt's global $fetch: GETs are answered by the same builder the Nitro mock route uses.
const serve = (url: string, options?: FetchOptions) =>
  buildApplicantSummary(
    structuredClone(rows),
    { minScore: options?.query?.min_score ?? null, size: options?.query?.['page[size]'] ?? 10, number: options?.query?.['page[number]'] ?? 1 },
    url,
  )
const fetchMock = vi.fn((url: string, options?: FetchOptions): Promise<unknown> => Promise.resolve(serve(url, options)))

const summary = (minScore: number | null, size = 100) =>
  buildApplicantSummary(structuredClone(applicants), { minScore, size, number: 1 }, '/api/v1/campaigns/1/applicant-summary')

const mountCard = () => mount(ApplicantReviewCard, { props: { campaignId: 1 } })
// [shortlist, reject] by name, independent of DOM order (FR-F20 put Reject first).
const disabledButtons = (card: ReturnType<ReturnType<typeof mountCard>['find']>) =>
  ['shortlisted', 'rejected'].map(s => card.get<HTMLButtonElement>(`[data-test="${s}"]`).element.disabled)
const names = (wrapper: ReturnType<typeof mountCard>) => wrapper.findAll('[data-test="applicant"] h3').map(h => h.text())
// The sentence the live region announces (MatchCount's sr-only copy; the visual pill is aria-hidden). '' while empty.
const matchText = (wrapper: ReturnType<typeof mountCard>) => wrapper.get('[data-test="match-count"]').find('[data-test="match-sentence"]').text()

// TextMorph is asserted by final text (FR-F17): with reduced motion torph swaps text instantly, so no animation frames in the DOM.
const reducedMotion = (query: string): MediaQueryList => ({
  matches: query === '(prefers-reduced-motion: reduce)',
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => true,
})

// FR-F25: a controllable IntersectionObserver; `observers` keeps every instance so a test can fire its callback.
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  observed: Element[] = []
  disconnect = vi.fn()
  constructor(
    readonly callback: (entries: Pick<IntersectionObserverEntry, 'isIntersecting' | 'boundingClientRect'>[]) => void,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this)
  }

  observe(el: Element): void { this.observed.push(el) }
  unobserve(): void {}
  fire(isIntersecting: boolean, top: number): void { this.callback([{ isIntersecting, boundingClientRect: DOMRect.fromRect({ y: top }) }]) }
}

beforeEach(() => {
  FakeIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  rows = applicants
  fetchMock.mockClear()
  vi.stubGlobal('$fetch', fetchMock)
  vi.spyOn(window, 'matchMedia').mockImplementation(reducedMotion)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ApplicantReviewCard', () => {
  it('shows a skeleton, then renders applicants with badge, date, bullets and summary', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T14:30:00Z'))
    const wrapper = mountCard()
    const grid = ['grid', 'grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-3', 'gap-4'] // FR-F20: 1 / md:2 / xl:3 columns, gap-4, same for skeleton and list
    expect(wrapper.find('[data-test="skeleton"]').classes()).toEqual(expect.arrayContaining(grid))
    expect(wrapper.find('[data-test="summary-skeleton"]').exists()).toBe(true) // header box reserved on first load (FR-F12)

    await flushPromises()

    expect(wrapper.find('[data-test="skeleton"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="summary-skeleton"]').exists()).toBe(false)
    expect(names(wrapper)).toHaveLength(10)
    expect(names(wrapper)[0]).toBe('Jane Doe')
    expect(wrapper.get('ul:has(> li > [data-test="applicant"])').classes()).toEqual(expect.arrayContaining(grid))
    expect(wrapper.findAll('[data-test="metric-value"]').map(d => d.text())).toEqual(['10', '7', '76.50'])
    expect(matchText(wrapper)).toBe('10 of 10 match')
    expect(wrapper.find('[data-test="truncation"]').exists()).toBe(false)

    const first = wrapper.find('[data-test="applicant"]')
    expect(first.find('[data-test="score-value"]').text()).toBe('96')
    expect(first.find('[data-test="tier-label"]').text()).toBe('Top-tier')
    expect(first.find('time').text()).toBe('2 days ago')
    expect(first.find('time').attributes('title')).toBe('October 1, 2026 at 2:30 PM UTC')
    expect(first.findAll('ul li')).toHaveLength(4) // fixture has 5 highlights, FR-F4 caps at 4

    // FR-F3: label and color both; Jane 96, Sofia 70, Ethan 69.
    const badge = (score: string) => wrapper.findAll('[data-test="badge"]').find(b => b.get('[data-test="score-value"]').text() === score)
    const tier = (score: string) => badge(score)?.get('[data-test="tier-label"]')
    expect(tier('96')?.text()).toBe('Top-tier')
    expect(tier('96')?.classes()).toContain('bg-emerald-100')
    expect(tier('70')?.text()).toBe('Eligible')
    expect(tier('70')?.classes()).toContain('bg-amber-100')
    expect(tier('69')?.text()).toBe('Below threshold')
    expect(tier('69')?.classes()).toContain('bg-gray-100')
    expect(badge('69')?.find('.sr-only').text()).toBe('AI score')
  })

  it('keeps the live match count mounted; no "Showing N of Y" notice under infinite scroll', async () => {
    fetchMock.mockResolvedValueOnce(summary(null, 3))
    const wrapper = mountCard()
    const count = wrapper.find('[data-test="match-count"]')
    expect(count.exists()).toBe(true)
    expect(count.text()).toBe('')
    expect(count.attributes()).toMatchObject({ 'aria-live': 'polite', 'aria-atomic': 'true' })
    // FR-F12: while pending, a pill-shaped placeholder holds the pill's box (no list drop below sm); nothing to announce.
    const placeholder = count.get('[data-test="match-placeholder"]')
    expect(placeholder.attributes('aria-hidden')).toBe('true')
    expect(placeholder.classes()).toEqual(expect.arrayContaining(['block', 'h-7.5', 'rounded-full', 'animate-pulse']))
    expect(count.find('[data-test="match-pill"]').exists()).toBe(false)

    await flushPromises()
    expect(wrapper.find('[data-test="match-count"]').element).toBe(count.element) // same node, content swapped
    expect(count.find('[data-test="match-placeholder"]').exists()).toBe(false)
    expect(count.find('[data-test="match-pill"]').exists()).toBe(true)
    expect(matchText(wrapper)).toBe('10 of 10 match')
    // Announced once, as one sentence: the only live region; the visual pill inside it is aria-hidden.
    expect(count.findAll('[aria-live]')).toHaveLength(0)
    expect(count.get('[data-test="match-pill"]').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('[data-test="truncation"]').exists()).toBe(false) // Decision — "Showing N of Y" (A): removed
    expect(names(wrapper)).toHaveLength(3)
  })

  it('keeps the previous count visible while a filter refetch is pending', async () => {
    vi.useFakeTimers()
    const wrapper = mountCard()
    await flushPromises()

    let resolveRefetch: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveRefetch = resolve }))
    await wrapper.find('#min-score').setValue('95')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
    await flushPromises()

    expect(wrapper.find('[data-test="skeleton"]').exists()).toBe(true)
    expect(matchText(wrapper)).toBe('10 of 10 match') // stale, not blank

    resolveRefetch(summary(95))
    await flushPromises()
    expect(matchText(wrapper)).toBe('1 of 10 match')
  })

  it('animated path (no reduced-motion stub): the screen-reader copy holds the final count', async () => {
    vi.mocked(window.matchMedia).mockRestore()
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false)
    vi.useFakeTimers()
    const wrapper = mountCard()
    await flushPromises()

    await wrapper.find('#min-score').setValue('95')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
    await flushPromises()

    const morph = wrapper.get('[data-test="match-count"] [torph-root]')
    expect(morph.get('[torph-sr]').text()).toBe('1')
    const visual = morph.findAll(':scope > *').filter(child => child.attributes('torph-sr') === undefined)
    expect(visual.length).toBeGreaterThan(0)
    expect(visual.every(child => child.attributes('aria-hidden') === 'true')).toBe(true)
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
    expect(matchText(wrapper)).toBe('1 of 10 match')
  })

  it('keeps the new status when a refetch lands while the PATCH is in flight', async () => {
    vi.useFakeTimers()
    const wrapper = mountCard()
    await flushPromises()
    let resolvePatch: (value: unknown) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePatch = resolve }))

    await wrapper.find('[data-test="applicant"] [data-test="shortlisted"]').trigger('click')
    await wrapper.find('#min-score').setValue('90')
    vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
    await flushPromises() // refetch replaces data with the server's still-pending row

    // The row reads the server's 'pending' again, but the spinner stays on the target being saved.
    const racing = wrapper.find('[data-test="applicant"]')
    expect(racing.find('[data-test="status"]').text()).toBe('Status: Pending review')
    expect(racing.find('[data-test="shortlisted"] [data-test="spinner"]').exists()).toBe(true)
    expect(racing.find('[data-test="rejected"] [data-test="spinner"]').exists()).toBe(false)
    expect(disabledButtons(racing)).toEqual([true, true])

    resolvePatch({})
    await flushPromises()
    const card = wrapper.find('[data-test="applicant"]')
    expect(card.find('h3').text()).toBe('Jane Doe')
    expect(card.find('[data-test="status"]').text()).toBe('Status: Shortlisted')
    expect(disabledButtons(card)).toEqual([true, false])
  })

  it('condenses the sticky summary past the dead zone, expands when the sentinel is back in view, disconnects on unmount (FR-F25)', async () => {
    const wrapper = mountCard()
    await flushPromises()
    // [0] expands (plain viewport), [1] condenses (root grown 64 px upward → fires only once the sentinel is 64 px above)
    const [expand, condense] = FakeIntersectionObserver.instances
    const value = () => wrapper.get('dd').classes()
    expect(FakeIntersectionObserver.instances).toHaveLength(2)
    expect(expand.options).toBeUndefined()
    expect(condense.options).toEqual({ rootMargin: '64px 0px 0px 0px' })
    const sentinel = expand.observed[0]
    expect(condense.observed).toEqual([sentinel])
    expect(wrapper.get('[data-test="sticky-block"]').element.previousElementSibling?.contains(sentinel)).toBe(true) // sentinel sits above the sticky block
    expect(wrapper.get('section').classes()).toContain('[overflow-anchor:none]')
    expect(value()).toContain('sm:text-2xl')

    expand.fire(false, -10) // scrolled past the viewport edge but inside the dead zone: the expand observer never condenses
    await flushPromises()
    expect(value()).toContain('sm:text-2xl')

    condense.fire(false, -70)
    await flushPromises()
    expect(value()).toContain('text-sm') // FR-F36: condensed below sm (sm:text-base from sm)
    expect(wrapper.findAll('[data-test="metric-value"]').map(d => d.text())).toEqual(['10', '7', '76.50'])

    condense.fire(true, -30) // scrolling back up into the dead zone: stays condensed (hysteresis)
    await flushPromises()
    expect(value()).toContain('text-sm')

    expand.fire(true, 0) // sentinel back in view: expanded again
    await flushPromises()
    expect(value()).toContain('sm:text-2xl')

    condense.fire(false, 2000) // below the viewport (not scrolled past): stays expanded
    await flushPromises()
    expect(value()).toContain('sm:text-2xl')

    wrapper.unmount()
    expect(expand.disconnect).toHaveBeenCalledTimes(1)
    expect(condense.disconnect).toHaveBeenCalledTimes(1)
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
    expect(matchText(wrapper)).toBe('1 of 10 match')
    expect(wrapper.findAll('[data-test="metric-value"]').map(d => d.text())).toEqual(['10', '7', '76.50']) // summary stays campaign-wide

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
    await card.get('[data-test="shortlisted"]').trigger('click')

    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/applicants/1/status', { method: 'PATCH', body: { status: 'shortlisted' } })
    expect(card.find('[data-test="status"]').text()).toBe('Status: Shortlisted')
    expect(card.attributes('aria-busy')).toBe('true')
    expect(disabledButtons(card)).toEqual([true, true])

    resolvePatch({})
    await flushPromises()
    expect(card.find('[data-test="status"]').text()).toBe('Status: Shortlisted')
    expect(disabledButtons(card)).toEqual([true, false]) // already shortlisted; can still reject
    expect(card.find('[role="alert"]').exists()).toBe(false)
  })

  it('rolls back and shows a message when the status request fails', async () => {
    const wrapper = mountCard()
    await flushPromises()
    let rejectPatch: (reason: Error) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise((_, reject) => { rejectPatch = reject }))

    const card = wrapper.find('[data-test="applicant"]')
    await card.get('[data-test="rejected"]').trigger('click')
    expect(card.find('[data-test="status"]').text()).toBe('Status: Rejected')
    expect(disabledButtons(card)).toEqual([true, true])

    rejectPatch(new Error('503'))
    await flushPromises()
    expect(card.find('[data-test="status"]').text()).toBe('Status: Pending review')
    expect(card.find('[role="alert"]').text()).toBe('Could not update Jane Doe\'s status. Please try again.')
    expect(disabledButtons(card)).toEqual([false, false])
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

  describe('infinite scroll (FR-F33/F34)', () => {
    // 25 rows → pages of 10, 10, 5. Ids 101–125, scores 99 down to 75 so min_score filters predictably.
    const many = Array.from({ length: 25 }, (_, i) => ({
      ...structuredClone(applicants[0]),
      id: String(101 + i),
      attributes: { ...structuredClone(applicants[0].attributes), name: `Applicant ${101 + i}`, ai_score: 99 - i },
    }))
    const bottom = () => FakeIntersectionObserver.instances.filter(o => o.options?.rootMargin === '0px 0px 200px 0px')
    const live = () => bottom().filter(o => o.disconnect.mock.calls.length === 0)
    const page = (n: number) => fetchMock.mock.calls.filter(([, o]) => o?.query?.['page[number]'] === n).length
    const scrollToEnd = async () => { live().at(-1)?.fire(true, 0); await flushPromises() }

    beforeEach(() => { rows = many })

    it('appends pages through the Nuxt route (page[number], page[size]=10), never the links.next URL', async () => {
      const wrapper = mountCard()
      await flushPromises()
      expect(names(wrapper)).toHaveLength(10)
      expect(fetchMock.mock.lastCall?.[1]?.query).toEqual({ 'min_score': 0, 'page[size]': 10, 'page[number]': 1 })
      expect(live()).toHaveLength(1)
      expect(live()[0].observed[0]).toBe(wrapper.get('[data-test="list-end-sentinel"]').element)

      await scrollToEnd()
      expect(names(wrapper)).toHaveLength(20)
      expect(names(wrapper).slice(9, 11)).toEqual(['Applicant 110', 'Applicant 111'])
      expect(fetchMock.mock.lastCall?.[0]).toBe('/api/v1/campaigns/1/applicant-summary') // our route, not links.next
      expect(fetchMock.mock.lastCall?.[1]?.query).toEqual({ 'min_score': 0, 'page[size]': 10, 'page[number]': 2 })
      expect(matchText(wrapper)).toBe('25 of 25 match') // filtered total, not loaded count
    })

    it('skips an id the next page repeats and keeps the loaded row (with its optimistic status)', async () => {
      const wrapper = mountCard()
      await flushPromises()
      const card110 = () => wrapper.findAll('[data-test="applicant"]').filter(c => c.get('h3').text() === 'Applicant 110')
      await card110()[0].get('[data-test="shortlisted"]').trigger('click')
      await flushPromises()
      // the set shifted between pages: page 2 starts with 110 again (pending on the server's copy)
      const page2 = serve('/api/v1/campaigns/1/applicant-summary', { query: { 'min_score': 0, 'page[size]': 10, 'page[number]': 2 } })
      page2.data[0] = { ...structuredClone(many[9]), attributes: { ...structuredClone(many[9].attributes), status: 'pending' } }
      fetchMock.mockResolvedValueOnce(page2)

      await scrollToEnd()
      expect(names(wrapper)).toHaveLength(19)
      expect(new Set(names(wrapper)).size).toBe(19)
      expect(card110()).toHaveLength(1)
      expect(card110()[0].get('[data-test="status"]').text()).toBe('Status: Shortlisted')
    })

    it('shows 3 append skeletons while loadingMore, ignores observer hits meanwhile, no end row', async () => {
      const wrapper = mountCard()
      await flushPromises()
      let resolvePage: (value: unknown) => void = () => {}
      fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePage = resolve }))

      const observer = live()[0]
      observer.fire(true, 0)
      await flushPromises()
      expect(wrapper.findAll('[data-test="append-skeleton"]')).toHaveLength(3)
      expect(wrapper.get('[data-test="loading-more"]').text()).toBe('Loading more applicants…')
      expect(names(wrapper)).toHaveLength(10) // existing cards stay
      expect(wrapper.find('[data-test="end-of-list"]').exists()).toBe(false)
      expect(observer.disconnect).toHaveBeenCalled() // not observing while loading
      observer.fire(true, 0) // a late hit from the old observer
      await flushPromises()
      expect(page(2)).toBe(1) // never double-fetched

      resolvePage(serve('/api/v1/campaigns/1/applicant-summary', { query: { 'min_score': 0, 'page[size]': 10, 'page[number]': 2 } }))
      await flushPromises()
      expect(wrapper.findAll('[data-test="append-skeleton"]')).toHaveLength(0)
      expect(names(wrapper)).toHaveLength(20)
      const status = wrapper.get('[data-test="loading-more"]') // same live region stays mounted; only its text is cleared
      expect(status.attributes('role')).toBe('status')
      expect(status.text()).toBe('')
    })

    it('stops for good when there is no next page and shows the end row with the filtered total', async () => {
      const wrapper = mountCard()
      await flushPromises()
      await scrollToEnd()
      expect(wrapper.find('[data-test="end-of-list"]').exists()).toBe(false) // page 2 of 3: not the end yet
      await scrollToEnd()

      expect(names(wrapper)).toHaveLength(25)
      expect(live()).toHaveLength(0) // every bottom observer disconnected, none re-created
      const created = bottom().length
      expect(wrapper.find('[data-test="list-end-sentinel"]').exists()).toBe(false)
      expect(wrapper.get('[data-test="end-of-list"]').text()).toBe('You\'ve reached the end — all 25 applicants loaded')
      expect(wrapper.get('[data-test="end-of-list"]').classes()).toEqual(expect.arrayContaining(['flex', 'items-center', 'gap-3', 'text-xs', 'text-gray-500']))
      expect(wrapper.get('[data-test="end-of-list"] .tabular-nums').attributes('style')).toContain('min-width: 2ch') // total ≥ 10 → 2ch (Decision — dynamic count width, A)
      await flushPromises()
      expect(bottom()).toHaveLength(created)
      expect(page(4)).toBe(0)

      wrapper.unmount()
      expect(bottom().every(o => o.disconnect.mock.calls.length > 0)).toBe(true)
    })

    it('a single page shows the end row at once (mock fixture: 10 rows)', async () => {
      rows = applicants
      const wrapper = mountCard()
      await flushPromises()
      expect(bottom()).toHaveLength(0)
      expect(wrapper.get('[data-test="end-of-list"]').text()).toBe('You\'ve reached the end — all 10 applicants loaded')
    })

    it('a failed append keeps the loaded cards and offers an inline retry', async () => {
      const wrapper = mountCard()
      await flushPromises()
      fetchMock.mockRejectedValueOnce(new Error('503'))
      await scrollToEnd()

      expect(names(wrapper)).toHaveLength(10)
      const retry = wrapper.get('[role="alert"]')
      expect(retry.text()).toContain('Could not load more applicants.')
      expect(wrapper.find('[data-test="end-of-list"]').exists()).toBe(false)
      expect(live()).toHaveLength(0) // no auto-retry loop; the button decides

      await retry.get('button').trigger('click')
      await flushPromises()
      expect(names(wrapper)).toHaveLength(20)
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(live()).toHaveLength(1)
    })

    it('a filter change resets to page 1, discards a late page from the old filter, and scrolls the list top back', async () => {
      vi.useFakeTimers()
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      const wrapper = mountCard()
      await flushPromises()
      await scrollToEnd()
      expect(names(wrapper)).toHaveLength(20)

      // page 3 of the OLD filter is in flight when the filter changes
      let resolveOld: (value: unknown) => void = () => {}
      fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      live().at(-1)?.fire(true, 0)
      await flushPromises()
      // list top is under the sticky block (scrolled down) → it must be brought back into view
      vi.spyOn(wrapper.get('[data-test="sticky-block"]').element, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ y: 0, height: 200 }))
      await wrapper.find('#min-score').setValue('95')
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
      await flushPromises()

      expect(fetchMock.mock.lastCall?.[1]?.query).toEqual({ 'min_score': 95, 'page[size]': 10, 'page[number]': 1 })
      expect(names(wrapper)).toEqual(['Applicant 101', 'Applicant 102', 'Applicant 103', 'Applicant 104', 'Applicant 105'])
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
      expect(wrapper.get('[data-test="end-of-list"]').text()).toBe('You\'ve reached the end — all 5 applicants loaded')
      expect(wrapper.get('[data-test="end-of-list"] .tabular-nums').attributes('style')).toContain('min-width: 1ch') // total < 10 → 1ch

      resolveOld(serve('/api/v1/campaigns/1/applicant-summary', { query: { 'min_score': 0, 'page[size]': 10, 'page[number]': 3 } }))
      await flushPromises()
      expect(names(wrapper)).toHaveLength(5) // the stale page never mixes in
      expect(wrapper.findAll('[data-test="append-skeleton"]')).toHaveLength(0)
      expect(matchText(wrapper)).toBe('5 of 25 match')
    })

    it('does not scroll when the list top is already below the sticky block', async () => {
      vi.useFakeTimers()
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      const wrapper = mountCard()
      await flushPromises()
      const block = wrapper.get('[data-test="sticky-block"]').element
      vi.spyOn(block, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ y: 0, height: 200 }))
      vi.spyOn(block.nextElementSibling!, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ y: 400, height: 800 }))
      await wrapper.find('#min-score').setValue('95')
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
      await flushPromises()
      expect(scrollIntoView).not.toHaveBeenCalled() // list top 400 is below the sticky bottom 200
    })

    it('initial skeletons: last row count capped at one page (Decision — P2.1 skeleton count, A)', async () => {
      vi.useFakeTimers()
      const wrapper = mountCard()
      expect(wrapper.findAll('[data-test="skeleton"] > div')).toHaveLength(3) // before the first response
      await flushPromises()
      await scrollToEnd()
      fetchMock.mockImplementationOnce(() => new Promise(() => {}))
      await wrapper.find('#min-score').setValue('80')
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
      await flushPromises()
      expect(wrapper.findAll('[data-test="skeleton"] > div')).toHaveLength(10) // 20 loaded → capped at PAGE_SIZE
    })

    it('optimistic status works on an appended card, and the saving target survives a filter refetch', async () => {
      vi.useFakeTimers()
      const wrapper = mountCard()
      await flushPromises()
      await scrollToEnd()
      const card = () => wrapper.findAll('[data-test="applicant"]').find(c => c.get('h3').text() === 'Applicant 115')
      let resolvePatch: (value: unknown) => void = () => {}
      fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePatch = resolve }))

      await card()?.get('[data-test="shortlisted"]').trigger('click')
      expect(card()?.get('[data-test="status"]').text()).toBe('Status: Shortlisted')
      expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/applicants/115/status', { method: 'PATCH', body: { status: 'shortlisted' } })

      await wrapper.find('#min-score').setValue('80') // refetch replaces every page; 115 (score 85) is on page 2 of the new filter
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS)
      await flushPromises()
      await scrollToEnd()
      expect(card()?.find('[data-test="shortlisted"] [data-test="spinner"]').exists()).toBe(true)
      expect(disabledButtons(card()!)).toEqual([true, true])

      resolvePatch({})
      await flushPromises()
      expect(card()?.get('[data-test="status"]').text()).toBe('Status: Shortlisted')
    })

    it('one sticky block holds summary + filter; condensed hides the tick labels; title spacing one step down', async () => {
      const wrapper = mountCard()
      await flushPromises()
      const block = wrapper.get('[data-test="sticky-block"]')
      expect(block.classes()).toEqual(expect.arrayContaining(['sticky', 'top-0', 'z-20', 'backdrop-blur', 'border-b', 'bg-white/85', 'dark:bg-gray-900/85']))
      expect(block.find('dl').exists()).toBe(true)
      expect(block.find('#min-score').exists()).toBe(true)
      expect(block.find('[data-test="match-count"]').exists()).toBe(true)
      expect(wrapper.findAll('.sticky')).toHaveLength(1)
      expect(wrapper.findAll('.border-b').filter(el => block.element.contains(el.element))).toHaveLength(1) // single border
      expect(wrapper.get('header').classes()).toContain('mb-4') // FR-F29
      expect(wrapper.findAll('[data-test="tick-label"]')).toHaveLength(2)

      FakeIntersectionObserver.instances[1].fire(false, -70)
      await flushPromises()
      expect(wrapper.findAll('[data-test="tick-label"]')).toHaveLength(0)
      expect(wrapper.find('#min-score').exists()).toBe(true)
      expect(matchText(wrapper)).toBe('25 of 25 match')
    })
  })
})

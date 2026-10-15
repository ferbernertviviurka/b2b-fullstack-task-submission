import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ApplicantCard from '~/components/ApplicantCard.vue'
import CardSkeleton from '~/components/CardSkeleton.vue'
import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import ScoreBadge from '~/components/ScoreBadge.vue'
import ScoreFilter from '~/components/ScoreFilter.vue'
import StatusActions from '~/components/StatusActions.vue'
import SummaryHeader from '~/components/SummaryHeader.vue'
import MatchCount from '~/components/ui/MatchCount.vue'
import TextMorph from '~/components/ui/TextMorph.vue'
import type { ApplicantStatus } from '~/types/applicant'
import { tierFor } from '~/utils/tier'

afterEach(() => vi.restoreAllMocks())

describe('ScoreBadge', () => {
  it.each([
    [96, 'Top-tier', 'bg-emerald-500'],
    [90, 'Top-tier', 'bg-emerald-500'],
    [89, 'Eligible', 'bg-amber-500'],
    [70, 'Eligible', 'bg-amber-500'],
    [69, 'Below threshold', 'bg-gray-300'],
  ])('score %i → %s label, %s fill at score%% width, progressbar aria', (score, label, fill) => {
    const wrapper = mount(ScoreBadge, { props: { score } })

    expect(wrapper.get('[data-test="score-value"]').text()).toBe(String(score))
    expect(wrapper.get('[data-test="tier-label"]').text()).toBe(label)
    expect(wrapper.get('[data-test="badge"] .sr-only').text()).toBe('AI score')
    const bar = wrapper.get('[role="progressbar"]')
    expect(bar.attributes()).toMatchObject({
      'aria-valuenow': String(score),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-label': `AI score ${score} out of 100`,
    })
    const fillEl = wrapper.get('[data-test="score-fill"]')
    expect(fillEl.classes()).toEqual(expect.arrayContaining([fill, 'transition-colors', 'duration-300']))
    expect(fillEl.attributes('style')).toContain(`width: ${score}%`)
    expect(wrapper.findAll('[data-test="score-tick"]').map(t => (t.element as HTMLElement).style.left)).toEqual(['70%', '90%'])
  })
})

describe('StatusActions', () => {
  it('emits the chosen status', async () => {
    const wrapper = mount(StatusActions, { props: { status: 'pending' } })
    const [reject, shortlist] = wrapper.findAll('button') // FR-F20: ghost Reject first, primary Shortlist last

    await shortlist.trigger('click')
    await reject.trigger('click')

    expect(wrapper.emitted('change')).toEqual([['shortlisted'], ['rejected']])
  })

  it('disables both buttons while saving and the button for the current status otherwise', async () => {
    const wrapper = mount(StatusActions, { props: { status: 'pending', saving: 'rejected' } })
    const disabled = () => ['shortlisted', 'rejected'].map(s => wrapper.get<HTMLButtonElement>(`[data-test="${s}"]`).element.disabled)

    expect(disabled()).toEqual([true, true])
    await wrapper.setProps({ saving: undefined, status: 'shortlisted' })
    expect(disabled()).toEqual([true, false])
    await wrapper.setProps({ status: 'rejected' })
    expect(disabled()).toEqual([false, true])
  })

  it('replaces the in-flight label with a spinner, keeping the accessible name and the label box', async () => {
    // status still 'pending' (a refetch reset the row): the spinner follows the target being saved, not the status.
    const wrapper = mount(StatusActions, { props: { status: 'pending', saving: 'shortlisted' } })
    const shortlist = wrapper.get('[data-test="shortlisted"]')

    expect(shortlist.find('[data-test="spinner"]').attributes('aria-hidden')).toBe('true')
    expect(shortlist.text()).toBe('Shortlist') // still in the DOM and the a11y tree (opacity-0, not hidden)
    expect(shortlist.get('span').classes()).toContain('opacity-0')
    expect(wrapper.get('[data-test="rejected"]').find('[data-test="spinner"]').exists()).toBe(false)

    await wrapper.setProps({ saving: undefined })
    expect(wrapper.find('[data-test="spinner"]').exists()).toBe(false)
    expect(shortlist.get('span').classes()).not.toContain('opacity-0')
  })

  it('FR-F27: the pressed button renders the spinner; its sibling is disabled without one', () => {
    for (const [pressed, sibling] of [['shortlisted', 'rejected'], ['rejected', 'shortlisted']] as const) {
      const wrapper = mount(StatusActions, { props: { status: 'pending', saving: pressed } })
      const button = (s: ApplicantStatus) => wrapper.get<HTMLButtonElement>(`[data-test="${s}"]`)

      expect(button(pressed).find('[data-test="spinner"]').exists()).toBe(true)
      expect(button(pressed).element.disabled).toBe(true)
      expect(button(sibling).find('[data-test="spinner"]').exists()).toBe(false)
      expect(button(sibling).element.disabled).toBe(true)
      expect(button(sibling).get('span').classes()).not.toContain('opacity-0')
    }
  })

  it('uses the AA-safe button palette (Decision — P2.2 action button contrast, B); Reject is danger-soft (FR-F31)', () => {
    const wrapper = mount(StatusActions, { props: { status: 'pending' } })

    expect(wrapper.get('[data-test="shortlisted"]').classes()).toEqual(expect.arrayContaining(['bg-emerald-700', 'text-white', 'hover:bg-emerald-800', 'active:bg-emerald-900']))
    expect(wrapper.get('[data-test="rejected"]').classes()).toEqual(expect.arrayContaining(['bg-red-50', 'text-red-700', 'hover:bg-red-100', 'active:bg-red-200', 'active:text-red-800']))
  })

  it('has a focus ring that survives forced-colors and clears 3:1 against card and button', () => {
    for (const button of mount(StatusActions, { props: { status: 'pending' } }).findAll('button')) {
      expect(button.classes()).toEqual(expect.arrayContaining(['focus-visible:outline-hidden', 'focus-visible:ring-2', 'focus-visible:ring-gray-900', 'focus-visible:ring-offset-2']))
    }
  })
})

describe('FR-F18 pointer affordance', () => {
  const POINTER = ['cursor-pointer', 'disabled:cursor-not-allowed']

  it('puts cursor-pointer and disabled:cursor-not-allowed on every interactive element', () => {
    const controls = [
      ...mount(StatusActions, { props: { status: 'pending', saving: 'shortlisted' } }).findAll('button'),
      mount(ScoreFilter, { props: { minScore: 0 } }).get('#min-score'),
      mount(EmptyState, { props: { title: 'None', actionLabel: 'Clear filter' } }).get('button'),
      mount(ErrorState, { props: { message: 'Oops' } }).get('button'),
    ]
    for (const control of controls) expect(control.classes()).toEqual(expect.arrayContaining(POINTER))
    const thumb = mount(ScoreFilter, { props: { minScore: 0 } }).get('#min-score').classes()
    expect(thumb).toEqual(expect.arrayContaining([
      '[&::-webkit-slider-thumb]:cursor-pointer',
      '[&::-moz-range-thumb]:cursor-pointer',
      // the thumb is a pseudo-element: the input's disabled:cursor-not-allowed does not reach it
      'disabled:[&::-webkit-slider-thumb]:cursor-not-allowed',
      'disabled:[&::-moz-range-thumb]:cursor-not-allowed',
    ]))
  })
})

describe('ApplicantCard', () => {
  const applicant = (status: ApplicantStatus) => ({
    type: 'applicants' as const,
    id: '1',
    attributes: { name: '  Jane  Doe ', ai_score: 75, status, applied_at: '2026-10-01T14:30:00Z', highlights: ['a', 'b', 'c', 'd'] },
  })
  const mountCard = (status: ApplicantStatus) =>
    mount(ApplicantCard, { props: { applicant: applicant(status), now: Date.parse('2026-10-03T14:30:00Z') } })

  it.each([
    ['pending', 'Pending review', ['ring-1', 'ring-gray-300'], ['bg-white', 'dark:bg-gray-900'], 'text-gray-900'],
    ['shortlisted', 'Shortlisted', ['bg-emerald-50', 'text-emerald-700'], ['bg-white', 'ring-1', 'ring-emerald-200', 'dark:ring-emerald-900'], 'text-gray-900'],
    // Decision C: muted palette (gray-50 card, gray-600 name, all text ≥ 4.5:1) instead of opacity; the red chip carries the meaning.
    ['rejected', 'Rejected', ['bg-red-50', 'text-red-700'], ['bg-gray-50', 'dark:bg-gray-950'], 'text-gray-600'],
  ] as const)('%s → chip "%s" with its classes and the state palette', (status, label, chipClasses, shellClasses, nameColor) => {
    const wrapper = mountCard(status)
    const chip = wrapper.get('[data-test="status-chip"]')
    const article = wrapper.get('article')

    expect(wrapper.get('[data-test="status"]').text()).toBe(`Status: ${label}`)
    expect(chip.classes()).toEqual(expect.arrayContaining([...chipClasses, 'rounded-full', 'px-2.5', 'py-0.5', 'text-xs', 'font-medium']))
    expect(article.classes()).toEqual(expect.arrayContaining([...shellClasses]))
    expect(article.classes().includes('ring-emerald-200')).toBe(status === 'shortlisted')
    expect(article.classes().includes('bg-white')).toBe(status !== 'rejected')
    expect(wrapper.get('h3').classes()).toContain(nameColor)
    // No opacity/filter anywhere: it would push text below AA and fade the undo buttons.
    // (prefix match, so the test file itself doesn't make Tailwind emit the dead utilities)
    expect(wrapper.findAll('*').flatMap(el => el.classes()).filter(c => /^(opacity|saturate)-/.test(c))).toEqual([])
  })

  it('FR-F28: the chip re-mounts on apply and on rollback, with one chip and the live-region copy intact (real <Transition>)', async () => {
    const wrapper = mount(ApplicantCard, {
      props: { applicant: applicant('pending'), now: 0 },
      global: { stubs: { transition: false } },
    })
    const region = wrapper.get('[data-test="status"]')
    const chip = () => wrapper.get('[data-test="status-chip"]')
    const first = chip().element

    await wrapper.setProps({ applicant: applicant('shortlisted') }) // optimistic apply
    // Checked right after the patch, before any animation frame: the leaving chip must already be gone.
    expect(wrapper.findAll('[data-test="status-chip"]')).toHaveLength(1)
    expect(chip().element).not.toBe(first) // keyed: a fresh node, so the enter transition runs
    expect(region.text()).toBe('Status: Shortlisted')

    const applied = chip().element
    await wrapper.setProps({ applicant: applicant('pending') }) // rollback
    expect(wrapper.findAll('[data-test="status-chip"]')).toHaveLength(1)
    expect(chip().element).not.toBe(applied) // reverting re-animates too
    expect(region.text()).toBe('Status: Pending review')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.get('.sr-only').text()).toBe('Status:')
    expect(chip().classes()).toEqual(expect.arrayContaining(['rounded-full', 'ring-1', 'ring-gray-300']))
  })

  it('renders initials, a relative date with the full date in title, and tier-accented icons', () => {
    const wrapper = mountCard('pending')

    expect(wrapper.get('[data-test="avatar"]').text()).toBe('JD')
    expect(wrapper.get('h3').attributes('title')).toBe('  Jane  Doe ') // truncated name stays recoverable
    const time = wrapper.get('time')
    expect(time.text()).toBe('2 days ago')
    expect(time.attributes()).toMatchObject({ datetime: '2026-10-01T14:30:00Z', title: 'October 1, 2026 at 2:30 PM UTC' })
    const icons = wrapper.findAll('[data-test="highlight-icon"]')
    expect(icons).toHaveLength(4)
    expect(icons.every(i => i.classes().includes('text-amber-500'))).toBe(true)
    for (const li of wrapper.findAll('li')) {
      expect(li.classes()).toEqual(expect.arrayContaining(['text-sm', 'leading-relaxed']))
      expect(li.get('[title]').classes()).toEqual(expect.arrayContaining(['line-clamp-2', 'text-gray-600', 'dark:text-gray-400']))
    }
  })

  it('CardSkeleton mirrors the card section by section (FR-F12): shell, header, score row + bar, 4 highlight rows, footer', () => {
    const card = mountCard('pending').get('article').element
    const skeleton = mount(CardSkeleton).get('div').element // root div (the leading comment makes the wrapper a fragment)
    // FR-F35's blur/transition classes are state styling, not layout; the skeleton has no rejected state to mirror.
    const classes = (el: Element) => [...el.classList].filter(c => !/blur|transition|duration|motion-reduce/.test(c)).sort()
    const [cardHeader, cardScore, cardHighlights, cardFooter] = [...card.children]
    const [skHeader, skScore, skHighlights, skFooter] = [...skeleton.children]

    expect(skeleton.children).toHaveLength(4)
    expect([...skeleton.classList].filter(c => c !== 'animate-pulse').every(c => card.classList.contains(c))).toBe(true)
    expect(classes(skHeader)).toEqual(classes(cardHeader))
    // score block: number row (text-2xl = 32 px line, skeleton h-8) and the same h-1.5 bar
    expect(classes(skScore)).toEqual(classes(cardScore))
    expect(cardScore.querySelector('[data-test="score-value"]')?.classList.contains('text-2xl')).toBe(true)
    expect(skScore.children[0].classList.contains('h-8')).toBe(true)
    const barBox = ['mt-2', 'h-1.5', 'w-full', 'rounded-full']
    expect(barBox.every(c => cardScore.querySelector('[role="progressbar"]')?.classList.contains(c))).toBe(true)
    expect(barBox.every(c => skScore.children[1].classList.contains(c))).toBe(true)
    // highlights: 4 rows on the same text-sm/leading-relaxed line box
    expect(classes(skHighlights)).toEqual(classes(cardHighlights))
    expect(skHighlights.children).toHaveLength(cardHighlights.children.length)
    for (const row of skHighlights.children) expect(['text-sm', 'leading-relaxed', 'h-[1lh]'].every(c => row.classList.contains(c))).toBe(true)
    // footer: same divider box, two button-height blocks for the two buttons (FR-F26: 44 px below sm, 36 px from sm)
    expect(classes(skFooter)).toEqual(classes(cardFooter))
    expect(skFooter.children).toHaveLength(cardFooter.querySelectorAll('button').length)
    for (const block of skFooter.children) expect(['h-11', 'sm:h-9'].every(c => block.classList.contains(c))).toBe(true)
    for (const button of cardFooter.querySelectorAll('button')) expect(['min-h-11', 'sm:min-h-0'].every(c => button.classList.contains(c))).toBe(true)
  })

  it('mobile anatomy (FR-F24/F26): full-bleed shell below sm, wrapping header, 2-col footer grid, truncation guards', () => {
    const wrapper = mountCard('pending')
    const card = wrapper.get('article')
    const skeleton = mount(CardSkeleton).get('div')
    const mobileShell = ['max-sm:rounded-none', 'max-sm:border-x-0', 'max-sm:border-t-0', 'max-sm:shadow-none', 'rounded-2xl', 'border', 'p-5', 'shadow-sm']

    expect(card.classes()).toEqual(expect.arrayContaining(mobileShell))
    expect(skeleton.classes()).toEqual(expect.arrayContaining(mobileShell))
    expect(card.element.children[0].classList.contains('max-sm:flex-wrap')).toBe(true)
    expect(card.get('h3').classes()).toContain('truncate')
    expect(card.get('h3').element.parentElement?.classList.contains('min-w-0')).toBe(true)
    expect(wrapper.get('[data-test="score-value"]').classes()).toContain('shrink-0')
    for (const text of wrapper.findAll('li [title]')) expect(text.classes()).toEqual(expect.arrayContaining(['min-w-0', 'line-clamp-2', 'break-words']))
    const footer = card.element.children[3]
    expect(['grid', 'grid-cols-2', 'gap-2', 'sm:flex', 'sm:justify-end'].every(c => footer.classList.contains(c))).toBe(true)
    for (const button of footer.querySelectorAll('button')) expect(['w-full', 'sm:w-auto', 'min-h-11', 'px-3.5', 'py-2', 'text-sm'].every(c => button.classList.contains(c))).toBe(true)
  })
})

describe('ScoreFilter', () => {
  it('emits update:minScore as a number and reflects the bound value', async () => {
    const wrapper = mount(ScoreFilter, { props: { minScore: 40 } })

    expect(wrapper.get('output').text()).toBe('40')
    await wrapper.get('#min-score').setValue('85')

    expect(wrapper.emitted('update:minScore')).toEqual([[85]])
    expect(wrapper.get('output').attributes('aria-hidden')).toBe('true') // the native slider announces the value
    expect(wrapper.findAll('[data-test="tick-label"]').map(t => t.text())).toEqual(['70', '90'])
  })

  it.each([
    [40, '40, Below threshold'],
    [70, '70, Eligible'],
    [90, '90, Top-tier'],
  ])('announces the tier with the value: min_score %i → aria-valuetext "%s"', (minScore, text) => {
    expect(mount(ScoreFilter, { props: { minScore } }).get('#min-score').attributes('aria-valuetext')).toBe(text)
  })

  it('uses the gray-100 track so the gray-300 fill below 70 stays distinguishable', () => {
    const track = mount(ScoreFilter, { props: { minScore: 40 } }).get('[data-test="filter-fill"]').element.parentElement
    expect(track?.classList.contains('bg-gray-100')).toBe(true)
  })

  it.each([
    [65, 'Below threshold', 'bg-gray-300'],
    [70, 'Eligible', 'bg-amber-500'],
    [85, 'Eligible', 'bg-amber-500'],
    [90, 'Top-tier', 'bg-emerald-500'],
  ])('min_score %i → fill and tier label follow the tier (%s)', (minScore, label, fill) => {
    const wrapper = mount(ScoreFilter, { props: { minScore } })

    expect(wrapper.get('[data-test="filter-fill"]').classes()).toEqual(expect.arrayContaining([fill, 'transition-colors', 'duration-300']))
    expect(wrapper.get('[data-test="filter-tier"]').text()).toBe(label)
  })

  it('positions fill, bubble, tick marks and labels on the thumb centre (16 px thumb: +8 px at 0, −8 px at 100)', () => {
    const left = (el: { element: Element }) => (el.element as HTMLElement).style.left
    const wrapper = mount(ScoreFilter, { props: { minScore: 40 } })

    expect((wrapper.get('[data-test="filter-fill"]').element as HTMLElement).style.width).toBe('calc(40% + 1.6px)')
    expect(left(wrapper.get('output'))).toBe('calc(40% + 1.6px)')
    const expected = ['calc(70% + -3.2px)', 'calc(90% + -6.4px)']
    expect(wrapper.findAll('[data-test="tick-mark"]').map(left)).toEqual(expected)
    expect(wrapper.findAll('[data-test="tick-label"]').map(left)).toEqual(expected)
    // The mark is its own 1 px element centred by its own width, not a border on the (wider) label.
    for (const mark of wrapper.findAll('[data-test="tick-mark"]')) {
      expect(mark.classes()).toEqual(expect.arrayContaining(['w-px', '-translate-x-1/2']))
      expect(mark.text()).toBe('')
    }
  })
})

describe('SummaryHeader (FR-F25)', () => {
  const summary = { total_applicants: 10, eligible_applicants: 7, average_ai_score: 76.5, top_applicants: [] }

  it.each([
    // Decision — FR-F25 expanded metric size (B), then FR-F36: one step down below sm (text-lg → text-base, labels text-xs).
    [false, ['gap-4', 'py-3'], ['p-3'], ['text-xs', 'sm:text-sm'], ['h-6', 'text-base', 'sm:h-8', 'sm:text-2xl']],
    // FR-F36: condensed values shrink further from the mobile base (text-sm), sm: up unchanged (text-base).
    // Decision — human SummaryHeader typography (A): condensed labels are text-xs tracking-wide, no uppercase.
    [true, ['gap-2', 'py-1.5'], ['px-3', 'py-1'], ['text-xs', 'tracking-wide'], ['h-5', 'text-sm', 'sm:h-6', 'sm:text-base']],
  ])('condensed=%s → dl %j, metric %j, label %j, value %j', (condensed, dl, metric, label, value) => {
    const wrapper = mount(SummaryHeader, { props: { summary, condensed } })
    const motion = ['transition-all', 'duration-300', 'motion-reduce:transition-none']

    expect(wrapper.get('dl').classes()).toEqual(expect.arrayContaining([...dl, ...motion]))
    // FR-F30: the sticky surface moved to the container's block (summary + filter); the dl must not stick on its own.
    expect(wrapper.get('dl').classes()).not.toEqual(expect.arrayContaining(['sticky']))
    for (const box of wrapper.findAll('dl > div')) expect(box.classes()).toEqual(expect.arrayContaining([...metric, ...motion]))
    for (const dt of wrapper.findAll('dt')) expect(dt.classes()).toEqual(expect.arrayContaining([...label, ...motion]))
    const values = wrapper.findAll('[data-test="metric-value"]')
    for (const dd of values) expect(dd.classes()).toEqual(expect.arrayContaining([...value, ...motion]))
    // values stay readable either way (TextMorph text)
    expect(values.map(d => d.text())).toEqual(['10', '7', '76.50'])
  })

  it('does not leak the other state\'s classes', () => {
    const wrapper = mount(SummaryHeader, { props: { summary, condensed: true } })

    expect(wrapper.get('dd').classes()).not.toContain('sm:text-2xl')
    expect(wrapper.get('dd').classes()).not.toContain('text-base') // mobile condensed is text-sm (only sm:text-base)
    // labels: condensed drops the sm: step-up and adds tracking; no uppercase and no 11 px (human design, Decision A)
    expect(wrapper.get('dt').classes()).not.toContain('sm:text-sm')
    expect(wrapper.get('dt').classes()).not.toContain('uppercase')
    expect(wrapper.get('dt').classes()).not.toContain('text-[11px]')

    const expanded = mount(SummaryHeader, { props: { summary, condensed: false } })
    expect(expanded.get('dt').classes()).not.toContain('tracking-wide')
    expect(expanded.get('dl').classes()).not.toContain('py-1.5')
    // the two states must stay distinguishable
    expect(expanded.get('dt').classes()).not.toEqual(wrapper.get('dt').classes())
    expect(expanded.get('dd').classes()).not.toEqual(wrapper.get('dd').classes())
  })

  it('supporting percent text is text-xs at every width (human design, Decision A)', () => {
    const percent = mount(SummaryHeader, { props: { summary } }).get('[data-test="eligible-share"] > span')
    expect(percent.classes()).toEqual(expect.arrayContaining(['text-xs', 'tabular-nums']))
    expect(percent.classes()).not.toContain('text-[11px]')
  })

  it.each([
    [false, 'h-1.5', 'h-1'],
    [true, 'h-1', 'h-1.5'],
  ])('eligible-share bar (Decision A): condensed=%s → %s, not %s', (condensed, height, other) => {
    const bar = mount(SummaryHeader, { props: { summary, condensed } }).get('[role="meter"]')

    expect(bar.classes()).toEqual(expect.arrayContaining([height, 'rounded-full', 'bg-gray-100', 'transition-all', 'duration-300', 'motion-reduce:transition-none']))
    expect(bar.classes()).not.toContain(other)
  })

  it('eligible-share bar: percent as visible text, fill width and aria values', () => {
    const wrapper = mount(SummaryHeader, { props: { summary: { ...summary, total_applicants: 40, eligible_applicants: 19 } } })
    const bar = wrapper.get('[role="meter"]')

    expect(bar.attributes()).toMatchObject({
      'aria-label': 'Eligible share',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': '48',
      'aria-valuetext': '19 of 40 eligible (48%)',
    })
    expect(bar.get('div').attributes('style')).toContain('width: 48%')
    expect(bar.get('div').classes()).toContain('bg-gray-700') // fixed neutral, not a tier colour
    expect(wrapper.get('[data-test="eligible-share"]').text()).toBe('48%')
    // announced once: from aria-valuetext; the visible percent is hidden from screen readers
    expect(wrapper.get('[data-test="eligible-share"] > span').attributes('aria-hidden')).toBe('true')
  })

  it.each([
    [1, 300, 1], // rounds to 0 → shown as 1 %: some are eligible
    [199, 200, 99], // rounds to 100 → shown as 99 %: not all are
    [200, 200, 100],
    [0, 300, 0],
    [1, 2, 50],
  ])('eligible-share bar: %i of %i → %i %% (never 0 %% for some, never 100 %% for not all)', (eligible, total, pct) => {
    const wrapper = mount(SummaryHeader, { props: { summary: { ...summary, total_applicants: total, eligible_applicants: eligible } } })

    expect(wrapper.get('[role="meter"]').attributes('aria-valuenow')).toBe(String(pct))
    expect(wrapper.get('[data-test="eligible-share"]').text()).toBe(`${pct}%`)
  })

  it('eligible-share bar: total 0 → 0 %, no NaN', () => {
    const wrapper = mount(SummaryHeader, { props: { summary: { ...summary, total_applicants: 0, eligible_applicants: 0 } } })
    const bar = wrapper.get('[role="meter"]')

    expect(bar.attributes('aria-valuenow')).toBe('0')
    expect(bar.attributes('aria-valuetext')).toBe('0 of 0 eligible (0%)')
    expect(bar.get('div').attributes('style')).toContain('width: 0%')
    expect(wrapper.html()).not.toContain('NaN')
  })

  it('skeleton reserves the bar box without exposing a meter (FR-F12)', () => {
    const wrapper = mount(SummaryHeader, { props: { summary: null } })
    const share = wrapper.get('[data-test="eligible-share"]')

    expect(wrapper.find('[role="meter"]').exists()).toBe(false)
    expect(share.classes()).toEqual(expect.arrayContaining(['flex', 'h-4']))
    expect(share.get('div').classes()).toEqual(expect.arrayContaining(['h-1.5', 'animate-pulse']))
    expect(share.get('div').attributes('aria-hidden')).toBe('true')
  })
})

describe('TextMorph', () => {
  it('renders the value as plain text on the server', async () => {
    expect(await renderToString(h(TextMorph, { value: 42 }))).toMatch(/^<span[^>]*>42<\/span>$/)
  })

  it('swaps instantly to the final text under prefers-reduced-motion', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string): MediaQueryList => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }))
    const wrapper = mount(TextMorph, { props: { value: 10 } })

    await wrapper.setProps({ value: 7 })

    expect(wrapper.text()).toBe('7')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['tabular-nums', 'min-w-[3ch]']))
  })

  it('minWidth: default is the 3ch class; an explicit value replaces it with an inline min-width', () => {
    const byDefault = mount(TextMorph, { props: { value: 10 } })
    const explicit = mount(TextMorph, { props: { value: 10, minWidth: '2ch' } })

    expect(byDefault.classes()).toContain('min-w-[3ch]')
    expect((byDefault.element as HTMLElement).style.minWidth).toBe('')
    expect(explicit.classes()).not.toContain('min-w-[3ch]')
    expect((explicit.element as HTMLElement).style.minWidth).toBe('2ch')
  })
})

// TextMorph is asserted by final text (FR-F17): under reduced motion torph swaps instantly (no sr + visual copies).
const stubReducedMotion = () => vi.spyOn(window, 'matchMedia').mockImplementation((query: string): MediaQueryList => ({
  matches: query === '(prefers-reduced-motion: reduce)',
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => true,
}))

describe('ScoreFilter — FR-F30 condensed + FR-F37 granularity', () => {
  beforeEach(stubReducedMotion)
  it('condensed hides the tick labels and tightens padding; slider, bubble and tick marks stay', async () => {
    const wrapper = mount(ScoreFilter, { props: { minScore: 40 } })
    const body = () => wrapper.get('[data-test="filter-body"]').classes()
    expect(wrapper.findAll('[data-test="tick-label"]')).toHaveLength(2)
    expect(body()).toEqual(expect.arrayContaining(['pt-7', 'pb-5']))

    await wrapper.setProps({ condensed: true })
    expect(wrapper.findAll('[data-test="tick-label"]')).toHaveLength(0)
    expect(body()).toEqual(expect.arrayContaining(['pt-6', 'pb-1']))
    expect(body()).not.toContain('pb-5')
    expect(wrapper.find('#min-score').exists()).toBe(true)
    expect(wrapper.get('output').text()).toBe('40')
    expect(wrapper.findAll('[data-test="tick-mark"]')).toHaveLength(2)
  })

  it('steps by 1 over 0–100 and the bubble follows every unit (TextMorph)', async () => {
    const wrapper = mount(ScoreFilter, { props: { minScore: 69 } })
    expect(wrapper.get('#min-score').attributes()).toMatchObject({ min: '0', max: '100', step: '1' })
    expect(wrapper.get('output').text()).toBe('69')

    await wrapper.get('#min-score').setValue('71')
    expect(wrapper.emitted('update:minScore')).toEqual([[71]])
    await wrapper.setProps({ minScore: 71 })
    expect(wrapper.get('output').text()).toBe('71')
  })

  it.each([
    [69, 'Below threshold', 'bg-gray-300'],
    [70, 'Eligible', 'bg-amber-500'],
    [89, 'Eligible', 'bg-amber-500'],
    [90, 'Top-tier', 'bg-emerald-500'],
  ])('tier still flips exactly at the thresholds with step 1: %i → %s', (minScore, label, fill) => {
    const wrapper = mount(ScoreFilter, { props: { minScore } })
    expect(wrapper.get('[data-test="filter-tier"]').text()).toBe(label)
    expect(wrapper.get('[data-test="filter-fill"]').classes()).toContain(fill)
  })
})

describe('MatchCount (FR-F37, human design — Decision B)', () => {
  beforeEach(stubReducedMotion)
  it.each([[5, 40], [40, 40]])('x=%i y=%i → sr-only sentence, aria-hidden px-2 gap-1 pill, no ratio bar', (x, y) => {
    const wrapper = mount(MatchCount, { props: { x, y } })
    const sentence = wrapper.get('[data-test="match-sentence"]')
    const pill = wrapper.get('[data-test="match-pill"]')

    expect(sentence.text()).toBe(`${x} of ${y} match`)
    expect(sentence.classes()).toContain('sr-only')
    expect(pill.attributes('aria-hidden')).toBe('true')
    expect(pill.classes()).toEqual(expect.arrayContaining(['inline-flex', 'items-center', 'gap-1', 'rounded-full', 'border', 'border-gray-200', 'bg-gray-50', 'px-2', 'py-1']))
    expect(pill.classes()).not.toContain('px-3')
    expect(pill.text()).toBe(`${x}of ${y} match`)
    expect(wrapper.find('[data-test="match-fill"]').exists()).toBe(false)
    expect(pill.findAll(':scope > span')).toHaveLength(2)
  })

  it('x=0 turns the pill amber (AA text: amber-900 8.73:1, amber-800 6.84:1 on amber-50)', () => {
    const pill = mount(MatchCount, { props: { x: 0, y: 40 } }).get('[data-test="match-pill"]')

    expect(pill.classes()).toEqual(expect.arrayContaining(['border-amber-300', 'bg-amber-50']))
    expect(pill.classes()).not.toContain('bg-gray-50')
    expect(pill.findAll(':scope > span').map(s => s.classes().find(c => c.startsWith('text-amber')))).toEqual(['text-amber-900', 'text-amber-800'])
  })

  it('y=0 is safe: renders "0 of 0 match", no NaN', () => {
    const wrapper = mount(MatchCount, { props: { x: 0, y: 0 } })
    expect(wrapper.get('[data-test="match-sentence"]').text()).toBe('0 of 0 match')
    expect(wrapper.html()).not.toContain('NaN')
  })

  // Decision — dynamic count width (human edit 16:19, A): 1ch below 10, 2ch from 10.
  it.each([[9, '1ch'], [10, '2ch']])('X=%i sits in a %s slot (minWidth passed to TextMorph)', (value, slot) => {
    const x = mount(MatchCount, { props: { x: value, y: 40 } }).getComponent(TextMorph)
    expect(x.props('minWidth')).toBe(slot)
    expect((x.element as HTMLElement).style.minWidth).toBe(slot)
  })
})

describe('ApplicantCard — FR-F35 rejected blur, FR-F38 avatar ring', () => {
  const applicant = (status: ApplicantStatus) => ({
    type: 'applicants' as const,
    id: '1',
    attributes: { name: 'Jane Doe', ai_score: 75, status, applied_at: '2026-10-01T14:30:00Z', highlights: ['a', 'b'] },
  })
  // Decision — FR-F35 blur on touch devices (A): blurred only where hover can clear it.
  const BLUR = ['[@media(hover:hover)]:blur-[1px]', 'group-hover:blur-none', 'group-focus-within:blur-none']
  const MOTION = ['transition-[filter]', 'duration-300', 'motion-reduce:transition-none']

  it('rejected: name block, score, highlights and footer blur; chip and shell stay sharp; undo stays live', () => {
    const wrapper = mount(ApplicantCard, { props: { applicant: applicant('rejected'), now: 0 } })
    const article = wrapper.get('article')
    const [header, score, highlights, footer] = [...article.element.children]
    const blurred = [header.children[0], score, highlights, footer]

    expect(article.classes()).toContain('group')
    for (const el of blurred) expect([...BLUR, ...MOTION].every(c => el.classList.contains(c))).toBe(true)
    const sharp = [article.element, header, wrapper.get('[data-test="status"]').element, wrapper.get('[data-test="status-chip"]').element]
    for (const el of sharp) expect([...el.classList].some(c => c.includes('blur'))).toBe(false)
    expect(wrapper.findAll('*').flatMap(el => el.classes()).filter(c => /^(opacity|saturate)-/.test(c))).toEqual([])
    // Undo path: Shortlist enabled, Reject natively disabled; nothing needs aria-disabled.
    expect(wrapper.get<HTMLButtonElement>('[data-test="shortlisted"]').element.disabled).toBe(false)
    expect(wrapper.get<HTMLButtonElement>('[data-test="rejected"]').element.disabled).toBe(true)
    expect(wrapper.find('[aria-disabled]').exists()).toBe(false)
  })

  it.each(['pending', 'shortlisted'] as const)('%s: no blur, transition kept so becoming rejected animates', (status) => {
    const wrapper = mount(ApplicantCard, { props: { applicant: applicant(status), now: 0 } })
    expect(wrapper.findAll('*').flatMap(el => el.classes()).filter(c => c.includes('blur'))).toEqual([])
    expect(wrapper.get('[data-test="score-value"]').element.closest('.transition-\\[filter\\]')).not.toBeNull()
  })

  it('avatar has the inset ring inside the same size-10 circle; the skeleton mirrors it', () => {
    const avatar = mount(ApplicantCard, { props: { applicant: applicant('pending'), now: 0 } }).get('[data-test="avatar"]')
    const ring = ['size-10', 'rounded-full', 'ring-1', 'ring-inset', 'ring-black/10', 'dark:ring-white/15']
    expect(avatar.classes()).toEqual(expect.arrayContaining([...ring, 'inset-shadow-sm']))
    expect(avatar.text()).toBe('JD')
    const skAvatar = mount(CardSkeleton).get('div').element.querySelector('.size-10')
    expect(ring.every(c => skAvatar?.classList.contains(c))).toBe(true)
  })
})

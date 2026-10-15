import { describe, expect, it } from 'vitest'
import { fullDate, initials, relativeDate } from '~/utils/format'
import { ELIGIBLE_MIN, TIER_THRESHOLDS, TOP_TIER_MIN, tierFor } from '~/utils/tier'

describe('tierFor', () => {
  it.each([
    [100, 'Top-tier', 'bg-emerald-500', 'text-emerald-500'],
    [90, 'Top-tier', 'bg-emerald-500', 'text-emerald-500'],
    [89, 'Eligible', 'bg-amber-500', 'text-amber-500'],
    [70, 'Eligible', 'bg-amber-500', 'text-amber-500'],
    [69, 'Below threshold', 'bg-gray-300 dark:bg-gray-600', 'text-gray-400 dark:text-gray-500'],
    [0, 'Below threshold', 'bg-gray-300 dark:bg-gray-600', 'text-gray-400 dark:text-gray-500'],
  ])('%i → %s (%s, %s)', (score, label, fill, accent) => {
    expect(tierFor(score)).toMatchObject({ label, fill, accent })
  })

  it('filter steps (step 5) cross the tiers at 70 and 90', () => {
    expect([0, 65, 70, 85, 90, 95].map(v => tierFor(v).label))
      .toEqual(['Below threshold', 'Below threshold', 'Eligible', 'Eligible', 'Top-tier', 'Top-tier'])
  })

  it('exports the FRD-00 thresholds the ticks and labels use', () => {
    expect([ELIGIBLE_MIN, TOP_TIER_MIN]).toEqual([70, 90])
    expect(TIER_THRESHOLDS).toEqual([70, 90])
  })
})

describe('initials', () => {
  it.each([
    ['Jane Doe', 'JD'],
    ['Cher', 'C'],
    ['  liam   o\'brien  ', 'LO'],
    ['Ana Maria da Silva', 'AS'],
    ['   ', ''],
    ['😀 Smile', '😀S'], // code point, not a lone UTF-16 surrogate
  ])('%j → %j', (name, expected) => {
    expect(initials(name)).toBe(expected)
  })
})

describe('relativeDate', () => {
  const now = Date.parse('2026-10-03T14:30:00Z')

  it.each([
    ['2026-10-01T14:30:00Z', '2 days ago'],
    ['2026-10-02T14:30:01Z', '23 hours ago'],
    ['2026-10-03T14:29:30Z', 'just now'],
    ['2026-10-03T14:30:00Z', 'just now'], // +0 must not read "in 0 seconds"
    ['2026-10-03T14:33:00Z', 'just now'], // future (client clock behind the server) clamps, never "in 3 minutes"
    ['2026-10-03T14:28:59Z', '1 minute ago'],
    ['2026-10-02T05:30:00Z', '1 day ago'], // 33 h, calendar day −2: elapsed wording, not "yesterday"
    ['2026-09-26T14:30:00Z', '1 week ago'], // not "last week"
    ['2026-09-19T14:30:00Z', '2 weeks ago'],
    ['2026-09-04T14:30:00Z', '4 weeks ago'], // 29 d
    ['2026-09-03T14:30:00Z', '1 month ago'], // 30 d
    ['2026-07-01T14:30:00Z', '3 months ago'],
    ['2024-10-01T14:30:00Z', '2 years ago'],
  ])('%s → %s', (iso, expected) => {
    expect(relativeDate(iso, now)).toBe(expected)
  })

  it('formats the full UTC date for the title', () => {
    expect(fullDate('2026-10-01T14:30:00Z')).toBe('October 1, 2026 at 2:30 PM UTC')
  })
})

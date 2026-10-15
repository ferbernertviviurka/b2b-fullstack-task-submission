const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'always' })
// UTC so server and client render the same string.
const full = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' })

// ponytail: 30-day months and 365-day years; switch to calendar maths if exact month boundaries ever matter.
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

/**
 * Elapsed-time wording ("1 day ago", never the calendar "yesterday"). `now` is passed in (epoch ms) so the result is
 * deterministic. Future timestamps (client clock behind the server) clamp to "just now".
 */
export function relativeDate(iso: string, now: number): string {
  const seconds = Math.min(0, (Date.parse(iso) - now) / 1000)
  const match = UNITS.find(([, s]) => -seconds >= s)
  return match ? relative.format(Math.trunc(seconds / match[1]), match[0]) : 'just now'
}

/** "October 1, 2026 at 2:30 PM UTC" for the title attribute. */
export function fullDate(iso: string): string {
  return `${full.format(new Date(iso))} UTC`
}

/** First letter of the first and last word: "Jane van Doe" → "JD", "Cher" → "C". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  // Array.from splits by code point, so an emoji or astral CJK initial is not cut into a lone surrogate.
  const first = Array.from(words[0] ?? '')[0] ?? ''
  const last = words.length > 1 ? (Array.from(words.at(-1) ?? '')[0] ?? '') : ''
  return (first + last).toUpperCase()
}

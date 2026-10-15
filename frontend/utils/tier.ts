// FR-F3/F19: the one score→tier mapping (FRD-00: eligible ≥ 70, top-tier ≥ 90).
export const ELIGIBLE_MIN = 70
export const TOP_TIER_MIN = 90
/** Tick positions for both bars. */
export const TIER_THRESHOLDS = [ELIGIBLE_MIN, TOP_TIER_MIN] as const

// Full static class strings so Tailwind v4's scanner sees every class; never concatenate fragments.
export interface Tier {
  label: string
  /** Progress fill (card score bar and ScoreFilter track). */
  fill: string
  /** Icon/text accent (highlight icons). */
  accent: string
  /** Soft chip behind the tier label. */
  chip: string
}

const TOP: Tier = {
  label: 'Top-tier',
  fill: 'bg-emerald-500',
  accent: 'text-emerald-500',
  chip: 'bg-emerald-100 text-emerald-800 ring-emerald-600/30 dark:bg-emerald-950/60 dark:text-emerald-300',
}
const ELIGIBLE: Tier = {
  label: 'Eligible',
  fill: 'bg-amber-500',
  accent: 'text-amber-500',
  chip: 'bg-amber-100 text-amber-800 ring-amber-600/30 dark:bg-amber-950/60 dark:text-amber-300',
}
const BELOW: Tier = {
  label: 'Below threshold',
  fill: 'bg-gray-300 dark:bg-gray-600',
  accent: 'text-gray-400 dark:text-gray-500',
  chip: 'bg-gray-100 text-gray-700 ring-gray-500/30 dark:bg-gray-800 dark:text-gray-300',
}

export function tierFor(score: number): Tier {
  if (score >= TOP_TIER_MIN) return TOP
  if (score >= ELIGIBLE_MIN) return ELIGIBLE
  return BELOW
}

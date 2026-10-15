<template>
  <!-- summary === null → same grid with placeholder values (first load), so the real header swaps in without a shift (FR-F12).
       FR-F25/F30: the container's sticky block owns the surface (sticky, blur, border); `condensed` comes from its
       IntersectionObserver. Reduced motion → instant swap. FR-F36: one step smaller below sm, condensed smaller still. -->
  <dl
    :class="condensed ? 'gap-2 py-1.5' : 'gap-4 py-3'"
    class="grid grid-cols-3 transition-all duration-300 motion-reduce:transition-none"
    :data-test="summary ? undefined : 'summary-skeleton'">
    <div
      v-for="metric in metrics"
      :key="metric.label"
      :class="condensed ? 'px-3 py-1' : 'p-3'"
      class="rounded-lg bg-gray-50 transition-all duration-300 motion-reduce:transition-none dark:bg-gray-800">
      <dt
        :class="condensed ? 'text-xs tracking-wide' : 'text-xs sm:text-sm'"
        class="text-gray-500 transition-all duration-300 motion-reduce:transition-none dark:text-gray-400"
        data-test="metric-label"
        v-text="metric.label" />
      <dd
        :class="condensed ? 'h-5 text-sm sm:h-6 sm:text-base' : 'h-6 text-base sm:h-8 sm:text-2xl'"
        class="flex items-center font-semibold text-gray-900 transition-all duration-300 motion-reduce:transition-none dark:text-gray-100"
        data-test="metric-value">
        <UiTextMorph v-if="summary" :value="metric.value" />
        <span
          v-else
          class="h-5 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
          aria-hidden="true" />
      </dd>
      <!-- Decision — FR-F25 summary progress bar (A): eligible share, fixed neutral fill (no tier colour); the percent is
           also visible text, so the bar never carries the number alone. Skeleton keeps the same box (FR-F12).
           Screen readers get the value once, from the meter's aria-valuetext; the visible percent is aria-hidden. -->
      <dd v-if="metric.bar" class="flex h-4 items-center gap-2" data-test="eligible-share">
        <div
          :class="[condensed ? 'h-1' : 'h-1.5', !summary && 'animate-pulse']"
          class="flex-1 overflow-hidden rounded-full bg-gray-100 transition-all duration-300 motion-reduce:transition-none dark:bg-gray-700"
          v-bind="summary ? shareAria : { 'aria-hidden': 'true' }">
          <div
            class="h-full rounded-full bg-gray-700 transition-all duration-300 motion-reduce:transition-none dark:bg-gray-200"
            :style="{ width: `${share}%` }" />
        </div>
        <span
          class="w-9 text-right text-xs tabular-nums sm:text-xs text-gray-600 dark:text-gray-300"
          aria-hidden="true">
          <UiTextMorph v-if="summary" :value="`${share}%`" />
        </span>
      </dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ApplicantSummary } from "~/types/applicant";
import { ELIGIBLE_MIN } from "~/utils/tier";

const props = defineProps<{ summary: ApplicantSummary | null; condensed?: boolean }>();

const metrics = computed(() => [
  { label: "Total applicants", value: props.summary?.total_applicants ?? "", bar: false },
  {
    label: `Eligible (≥ ${ELIGIBLE_MIN})`,
    value: props.summary?.eligible_applicants ?? "",
    bar: true,
  },
  {
    label: "Average AI score",
    value: props.summary?.average_ai_score.toFixed(2) ?? "",
    bar: false,
  },
]);

// Total 0 → 0 %, never NaN. Clamped so rounding never shows 0 % for some eligible or 100 % for not all (1/300 → 1, 199/200 → 99).
const share = computed(() => {
  const total = props.summary?.total_applicants ?? 0;
  const eligible = props.summary?.eligible_applicants ?? 0;
  if (total <= 0 || eligible <= 0) return 0;
  if (eligible >= total) return 100;
  return Math.min(99, Math.max(1, Math.round((eligible / total) * 100)));
});

const shareAria = computed(() => ({
  role: "meter",
  "aria-label": "Eligible share",
  "aria-valuemin": 0,
  "aria-valuemax": 100,
  "aria-valuenow": share.value,
  "aria-valuetext": `${props.summary?.eligible_applicants ?? 0} of ${props.summary?.total_applicants ?? 0} eligible (${share.value}%)`,
}));
</script>

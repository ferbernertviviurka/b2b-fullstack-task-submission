<template>
  <div>
    <div class="flex items-center gap-2" data-test="badge">
      <span class="sr-only">AI score</span>
      <span class="shrink-0 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100" data-test="score-value"><UiTextMorph :value="score" /></span>
      <span :class="tier.chip" class="rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset" data-test="tier-label"><UiTextMorph :value="tier.label" /></span>
    </div>
    <div
      role="progressbar"
      :aria-valuenow="score"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`AI score ${score} out of 100`"
      class="relative mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800"
    >
      <div :class="tier.fill" class="h-full rounded-full transition-colors duration-300" :style="{ width: `${score}%` }" data-test="score-fill" />
      <span
        v-for="tick in TIER_THRESHOLDS"
        :key="tick"
        class="absolute inset-y-0 w-px bg-gray-400/50"
        :style="{ left: `${tick}%` }"
        aria-hidden="true"
        data-test="score-tick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TIER_THRESHOLDS, tierFor } from '~/utils/tier'

const props = defineProps<{ score: number }>()

// FR-F3: the label carries the meaning, color only reinforces it.
const tier = computed(() => tierFor(props.score))
</script>

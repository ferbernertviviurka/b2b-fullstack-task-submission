<template>
  <div class="space-y-1">
    <div class="flex items-center justify-between gap-4">
      <label for="min-score" class="text-sm font-medium text-gray-700">Minimum AI score</label>
      <span :class="tier.chip" class="rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset" data-test="filter-tier"><UiTextMorph :value="tier.label" /></span>
    </div>
    <!-- FR-F30: condensed = tighter padding and no tick labels; slider, value bubble and tick marks stay. -->
    <div :class="condensed ? 'pt-6 pb-1' : 'pt-7 pb-5'" class="relative transition-[padding] duration-300 motion-reduce:transition-none" data-test="filter-body">
      <!-- aria-hidden: the native slider already exposes its value; an <output> (role=status) would announce it twice.
           FR-F37: the bubble morphs per unit (TextMorph owns the text node, so no v-text here, FR-F13 exception). -->
      <output
        for="min-score"
        aria-hidden="true"
        class="absolute top-0 -translate-x-1/2 rounded-md bg-gray-900 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white"
        :style="{ left: thumbCenter(minScore) }"
      ><UiTextMorph :value="minScore" /></output>
      <div class="relative h-4">
        <!-- gray-100 track: the lightest neutral, so the FR-F19 gray-300 fill below 70 is as visible as it gets (1.34:1).
             Still under 3:1, so the bubble, thumb and tier label carry the value. -->
        <div class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-100">
          <div :class="tier.fill" class="h-full rounded-full transition-colors duration-300" :style="{ width: thumbCenter(minScore) }" data-test="filter-fill" />
        </div>
        <input
          id="min-score"
          :value="minScore"
          :aria-valuetext="`${minScore}, ${tier.label}`"
          type="range"
          min="0"
          max="100"
          step="1"
          class="relative block h-4 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:[&::-moz-range-thumb]:cursor-not-allowed disabled:[&::-webkit-slider-thumb]:cursor-not-allowed [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gray-900 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:box-border [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-900 [&::-webkit-slider-thumb]:bg-white"
          @input="onInput"
        >
        <!-- 1 px mark right under the slider row (anchored to it, so it holds its place when the padding condenses):
             -translate-x-1/2 of its own width puts its centre exactly on the thumb position. -->
        <span
          v-for="tick in TIER_THRESHOLDS"
          :key="tick"
          class="absolute top-full h-1 w-px -translate-x-1/2 bg-gray-400"
          :style="{ left: thumbCenter(tick) }"
          aria-hidden="true"
          data-test="tick-mark"
        />
      </div>
      <template v-if="!condensed">
        <span
          v-for="tick in TIER_THRESHOLDS"
          :key="tick"
          class="absolute bottom-0 -translate-x-1/2 text-[10px] leading-4 text-gray-500"
          :style="{ left: thumbCenter(tick) }"
          aria-hidden="true"
          data-test="tick-label"
          v-text="tick"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TIER_THRESHOLDS, tierFor } from '~/utils/tier'

const props = defineProps<{ minScore: number; condensed?: boolean }>()
const emit = defineEmits<{ 'update:minScore': [value: number] }>()

// FR-F19: the fill and label follow the tier of the current min_score, so dragging past 70/90 shifts it.
const tier = computed(() => tierFor(props.minScore))
const THUMB_PX = 16 // size-4; thumbs use border-box sizing so the 2 px border sits inside the 16 px

// Where the native thumb's center sits for a value: it travels from THUMB_PX/2 to (width − THUMB_PX/2), not 0–100 %.
// Written as THUMB_PX·(50 − v)/100 (= THUMB_PX/2 − THUMB_PX·v/100) so the offset has no float noise.
function thumbCenter(value: number): string {
  return `calc(${value}% + ${(THUMB_PX * (50 - value)) / 100}px)`
}

function onInput(event: Event): void {
  if (event.currentTarget instanceof HTMLInputElement) emit('update:minScore', Number(event.currentTarget.value))
}
</script>

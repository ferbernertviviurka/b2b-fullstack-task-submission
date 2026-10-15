<template>
  <button type="button" :class="button({ intent, size, class: props.class })" :disabled="disabled || loading">
    <!-- While loading the label goes transparent (keeps the width and the accessible name) and a spinner overlays it. -->
    <span :class="loading && 'opacity-0'" v-text="label" />
    <svg v-if="loading" class="absolute size-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true" data-test="spinner">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { tv, type ClassValue, type VariantProps } from 'tailwind-variants'

// FR-F21. Base owns the FR-F18 cursors and the AA focus ring (P2.2); intents use the AA palette (Decision — P2.2 action
// button contrast, B). `class` is merged by tailwind-variants' built-in merge, so a parent can override (e.g. px-0) instead of stacking.
// FR-F32 (Decision — FR-F32 hover fix, A): every intent has a perceptible hover AND an `active:` press shade, because
// Tailwind v4 only applies `hover:` under @media (hover: hover) and touch would otherwise get no feedback at all.
// `disabled:hover:*` pins the resting look on disabled buttons (Chrome never applies :active to a disabled button).
const button = tv({
  base: 'relative inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  variants: {
    intent: {
      'primary': 'bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900 disabled:hover:bg-emerald-700',
      // FR-F31 classes verbatim + active:text-red-800 (Decision — FR-F31 pressed-state contrast, A: red-700 on red-200 is 4.42:1).
      'danger-soft': 'bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 active:text-red-800 disabled:hover:bg-red-50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 dark:disabled:hover:bg-red-950/40',
      'danger-ghost': 'text-red-700 hover:bg-red-50 active:bg-red-100 disabled:hover:bg-transparent dark:hover:bg-red-950/40',
      'neutral-outline': 'border border-gray-300 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-100 active:bg-gray-200 disabled:hover:border-gray-300 disabled:hover:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800',
    },
    size: {
      sm: 'px-3.5 py-2 text-sm',
      md: 'px-4 py-2.5 text-sm',
    },
  },
  defaultVariants: { intent: 'neutral-outline', size: 'sm' },
})

type ButtonVariants = VariantProps<typeof button>

const props = defineProps<{
  label: string
  intent?: ButtonVariants['intent']
  size?: ButtonVariants['size']
  loading?: boolean
  disabled?: boolean
  class?: ClassValue
}>()
</script>

<template>
  <ul class="space-y-2">
    <li v-for="(highlight, index) in highlights.slice(0, 4)" :key="index" class="flex gap-2 text-sm leading-relaxed">
      <!-- h-[1lh]: the icon box is one text line tall, so the icon centres on the first line. -->
      <span class="flex h-[1lh] shrink-0 items-center">
        <svg :class="accent" class="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-test="highlight-icon">
          <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
        </svg>
      </span>
      <span class="line-clamp-2 min-w-0 break-words text-gray-600 dark:text-gray-400" :title="highlight" v-text="highlight" />
    </li>
  </ul>
</template>

<script setup lang="ts">
// FR-F4: 2–4 bullets; the API may send more. `accent` is the tier's text class (utils/tier.ts).
defineProps<{ highlights: string[]; accent: string }>()
</script>

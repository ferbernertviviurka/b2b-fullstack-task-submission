<template>
  <!-- FR-F37, dumb: props in, nothing out. The container's live region wraps it; the sentence below is what gets
       announced (once, whole), the visual pill is aria-hidden so the parts aren't read separately. -->
  <span class="inline-flex">
    <span class="sr-only" data-test="match-sentence" v-text="`${x} of ${y} match`" />
    <span
      :class="
        x === 0
          ? 'border-amber-300 bg-amber-50'
          : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/60'
      "
      class="inline-flex items-center rounded-full border px-2 gap-1 py-1 transition-colors duration-300 motion-reduce:transition-none"
      aria-hidden="true"
      data-test="match-pill">
      <span
        :class="x === 0 ? 'text-amber-900' : 'text-gray-900 dark:text-gray-100'"
        class="text-sm font-semibold tabular-nums"
        ><UiTextMorph :value="x" :min-width="x >= 10 ? '2ch' : '1ch'"
      /></span>
      <span
        :class="x === 0 ? 'text-amber-800' : 'text-gray-500 dark:text-gray-400'"
        class="text-xs"
        v-text="`of ${y} match`" />
    </span>
  </span>
</template>

<script setup lang="ts">
// x = filtered matches (meta.pagination.total), y = campaign total (Decision — P2.1 "X of Y match" semantics, A).
defineProps<{ x: number; y: number }>();
</script>

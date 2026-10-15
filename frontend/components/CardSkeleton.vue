<template>
  <!-- Mirrors ApplicantCard box for box (FR-F12): same shell, header row, score block, 4 highlight rows (FR-F4 max), footer.
       Text placeholders sit in boxes of the real line heights (text-sm 20px, text-xs 16px, text-2xl 32px, 1lh rows). -->
  <div class="flex h-full animate-pulse flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0 max-sm:px-4 max-sm:shadow-none" aria-hidden="true">
    <div class="flex items-start justify-between gap-3 max-sm:flex-wrap max-sm:gap-y-2">
      <div class="flex min-w-0 items-center gap-3">
        <div :class="BLOCK" class="size-10 shrink-0 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/15" />
        <div>
          <div class="flex h-5 items-center"><div :class="BLOCK" class="h-3.5 w-28 rounded" /></div>
          <div class="flex h-4 items-center"><div :class="BLOCK" class="h-3 w-24 rounded" /></div>
        </div>
      </div>
      <div :class="BLOCK" class="h-5 w-24 shrink-0 rounded-full" />
    </div>

    <div class="mt-4">
      <div class="flex h-8 items-center gap-2">
        <div :class="BLOCK" class="h-6 w-10 rounded" />
        <div :class="BLOCK" class="h-5 w-16 rounded-full" />
      </div>
      <div :class="BLOCK" class="mt-2 h-1.5 w-full rounded-full" />
    </div>

    <div class="mt-4 flex-1 space-y-2">
      <div v-for="n in 4" :key="n" class="flex h-[1lh] items-center gap-2 text-sm leading-relaxed">
        <div :class="BLOCK" class="size-4 shrink-0 rounded-full" />
        <div :class="BLOCK" class="h-3 w-3/4 rounded" />
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 sm:flex sm:justify-end dark:border-gray-800">
      <div :class="BLOCK" class="h-11 rounded-lg sm:h-9 sm:w-18" />
      <div :class="BLOCK" class="h-11 rounded-lg sm:h-9 sm:w-22" />
    </div>
  </div>
</template>

<script setup lang="ts">
const BLOCK = 'bg-gray-200 dark:bg-gray-800'
</script>

<template>
  <div role="alert" class="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
    <span class="min-w-0 break-words" v-text="message" />
    <UiButton class="shrink-0" label="Retry" @click="emit('retry')" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string }>()
const emit = defineEmits<{ retry: [] }>()
</script>

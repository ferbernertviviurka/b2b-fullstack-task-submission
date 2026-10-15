<template>
  <div class="rounded-lg border border-dashed border-gray-300 p-8 text-center" data-test="empty">
    <p class="font-medium text-gray-900" v-text="title" />
    <p v-if="description" class="mt-1 text-sm text-gray-500" v-text="description" />
    <UiButton v-if="actionLabel" class="mt-4" :label="actionLabel" @click="emit('action')" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string; actionLabel?: string }>()
const emit = defineEmits<{ action: [] }>()
</script>

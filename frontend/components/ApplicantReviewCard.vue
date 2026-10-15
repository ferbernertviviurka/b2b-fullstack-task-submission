<template>
  <ApplicantBoard :campaign-id="campaignId" />
</template>

<script setup lang="ts">
// FR-F1 path kept as a thin alias; ApplicantBoard is the container (Decision — P2.1 container component).
defineProps<{ campaignId: number }>()
</script>

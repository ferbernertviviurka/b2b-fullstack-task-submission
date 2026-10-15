<template>
  <TorphTextMorph
    :text="text"
    :ease="ease"
    :class="numeric ? (minWidth ? 'inline-block tabular-nums' : 'inline-block min-w-[3ch] tabular-nums') : 'inline-block'"
    :style="numeric && minWidth ? { minWidth } : undefined" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { TextMorph as TorphTextMorph, type TextMorphProps } from "torph/vue";

type Props = {
  value: string | number;
  ease?: TextMorphProps["ease"];
  /** Overrides the default 3ch numeric slot (inline style: Tailwind can't see dynamic arbitrary classes). */
  minWidth?: string;
};

// SSR-safe by torph's design: its render function emits the value as plain text (server and first paint)
// and the morph controller only attaches in a post-mount watcher on the client.
// Reduced motion: torph's respectReducedMotion (default true) tracks the media query and swaps the text instantly.
const props = withDefaults(defineProps<Props>(), {
  ease: "linear",
});

const text = computed(() => String(props.value));
// Stable box for counts/scores: equal-width digits and room for 3 of them, so a morph never nudges siblings.
const numeric = computed(() => /^[\d.,]+$/.test(text.value));
</script>

<template>
  <section
    aria-labelledby="applicant-review-title"
    class="[overflow-anchor:none] mx-auto max-w-6xl md:space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-sm:rounded-none max-sm:border-0 max-sm:px-0 max-sm:shadow-none">
    <!-- FR-F29: title block margin one step down (space-y-6's 24 px → mb-4). -->
    <header class="mb-4 max-sm:px-4">
      <h2 id="applicant-review-title" class="text-xl font-semibold text-gray-900">
        Applicant review
      </h2>
      <!-- FR-F25: when this leaves the viewport the block below is stuck to the top → condensed. -->
      <div ref="sentinel" class="h-px" aria-hidden="true" />
    </header>

    <!-- FR-F30: summary + filter are ONE sticky surface with a single border-b. A direct child of the section (sticky
         only sticks within its parent's box); both children are dumb and get the same `condensed`. -->
    <div
      ref="sticky"
      class="sticky top-0 z-20 -mx-6 border-b border-gray-200 bg-white/85 px-6 backdrop-blur transition-[padding] duration-300 motion-reduce:transition-none dark:border-gray-800 dark:bg-gray-900/85 max-sm:mx-0 max-sm:px-4"
      :class="condensed && 'md:py-4'"
      data-test="sticky-block">
      <SummaryHeader
        v-if="data || pending"
        :summary="data?.meta.summary ?? null"
        :condensed="condensed" />
      <!-- Below sm the pill goes under the slider (P2.3 layout): beside it, "Minimum AI score" wraps at 360. -->
      <div class="flex items-end gap-6 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <ScoreFilter
          v-model:min-score="minScore"
          class="min-w-0 flex-1 max-sm:w-full"
          :condensed="condensed" />
        <!-- Stays mounted (MatchCount swapped inside, not the region) so the live region announces every change; atomic so
             the whole sentence is read once. A refetch keeps the previous count (no blank flash). -->
        <div
          :class="condensed ? 'pb-0' : 'pb-4'"
          class="shrink-0 transition-[padding] duration-300 motion-reduce:transition-none max-sm:pb-2"
          aria-live="polite"
          aria-atomic="true"
          data-test="match-count">
          <UiMatchCount
            v-if="data && !error"
            :x="data.meta.pagination.total"
            :y="data.meta.summary.total_applicants" />
          <!-- FR-F12: first load reserves the pill's box (30 px tall, ~109 px wide) so the list doesn't drop below sm. -->
          <span
            v-else-if="pending"
            class="block h-7.5 w-28 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"
            aria-hidden="true"
            data-test="match-placeholder" />
        </div>
      </div>
    </div>

    <div ref="results" class="space-y-6">
      <ErrorState v-if="error" class="max-sm:mx-4" :message="error" @retry="refresh" />

      <div v-else-if="pending" role="status" aria-busy="true" :class="GRID" data-test="skeleton">
        <span class="sr-only">Loading applicants…</span>
        <CardSkeleton v-for="n in skeletonCount" :key="n" />
      </div>

      <EmptyState
        v-else-if="data && data.meta.summary.total_applicants === 0"
        class="max-sm:mx-4"
        title="No one has applied to this campaign yet." />

      <EmptyState
        v-else-if="data && data.data.length === 0"
        class="max-sm:mx-4"
        title="No applicants match this minimum score."
        description="Lower the threshold or clear the filter to see everyone."
        action-label="Clear filter"
        @action="minScore = 0" />

      <template v-else-if="data">
        <ul :class="GRID" :aria-busy="loadingMore">
          <li v-for="applicant in data.data" :key="applicant.id">
            <ApplicantCard
              :applicant="applicant"
              :now="now"
              :saving="saving[applicant.id]"
              :error="actionErrors[applicant.id]"
              @change="setStatus(applicant, $event)" />
          </li>
          <!-- FR-F33: the next page's placeholders, in the same grid (FR-F12 anatomy). -->
          <template v-if="loadingMore">
            <li v-for="n in APPEND_SKELETONS" :key="`more-${n}`" data-test="append-skeleton">
              <CardSkeleton />
            </li>
          </template>
        </ul>
        <!-- Always mounted, only the text toggles: a live region inserted together with its content often isn't announced. -->
        <p
          role="status"
          class="sr-only"
          data-test="loading-more"
          v-text="loadingMore ? 'Loading more applicants…' : ''" />
        <!-- FR-F33: invisible sentinel after the last card; its observer prefetches the next page ~200 px early. -->
        <div
          v-if="hasNext"
          ref="end"
          class="h-px"
          aria-hidden="true"
          data-test="list-end-sentinel" />
        <!-- A failed append keeps every loaded card; only this row asks to retry. -->
        <ErrorState
          v-if="loadMoreError"
          class="max-sm:mx-4"
          :message="loadMoreError"
          @retry="loadMore" />
        <!-- FR-F34: only after the last page has completed; never next to skeletons or the retry row. -->
        <p
          v-else-if="!hasNext && !loadingMore"
          class="flex items-center gap-3 text-xs text-gray-500 max-sm:px-4"
          data-test="end-of-list">
          <span class="flex-1 border-t border-gray-200 dark:border-gray-800" aria-hidden="true" />
          <span
            >You've reached the end — all
            <UiTextMorph
              :value="data?.meta.pagination.total"
              :min-width="data?.meta.pagination.total >= 10 ? '2ch' : '1ch'" />
            {{ data?.meta.pagination.total === 1 ? "applicant" : "applicants" }} loaded</span
          >
          <span class="flex-1 border-t border-gray-200 dark:border-gray-800" aria-hidden="true" />
        </p>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { PAGE_SIZE, useApplicantSummary } from "~/composables/useApplicantSummary";
import type { ApplicantResource, ApplicantStatus } from "~/types/applicant";

const props = defineProps<{ campaignId: number }>();

// The only stateful component (FR-F11): fetch, filter (debounced in the composable) and status actions live here.
const minScore = ref(0);
const { data, pending, error, refresh, hasNext, loadingMore, loadMoreError, loadMore } =
  useApplicantSummary(props.campaignId, minScore);

// Same grid for skeletons and cards (FR-F20/F24).
const GRID =
  "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 max-sm:gap-0 max-sm:border-t max-sm:border-gray-200 max-sm:dark:border-gray-800";
const APPEND_SKELETONS = 3;
// Decision — P2.1 skeleton count (A): rows already shown (or 3 before the first response), capped at one page.
const skeletonCount = computed(() => Math.min(data.value?.data.length || 3, PAGE_SIZE));
// "Now" for relative dates, re-read on every response (not per render) so cards stay deterministic between loads.
// ponytail: fine while the fetch is client-only (onMounted); an SSR fetch (useAsyncData) must ship `now` in the payload
// with the data, or server and client compute it separately and mismatch on hydration at unit boundaries.
const now = ref(Date.now());
watch(data, () => {
  now.value = Date.now();
});

// FR-F25: the summary condenses once the sentinel above it has scrolled out of the top of the viewport.
// No scroll listener; onMounted only runs in the browser, so SSR never touches IntersectionObserver.
// Condensing shrinks the summary's in-flow height (~40 px), so two guards stop a condense/expand feedback loop (P2.3 review #1):
// - `[overflow-anchor:none]` on the section: Chrome's scroll anchoring no longer shifts scrollY when the summary resizes;
// - hysteresis: expand as soon as the sentinel is back in view, condense only once it is CONDENSE_AFTER px above the
//   viewport. The gap exceeds the height delta, so even a clamped scrollY at the page bottom can't re-cross the expand edge.
const CONDENSE_AFTER = 64;
const sentinel = useTemplateRef<HTMLElement>("sentinel");
const condensed = ref(false);
let observers: IntersectionObserver[] = [];
onMounted(() => {
  const el = sentinel.value;
  if (!el) return;
  observers = [
    new IntersectionObserver((entries) => {
      if (entries.at(-1)?.isIntersecting) condensed.value = false;
    }),
    new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry && !entry.isIntersecting && entry.boundingClientRect.top < 0)
          condensed.value = true;
      },
      { rootMargin: `${CONDENSE_AFTER}px 0px 0px 0px` },
    ),
  ];
  for (const observer of observers) observer.observe(el);
});
onBeforeUnmount(() => observers.forEach((observer) => observer.disconnect()));

// FR-F33: bottom sentinel → next page. Observing only while a next page exists and nothing is loading or failed, so
// hits during loadingMore are ignored, the observer is gone for good once there is no next link, and a failed append
// waits for Retry instead of looping. Re-creating it after each page makes it re-check: a still-visible sentinel
// (short page, tall screen) loads again at once instead of waiting for a scroll that never comes.
const end = useTemplateRef<HTMLElement>("end");
let moreObserver: IntersectionObserver | undefined;
watch(
  [end, hasNext, loadingMore, loadMoreError],
  ([el, next, busy, failed]) => {
    moreObserver?.disconnect();
    moreObserver = undefined;
    if (!el || !next || busy || failed) return;
    moreObserver = new IntersectionObserver(
      (entries) => {
        if (entries.at(-1)?.isIntersecting && !loadingMore.value) loadMore();
      },
      { rootMargin: "0px 0px 200px 0px" },
    );
    moreObserver.observe(el);
  },
  { flush: "post" },
);
onBeforeUnmount(() => moreObserver?.disconnect());

// FR-F33: a refetch (filter change / retry) swaps the list for page-1 skeletons; bring the list top back under the
// sticky block if it had scrolled beneath it. scrollIntoView honours html's scroll-padding-top (≥ the sticky block).
const results = useTemplateRef<HTMLElement>("results");
const sticky = useTemplateRef<HTMLElement>("sticky");
watch(
  pending,
  (loading) => {
    const list = results.value;
    if (!loading || !list || !sticky.value) return;
    if (list.getBoundingClientRect().top < sticky.value.getBoundingClientRect().bottom)
      list.scrollIntoView({ block: "start" });
  },
  { flush: "post" },
);

// FR-F5: optimistic update per applicant, following the optimistic-ui-vue skill.
// Target status of the in-flight PATCH per applicant id; drives the disabled state and the spinner.
const saving = ref<Record<string, ApplicantStatus>>({});
const actionErrors = ref<Record<string, string>>({});

// A refetch may replace `data` while the PATCH is in flight, so settle onto the current row for that id.
function setCurrentStatus(id: string, status: ApplicantStatus): void {
  const current = data.value?.data.find((a) => a.id === id);
  if (current) current.attributes.status = status;
}

async function setStatus(applicant: ApplicantResource, next: ApplicantStatus): Promise<void> {
  const {
    id,
    attributes: { name, status: previous },
  } = applicant;
  applicant.attributes.status = next;
  saving.value[id] = next;
  delete actionErrors.value[id];
  try {
    await $fetch(`/api/v1/applicants/${id}/status`, { method: "PATCH", body: { status: next } });
    setCurrentStatus(id, next);
  } catch {
    setCurrentStatus(id, previous);
    actionErrors.value[id] = `Could not update ${name}'s status. Please try again.`;
  } finally {
    delete saving.value[id];
  }
}
</script>

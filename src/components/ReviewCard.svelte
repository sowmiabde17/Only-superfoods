<!--
  ReviewCard.svelte — Individual review card for carousel
  Star rating + review text + customer name + product tag.
  Svelte 5 runes mode.
-->
<script>
  let { review } = $props();

  // Generate star array
  const stars = Array.from({ length: 5 }, (_, i) => i < review.rating);
</script>

<article class="flex-shrink-0 w-[280px] snap-start rounded-sm border border-[#E4E4DC] bg-[#F7F7F2] p-4 flex flex-col gap-3">
  <!-- Star rating -->
  <div class="flex gap-0.5">
    {#each stars as filled}
      <svg class="h-4 w-4 {filled ? 'text-[#A8D632]' : 'text-[#E4E4DC]'}" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    {/each}
  </div>

  <!-- Review text -->
  <p class="flex-1 text-[0.85rem] italic leading-relaxed text-[#4A5A52]">
    "{review.text}"
  </p>

  <!-- Customer info -->
  <div class="flex items-center justify-between">
    <span class="text-sm font-bold text-[#0B1F2E]">{review.name}</span>
    <span class="rounded-sm bg-[#A8D632]/15 px-2 py-0.5 text-[9px] font-medium text-[#2B5A16]">
      {review.product}
    </span>
  </div>
</article>


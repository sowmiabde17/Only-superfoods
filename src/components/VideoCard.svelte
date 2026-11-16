<!--
  VideoCard.svelte — Recipe Card Component matching the new design
  - Photo with centered Play button
  - Duration badge
  - Wishlist heart
  - Title in Playfair Display
  - Metadata pill tags: Difficulty, Cook time, Servings
  Svelte 5 runes mode.
-->
<script>
  let { recipe } = $props();
</script>

<a
  href={`/recipes/${recipe.slug}`}
  class="group flex-shrink-0 w-[240px] snap-start rounded-2xl border border-[#E4E4DC] bg-white overflow-hidden shadow-2xs hover:shadow-md hover:border-[#A8D632] transition-all press block"
>
  <!-- Thumbnail with play icon & duration badge -->
  <div class="relative aspect-[4/3] bg-[#0B1F2E] overflow-hidden">
    <img
      src={recipe.thumbnail}
      alt={recipe.title}
      class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      loading="lazy"
    />
    <!-- Play icon overlay -->
    <div class="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/10 transition-colors">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#2B5A16] shadow-sm backdrop-blur-xs group-hover:scale-110 transition-transform">
        <svg class="ml-0.5 h-4 w-4 fill-current" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>

    <!-- Duration badge on bottom right -->
    <div class="absolute bottom-2 right-2 rounded-md bg-black/75 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white shadow">
      {recipe.videoDuration || recipe.cookTime}
    </div>
  </div>

  <!-- Card body -->
  <div class="p-3">
    <!-- Title -->
    <h3
      class="text-[13px] font-bold leading-snug text-[#0B1F2E] line-clamp-2 group-hover:text-[#2B5A16] transition-colors"
      style="font-family: 'Playfair Display', Georgia, serif;"
    >
      {recipe.title}
    </h3>

    <!-- Metadata Pill Badges (Difficulty, Time, Servings) -->
    <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
      <span
        class={`rounded-md px-1.5 py-0.5 text-[9.5px] font-bold ${
          recipe.difficulty === 'Easy'
            ? 'bg-[#EBF5D9] text-[#2B5A16]'
            : 'bg-[#FEF3C7] text-[#B45309]'
        }`}
      >
        {recipe.difficulty}
      </span>

      <span class="rounded-md bg-[#F7F7F2] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#4A5A52] border border-[#E4E4DC]/80">
        {recipe.cookTime}
      </span>

      <span class="rounded-md bg-[#F7F7F2] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#4A5A52] border border-[#E4E4DC]/80">
        {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
      </span>
    </div>
  </div>
</a>

<!--
  RecipeHub.svelte — Fresh Produce Recipes Gallery & Hub
  Matches Screen 1 in Design Reference:
  - Hero Card: "Simple Food. Big Benefits." with farm oyster spread
  - Category circular filter pills: All Recipes, Mushrooms, Microgreens, Kombucha, Desi Eggs
  - Popular Recipes 2-column card grid with play icons, duration badges, wishlist hearts, and metadata pills (Difficulty, Cook Time, Servings)
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { recipeCategories } from '../data/recipes.js';
  import { getRecipes } from '../lib/recipesStore.js';

  // State
  let currentRecipes = $state(getRecipes());
  let selectedCategory = $state('all');
  let savedRecipeSlugs = $state([]);

  // Filtered recipes
  let filteredRecipes = $derived(
    selectedCategory === 'all'
      ? currentRecipes
      : currentRecipes.filter((r) => r.category === selectedCategory)
  );

  function handleRecipesUpdated(e) {
    currentRecipes = e.detail?.recipes || getRecipes();
  }

  onMount(() => {
    currentRecipes = getRecipes();
    window.addEventListener('osf:recipes-updated', handleRecipesUpdated);
    try {
      const saved = localStorage.getItem('osf_favorite_recipes');
      if (saved) savedRecipeSlugs = JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:recipes-updated', handleRecipesUpdated);
    }
  });

  function toggleFavorite(slug, event) {
    event.preventDefault();
    event.stopPropagation();
    if (savedRecipeSlugs.includes(slug)) {
      savedRecipeSlugs = savedRecipeSlugs.filter((s) => s !== slug);
    } else {
      savedRecipeSlugs = [...savedRecipeSlugs, slug];
    }
    try {
      localStorage.setItem('osf_favorite_recipes', JSON.stringify(savedRecipeSlugs));
    } catch (e) {
      console.error(e);
    }
  }
</script>

<div class="mx-auto max-w-[440px] px-4 pt-3 pb-12 font-sans text-[#0B1F2E]">

  <!-- 1. Hero Banner Card: "Simple Food. Big Benefits." -->
  <div class="relative overflow-hidden rounded-3xl bg-[#F7F7F2] p-5 shadow-xs border border-[#E4E4DC]/80">
    <div class="flex items-center justify-between gap-3">
      <!-- Left text column -->
      <div class="flex-1 pr-1">
        <span class="inline-block text-[10px] font-bold tracking-widest uppercase text-[#4A5A52]/80 mb-1.5">
          Fresh Produce Recipes
        </span>
        <h1
          class="text-[1.65rem] sm:text-[1.85rem] font-bold leading-[1.15] text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Simple Food.<br />Big Benefits.
        </h1>
        <p class="mt-2 text-[12px] leading-relaxed text-[#4A5A52]">
          Easy, nutritious recipes made with our farm-fresh produce.
        </p>
      </div>

      <!-- Right image: round wooden bowl of freshly harvested oyster mushrooms -->
      <div class="relative h-28 w-28 sm:h-32 sm:w-32 shrink-0 overflow-hidden rounded-2xl shadow-sm border border-white">
        <img
          src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/botton.webp"
          alt="Fresh farm produce for recipes"
          class="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          loading="eager"
        />
      </div>
    </div>
  </div>

  <!-- 2. Circular Category Bar (All Recipes, Mushrooms, Microgreens, Kombucha, Desi Eggs) -->
  <div class="pt-6 pb-2">
    <div class="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-none">
      {#each recipeCategories as cat}
        <button
          type="button"
          onclick={() => selectedCategory = cat.id}
          class="group flex flex-col items-center gap-1.5 shrink-0 press focus:outline-none"
        >
          <!-- Circular Thumbnail / Icon -->
          <div
            class={`relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full p-0.5 transition-all ${
              selectedCategory === cat.id
                ? 'ring-2 ring-[#2B5A16] ring-offset-2'
                : 'border border-[#E4E4DC] hover:border-[#A8D632]'
            }`}
          >
            {#if cat.icon === 'leaf'}
              <div class="flex h-full w-full items-center justify-center rounded-full bg-[#EBF5D9] text-[#2B5A16]">
                <!-- Clean Leaf Icon -->
                <svg class="h-6 w-6 fill-current" viewBox="0 0 24 24">
                  <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/>
                </svg>
              </div>
            {:else}
              <img
                src={cat.image}
                alt={cat.name}
                class="h-full w-full rounded-full object-cover"
                loading="lazy"
              />
            {/if}
          </div>

          <!-- Label -->
          <span
            class={`text-[11px] font-semibold transition-colors ${
              selectedCategory === cat.id
                ? 'font-bold text-[#2B5A16] underline underline-offset-4 decoration-2 decoration-[#2B5A16]'
                : 'text-[#4A5A52] group-hover:text-[#0B1F2E]'
            }`}
          >
            {cat.name}
          </span>
        </button>
      {/each}
    </div>
  </div>

  <!-- 3. Section Title: "Popular Recipes" & "See All →" -->
  <div class="flex items-center justify-between pt-5 pb-3">
    <h2
      class="text-[1.35rem] font-bold text-[#0B1F2E]"
      style="font-family: 'Playfair Display', Georgia, serif;"
    >
      {selectedCategory === 'all' ? 'Popular Recipes' : `${selectedCategory} Recipes`}
    </h2>

    {#if selectedCategory !== 'all'}
      <button
        onclick={() => selectedCategory = 'all'}
        class="text-xs font-bold text-[#2B5A16] hover:text-[#1e3f0f] transition-colors"
      >
        View All →
      </button>
    {:else}
      <a
        href="#all-recipes"
        class="text-xs font-bold text-[#2B5A16] hover:text-[#1e3f0f] transition-colors inline-flex items-center gap-1"
      >
        <span>See All</span>
        <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd"/>
        </svg>
      </a>
    {/if}
  </div>

  <!-- 4. 2-Column Recipe Cards Grid (Gallery) -->
  <div class="grid grid-cols-2 gap-3.5">
    {#each filteredRecipes as recipe}
      <a
        href={`/recipes/${recipe.slug}`}
        class="group flex flex-col overflow-hidden rounded-2xl border border-[#E4E4DC] bg-white shadow-2xs hover:shadow-md hover:border-[#A8D632]/80 transition-all press"
      >
        <!-- Card Thumbnail Container -->
        <div class="relative aspect-[4/3] w-full overflow-hidden bg-[#0B1F2E]">
          <img
            src={recipe.thumbnail}
            alt={recipe.title}
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          <!-- Play Button Overlay in center -->
          <div class="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/10 transition-colors">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#2B5A16] shadow-sm backdrop-blur-xs group-hover:scale-110 transition-transform">
              <svg class="h-4 w-4 ml-0.5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>

          <!-- Wishlist / Heart Button in Top Right -->
          <button
            type="button"
            onclick={(e) => toggleFavorite(recipe.slug, e)}
            class="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-[#0B1F2E] backdrop-blur-xs shadow-xs hover:bg-white press transition-transform"
            aria-label="Save recipe"
          >
            {#if savedRecipeSlugs.includes(recipe.slug)}
              <svg class="h-4 w-4 fill-red-500 text-red-500" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            {:else}
              <svg class="h-4 w-4 stroke-[#0B1F2E] stroke-2 fill-none" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            {/if}
          </button>

          <!-- Duration Badge on Bottom Right -->
          <div class="absolute bottom-2 right-2 rounded-md bg-black/75 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white shadow">
            {recipe.videoDuration || recipe.cookTime}
          </div>
        </div>

        <!-- Card Content -->
        <div class="p-3 flex flex-1 flex-col justify-between">
          <div>
            <h3
              class="text-[13px] sm:text-[14px] font-bold text-[#0B1F2E] leading-snug line-clamp-2 group-hover:text-[#2B5A16] transition-colors"
              style="font-family: 'Playfair Display', Georgia, serif;"
            >
              {recipe.title}
            </h3>
          </div>

          <!-- Metadata Pill Badges (Difficulty, Time, Servings) -->
          <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
            <!-- Difficulty Badge -->
            <span
              class={`rounded-md px-1.5 py-0.5 text-[9.5px] font-bold ${
                recipe.difficulty === 'Easy'
                  ? 'bg-[#EBF5D9] text-[#2B5A16]'
                  : 'bg-[#FEF3C7] text-[#B45309]'
              }`}
            >
              {recipe.difficulty}
            </span>

            <!-- Cook Time Badge -->
            <span class="rounded-md bg-[#F7F7F2] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#4A5A52] border border-[#E4E4DC]/80">
              {recipe.cookTime}
            </span>

            <!-- Servings Badge -->
            <span class="rounded-md bg-[#F7F7F2] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#4A5A52] border border-[#E4E4DC]/80">
              {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
            </span>
          </div>
        </div>
      </a>
    {/each}
  </div>

</div>


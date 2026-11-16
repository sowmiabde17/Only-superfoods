<!--
  DesktopRecipeHub.svelte — Full-width 3–4 column Recipe Studio Gallery (1024px+ only)
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { recipeCategories } from '../../data/recipes.js';
  import { getRecipes } from '../../lib/recipesStore.js';

  let currentRecipes = $state(getRecipes());
  let selectedCategory = $state('all');
  let savedRecipeSlugs = $state([]);

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
    } catch (e) {}
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:recipes-updated', handleRecipesUpdated);
    }
  });

  function toggleFavorite(slug, event) {
    event.preventDefault();
    event.stopPropagation();
    savedRecipeSlugs = savedRecipeSlugs.includes(slug)
      ? savedRecipeSlugs.filter((s) => s !== slug)
      : [...savedRecipeSlugs, slug];
    try {
      localStorage.setItem('osf_favorite_recipes', JSON.stringify(savedRecipeSlugs));
    } catch (e) {}
  }
</script>

<div class="mx-auto max-w-[1280px] px-8 py-12 text-[#0B1F2E]">
  <!-- Wide Hero Banner -->
  <div class="relative overflow-hidden rounded-3xl border border-[#E4E4DC] bg-gradient-to-r from-[#FAF7F0] via-[#FAF7F0] to-[#EFF5E4] p-10 shadow-xs">
    <div class="grid grid-cols-12 items-center gap-8">
      <div class="col-span-7 space-y-3">
        <span class="inline-block text-xs font-extrabold uppercase tracking-[0.16em] text-[#2B5A16]">
          Fresh Produce Recipes
        </span>
        <h1
          class="text-4xl xl:text-5xl font-bold leading-[1.1] text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Simple Food. Big Benefits.
        </h1>
        <p class="max-w-xl text-base leading-relaxed text-[#4A5A52]">
          Chef-tested recipes crafted around our morning-harvested grey oysters, living microgreens, raw kombucha, and free-range desi eggs—each paired directly with live farm packs.
        </p>
      </div>

      <div class="col-span-5">
        <div class="overflow-hidden rounded-2xl border-2 border-white shadow-lg">
          <img
            src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/botton.webp"
            alt="Fresh farm produce harvest for recipes"
            class="aspect-[16/10] w-full object-cover"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Category Tabs -->
  <div class="mt-10 mb-8 flex items-center justify-between gap-4 border-b border-[#E4E4DC] pb-4">
    <div class="flex flex-wrap items-center gap-2.5">
      {#each recipeCategories as cat}
        <button
          type="button"
          onclick={() => (selectedCategory = cat.id)}
          class="inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all press {selectedCategory === cat.id
            ? 'bg-[#143922] text-white shadow-xs'
            : 'border border-[#E4E4DC] bg-white text-[#4A5A52] hover:border-[#2B5A16] hover:text-[#2B5A16]'}"
        >
          <span>{cat.name}</span>
        </button>
      {/each}
    </div>
    <div class="text-xs font-semibold text-[#4A5A52]">
      Showing {filteredRecipes.length} recipes
    </div>
  </div>

  <!-- 3-Column Desktop Grid -->
  <div class="grid grid-cols-3 xl:grid-cols-4 gap-6">
    {#each filteredRecipes as recipe (recipe.id)}
      {@const isSaved = savedRecipeSlugs.includes(recipe.slug)}
      <a
        href={`/recipes/${recipe.slug}`}
        class="group flex flex-col overflow-hidden rounded-2xl border border-[#E4E4DC] bg-white shadow-2xs hover:border-[#A8D632] hover:shadow-lg transition-all"
      >
        <div class="relative aspect-[4/3] overflow-hidden bg-[#0B1F2E]">
          <img
            src={recipe.thumbnail}
            alt={recipe.title}
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <button
            type="button"
            onclick={(e) => toggleFavorite(recipe.slug, e)}
            class="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm shadow-xs hover:scale-110 transition-transform"
            aria-label="Save recipe"
          >
            <span class={isSaved ? 'text-red-500' : 'text-[#4A5A52]'}>
              {isSaved ? '♥' : '♡'}
            </span>
          </button>
          <span class="absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white">
            {recipe.videoDuration || recipe.cookTime}
          </span>
        </div>

        <div class="flex flex-1 flex-col justify-between p-5 space-y-3">
          <div>
            <span class="text-[10px] font-extrabold uppercase tracking-widest text-[#2B5A16]">
              {recipe.category}
            </span>
            <h2
              class="mt-1 text-lg font-bold leading-snug text-[#0B1F2E] group-hover:text-[#2B5A16] transition-colors"
              style="font-family: 'Playfair Display', Georgia, serif;"
            >
              {recipe.title}
            </h2>
            <p class="mt-1.5 text-xs text-[#4A5A52] line-clamp-2">{recipe.subtitle}</p>
          </div>

          <div class="flex flex-wrap items-center gap-2 border-t border-[#E4E4DC]/70 pt-3 text-[10.5px] font-bold">
            <span class="rounded-md bg-[#EBF5D9] px-2 py-0.5 text-[#2B5A16]">{recipe.difficulty}</span>
            <span class="rounded-md bg-[#F7F7F2] px-2 py-0.5 text-[#4A5A52]">{recipe.cookTime}</span>
            <span class="rounded-md bg-[#F7F7F2] px-2 py-0.5 text-[#4A5A52]">{recipe.servings} servings</span>
          </div>
        </div>
      </a>
    {/each}
  </div>
</div>


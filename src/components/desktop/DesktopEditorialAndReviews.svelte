<!--
  DesktopEditorialAndReviews.svelte — Wide Recipe Studio + East BLR Reviews Bento (1024px+ only)
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { getRecipes } from '../../lib/recipesStore.js';
  import { reviews, getAverageRating } from '../../data/reviews.js';
  import { faqs } from '../../data/faqs.js';

  let openFaqIndex = $state(0);

  let currentRecipes = $state(getRecipes());
  let featuredRecipe = $derived(currentRecipes[0] || null);
  let secondaryRecipes = $derived(currentRecipes.slice(1, 5));
  let displayedReviews = reviews.slice(0, 6);
  let avgRating = getAverageRating();

  function handleRecipesUpdated(e) {
    currentRecipes = e.detail?.recipes || getRecipes();
  }

  onMount(() => {
    currentRecipes = getRecipes();
    window.addEventListener('osf:recipes-updated', handleRecipesUpdated);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:recipes-updated', handleRecipesUpdated);
    }
  });
</script>

<!-- ═══ SECTION 1: RECIPE STUDIO ═══ -->
<section class="w-full bg-white py-20 border-b border-[#E4E4DC]">
  <div class="mx-auto max-w-[1280px] px-8">
    <div class="mb-10 flex items-end justify-between gap-6">
      <div>
        <span class="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2B5A16]">
          Farm Kitchen Journal
        </span>
        <h2
          class="mt-1.5 text-3xl xl:text-4xl font-bold tracking-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Cook Something New Tonight
        </h2>
      </div>
      <a
        href="/recipes"
        class="inline-flex items-center gap-2 rounded-full border border-[#E4E4DC] bg-[#FAF7F0] px-5 py-2.5 text-xs font-bold text-[#0B1F2E] hover:border-[#2B5A16] hover:bg-[#F2F8EA] transition-colors press"
      >
        <span>Explore All Recipes</span>
        <span>→</span>
      </a>
    </div>

    <!-- Editorial 12-Col Grid: 1 Spotlight Feature + 2x2 Grid -->
    <div class="grid grid-cols-12 gap-6 items-stretch">
      {#if featuredRecipe}
        <a
          href={`/recipes/${featuredRecipe.slug}`}
          class="col-span-5 group flex flex-col overflow-hidden rounded-3xl border border-[#E4E4DC] bg-[#FAF7F0] shadow-2xs hover:border-[#A8D632] hover:shadow-xl transition-all"
        >
          <div class="relative aspect-[4/3] overflow-hidden bg-[#0B1F2E]">
            <img
              src={featuredRecipe.thumbnail}
              alt={featuredRecipe.title}
              class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div class="absolute top-4 left-4 rounded-full bg-[#143922]/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#D8F3A0]">
              Chef Spotlight · {featuredRecipe.category}
            </div>
            <div class="absolute bottom-4 right-4 rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white">
              ⏱ {featuredRecipe.cookTime}
            </div>
          </div>

          <div class="flex flex-1 flex-col justify-between p-7 space-y-4">
            <div class="space-y-2">
              <h3
                class="text-2xl font-bold text-[#0B1F2E] group-hover:text-[#2B5A16] transition-colors"
                style="font-family: 'Playfair Display', Georgia, serif;"
              >
                {featuredRecipe.title}
              </h3>
              <p class="text-sm leading-relaxed text-[#4A5A52]">
                {featuredRecipe.subtitle}
              </p>
            </div>

            <div class="flex items-center justify-between border-t border-[#E4E4DC] pt-4 text-xs font-bold text-[#2B5A16]">
              <span>{featuredRecipe.difficulty} · {featuredRecipe.servings} servings</span>
              <span class="group-hover:translate-x-1 transition-transform">Read Recipe →</span>
            </div>
          </div>
        </a>
      {/if}

      <div class="col-span-7 grid grid-cols-2 gap-5">
        {#each secondaryRecipes as recipe (recipe.id)}
          <a
            href={`/recipes/${recipe.slug}`}
            class="group flex flex-col overflow-hidden rounded-2xl border border-[#E4E4DC] bg-white shadow-2xs hover:border-[#A8D632] hover:shadow-md transition-all"
          >
            <div class="relative aspect-[16/10] overflow-hidden bg-[#0B1F2E]">
              <img
                src={recipe.thumbnail}
                alt={recipe.title}
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <span class="absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white">
                {recipe.cookTime}
              </span>
            </div>

            <div class="flex flex-1 flex-col justify-between p-4 space-y-2.5">
              <h4
                class="text-base font-bold text-[#0B1F2E] line-clamp-2 group-hover:text-[#2B5A16] transition-colors"
                style="font-family: 'Playfair Display', Georgia, serif;"
              >
                {recipe.title}
              </h4>
              <div class="flex items-center gap-2 text-[10px] font-bold">
                <span class="rounded-md bg-[#EBF5D9] px-2 py-0.5 text-[#2B5A16]">
                  {recipe.difficulty}
                </span>
                <span class="text-[#4A5A52]">{recipe.servings} servings</span>
              </div>
            </div>
          </a>
        {/each}
      </div>
    </div>
  </div>
</section>

<!-- ═══ SECTION 2: EAST BENGALURU CUSTOMER REVIEWS ═══ -->
<section class="w-full bg-[#FAF7F0] py-20">
  <div class="mx-auto max-w-[1280px] px-8">
    <div class="mb-10 flex items-end justify-between gap-6">
      <div>
        <span class="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2B5A16]">
          Neighborhood Love
        </span>
        <h2
          class="mt-1.5 text-3xl xl:text-4xl font-bold tracking-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          What Whitefield &amp; East Bengaluru Says
        </h2>
      </div>

      <div class="flex items-center gap-3 rounded-2xl border border-[#D4E3C5] bg-white px-5 py-3 shadow-2xs">
        <div class="text-2xl font-black text-[#143922]" style="font-family: 'Playfair Display', serif;">
          ★ {avgRating}
        </div>
        <div class="text-xs leading-tight text-[#4A5A52]">
          <div class="font-bold text-[#0B1F2E]">Verified Local Buyers</div>
          <div>Whitefield • Kadugodi • Brookefield</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-6">
      {#each displayedReviews as review (review.id)}
        <article class="flex flex-col justify-between gap-4 rounded-2xl border border-[#E4E4DC] bg-white p-6 shadow-2xs">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex gap-0.5">
                {#each Array.from({ length: 5 }, (_, i) => i < review.rating) as filled}
                  <svg class="h-4 w-4 {filled ? 'text-[#A8D632]' : 'text-[#E4E4DC]'}" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                {/each}
              </div>
              <span class="rounded-full bg-[#EBF5E4] px-2.5 py-0.5 text-[10px] font-bold text-[#2B5A16]">
                {review.product}
              </span>
            </div>

            <p class="text-sm italic leading-relaxed text-[#4A5A52]">
              "{review.text}"
            </p>
          </div>

          <div class="flex items-center justify-between border-t border-[#E4E4DC]/70 pt-3 text-xs">
            <span class="font-bold text-[#0B1F2E]">{review.name}</span>
            <span class="text-[#4A5A52]/70">Verified Morning Drop</span>
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>

<!-- ═══ SECTION 3: AEO FAQ & EAST BENGALURU DELIVERY KNOWLEDGE BASE ═══ -->
<section class="w-full bg-white py-16 border-t border-[#E4E4DC]">
  <div class="mx-auto max-w-[1280px] px-8">
    <div class="grid grid-cols-12 gap-10 items-start">
      <div class="col-span-4 space-y-3">
        <span class="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2B5A16]">
          Farm &amp; Delivery Answers
        </span>
        <h2
          class="text-3xl font-bold leading-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Frequently Asked Questions
        </h2>
        <p class="text-sm leading-relaxed text-[#4A5A52]">
          Everything you need to know about our 5:30 AM Kadugodi harvest schedule, storage, and morning deliveries across Whitefield &amp; East Bengaluru.
        </p>
      </div>

      <div class="col-span-8 space-y-3">
        {#each faqs as item, idx}
          <div class="rounded-2xl border border-[#E4E4DC] bg-[#FAF7F0]/70 overflow-hidden transition-colors {openFaqIndex === idx ? 'border-[#A8D632] bg-[#FAF7F0]' : ''}">
            <button
              type="button"
              onclick={() => (openFaqIndex = openFaqIndex === idx ? -1 : idx)}
              aria-expanded={openFaqIndex === idx}
              class="w-full flex items-center justify-between gap-4 px-6 py-4 text-left text-sm font-bold text-[#0B1F2E] hover:text-[#2B5A16]"
            >
              <span>{item.q}</span>
              <span class="text-base font-black text-[#2B5A16] shrink-0">
                {openFaqIndex === idx ? '−' : '+'}
              </span>
            </button>
            {#if openFaqIndex === idx}
              <div class="px-6 pb-4 text-xs leading-relaxed text-[#4A5A52]">
                {item.a}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>


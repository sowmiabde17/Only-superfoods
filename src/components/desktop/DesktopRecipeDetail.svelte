<!--
  DesktopRecipeDetail.svelte — 2-Column Editorial Magazine Recipe Page (1024px+ only)
  Left Sticky Column: Recipe hero card, metadata pills, paired live produce quick-add + bundle box
  Right Column: Scaled ingredients, step-by-step instructions, nutrition breakdown & related recipes
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { addToCart, openCartDrawer } from '../../lib/cart.js';
  import { getEffectiveStatus, isProductAvailable } from '../../lib/inventory.js';
  import { getRecipeBySlug } from '../../lib/recipesStore.js';
  import { getProductById } from '../../lib/productsStore.js';
  import { site } from '../../data/site.js';

  let { recipe, product, relatedRecipes = [] } = $props();

  let dynamicRecipe = $state(null);
  let r = $derived(dynamicRecipe || recipe);
  let prodId = $derived(product?.id || r?.productId || 'grey-oyster');

  let liveProduct = $state(null);
  let liveGarnishProduct = $state(null);
  let activeProduct = $derived(liveProduct || product);
  let stockStatus = $state('IN_STOCK');

  let selectedServings = $state(recipe?.servings || 2);
  let addedFeedback = $state(false);
  let bundleAddedFeedback = $state(false);
  let isSaved = $state(false);

  function syncLiveProduce() {
    liveProduct = getProductById(prodId) || product || null;
    liveGarnishProduct = getProductById('sunflower-microgreens') || null;
    stockStatus = getEffectiveStatus(prodId);
  }

  let selectedPack = $derived.by(() => {
    const pack0 = activeProduct?.packSizes?.[0];
    return {
      size: pack0?.size || activeProduct?.unit || r?.productPackSize || '250 g',
      price: Number(pack0?.price ?? activeProduct?.price ?? r?.productPackPrice ?? 100),
    };
  });

  let garnishOriginalPrice = $derived(
    Number(liveGarnishProduct?.packSizes?.[0]?.price ?? liveGarnishProduct?.price ?? 80)
  );
  let garnishBundlePrice = $derived(Math.max(10, garnishOriginalPrice - 20));
  let bundleSavingsAmount = $derived(Math.max(0, garnishOriginalPrice - garnishBundlePrice));

  onMount(() => {
    syncLiveProduce();
    const loaded = getRecipeBySlug(recipe?.slug);
    if (loaded) dynamicRecipe = { ...recipe, ...loaded };
    try {
      const saved = JSON.parse(localStorage.getItem('osf_favorite_recipes') || '[]');
      isSaved = Array.isArray(saved) && saved.includes(recipe?.slug);
    } catch (e) {}

    window.addEventListener('osf:inventory-updated', syncLiveProduce);
    window.addEventListener('osf:products-updated', syncLiveProduce);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:inventory-updated', syncLiveProduce);
      window.removeEventListener('osf:products-updated', syncLiveProduce);
    }
  });

  function toggleSave() {
    isSaved = !isSaved;
    try {
      let list = JSON.parse(localStorage.getItem('osf_favorite_recipes') || '[]');
      if (isSaved && !list.includes(r.slug)) list.push(r.slug);
      else list = list.filter((s) => s !== r.slug);
      localStorage.setItem('osf_favorite_recipes', JSON.stringify(list));
    } catch (e) {}
  }

  function formatQty(baseQty) {
    if (baseQty == null) return '';
    const scaled = (baseQty * selectedServings) / (r?.servings || 2);
    if (scaled === 0.5) return '½';
    if (scaled === 0.25) return '¼';
    if (scaled === 0.75) return '¾';
    return Number.isInteger(scaled)
      ? scaled.toString()
      : scaled.toFixed(1).replace(/\.0$/, '');
  }

  function handleAddToCart() {
    const prodToCart = activeProduct || {
      id: prodId,
      name: r?.product || 'Grey Oyster Mushrooms',
      image: r?.thumbnail,
    };
    if (stockStatus === 'OUT_OF_STOCK' || !isProductAvailable(prodToCart.id, 1)) {
      alert(`Sorry! ${prodToCart.name} is sold out for today.`);
      return;
    }
    addToCart(prodToCart, selectedPack, 1);
    addedFeedback = true;
    setTimeout(() => (addedFeedback = false), 2000);
  }

  function handleAddBundle() {
    const mainProd = activeProduct || {
      id: prodId,
      name: r?.product || 'Grey Oyster Mushrooms',
      image: r?.thumbnail,
    };
    const garnishProd = {
      id: 'sunflower-microgreens',
      name: 'Sunflower Microgreens (Garnish Pack)',
      image: liveGarnishProduct?.image || '/images/prod-microgreens-mix.jpg',
      price: garnishBundlePrice,
      unit: liveGarnishProduct?.unit || '50 g',
    };
    if (stockStatus === 'OUT_OF_STOCK' || !isProductAvailable(mainProd.id, 1)) {
      alert(`Sorry! ${mainProd.name} is currently sold out for today's harvest drop.`);
      return;
    }
    addToCart(mainProd, selectedPack, 1);
    addToCart(
      { ...garnishProd, isBundleDiscount: true },
      { size: garnishProd.unit, price: garnishBundlePrice, isBundleDiscount: true },
      1
    );
    bundleAddedFeedback = true;
    setTimeout(() => {
      bundleAddedFeedback = false;
      openCartDrawer();
    }, 500);
  }
</script>

<div class="mx-auto max-w-[1280px] px-8 py-10 text-[#0B1F2E]">
  <!-- Breadcrumb Bar -->
  <div class="mb-7 flex items-center justify-between border-b border-[#E4E4DC] pb-4 text-xs">
    <a href="/recipes" class="inline-flex items-center gap-2 font-bold text-[#2B5A16] hover:underline">
      <span>←</span>
      <span>Back to All Recipes</span>
    </a>
    <div class="flex items-center gap-3 text-[#4A5A52]">
      <span>{r.category}</span>
      <span>•</span>
      <span>{r.difficulty}</span>
      <span>•</span>
      <span>Prep {r.prepTime || '5 min'} • Cook {r.cookTime}</span>
    </div>
  </div>

  <!-- 2-Column Editorial Recipe Layout -->
  <div class="grid grid-cols-12 gap-10 items-start">
    <!-- Left 5 Cols (Sticky): Photo + Live Produce Purchase Cards -->
    <div class="col-span-5 sticky top-24 space-y-6">
      <div class="relative overflow-hidden rounded-3xl border border-[#E4E4DC] bg-[#0B1F2E] shadow-lg">
        <img src={r.thumbnail} alt={r.title} class="aspect-[4/3] w-full object-cover" />
        <button
          type="button"
          onclick={toggleSave}
          class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-base shadow-md hover:scale-105 transition-transform"
          aria-label="Save recipe"
        >
          <span class={isSaved ? 'text-red-500' : 'text-[#4A5A52]'}>{isSaved ? '♥' : '♡'}</span>
        </button>
        <div class="absolute bottom-4 left-4 rounded-full bg-black/75 px-3.5 py-1 text-xs font-bold text-white">
          ⏱ {r.cookTime} • {r.servings} servings
        </div>
      </div>

      <!-- Paired Fresh Produce Direct Add Card -->
      <div class="rounded-3xl border border-[#D4E3C5] bg-[#FAF7F0] p-6 space-y-4 shadow-2xs">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-extrabold uppercase tracking-widest text-[#2B5A16]">
            Shop Key Harvest Ingredient
          </span>
          <span class="rounded-full bg-[#EBF5E4] px-2.5 py-0.5 text-[10px] font-bold text-[#2B5A16]">
            5:30 AM Fresh Pick
          </span>
        </div>

        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3.5 min-w-0">
            <img
              src={activeProduct?.image || r.thumbnail}
              alt={activeProduct?.name || r.product}
              class="h-14 w-14 rounded-xl object-cover border border-[#E4E4DC] shrink-0"
            />
            <div class="min-w-0">
              <div class="truncate text-sm font-bold text-[#0B1F2E]">
                {activeProduct?.name || r.product}
              </div>
              <div class="text-xs text-[#4A5A52]">
                {selectedPack.size} · ₹{selectedPack.price}
              </div>
            </div>
          </div>

          <button
            type="button"
            onclick={handleAddToCart}
            disabled={stockStatus === 'OUT_OF_STOCK'}
            class="shrink-0 rounded-full bg-[#143922] hover:bg-[#2B5A16] disabled:bg-slate-300 px-5 py-2.5 text-xs font-bold text-white transition-colors press"
          >
            {stockStatus === 'OUT_OF_STOCK' ? 'Sold Out' : addedFeedback ? '✓ Added' : '+ Add Pack'}
          </button>
        </div>

        <!-- Complete the Dish Bundle Upsell -->
        {#if prodId !== 'sunflower-microgreens'}
          <div class="rounded-2xl border border-[#A8D632]/60 bg-white p-4 space-y-2.5">
            <div class="flex items-center justify-between text-xs">
              <span class="font-extrabold text-[#2B5A16]">✨ Complete the Dish Bundle</span>
              <span class="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#B45309]">
                Save ₹{bundleSavingsAmount}
              </span>
            </div>
            <p class="text-[11px] text-[#4A5A52]">
              {activeProduct?.name || r.product} ({selectedPack.size}) + Sunflower Microgreens garnish pack ({liveGarnishProduct?.unit || '50 g'}).
            </p>
            <button
              type="button"
              onclick={handleAddBundle}
              class="w-full rounded-xl bg-[#8DC63F] hover:bg-[#2B5A16] py-2.5 text-xs font-bold text-white transition-colors press"
            >
              {bundleAddedFeedback
                ? '✓ Added Combo to Bag!'
                : `Add Chef Combo · ₹${selectedPack.price + garnishBundlePrice}`}
            </button>
          </div>
        {/if}

        <a
          href={`${site.whatsapp.link}?text=${encodeURIComponent(`Hi Only Superfoods! I'm ordering ${activeProduct?.name || r.product} (${selectedPack.size} · ₹${selectedPack.price}) to cook ${r.title}.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          class="block text-center text-xs font-bold text-[#25D366] hover:underline"
        >
          Or Order 1-on-1 via WhatsApp 💬
        </a>
      </div>
    </div>

    <!-- Right 7 Cols: Title, Ingredients Scaler, Steps, Chef Notes & Nutrition -->
    <div class="col-span-7 space-y-8">
      <div class="space-y-3">
        <h1
          class="text-4xl font-black leading-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          {r.title}
        </h1>
        <p class="text-base leading-relaxed text-[#4A5A52]">{r.subtitle}</p>

        {#if Array.isArray(r.nutrientHighlights) && r.nutrientHighlights.length > 0}
          <div class="flex flex-wrap gap-2 pt-1">
            {#each r.nutrientHighlights as pill}
              <span class="rounded-full bg-[#EBF5E4] border border-[#D4E3C5] px-3 py-1 text-xs font-semibold text-[#2B5A16]">
                ✓ {pill}
              </span>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Ingredients Card with Servings Scaler -->
      <div class="rounded-3xl border border-[#E4E4DC] bg-white p-7 space-y-5 shadow-2xs">
        <div class="flex items-center justify-between border-b border-[#E4E4DC] pb-4">
          <h2 class="text-xl font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
            Ingredients
          </h2>
          <div class="flex items-center gap-2 text-xs font-bold">
            <span class="text-[#4A5A52]">Servings:</span>
            {#each [1, 2, 4] as count}
              <button
                type="button"
                onclick={() => (selectedServings = count)}
                class="h-8 w-8 rounded-full border text-xs font-bold transition-colors {selectedServings === count
                  ? 'border-[#143922] bg-[#143922] text-white'
                  : 'border-[#E4E4DC] bg-[#FAF7F0] text-[#0B1F2E] hover:border-[#2B5A16]'}"
              >
                {count}
              </button>
            {/each}
          </div>
        </div>

        <ul class="grid grid-cols-2 gap-3 text-sm text-[#0B1F2E]">
          {#if Array.isArray(r.ingredientsList) && r.ingredientsList.length > 0}
            {#each r.ingredientsList as item}
              <li class="flex items-start gap-2.5 rounded-xl bg-[#FAF7F0] px-3.5 py-2.5">
                <span class="mt-1 h-2 w-2 rounded-full bg-[#A8D632] shrink-0"></span>
                <span>
                  <strong class="text-[#2B5A16]">{formatQty(item.baseQty)} {item.unit}</strong>
                  {item.name}
                </span>
              </li>
            {/each}
          {:else if Array.isArray(r.ingredients)}
            {#each r.ingredients as ing}
              <li class="flex items-start gap-2.5 rounded-xl bg-[#FAF7F0] px-3.5 py-2.5">
                <span class="mt-1 h-2 w-2 rounded-full bg-[#A8D632] shrink-0"></span>
                <span>{ing}</span>
              </li>
            {/each}
          {/if}
        </ul>
      </div>

      <!-- Cooking Steps Card -->
      <div class="rounded-3xl border border-[#E4E4DC] bg-white p-7 space-y-5 shadow-2xs">
        <h2 class="text-xl font-bold text-[#0B1F2E] border-b border-[#E4E4DC] pb-4" style="font-family: 'Playfair Display', serif;">
          Method
        </h2>
        <ol class="space-y-4">
          {#each r.steps || [] as stepText, idx}
            <li class="flex items-start gap-4">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#143922] text-xs font-extrabold text-white">
                {idx + 1}
              </span>
              <p class="pt-0.5 text-sm leading-relaxed text-[#4A5A52]">{stepText}</p>
            </li>
          {/each}
        </ol>
      </div>

      <!-- Nutrition & Chef Tips Row -->
      {#if (r.nutritionFacts && r.nutritionFacts.length > 0) || (r.chefNotes && r.chefNotes.length > 0)}
        <div class="grid grid-cols-2 gap-6">
          {#if r.nutritionFacts?.length}
            <div class="rounded-2xl border border-[#E4E4DC] bg-[#FAF7F0] p-5 space-y-3">
              <h3 class="text-sm font-bold text-[#0B1F2E]">Nutrition per Serving</h3>
              <div class="grid grid-cols-2 gap-2">
                {#each r.nutritionFacts as nf}
                  <div class="rounded-xl bg-white p-2.5 border border-[#E4E4DC]/80">
                    <div class="text-[10px] text-[#4A5A52]">{nf.label}</div>
                    <div class="text-xs font-extrabold text-[#2B5A16]">{nf.value}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if r.chefNotes?.length}
            <div class="rounded-2xl border border-[#D4E3C5] bg-[#F2F8EA] p-5 space-y-2.5">
              <h3 class="text-sm font-bold text-[#2B5A16]">👨‍🌾 Farm Kitchen Notes</h3>
              <ul class="space-y-1.5 text-xs leading-relaxed text-[#4A5A52]">
                {#each r.chefNotes as note}
                  <li>• {note}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Related Recipes Row -->
  {#if relatedRecipes.length > 0}
    <div class="mt-16 border-t border-[#E4E4DC] pt-12">
      <h2 class="mb-6 text-2xl font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
        More Farm Kitchen Recipes
      </h2>
      <div class="grid grid-cols-3 gap-6">
        {#each relatedRecipes as rel (rel.slug)}
          <a
            href={`/recipes/${rel.slug}`}
            class="group overflow-hidden rounded-2xl border border-[#E4E4DC] bg-white shadow-2xs hover:border-[#A8D632] hover:shadow-md transition-all"
          >
            <div class="aspect-[16/10] overflow-hidden bg-[#0B1F2E]">
              <img src={rel.thumbnail} alt={rel.title} class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            </div>
            <div class="p-4">
              <h3 class="text-base font-bold text-[#0B1F2E] group-hover:text-[#2B5A16]" style="font-family: 'Playfair Display', serif;">
                {rel.title}
              </h3>
              <p class="mt-1 text-xs text-[#4A5A52]">{rel.cookTime} • {rel.difficulty}</p>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}
</div>


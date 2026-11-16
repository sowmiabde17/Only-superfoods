<!--
  ProductDetailView.svelte — Dedicated SEO Product Detail Component
  Syncs live with productsStore, inventory, and cart across Desktop & Mobile.
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { getProductById } from '../lib/productsStore.js';
  import { addToCart } from '../lib/cart.js';
  import { getEffectiveStatus, getAvailableStock, isProductAvailable } from '../lib/inventory.js';
  import { site } from '../data/site.js';

  let { product } = $props();

  let liveProd = $state(product);
  let selectedPackIdx = $state(0);
  let addedFeedback = $state(false);
  let errorMsg = $state('');
  let invTick = $state(0);

  let activeProduct = $derived(liveProd || product);
  let packOptions = $derived(
    Array.isArray(activeProduct?.packSizes) && activeProduct.packSizes.length > 0
      ? activeProduct.packSizes
      : [{ size: activeProduct?.unit || '250 g', price: activeProduct?.price || 100 }]
  );
  let selectedPack = $derived(packOptions[selectedPackIdx] || packOptions[0]);
  let stockStatus = $derived.by(() => {
    invTick;
    return getEffectiveStatus(activeProduct?.id);
  });
  let availableStock = $derived.by(() => {
    invTick;
    return getAvailableStock(activeProduct?.id);
  });

  function syncProduct() {
    const fresh = getProductById(product?.id);
    if (fresh) liveProd = fresh;
    invTick++;
  }

  onMount(() => {
    syncProduct();
    window.addEventListener('osf:products-updated', syncProduct);
    window.addEventListener('osf:inventory-updated', syncProduct);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:products-updated', syncProduct);
      window.removeEventListener('osf:inventory-updated', syncProduct);
    }
  });

  function handleAdd() {
    errorMsg = '';
    if (stockStatus === 'OUT_OF_STOCK' || availableStock <= 0 || !isProductAvailable(activeProduct.id, 1)) {
      errorMsg = `Sorry, ${activeProduct.name} is sold out for today's morning harvest drop.`;
      return;
    }
    addToCart(activeProduct, selectedPack, 1);
    addedFeedback = true;
    setTimeout(() => (addedFeedback = false), 1500);
  }

  let whatsappUrl = $derived(
    `${site.whatsapp.link}?text=${encodeURIComponent(
      (activeProduct?.whatsappMessage || `Hi! I'd like to order ${activeProduct?.name} ({{size}}).`).replace(
        '{{size}}',
        selectedPack.size
      )
    )}`
  );
</script>

<div class="mx-auto max-w-[1160px] px-5 lg:px-8 py-6 lg:py-12 text-[#0B1F2E]">
  <!-- Breadcrumbs -->
  <nav class="mb-6 flex items-center gap-2 text-xs text-[#4A5A52]" aria-label="Breadcrumb">
    <a href="/" class="font-semibold hover:text-[#2B5A16]">Home</a>
    <span>/</span>
    <span class="font-semibold">{activeProduct.category}</span>
    <span>/</span>
    <span class="font-bold text-[#0B1F2E] truncate">{activeProduct.name}</span>
  </nav>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
    <!-- Left Image & Freshness Card -->
    <div class="lg:col-span-6 space-y-4">
      <div class="relative overflow-hidden rounded-3xl border border-[#E4E4DC] bg-white shadow-sm">
        <img
          src={activeProduct.image}
          alt={activeProduct.name}
          class="aspect-[4/3] w-full object-cover"
        />
        <div class="absolute top-4 left-4 flex gap-2">
          {#if activeProduct.badge}
            <span class="rounded-full bg-[#143922] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#D8F3A0]">
              {activeProduct.badge}
            </span>
          {/if}
          <span class="rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold text-[#2B5A16] shadow-2xs">
            {activeProduct.freshnessBadge || 'Harvested Fresh at 5:30 AM'}
          </span>
        </div>
      </div>

      <!-- Hyper-Local Delivery Callout -->
      <div class="rounded-2xl border border-[#D4E3C5] bg-[#F2F8EA] p-4 flex items-center gap-3 text-xs text-[#2B5A16]">
        <span class="text-xl">🚚</span>
        <div>
          <div class="font-bold">Same-Morning Drop in Whitefield, Kadugodi &amp; East Bengaluru</div>
          <div class="text-[#4A5A52] text-[11px]">
            Order before 11:59 PM tonight for 5:30 AM harvest &amp; 7:00 AM–10:00 AM delivery.
          </div>
        </div>
      </div>
    </div>

    <!-- Right Purchase & Details Column -->
    <div class="lg:col-span-6 space-y-6">
      <div class="space-y-2">
        <span class="text-xs font-extrabold uppercase tracking-widest text-[#2B5A16]">
          {activeProduct.category} • Kadugodi Indoor Farm
        </span>
        <h1
          class="text-3xl lg:text-4xl font-black leading-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          {activeProduct.name}
        </h1>
        <p class="text-sm lg:text-base leading-relaxed text-[#4A5A52]">
          {activeProduct.longDescription || activeProduct.shortDescription}
        </p>
      </div>

      <!-- Price & Stock -->
      <div class="flex items-baseline justify-between border-y border-[#E4E4DC] py-4">
        <div>
          <div class="text-3xl font-black text-[#143922]">₹{selectedPack.price}</div>
          <div class="text-xs text-[#4A5A52]">Pack size: {selectedPack.size} • Inclusive of all taxes</div>
        </div>
        {#if stockStatus === 'OUT_OF_STOCK' || availableStock <= 0}
          <span class="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
            Sold Out Today
          </span>
        {:else if stockStatus === 'COMING_SOON'}
          <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            Next Flush Maturing
          </span>
        {:else}
          <span class="rounded-full bg-[#EBF5E4] px-3 py-1 text-xs font-bold text-[#2B5A16]">
            ✓ In Stock ({availableStock} packs)
          </span>
        {/if}
      </div>

      <!-- Pack Size Pills -->
      {#if packOptions.length > 0}
        <div class="space-y-2">
          <div class="text-xs font-bold uppercase tracking-wider text-[#4A5A52]">Choose Pack Weight</div>
          <div class="grid grid-cols-3 gap-2.5">
            {#each packOptions as opt, idx}
              <button
                type="button"
                onclick={() => (selectedPackIdx = idx)}
                class="rounded-2xl border p-3 text-center transition-all press {selectedPackIdx === idx
                  ? 'border-[#143922] bg-[#143922] text-white shadow-xs'
                  : 'border-[#E4E4DC] bg-white text-[#0B1F2E] hover:border-[#2B5A16]'}"
              >
                <div class="text-xs font-bold">{opt.size}</div>
                <div class="text-sm font-black mt-0.5">₹{opt.price}</div>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if errorMsg}
        <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
          {errorMsg}
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onclick={handleAdd}
          disabled={stockStatus === 'OUT_OF_STOCK' || availableStock <= 0}
          class="flex-1 rounded-full bg-[#143922] hover:bg-[#2B5A16] disabled:bg-slate-300 py-4 px-6 text-sm font-bold text-white shadow-md transition-all press"
        >
          {#if stockStatus === 'OUT_OF_STOCK' || availableStock <= 0}
            Sold Out for Today
          {:else if addedFeedback}
            ✓ Added to Fresh Bag!
          {:else}
            + Add {selectedPack.size} to Bag · ₹{selectedPack.price}
          {/if}
        </button>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] hover:bg-[#1ebd5a] py-4 px-6 text-sm font-bold text-white shadow-sm press"
        >
          <span>💬 Order on WhatsApp</span>
        </a>
      </div>

      <!-- Storage, Culinary & Nutrition Cards -->
      <div class="space-y-3 pt-2 text-xs">
        {#if activeProduct.storageGuide}
          <div class="rounded-2xl border border-[#E4E4DC] bg-white p-4 space-y-1">
            <div class="font-bold text-[#2B5A16]">❄️ Shelf-Life &amp; Storage ({activeProduct.shelfLife || 'Fresh'})</div>
            <p class="leading-relaxed text-[#4A5A52]">{activeProduct.storageGuide}</p>
          </div>
        {/if}

        {#if activeProduct.culinaryTips}
          <div class="rounded-2xl border border-[#E4E4DC] bg-white p-4 space-y-1">
            <div class="font-bold text-[#0B1F2E]">🍳 Chef Preparation Tip</div>
            <p class="leading-relaxed text-[#4A5A52]">{activeProduct.culinaryTips}</p>
          </div>
        {/if}

        {#if Array.isArray(activeProduct.recipePairings) && activeProduct.recipePairings.length > 0}
          <div class="pt-1 space-y-2">
            <div class="font-bold uppercase tracking-wider text-[11px] text-[#4A5A52]">
              Recipes Using This Harvest
            </div>
            <div class="flex flex-wrap gap-2">
              {#each activeProduct.recipePairings as rec}
                <a
                  href={`/recipes/${rec.slug}`}
                  class="inline-flex items-center gap-1.5 rounded-full border border-[#D4E3C5] bg-[#FAF7F0] px-3.5 py-1.5 text-xs font-bold text-[#2B5A16] hover:bg-[#EBF5E4]"
                >
                  <span>📖 {rec.title} →</span>
                </a>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>


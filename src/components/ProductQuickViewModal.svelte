<!--
  ProductQuickViewModal.svelte — Storage, Shelf-Life & Farm Harvest Quick-View
  Features:
  - Displays complete storage guide (how to refrigerate, shelf life in days)
  - Harvest timing details (dawn harvest at Kadugodi)
  - Culinary cooking tips & pan-sear guidelines
  - Recipe pairings with 1-click links
  - Pack size selector & 1-tap "Add to Bag"
  - Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { addToCart } from '../lib/cart.js';
  import { site } from '../data/site.js';
  import { getEffectiveStatus, getAvailableStock, isProductAvailable } from '../lib/inventory.js';
  import { getProductById } from '../lib/productsStore.js';

  let isOpen = $state(false);
  let product = $state(null);
  let selectedPackIndex = $state(0);
  let addedFeedback = $state(false);
  let errorMessage = $state('');
  let invTick = $state(0);

  let stockStatus = $derived.by(() => {
    invTick;
    return product ? getEffectiveStatus(product.id) : 'IN_STOCK';
  });

  let availableStock = $derived.by(() => {
    invTick;
    return product ? getAvailableStock(product.id) : 99;
  });

  let selectedPack = $derived(
    product?.packSizes?.[selectedPackIndex] || {
      size: product?.unit || '250 g',
      price: product?.price || 100,
    }
  );

  let whatsappUrl = $derived.by(() => {
    if (!product) return site.whatsapp.link;
    const msg = (product.whatsappMessage || '').replace('{{size}}', selectedPack.size);
    return `https://wa.me/917019760360?text=${encodeURIComponent(msg)}`;
  });

  let notifyWhatsappUrl = $derived.by(() => {
    if (!product) return site.whatsapp.link;
    return `https://wa.me/917019760360?text=${encodeURIComponent(
      `Hi Only Superfoods! Please notify me when ${product.name} is harvested and back in stock for the morning drop! 🍄🌱`
    )}`;
  });

  function handleOpen(e) {
    const incoming = e.detail?.product || null;
    product = incoming?.id ? (getProductById(incoming.id) || incoming) : incoming;
    selectedPackIndex = 0;
    addedFeedback = false;
    isOpen = !!product;
    invTick++;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  function handleClose() {
    isOpen = false;
    product = null;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  function handleAdd() {
    if (!product) return;
    errorMessage = '';
    if (stockStatus === 'OUT_OF_STOCK' || availableStock <= 0) {
      errorMessage = `Sorry, ${product.name} is sold out for today's harvest drop.`;
      return;
    }
    addToCart(product, selectedPack, 1);
    addedFeedback = true;
    setTimeout(() => {
      addedFeedback = false;
      handleClose();
    }, 700);
  }

  onMount(() => {
    const onInv = () => invTick++;
    const onProds = () => {
      if (product?.id) {
        const fresh = getProductById(product.id);
        if (fresh) product = fresh;
      }
    };
    window.addEventListener('osf:open-product-quickview', handleOpen);
    window.addEventListener('osf:close-product-quickview', handleClose);
    window.addEventListener('osf:inventory-updated', onInv);
    window.addEventListener('osf:products-updated', onProds);
    return () => {
      window.removeEventListener('osf:open-product-quickview', handleOpen);
      window.removeEventListener('osf:close-product-quickview', handleClose);
      window.removeEventListener('osf:inventory-updated', onInv);
      window.removeEventListener('osf:products-updated', onProds);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  });
</script>

{#if isOpen && product}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
    onclick={handleClose}
    aria-hidden="true"
  ></div>

  <!-- Modal Container -->
  <div
    class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] max-h-[92vh] flex flex-col rounded-t-3xl border-t border-[#E4E4DC] bg-white shadow-2xl transition-transform duration-300 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border"
    role="dialog"
    aria-label="{product.name} Details & Storage Guide"
  >
    <!-- Modal Header with Image & Badges -->
    <div class="relative aspect-video w-full overflow-hidden bg-[#F7F7F2] shrink-0">
      <img
        src={product.image}
        alt={product.name}
        class="h-full w-full object-cover"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30"></div>

      <!-- Close Button -->
      <button
        type="button"
        onclick={handleClose}
        class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xs hover:bg-black/60 transition-all active:scale-95"
        aria-label="Close Modal"
      >
        ✕
      </button>

      <!-- Badges on Image -->
      <div class="absolute bottom-3 left-3 right-3 flex items-end justify-between">
        <div>
          {#if stockStatus === 'OUT_OF_STOCK'}
            <span class="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
              Sold Out for Today 🍄
            </span>
          {:else if stockStatus === 'COMING_SOON'}
            <span class="rounded-full bg-[#F59E0B] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
              Next Flush Maturing 🌱
            </span>
          {:else}
            <span class="rounded-full bg-[#A8D632] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0B1F2E] shadow-xs">
              {product.freshnessBadge || 'Harvested Today'}
            </span>
          {/if}
          <h2 class="mt-1 text-lg font-bold text-white drop-shadow-sm">
            {product.name}
          </h2>
        </div>
        <div class="rounded-xl bg-white/95 px-2.5 py-1 text-right shadow-md backdrop-blur-xs">
          <span class="text-[10px] text-[#4A5A52] block font-semibold">Price</span>
          <span class="text-sm font-bold text-[#2B5A16]">₹{selectedPack.price}</span>
        </div>
      </div>
    </div>

    <!-- Scrollable Body Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs text-[#0B1F2E]">
      <!-- Description -->
      <p class="leading-relaxed text-[#4A5A52]">
        {product.longDescription || product.shortDescription}
      </p>

      <!-- Pack Size Picker -->
      {#if product.packSizes && product.packSizes.length > 1}
        <div>
          <div class="block text-[11px] font-bold uppercase tracking-wider text-[#4A5A52] mb-1.5">
            Select Pack Weight
          </div>
          <div class="grid grid-cols-3 gap-2">
            {#each product.packSizes as p, idx}
              <button
                type="button"
                onclick={() => (selectedPackIndex = idx)}
                class="flex flex-col items-center justify-center rounded-xl p-2 border transition-all text-center {
                  selectedPackIndex === idx
                    ? 'border-[#2B5A16] bg-[#EBF7DC] text-[#2B5A16] font-bold ring-1 ring-[#2B5A16]'
                    : 'border-[#E4E4DC] bg-[#FAF7F0] text-[#4A5A52] font-semibold hover:border-[#A8D632]'
                }"
              >
                <span>{p.size}</span>
                <span class="text-[11px] font-extrabold mt-0.5">₹{p.price}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- ═══ Storage & Shelf-Life Card (Crucial Conversion Driver) ═══ -->
      <div class="rounded-2xl border border-[#A8D632]/50 bg-[#F4F9ED] p-3.5 space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="text-base">❄️</span>
          <h4 class="font-bold text-[#2B5A16] text-xs">
            Shelf-Life &amp; Storage Guide
          </h4>
          {#if product.shelfLife}
            <span class="ml-auto rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold text-[#2B5A16] border border-[#A8D632]/60">
              {product.shelfLife}
            </span>
          {/if}
        </div>
        <p class="text-[11px] text-[#4A5A52] leading-relaxed">
          {product.storageGuide || 'Keep refrigerated in breathable container.'}
        </p>
      </div>

      <!-- Culinary / Cooking Tips -->
      {#if product.culinaryTips}
        <div class="rounded-2xl border border-[#E4E4DC] bg-[#FAF7F0] p-3.5 space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-base">🍳</span>
            <h4 class="font-bold text-[#0B1F2E] text-xs">
              Chef's Pan-Sear &amp; Cooking Tip
            </h4>
          </div>
          <p class="text-[11px] text-[#4A5A52] leading-relaxed">
            {product.culinaryTips}
          </p>
        </div>
      {/if}

      <!-- Suggested Recipes Link Pills -->
      {#if product.recipePairings && product.recipePairings.length > 0}
        <div>
          <div class="block text-[11px] font-bold uppercase tracking-wider text-[#4A5A52] mb-1.5">
            📖 Recommended Recipes for This Harvest
          </div>
          <div class="flex flex-wrap gap-1.5">
            {#each product.recipePairings as recipe}
              <a
                href="/recipes/{recipe.slug}"
                onclick={handleClose}
                class="inline-flex items-center gap-1 rounded-full border border-[#E4E4DC] bg-white px-3 py-1 text-[11px] font-semibold text-[#2B5A16] hover:bg-[#EBF7DC] hover:border-[#A8D632] transition-colors"
              >
                <span>👨‍🍳</span>
                <span>{recipe.title}</span>
                <span class="text-[9px] text-[#4A5A52]">→</span>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Nutrition Pills -->
      {#if product.nutritionFacts && product.nutritionFacts.length > 0}
        <div class="pt-1">
          <span class="block text-[10px] font-bold uppercase tracking-wider text-[#4A5A52] mb-1">
            Nutrient Highlights
          </span>
          <div class="flex flex-wrap gap-1.5">
            {#each product.nutritionFacts as fact}
              <span class="rounded-lg bg-[#FAF7F0] px-2 py-1 text-[10px] font-semibold text-[#2B5A16] border border-[#E4E4DC]">
                <strong>{fact.label}:</strong> {fact.value}
              </span>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Sticky Bottom Bar: Add to Bag + WhatsApp -->
    {#if errorMessage}
      <div class="border-t border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
        {errorMessage}
      </div>
    {/if}
    <div class="border-t border-[#E4E4DC] bg-white p-3.5 flex items-center gap-2 shrink-0">
      {#if stockStatus === 'OUT_OF_STOCK' || availableStock <= 0}
        <button
          disabled
          class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-200 py-3 text-xs font-bold text-slate-500 cursor-not-allowed border border-slate-300"
        >
          <span>Sold Out for Today 🍄</span>
        </button>
      {:else if stockStatus === 'COMING_SOON'}
        <a
          href={notifyWhatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#F59E0B] py-3 text-xs font-bold text-white shadow-md hover:bg-[#D97706] active:scale-98 transition-all"
        >
          <span>🔔 Notify me on WhatsApp</span>
        </a>
      {:else}
        <button
          type="button"
          onclick={handleAdd}
          class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#2B5A16] py-3 text-xs font-bold text-white shadow-md hover:bg-[#1E3F20] active:scale-98 transition-all"
        >
          {#if addedFeedback}
            <span>✓ Added to Fresh Bag!</span>
          {:else}
            <span>🛒</span>
            <span>Add {selectedPack.size} (₹{selectedPack.price})</span>
          {/if}
        </button>
      {/if}

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center justify-center rounded-xl bg-[#25D366] px-3.5 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#20BA59] active:scale-98 transition-all"
        aria-label="Order on WhatsApp"
        title="Order on WhatsApp"
      >
        💬 WhatsApp
      </a>
    </div>
  </div>
{/if}


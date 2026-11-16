<!--
  ProductCard.svelte — Redesigned Premium Produce Card
  Matches Design Reference (Image 1 & Image 2):
  - Clean card with rounded-2xl corners & soft border
  - Top-left pill badge ("Bestseller" orange, "Fresh Harvest" green)
  - Top-right interactive wishlist Heart icon
  - Product title & pack weight
  - Price & lime-green "Add" button / active quantity selector "[ - ] 1 [ + ]"
  - Expandable nutrition & direct WhatsApp chat option
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from "svelte";
  import {
    getCartItems,
    addToCart,
    updateItemQuantity,
  } from "../lib/cart.js";
  import {
    getEffectiveStatus,
    getAvailableStock,
    isProductAvailable,
  } from "../lib/inventory.js";

  /** @type {{ product: object, compact?: boolean }} */
  let { product, compact = false } = $props();

  /* ── State ──────────────────────────────────────── */
  let isWishlisted = $state(false);
  let expanded = $state(false);
  let cartItems = $state([]);
  let selectedPackIndex = $state(0);
  let stockStatus = $state('IN_STOCK');
  let availableStock = $state(99);

  /* ── Derived values ─────────────────────────────── */
  let selectedPack = $derived(
    product?.packSizes?.[selectedPackIndex] || {
      size: product?.unit || '250 g',
      price: product?.price || 100,
    }
  );
  let itemKey = $derived(`${product?.id || 'item'}__${selectedPack.size}`);

  let cartItem = $derived(
    cartItems.find((i) => i.key === itemKey)
  );

  let inCartCount = $derived(cartItem ? cartItem.quantity : 0);

  let whatsappUrl = $derived.by(() => {
    const template = product?.whatsappMessage || `Hi Only Superfoods! I would like to order ${product?.name || 'fresh produce'} ({{size}}). 🍄🌱`;
    const msg = template.replace("{{size}}", selectedPack.size);
    return `https://wa.me/917019760360?text=${encodeURIComponent(msg)}`;
  });

  let notifyWhatsappUrl = $derived.by(() => {
    return `https://wa.me/917019760360?text=${encodeURIComponent(
      `Hi Only Superfoods! Please notify me on WhatsApp when ${product.name} is harvested and back in stock for the morning drop! 🍄🌱`
    )}`;
  });

  function refreshStock() {
    stockStatus = getEffectiveStatus(product.id);
    availableStock = getAvailableStock(product.id);
  }

  $effect(() => {
    product?.id;
    refreshStock();
  });

  function handleCartUpdated(e) {
    cartItems = e.detail?.items || getCartItems();
  }

  onMount(() => {
    cartItems = getCartItems();
    refreshStock();
    window.addEventListener("osf:cart-updated", handleCartUpdated);
    window.addEventListener("osf:inventory-updated", refreshStock);
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("osf:cart-updated", handleCartUpdated);
      window.removeEventListener("osf:inventory-updated", refreshStock);
    }
  });

  function handleAdd() {
    if (stockStatus === 'OUT_OF_STOCK' || availableStock <= 0) return;
    if (inCartCount >= availableStock) {
      alert(`Sorry! Only ${availableStock} packs available from today's morning harvest.`);
      return;
    }
    addToCart(product, selectedPack, 1);
  }

  function handleIncrement() {
    if (inCartCount >= availableStock) {
      alert(`Only ${availableStock} packs left for today.`);
      return;
    }
    updateItemQuantity(itemKey, 1);
  }

  function handleDecrement() {
    updateItemQuantity(itemKey, -1);
  }

  function toggleWishlist(e) {
    e.stopPropagation();
    isWishlisted = !isWishlisted;
  }

  function openQuickView(e) {
    e?.stopPropagation();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('osf:open-product-quickview', { detail: { product } })
      );
    }
  }
</script>

{#if stockStatus !== 'HIDDEN'}
<article
  class="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E4E4DC] bg-white p-3 shadow-2xs transition-all hover:shadow-sm {stockStatus === 'OUT_OF_STOCK' ? 'opacity-90' : ''}"
>
  <!-- Top Image Container (Clickable for Quick View & Storage Guide) -->
  <div
    onclick={openQuickView}
    class="relative aspect-square w-full overflow-hidden rounded-xl bg-[#F7F7F2] cursor-pointer"
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && openQuickView(e)}
    aria-label="View {product.name} Details & Storage Guide"
  >
    <img
      src={product.image}
      alt={product.name}
      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-103 {stockStatus === 'OUT_OF_STOCK' ? 'grayscale-[40%]' : ''}"
      loading="lazy"
    />

    <!-- Out of Stock Overlay -->
    {#if stockStatus === 'OUT_OF_STOCK'}
      <div class="absolute inset-0 bg-black/45 flex items-center justify-center p-2 text-center backdrop-blur-[1px]">
        <span class="rounded-xl bg-red-600/90 text-white font-extrabold text-[11px] px-2.5 py-1 shadow-md border border-white/30 uppercase tracking-wider">
          Sold Out Today 🍄
        </span>
      </div>
    {:else if stockStatus === 'COMING_SOON'}
      <div class="absolute inset-0 bg-amber-950/25 flex items-end justify-center p-2 text-center">
        <span class="rounded-lg bg-[#F59E0B] text-white font-bold text-[10px] px-2 py-0.5 shadow-sm uppercase tracking-wider">
          Next Flush Maturing 🌱
        </span>
      </div>
    {/if}

    <!-- Quick View Overlay Hint on Hover -->
    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
      <span class="text-[9.5px] font-bold text-white flex items-center gap-1">
        <span>🔍</span> Quick View &amp; Storage
      </span>
    </div>

    <!-- Badge on Top Left (Bestseller / Fresh Harvest) -->
    {#if product.badge && stockStatus === 'IN_STOCK'}
      <span
        class="absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-tight text-white shadow-2xs
               {product.badgeType === 'orange' ? 'bg-[#FF5500]' : 'bg-[#4B8E1D]'}"
      >
        {product.badge}
      </span>
    {/if}

    <!-- Heart Wishlist Icon on Top Right -->
    <button
      onclick={toggleWishlist}
      class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 backdrop-blur-xs text-[#0B1F2E] shadow-2xs transition-transform press"
      aria-label="Save to Wishlist"
    >
      <svg
        class="h-4 w-4 transition-colors {isWishlisted ? 'fill-[#E2311A] text-[#E2311A]' : 'text-[#0B1F2E]'}"
        viewBox="0 0 24 24"
        fill={isWishlisted ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      </svg>
    </button>
  </div>

  <!-- Product Details (Exact matching typography) -->
  <div class="mt-2.5 flex flex-1 flex-col justify-between gap-1">
    <div>
      <h3
        class="text-xs sm:text-sm font-bold leading-tight text-[#0B1F2E]"
      >
        {product.name}
      </h3>
      <div class="flex items-center justify-between">
        <p class="text-[11px] font-medium text-[#4A5A52]/75">
          {selectedPack.size}
        </p>
        {#if stockStatus === 'IN_STOCK' && availableStock > 0 && availableStock <= 5}
          <span class="text-[9.5px] font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-200">
            Only {availableStock} left!
          </span>
        {/if}
      </div>
      <button
        type="button"
        onclick={openQuickView}
        class="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#2B5A16] hover:underline"
      >
        <span>❄️ Storage &amp; Tips</span>
        <span>→</span>
      </button>
    </div>

    <!-- Collapsible Quick Nutrition Tag -->
    {#if expanded}
      <div class="my-1.5 space-y-1 rounded-lg bg-[#F7F7F2] p-2 text-[10px] text-[#4A5A52]">
        <p class="leading-relaxed">{product.shortDescription}</p>
        <div class="flex flex-wrap gap-1 pt-1">
          {#each product.nutritionFacts as fact}
            <span class="rounded bg-white px-1 py-0.5 font-medium text-[#2B5A16] border border-[#E4E4DC]">
              {fact.label}: {fact.value}
            </span>
          {/each}
        </div>
        <!-- WhatsApp fallback link -->
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="block pt-1 text-[10px] font-bold text-[#25D366] hover:underline"
        >
          Order 1-on-1 via WhatsApp 💬
        </a>
      </div>
    {/if}

    <!-- Bottom Action Row: Price & Add / Quantity Controller -->
    <div class="mt-2 flex items-center justify-between gap-1 pt-1">
      <div class="flex items-baseline gap-0.5">
        <span class="text-sm sm:text-base font-extrabold text-[#0B1F2E]">
          ₹{selectedPack.price}
        </span>
      </div>

      <!-- Out of Stock / Coming Soon / Add Button -->
      {#if stockStatus === 'OUT_OF_STOCK' || availableStock <= 0}
        <button
          disabled
          class="rounded-lg bg-slate-200 text-slate-500 font-bold {compact ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'} cursor-not-allowed border border-slate-300"
        >
          Sold Out
        </button>
      {:else if stockStatus === 'COMING_SOON'}
        <a
          href={notifyWhatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold {compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} shadow-2xs transition-colors flex items-center gap-1"
        >
          <span>🔔 Notify</span>
        </a>
      {:else if inCartCount === 0}
        <button
          onclick={handleAdd}
          class="rounded-lg bg-[#8DC63F] {compact ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'} font-bold text-white shadow-2xs transition-colors hover:bg-[#7db534] active:scale-96 press"
        >
          {compact ? 'Add' : 'Add to Cart'}
        </button>
      {:else}
        <!-- Active Quantity Control in Lime Green Surface (Exact match to Image 2) -->
        <div class="flex items-center {compact ? 'gap-1.5 px-1.5 py-0.5' : 'gap-2 px-2 py-1'} rounded-lg bg-[#EAF5D8] text-xs font-bold text-[#2B5A16] border border-[#A8D632]">
          <button
            onclick={handleDecrement}
            class="flex h-5 w-5 items-center justify-center text-sm font-black press hover:text-[#0B1F2E]"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span class="min-w-[12px] text-center font-bold text-[#0B1F2E]">
            {inCartCount}
          </span>
          <button
            onclick={handleIncrement}
            class="flex h-5 w-5 items-center justify-center text-sm font-black press hover:text-[#0B1F2E]"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      {/if}
    </div>

    <!-- Detail Toggle Prompt -->
    <button
      onclick={() => (expanded = !expanded)}
      class="mt-1 self-start text-[9.5px] font-medium text-[#2B5A16] hover:underline"
    >
      {expanded ? 'Hide info ▴' : 'Nutrition & Details ▾'}
    </button>
  </div>
</article>
{/if}

<!--
  DesktopProductCatalog.svelte — Dedicated multi-column desktop storefront (1024px+ only)
  Features category tabs with counts, inline search, In-Stock filter, sort dropdown,
  3–4 col product cards with inline weight pills, live inventory, wishlist, and Quick View.
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { getProducts } from '../../lib/productsStore.js';
  import {
    getCartItems,
    addToCart,
    updateItemQuantity,
    removeItem,
    getCartTotals,
    openCartDrawer,
  } from '../../lib/cart.js';
  import {
    getAvailableStock,
    getEffectiveStatus,
    isProductAvailable,
  } from '../../lib/inventory.js';

  function openQuickView(product) {
    if (typeof window !== 'undefined' && product) {
      window.dispatchEvent(new CustomEvent('osf:open-product-quickview', { detail: { product } }));
    }
  }
  import { site } from '../../data/site.js';

  let currentProducts = $state(getProducts());
  let cartItems = $state([]);
  let activeCategory = $state('all');
  let sortBy = $state('featured');
  let searchQuery = $state('');
  let inStockOnly = $state(false);
  let invTick = $state(0);

  // Per-product selected pack index & wishlist state
  let selectedPackMap = $state({});
  let wishlistIds = $state([]);

  const categories = [
    { id: 'all', name: 'All Harvest' },
    { id: 'Mushrooms', name: 'Mushrooms' },
    { id: 'Microgreens', name: 'Microgreens' },
    { id: 'Kombucha', name: 'Kombucha' },
    { id: 'Desi Eggs', name: 'Desi Eggs' },
  ];

  function getCategoryCount(catId) {
    if (catId === 'all') return currentProducts.length;
    return currentProducts.filter(
      (p) => (p.category || '').toLowerCase() === catId.toLowerCase()
    ).length;
  }

  let filteredProducts = $derived.by(() => {
    invTick;
    let list = [...currentProducts];

    if (activeCategory !== 'all') {
      const target = activeCategory.toLowerCase();
      list = list.filter((p) => (p.category || '').toLowerCase() === target);
    }

    if (inStockOnly) {
      list = list.filter((p) => isProductAvailable(p.id, 1));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.shortDescription || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'freshness') {
      list.sort((a, b) => {
        const aAvail = isProductAvailable(a.id, 1) ? 1 : 0;
        const bAvail = isProductAvailable(b.id, 1) ? 1 : 0;
        if (aAvail !== bAvail) return bAvail - aAvail;
        const aFresh = /fresh|dawn|harvest/i.test(a.badge || '') ? 1 : 0;
        const bFresh = /fresh|dawn|harvest/i.test(b.badge || '') ? 1 : 0;
        return bFresh - aFresh;
      });
    }

    return list;
  });

  let cartTotals = $derived(getCartTotals(cartItems));

  function getPackIndex(product) {
    return selectedPackMap[product.id] ?? 0;
  }

  function getSelectedPack(product) {
    if (Array.isArray(product.packSizes) && product.packSizes.length > 0) {
      return product.packSizes[getPackIndex(product)] || product.packSizes[0];
    }
    return { size: product.unit || '250 g', price: product.price };
  }

  function setPackIndex(productId, idx) {
    selectedPackMap = { ...selectedPackMap, [productId]: idx };
  }

  function getItemInCartQty(product, pack) {
    const match = cartItems.find(
      (i) => i.productId === product.id && i.packSize === pack.size
    );
    return match ? match.quantity : 0;
  }

  function handleAdd(product, pack) {
    if (!isProductAvailable(product.id, 1)) return;
    addToCart(product, pack, 1);
  }

  function handleIncrement(product, pack) {
    const qty = getItemInCartQty(product, pack);
    const totalStock = getAvailableStock(product.id);
    if (qty + 1 > totalStock) return;
    updateItemQuantity(`${product.id}__${pack.size}`, 1);
  }

  function handleDecrement(product, pack) {
    const key = `${product.id}__${pack.size}`;
    const qty = getItemInCartQty(product, pack);
    if (qty <= 1) {
      removeItem(key);
    } else {
      updateItemQuantity(key, -1);
    }
  }

  function toggleWishlist(productId) {
    const next = wishlistIds.includes(productId)
      ? wishlistIds.filter((id) => id !== productId)
      : [...wishlistIds, productId];
    wishlistIds = next;
    try {
      localStorage.setItem('osf_wishlist', JSON.stringify(next));
    } catch (e) {}
  }

  function resetFilters() {
    activeCategory = 'all';
    searchQuery = '';
    sortBy = 'featured';
    inStockOnly = false;
  }

  function handleCartUpdated(e) {
    cartItems = e.detail?.items || getCartItems();
  }
  function handleProductsUpdated(e) {
    currentProducts = e.detail?.products || getProducts();
  }
  function handleFilterCategory(e) {
    activeCategory = e.detail?.category || 'all';
  }
  function handleSearch(e) {
    searchQuery = e.detail?.query || '';
  }
  function handleInventoryUpdated() {
    invTick++;
  }

  onMount(() => {
    currentProducts = getProducts();
    cartItems = getCartItems();
    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) searchQuery = urlQ;

    try {
      const saved = JSON.parse(localStorage.getItem('osf_wishlist') || '[]');
      if (Array.isArray(saved)) wishlistIds = saved;
    } catch (e) {}

    window.addEventListener('osf:cart-updated', handleCartUpdated);
    window.addEventListener('osf:products-updated', handleProductsUpdated);
    window.addEventListener('osf:filter-category', handleFilterCategory);
    window.addEventListener('osf:search', handleSearch);
    window.addEventListener('osf:inventory-updated', handleInventoryUpdated);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:cart-updated', handleCartUpdated);
      window.removeEventListener('osf:products-updated', handleProductsUpdated);
      window.removeEventListener('osf:filter-category', handleFilterCategory);
      window.removeEventListener('osf:search', handleSearch);
      window.removeEventListener('osf:inventory-updated', handleInventoryUpdated);
    }
  });
</script>

<section id="desktop-catalog" class="w-full scroll-mt-20 bg-[#FAF7F0] py-20 border-b border-[#E4E4DC]">
  <div class="mx-auto max-w-[1280px] px-8">
    <!-- Section Title Row -->
    <div class="mb-8 flex items-end justify-between gap-6">
      <div>
        <span class="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2B5A16]">
          Harvested Fresh To Order
        </span>
        <h2
          class="mt-1.5 text-3xl xl:text-4xl font-bold tracking-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Shop Today’s Morning Harvest
        </h2>
      </div>

      <p class="max-w-md text-right text-sm text-[#4A5A52]">
        Select your preferred pack weight directly on any card, or inspect full nutrition &amp; chef storage notes.
      </p>
    </div>

    <!-- Filter & Sort Bar -->
    <div class="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E4E4DC] bg-white p-3.5 shadow-2xs">
      <!-- Category Filter Tabs -->
      <div class="flex flex-wrap items-center gap-2">
        {#each categories as cat}
          <button
            type="button"
            onclick={() => (activeCategory = cat.id)}
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all press {activeCategory === cat.id
              ? 'bg-[#143922] text-white shadow-xs'
              : 'bg-[#FAF7F0] text-[#4A5A52] hover:bg-[#EDF3E4] hover:text-[#2B5A16]'}"
          >
            <span>{cat.name}</span>
            <span
              class="rounded-full px-1.5 py-0.5 text-[10px] {activeCategory === cat.id
                ? 'bg-[#A8D632] text-[#0B1F2E]'
                : 'bg-white text-[#4A5A52]'}"
            >
              {getCategoryCount(cat.id)}
            </span>
          </button>
        {/each}
      </div>

      <!-- Right Controls: Search, In-Stock, Sort -->
      <div class="flex items-center gap-3">
        <div class="relative">
          <input
            type="search"
            bind:value={searchQuery}
            placeholder="Filter produce..."
            class="w-48 rounded-full border border-[#E4E4DC] bg-[#FAF7F0] pl-8 pr-3 py-1.5 text-xs text-[#0B1F2E] outline-none focus:border-[#2B5A16] focus:bg-white"
          />
          <svg
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#4A5A52]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        <button
          type="button"
          onclick={() => (inStockOnly = !inStockOnly)}
          class="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors press {inStockOnly
            ? 'border-[#2B5A16] bg-[#EBF5E4] text-[#2B5A16]'
            : 'border-[#E4E4DC] bg-white text-[#4A5A52] hover:border-[#2B5A16]'}"
        >
          <span>{inStockOnly ? '✓' : '○'}</span>
          <span>In Stock</span>
        </button>

        <select
          bind:value={sortBy}
          aria-label="Sort produce"
          class="rounded-full border border-[#E4E4DC] bg-white px-4 py-1.5 text-xs font-bold text-[#0B1F2E] outline-none focus:border-[#2B5A16] cursor-pointer"
        >
          <option value="featured">Sort: Featured</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="freshness">Harvest Freshness</option>
        </select>
      </div>
    </div>

    <!-- Product Grid (3 cols lg, 4 cols xl) or Empty State -->
    {#if filteredProducts.length === 0}
      <div class="rounded-3xl border border-[#E4E4DC] bg-white p-14 text-center space-y-3 shadow-2xs">
        <div class="text-4xl">🌱</div>
        <h3 class="text-xl font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
          No morning harvest matched those filters
        </h3>
        <p class="text-sm text-[#4A5A52]">
          Try clearing your search term or switching back to all fresh categories.
        </p>
        <button
          type="button"
          onclick={resetFilters}
          class="mt-2 inline-flex items-center rounded-full bg-[#143922] px-6 py-2.5 text-xs font-bold text-white shadow-xs press"
        >
          Reset Filters
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-3 xl:grid-cols-4 gap-6">
        {#each filteredProducts as product (product.id)}
          {@const pack = getSelectedPack(product)}
          {@const packIdx = getPackIndex(product)}
          {@const qtyInCart = getItemInCartQty(product, pack)}
          {@const availStock = (invTick, getAvailableStock(product.id))}
          {@const stockStatus = (invTick, getEffectiveStatus(product.id))}
          {@const isWished = wishlistIds.includes(product.id)}
          {@const isSoldOut = stockStatus === 'OUT_OF_STOCK' || availStock <= 0}
          {@const isComingSoon = stockStatus === 'COMING_SOON'}

          <article class="flex flex-col rounded-3xl border border-[#E4E4DC] bg-white overflow-hidden shadow-2xs hover:shadow-xl hover:border-[#A8D632] transition-all duration-300 group">
            <!-- Image Container -->
            <div class="relative aspect-[4/3] overflow-hidden bg-[#F7F7F2]">
              <img
                src={product.image}
                alt={product.name}
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 {isSoldOut ? 'grayscale opacity-75' : ''}"
                loading="lazy"
              />

              <!-- Top Badges -->
              <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                {#if product.badge}
                  <span
                    class="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-xs {product.badgeType === 'orange'
                      ? 'bg-[#FF5E00] text-white'
                      : 'bg-[#143922] text-[#D8F3A0]'}"
                  >
                    {product.badge}
                  </span>
                {/if}
              </div>

              <!-- Top-Right Wishlist -->
              <button
                type="button"
                onclick={() => toggleWishlist(product.id)}
                class="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-xs shadow-xs hover:scale-110 transition-transform"
                aria-label="Save {product.name} to wishlist"
              >
                <span class="text-sm {isWished ? 'text-red-500' : 'text-[#4A5A52]'}">
                  {isWished ? '♥' : '♡'}
                </span>
              </button>

              <!-- Bottom Freshness Strip -->
              <div class="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
                <span class="rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-1 text-[10px] font-bold text-[#2B5A16] shadow-2xs truncate">
                  {product.freshnessBadge || 'Harvested Fresh'}
                </span>
                {#if isSoldOut}
                  <span class="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs">
                    Sold Out
                  </span>
                {:else if availStock <= 5 && !isComingSoon}
                  <span class="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs">
                    {availStock} left
                  </span>
                {/if}
              </div>
            </div>

            <!-- Card Body -->
            <div class="flex flex-1 flex-col justify-between p-5 space-y-4">
              <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10px] font-extrabold uppercase tracking-widest text-[#2B5A16]">
                    {product.category}
                  </span>
                  <button
                    type="button"
                    onclick={() => openQuickView(product)}
                    class="text-[11px] font-bold text-[#4A5A52] hover:text-[#2B5A16] underline underline-offset-2"
                  >
                    Details &amp; Nutrition
                  </button>
                </div>

                <button
                  type="button"
                  onclick={() => openQuickView(product)}
                  class="text-left text-lg font-bold text-[#0B1F2E] leading-snug group-hover:text-[#2B5A16] transition-colors"
                  style="font-family: 'Playfair Display', Georgia, serif;"
                >
                  {product.name}
                </button>

                <p class="text-xs leading-relaxed text-[#4A5A52] line-clamp-2">
                  {product.shortDescription}
                </p>
              </div>

              <!-- Pack Weight Selector Pills -->
              {#if Array.isArray(product.packSizes) && product.packSizes.length > 0}
                <div class="flex flex-wrap gap-1.5">
                  {#each product.packSizes as option, idx}
                    <button
                      type="button"
                      onclick={() => setPackIndex(product.id, idx)}
                      class="rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-colors {packIdx === idx
                        ? 'border-[#143922] bg-[#143922] text-white'
                        : 'border-[#E4E4DC] bg-[#FAF7F0] text-[#4A5A52] hover:border-[#2B5A16]'}"
                    >
                      {option.size}
                    </button>
                  {/each}
                </div>
              {/if}

              <!-- Price + CTA Footer -->
              <div class="flex items-center justify-between border-t border-[#E4E4DC]/80 pt-3.5">
                <div>
                  <div class="text-xl font-black text-[#0B1F2E]">₹{pack.price}</div>
                  <div class="text-[10px] text-[#4A5A52]">per {pack.size}</div>
                </div>

                {#if isSoldOut}
                  <button
                    disabled
                    class="rounded-full bg-slate-200 px-4 py-2 text-xs font-bold text-slate-500 cursor-not-allowed"
                  >
                    Sold Out
                  </button>
                {:else if isComingSoon}
                  <a
                    href={`https://wa.me/91${site.whatsapp.number}?text=${encodeURIComponent(`Hi! Please notify me when ${product.name} is back in stock.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="rounded-full bg-[#F59E0B] hover:bg-[#D97706] px-4 py-2 text-xs font-bold text-white transition-colors press"
                  >
                    🔔 Notify Me
                  </a>
                {:else if qtyInCart === 0}
                  <button
                    type="button"
                    onclick={() => handleAdd(product, pack)}
                    class="rounded-full bg-[#8DC63F] hover:bg-[#2B5A16] px-5 py-2 text-xs font-bold text-white shadow-2xs transition-colors press"
                  >
                    + Add to Bag
                  </button>
                {:else}
                  <div class="flex items-center gap-2.5 rounded-full bg-[#EBF5E4] border border-[#A8D632] px-3 py-1.5 text-xs font-extrabold text-[#2B5A16]">
                    <button
                      type="button"
                      onclick={() => handleDecrement(product, pack)}
                      class="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white text-sm"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span class="min-w-[14px] text-center text-[#0B1F2E]">{qtyInCart}</span>
                    <button
                      type="button"
                      onclick={() => handleIncrement(product, pack)}
                      class="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white text-sm"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/if}

    <!-- Persistent Live Bag Quick-Bar when items exist -->
    {#if cartTotals.totalCount > 0}
      <div class="mt-10 flex items-center justify-between rounded-2xl border border-[#A8D632] bg-[#143922] px-7 py-4 text-white shadow-lg">
        <div class="flex items-center gap-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#A8D632] text-[#0B1F2E] font-black text-sm">
            {cartTotals.totalCount}
          </div>
          <div>
            <div class="text-sm font-bold">
              Your Fresh Morning Bag · ₹{cartTotals.totalPrice}
            </div>
            <div class="text-xs text-[#D8F3A0]">
              Harvested at 5:30 AM dawn &amp; dispatched straight to your kitchen.
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            onclick={openCartDrawer}
            class="rounded-full bg-[#A8D632] hover:bg-[#97c624] px-6 py-2.5 text-xs font-black text-[#0B1F2E] transition-colors press"
          >
            Review Bag &amp; Checkout →
          </button>
          <a
            href="/cart"
            class="rounded-full border border-white/25 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition-colors"
          >
            Full Cart Page
          </a>
        </div>
      </div>
    {/if}
  </div>
</section>

<!--
  ProductGrid.svelte — Full Farm Produce Grid with Category Circles & Sorting
  Matches Design Reference (Image 2):
  - Category Circle Filter Row with "All" grid icon + product category photos
  - Filter & Sort Controls ("Filters (1)" + "Sort by: Featured")
  - 2-Column Responsive Product Grid with active Runes, live cart quantities & wishlist
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { getProducts } from '../lib/productsStore.js';
  import { isProductAvailable } from '../lib/inventory.js';
  import ProductCard from './ProductCard.svelte';
  import FilterSortBar from './FilterSortBar.svelte';

  /* ── State ──────────────────────────────────────── */
  let currentProducts = $state(getProducts());
  let activeCategory = $state('all');
  let sortBy = $state('featured');
  let searchQuery = $state('');
  let inStockOnly = $state(false);
  let isFilterOpen = $state(false);
  let invTick = $state(0);

  let activeFilterCount = $derived(
    (activeCategory !== 'all' ? 1 : 0) +
      (inStockOnly ? 1 : 0) +
      (searchQuery.trim() ? 1 : 0)
  );

  /* ── Category Avatar List (Matches Image 2 exactly) ── */
  const catalogCategories = [
    {
      id: 'all',
      name: 'All',
      isAll: true,
    },
    {
      id: 'Mushrooms',
      name: 'Mushrooms',
      image: '/images/prod-grey-oyster.jpg',
    },
    {
      id: 'Microgreens',
      name: 'Microgreens',
      image: '/images/prod-microgreens-mix.jpg',
    },
    {
      id: 'Kombucha',
      name: 'Kombucha',
      image: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/Vibrant%20Kombucha%20Collection%20with%20Fresh%20Garnishes.webp',
    },
    {
      id: 'Desi Eggs',
      name: 'Desi Eggs',
      image: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/ehggs.webp',
    },
  ];

  /* ── Filter & Sort Logic ────────────────────────── */
  let filteredProducts = $derived.by(() => {
    invTick;
    let list = [...currentProducts];

    // Filter by category (case-insensitive)
    if (activeCategory !== 'all') {
      const targetCat = activeCategory.toLowerCase();
      list = list.filter((p) => (p.category || '').toLowerCase() === targetCat);
    }

    // Filter by availability
    if (inStockOnly) {
      list = list.filter((p) => isProductAvailable(p.id, 1));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.shortDescription || '').toLowerCase().includes(q)
      );
    }

    // Sort
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

  function selectCategory(catId) {
    activeCategory = catId;
  }

  function handleFilterCategory(e) {
    activeCategory = e.detail?.category || 'all';
  }

  function handleSortChanged(e) {
    sortBy = e.detail?.sortBy || 'featured';
  }

  function handleSearch(e) {
    searchQuery = e.detail?.query || '';
  }

  function handleProductsUpdated(e) {
    currentProducts = e.detail?.products || getProducts();
  }

  function handleInventoryUpdated() {
    invTick++;
  }

  onMount(() => {
    currentProducts = getProducts();
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('q');
    if (urlQuery) {
      searchQuery = urlQuery;
    }
    window.addEventListener('osf:filter-category', handleFilterCategory);
    window.addEventListener('osf:sort-changed', handleSortChanged);
    window.addEventListener('osf:search', handleSearch);
    window.addEventListener('osf:products-updated', handleProductsUpdated);
    window.addEventListener('osf:inventory-updated', handleInventoryUpdated);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:filter-category', handleFilterCategory);
      window.removeEventListener('osf:sort-changed', handleSortChanged);
      window.removeEventListener('osf:search', handleSearch);
      window.removeEventListener('osf:products-updated', handleProductsUpdated);
      window.removeEventListener('osf:inventory-updated', handleInventoryUpdated);
    }
  });

  function resetFilters() {
    activeCategory = 'all';
    searchQuery = '';
    sortBy = 'featured';
    inStockOnly = false;
    isFilterOpen = false;
  }
</script>

<section data-section="products" class="w-full bg-white px-4 pt-2 pb-12">
  <div class="mx-auto max-w-[440px]">
    
    <!-- 1. Category Circles Filter Bar (Matches Image 2 exactly) -->
    <div class="no-scrollbar mb-3 flex gap-4 overflow-x-auto pb-1 pt-1 snap-x">
      {#each catalogCategories as cat (cat.id)}
        <button
          onclick={() => selectCategory(cat.id)}
          class="flex shrink-0 flex-col items-center gap-1.5 press snap-start"
          aria-label={cat.name}
        >
          <!-- Circle Avatar -->
          <div
            class="relative flex h-16 w-16 sm:h-[68px] sm:w-[68px] items-center justify-center overflow-hidden rounded-full p-0.5 transition-all
                   {activeCategory === cat.id
                     ? 'ring-2 ring-[#A8D632] ring-offset-2'
                     : 'border border-[#E4E4DC] bg-[#F7F7F2]'}"
          >
            {#if cat.isAll}
              <!-- "All" 4-square Grid Icon matching Image 2 -->
              <div class="flex h-full w-full items-center justify-center rounded-full bg-white text-[#2B5A16]">
                <svg class="h-6 w-6 stroke-current" viewBox="0 0 24 24" fill="none" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5"/>
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
            class="max-w-[72px] text-center text-[11px] font-semibold leading-tight
                   {activeCategory === cat.id ? 'text-[#2B5A16] font-bold' : 'text-[#4A5A52]'}"
          >
            {cat.name}
          </span>
        </button>
      {/each}
    </div>

    <!-- 2. Filter & Sort Bar (Matches Image 2) -->
    <FilterSortBar
      {sortBy}
      {activeFilterCount}
      {isFilterOpen}
      onFilterClick={() => (isFilterOpen = !isFilterOpen)}
      onSortChange={(val) => (sortBy = val)}
    />

    {#if isFilterOpen}
      <div class="mx-auto mt-1 mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E4E4DC] bg-[#FAF7F0] p-3 text-xs">
        <button
          type="button"
          onclick={() => (inStockOnly = !inStockOnly)}
          class="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold transition-colors press
                 {inStockOnly
                   ? 'border-[#2B5A16] bg-[#2B5A16] text-white'
                   : 'border-[#E4E4DC] bg-white text-[#0B1F2E]'}"
        >
          <span>{inStockOnly ? '✓' : '○'}</span>
          <span>In Stock Only</span>
        </button>

        {#if activeFilterCount > 0}
          <button
            type="button"
            onclick={resetFilters}
            class="text-xs font-bold text-[#2B5A16] underline hover:text-[#1e3f0f]"
          >
            Clear All Filters
          </button>
        {/if}
      </div>
    {/if}

    <!-- Active Filter Notice if filtered -->
    {#if activeCategory !== 'all' || searchQuery.trim() || inStockOnly}
      <div class="my-2.5 flex items-center justify-between rounded-lg bg-[#F7F7F2] p-2 text-xs text-[#2B5A16]">
        <span>
          Showing <strong>{activeCategory !== 'all' ? activeCategory : searchQuery.trim() ? `"${searchQuery.trim()}"` : 'In Stock'}</strong> ({filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'})
        </span>
        <button onclick={resetFilters} class="font-bold underline text-[#0B1F2E]">
          Reset
        </button>
      </div>
    {/if}

    <!-- 3. 2-Column Responsive Product Grid (Matches Image 2) -->
    {#if filteredProducts.length === 0}
      <div class="mt-4 rounded-2xl border border-[#E4E4DC] bg-[#FAF7F0] p-6 text-center space-y-2.5">
        <div class="text-2xl">🌱</div>
        <p class="text-sm font-bold text-[#0B1F2E]">No fresh produce matched your filters</p>
        <p class="text-xs text-[#4A5A52]">Try clearing your search or checking all harvest categories.</p>
        <button
          type="button"
          onclick={resetFilters}
          class="inline-flex items-center justify-center rounded-xl bg-[#2B5A16] px-4 py-2 text-xs font-bold text-white shadow-xs press"
        >
          Show All Produce
        </button>
      </div>
    {:else}
      <div class="mt-3.5 grid grid-cols-2 gap-3">
        {#each filteredProducts as product (product.id)}
          <ProductCard {product} compact={false} />
        {/each}
      </div>
    {/if}
  </div>
</section>

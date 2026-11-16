<!--
  BestSellersRow.svelte — Horizontal Best Sellers Teaser Row
  Matches Design Reference (Image 1):
  - "Best Sellers" heading in serif font
  - "View All →" button on right
  - Horizontal scrolling row of 3 top-selling product cards with "Add" button and heart wishlist
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { getProducts } from '../lib/productsStore.js';
  import ProductCard from './ProductCard.svelte';

  let currentProducts = $state(getProducts());

  // Show top best seller items dynamically
  let bestSellers = $derived.by(() => {
    const list = [...currentProducts];
    const highlighted = list.filter((p) => p.badge?.toLowerCase().includes('bestseller') || p.id === 'grey-oyster');
    if (highlighted.length >= 3) return highlighted.slice(0, 4);
    return list.slice(0, 3);
  });

  function handleProductsUpdated(e) {
    currentProducts = e.detail?.products || getProducts();
  }

  onMount(() => {
    currentProducts = getProducts();
    window.addEventListener('osf:products-updated', handleProductsUpdated);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:products-updated', handleProductsUpdated);
    }
  });

  function scrollToCatalog() {
    const catalog = document.querySelector('[data-section="products"]');
    if (catalog) {
      catalog.scrollIntoView({ behavior: 'smooth' });
    }
  }
</script>

<section class="w-full bg-white px-4 pt-4 pb-2">
  <div class="mx-auto max-w-[440px]">
    <!-- Header: Best Sellers + View All -->
    <div class="mb-3 flex items-center justify-between">
      <h2
        class="text-[1.45rem] font-bold tracking-tight text-[#0B1F2E]"
        style="font-family: 'Playfair Display', Georgia, serif;"
      >
        Best Sellers
      </h2>

      <button
        onclick={scrollToCatalog}
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F7F7F2] border border-[#E4E4DC] px-3 py-1.5 text-xs font-bold text-[#0B1F2E] hover:bg-[#E4E4DC]/60 press"
      >
        <span>View All</span>
        <span class="text-xs">→</span>
      </button>
    </div>

    <!-- 3-Item Horizontal Scroll (Matches Image 1 layout) -->
    <div class="no-scrollbar flex gap-3 overflow-x-auto pb-2 snap-x">
      {#each bestSellers as product (product.id)}
        <div class="w-[145px] sm:w-[155px] shrink-0 snap-start">
          <ProductCard {product} compact={true} />
        </div>
      {/each}
    </div>
  </div>
</section>


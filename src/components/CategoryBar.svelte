<!--
  CategoryBar.svelte — "Explore Our Farm Fresh Collection"
  Matches Design Reference:
  - Header: "OUR GOODNESS" + "Explore Our Farm Fresh Collection" + "View All →"
  - Horizontal scrolling category circle avatars with authentic photoshoot thumbnails
  - Active category highlight ring
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';

  let { activeCategory = 'all', onSelectCategory = undefined } = $props();
  let selectedCategory = $state(activeCategory);

  const categories = [
    {
      id: 'Mushrooms',
      name: 'Oyster Mushrooms',
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
    {
      id: 'all',
      name: 'All Harvest',
      image: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/hero%20.webp',
    },
  ];

  function selectCat(catId) {
    selectedCategory = catId;
    if (onSelectCategory) {
      onSelectCategory(catId);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('osf:filter-category', { detail: { category: catId } })
      );
    }
    const target = document.querySelector('[data-section="products"]');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function handleFilter(e) {
    selectedCategory = e.detail?.category || 'all';
  }

  onMount(() => {
    window.addEventListener('osf:filter-category', handleFilter);
    return () => {
      window.removeEventListener('osf:filter-category', handleFilter);
    };
  });
</script>

<section class="w-full bg-white px-4 pt-5 pb-3">
  <div class="mx-auto max-w-[440px]">
    <!-- Section Title Row (Exact match to design) -->
    <div class="mb-4 flex items-end justify-between">
      <div>
        <span class="block text-[11px] font-bold uppercase tracking-widest text-[#2B5A16]">
          OUR GOODNESS
        </span>
        <h2
          class="mt-0.5 text-[1.45rem] font-bold leading-tight tracking-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Explore Our Farm Fresh<br />Collection
        </h2>
      </div>

      <!-- "View All ->" Pill button -->
      <button
        onclick={() => selectCat('all')}
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F7F7F2] border border-[#E4E4DC] px-3 py-1.5 text-xs font-bold text-[#0B1F2E] hover:bg-[#E4E4DC]/60 press"
      >
        <span>View All</span>
        <span class="text-xs">→</span>
      </button>
    </div>

    <!-- Category Circles Horizontal Scroll (Snap) -->
    <div class="no-scrollbar flex gap-4 overflow-x-auto pb-2 pt-1 snap-x">
      {#each categories as cat (cat.id)}
        <button
          onclick={() => selectCat(cat.id)}
          class="flex shrink-0 flex-col items-center gap-2 press snap-start"
          aria-label={cat.name}
        >
          <!-- Circle Avatar -->
          <div
            class="relative flex h-16 w-16 sm:h-[70px] sm:w-[70px] items-center justify-center overflow-hidden rounded-full p-0.5 transition-all
                   {selectedCategory === cat.id
                     ? 'ring-2 ring-[#A8D632] ring-offset-2'
                     : 'border border-[#E4E4DC] bg-[#F7F7F2]'}"
          >
            <img
              src={cat.image}
              alt={cat.name}
              class="h-full w-full rounded-full object-cover"
              loading="eager"
            />
          </div>

          <!-- Category Label (matches typography in design) -->
          <span
            class="max-w-[72px] text-center text-[11px] font-semibold leading-tight
                   {selectedCategory === cat.id ? 'text-[#2B5A16]' : 'text-[#4A5A52]'}"
          >
            {cat.name}
          </span>
        </button>
      {/each}
    </div>
  </div>
</section>

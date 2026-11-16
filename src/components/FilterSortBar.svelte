<!--
  FilterSortBar.svelte — Filter & Sort Controls
  Matches Design Reference (Image 2):
  - Left: "Filters (1)" pill button
  - Right: "Sort by: Featured" dropdown
  Svelte 5 runes mode.
-->
<script>
  let {
    sortBy = 'featured',
    onSortChange,
    activeFilterCount = 0,
    onFilterClick,
    isFilterOpen = false,
  } = $props();

  function handleSort(e) {
    if (onSortChange) {
      onSortChange(e.target.value);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('osf:sort-changed', { detail: { sortBy: e.target.value } })
      );
    }
  }
</script>

<div class="w-full bg-white px-4 py-2">
  <div class="mx-auto flex max-w-[440px] items-center justify-between gap-3">
    <!-- Filter Pill (Matches Image 2) -->
    <button
      type="button"
      onclick={() => onFilterClick && onFilterClick()}
      aria-expanded={isFilterOpen}
      class="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition-colors press
             {isFilterOpen || activeFilterCount > 0
               ? 'border-[#2B5A16] bg-[#F2F8EA] text-[#2B5A16]'
               : 'border-[#E4E4DC] bg-white text-[#0B1F2E] hover:bg-[#F7F7F2]'}"
      aria-label="Filter products"
    >
      <svg class="h-3.5 w-3.5 text-[#0B1F2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="4" y1="21" x2="4" y2="14"/>
        <line x1="4" y1="10" x2="4" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12" y2="3"/>
        <line x1="20" y1="21" x2="20" y2="16"/>
        <line x1="20" y1="12" x2="20" y2="3"/>
        <line x1="1" y1="14" x2="7" y2="14"/>
        <line x1="9" y1="8" x2="15" y2="8"/>
        <line x1="17" y1="16" x2="23" y2="16"/>
      </svg>
      <span>Filters</span>
      {#if activeFilterCount > 0}
        <span class="flex h-4 w-4 items-center justify-center rounded-full bg-[#A8D632] text-[10px] font-bold text-white">
          {activeFilterCount}
        </span>
      {/if}
    </button>

    <!-- Sort Dropdown (Matches Image 2) -->
    <div class="relative inline-flex items-center">
      <select
        value={sortBy}
        onchange={handleSort}
        class="appearance-none rounded-full border border-[#E4E4DC] bg-white py-1.5 pl-3.5 pr-8 text-xs font-semibold text-[#0B1F2E] shadow-2xs outline-none focus:border-[#A8D632] cursor-pointer"
      >
        <option value="featured">Sort by: Featured</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="freshness">Harvest Freshness</option>
      </select>
      <div class="pointer-events-none absolute right-2.5 flex items-center text-[#4A5A52]">
        <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>
  </div>
</div>


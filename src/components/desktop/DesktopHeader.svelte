<!--
  DesktopHeader.svelte — Editorial wide navigation header (1024px+ only)
  Shares exact same live state (cart, auth, search) with mobile components via lib stores & CustomEvents.
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { getCartItems, getCartTotals, openCartDrawer } from '../../lib/cart.js';
  import { getCurrentCustomer, openMyOrders, openAuthModal } from '../../lib/auth.js';
  import { site } from '../../data/site.js';

  let { currentPath = '/' } = $props();

  let cartItems = $state([]);
  let customer = $state(null);
  let searchQuery = $state('');
  let isSearchFocused = $state(false);
  let isScrolled = $state(false);

  let totals = $derived(getCartTotals(cartItems));

  function handleCartUpdated(e) {
    cartItems = e.detail?.items || getCartItems();
  }

  function handleAuthChanged(e) {
    customer = e.detail?.customer || getCurrentCustomer();
  }

  function handleScroll() {
    if (typeof window !== 'undefined') {
      isScrolled = window.scrollY > 18;
    }
  }

  onMount(() => {
    cartItems = getCartItems();
    customer = getCurrentCustomer();
    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) searchQuery = urlQ;

    window.addEventListener('osf:cart-updated', handleCartUpdated);
    window.addEventListener('osf:auth-changed', handleAuthChanged);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:cart-updated', handleCartUpdated);
      window.removeEventListener('osf:auth-changed', handleAuthChanged);
      window.removeEventListener('scroll', handleScroll);
    }
  });

  function handleSearchSubmit(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    const catalog = document.querySelector('#desktop-catalog') || document.querySelector('[data-section="products"]');
    if (catalog) {
      catalog.scrollIntoView({ behavior: 'smooth' });
      window.dispatchEvent(new CustomEvent('osf:search', { detail: { query: q } }));
    } else if (q) {
      window.location.href = `/?q=${encodeURIComponent(q)}#desktop-catalog`;
    }
  }

  function handleNavCatalog(e) {
    const catalog = document.querySelector('#desktop-catalog');
    if (catalog && (currentPath === '/' || currentPath === '')) {
      e.preventDefault();
      catalog.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function handleAnchor(e, selector) {
    const target = document.querySelector(selector);
    if (target && (currentPath === '/' || currentPath === '')) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }
</script>

<!-- Top Dawn Harvest Announcement Strip -->
<div class="w-full bg-[#143922] text-[#FAF7F0] text-xs font-medium tracking-wide border-b border-white/10">
  <div class="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-2">
    <div class="flex items-center gap-2.5">
      <span class="inline-flex h-2 w-2 rounded-full bg-[#A8D632] animate-pulse"></span>
      <span>Harvested daily at 5:30 AM dawn in Kadugodi, Bangalore</span>
      <span class="text-white/40">•</span>
      <span class="text-[#D8F3A0] font-semibold">Free Dawn Drop (7–10 AM) across East Bengaluru</span>
    </div>
    <div class="flex items-center gap-5 text-[11px] text-white/80">
      <span>100% Chemical-Free</span>
      <a
        href={site.whatsapp.link}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 font-semibold text-[#A8D632] hover:text-white transition-colors"
      >
        <span>WhatsApp Farm Desk: +91 70197 60360</span>
      </a>
    </div>
  </div>
</div>

<!-- Main Sticky Desktop Navigation -->
<header
  class="sticky top-0 z-40 w-full transition-all duration-200 border-b {isScrolled
    ? 'bg-white/95 backdrop-blur-md border-[#E4E4DC] shadow-sm'
    : 'bg-[#FAF7F0]/95 backdrop-blur-sm border-[#E4E4DC]/70'}"
>
  <div class="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 xl:px-8 py-3.5">
    <!-- Left: Brand Identity -->
    <a href="/" class="flex items-center gap-3 shrink-0 group focus:outline-none">
      <img
        src="/logo.png"
        alt="Only Superfoods"
        class="h-10 xl:h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.03]"
        width="155"
        height="44"
      />
      <div class="hidden 2xl:flex flex-col border-l border-[#D5DDD0] pl-3">
        <span class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2B5A16]">
          Kadugodi Farm
        </span>
        <span class="text-[11px] text-[#4A5A52]">East Bengaluru</span>
      </div>
    </a>

    <!-- Center: Primary Navigation -->
    <nav class="flex items-center gap-4 xl:gap-6 whitespace-nowrap text-[13px] xl:text-sm font-semibold text-[#0B1F2E]" aria-label="Desktop primary navigation">
      <a
        href="/#desktop-catalog"
        onclick={handleNavCatalog}
        class="relative py-1 transition-colors hover:text-[#2B5A16] {currentPath === '/' ? 'text-[#2B5A16]' : ''}"
      >
        Shop Produce
      </a>
      <a
        href="/#desktop-story"
        onclick={(e) => handleAnchor(e, '#desktop-story')}
        class="py-1 transition-colors hover:text-[#2B5A16]"
      >
        Our Farm
      </a>
      <a
        href="/#desktop-delivery"
        onclick={(e) => handleAnchor(e, '#desktop-delivery')}
        class="py-1 transition-colors hover:text-[#2B5A16]"
      >
        Delivery Zones
      </a>
      <a
        href="/subscribe"
        class="py-1 transition-colors hover:text-[#2B5A16] {currentPath.startsWith('/subscribe') ? 'text-[#2B5A16] underline decoration-[#A8D632] decoration-2 underline-offset-4' : ''}"
      >
        Weekly Box
      </a>
      <a
        href="/recipes"
        class="py-1 transition-colors hover:text-[#2B5A16] {currentPath.startsWith('/recipes') ? 'text-[#2B5A16] underline decoration-[#A8D632] decoration-2 underline-offset-4' : ''}"
      >
        Recipes
      </a>
    </nav>

    <!-- Right: Search, Account & Bag -->
    <div class="flex items-center gap-3 shrink-0">
      <!-- Inline Desktop Search -->
      <form onsubmit={handleSearchSubmit} class="relative">
        <input
          type="search"
          bind:value={searchQuery}
          onfocus={() => (isSearchFocused = true)}
          onblur={() => (isSearchFocused = false)}
          placeholder="Search mushrooms, eggs..."
          aria-label="Search fresh produce"
          class="rounded-full border bg-white pl-8 pr-3 py-2 text-xs text-[#0B1F2E] placeholder-[#4A5A52]/65 outline-none transition-all duration-200 {isSearchFocused
            ? 'w-48 border-[#2B5A16] ring-2 ring-[#A8D632]/30'
            : 'w-36 xl:w-44 border-[#E4E4DC] hover:border-[#C5D1BF]'}"
        />
        <svg
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5A52]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </form>

      <!-- Account / My Orders Button -->
      <button
        type="button"
        onclick={openMyOrders}
        class="inline-flex items-center gap-2 rounded-full border border-[#E4E4DC] bg-white px-3.5 py-2 text-xs font-bold text-[#0B1F2E] hover:border-[#A8D632] hover:bg-[#F7F9F3] transition-colors press"
        title="My Orders & Re-order"
      >
        <span class="relative flex h-2 w-2">
          <span class="h-2 w-2 rounded-full {customer?.phone ? 'bg-[#25D366]' : 'bg-[#CBD5E1]'}"></span>
        </span>
        <span>{customer?.name ? customer.name.split(' ')[0] : customer?.phone ? 'My Orders' : 'Orders'}</span>
      </button>

      <!-- Auth shortcut if not logged in -->
      {#if !customer?.phone}
        <button
          type="button"
          onclick={() => openAuthModal()}
          class="hidden xl:inline-flex items-center rounded-full border border-[#E4E4DC] bg-white px-3.5 py-2 text-xs font-semibold text-[#4A5A52] hover:text-[#2B5A16] hover:border-[#2B5A16] transition-colors"
        >
          Sign In
        </button>
      {/if}

      <!-- Fresh Bag Drawer Trigger -->
      <button
        type="button"
        onclick={openCartDrawer}
        class="inline-flex items-center gap-2.5 rounded-full bg-[#143922] hover:bg-[#1E4F30] px-4 py-2 text-xs font-bold text-white shadow-xs transition-all press"
        aria-label="Open Fresh Bag ({totals.totalCount} items)"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
          <path d="M3 6h18"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <span>Fresh Bag</span>
        {#if totals.totalCount > 0}
          <span class="rounded-full bg-[#A8D632] px-2 py-0.5 text-[11px] font-black text-[#0B1F2E]">
            {totals.totalCount} · ₹{totals.totalPrice}
          </span>
        {:else}
          <span class="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/90">
            0
          </span>
        {/if}
      </button>
    </div>
  </div>
</header>


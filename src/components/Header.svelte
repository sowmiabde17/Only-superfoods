<!--
  Header.svelte — Premium Redesigned Header
  Matches Design Reference:
  - Left: Hamburger Menu (opens mobile navigation drawer)
  - Center: Only Superfoods Brand Logo
  - Right: Search Icon + Shopping Cart with Dynamic Counter
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { getCartItems, getCartTotals, openCartDrawer } from '../lib/cart.js';
  import { site } from '../data/site.js';
  import { getCurrentCustomer, openMyOrders, openAuthModal } from '../lib/auth.js';

  let { isSubPage = false, backUrl = '/recipes' } = $props();

  let cartItems = $state([]);
  let customer = $state(null);
  let isMenuOpen = $state(false);
  let isSearchOpen = $state(false);
  let searchQuery = $state('');

  let totals = $derived(getCartTotals(cartItems));

  function handleCartUpdated(e) {
    cartItems = e.detail?.items || getCartItems();
  }

  function handleAuthChanged(e) {
    customer = e.detail?.customer || getCurrentCustomer();
  }

  onMount(() => {
    cartItems = getCartItems();
    customer = getCurrentCustomer();
    window.addEventListener('osf:cart-updated', handleCartUpdated);
    window.addEventListener('osf:auth-changed', handleAuthChanged);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:cart-updated', handleCartUpdated);
      window.removeEventListener('osf:auth-changed', handleAuthChanged);
      document.body.style.overflow = '';
    }
  });

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    }
  }

  function closeMenu() {
    isMenuOpen = false;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  function toggleSearch() {
    isSearchOpen = !isSearchOpen;
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    const productsSection = document.querySelector('[data-section="products"]');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
      window.dispatchEvent(new CustomEvent('osf:search', { detail: { query: q } }));
    } else {
      window.location.href = `/?q=${encodeURIComponent(q)}#products`;
    }
    isSearchOpen = false;
  }
</script>

<!-- Top Fixed Header Bar -->
<header class="sticky top-0 z-40 w-full border-b border-[#E4E4DC]/80 bg-white/95 px-4 py-3 backdrop-blur-md">
  <div class="mx-auto flex max-w-[440px] items-center justify-between">
    <!-- Left: Hamburger Menu Icon or Back Arrow -->
    {#if isSubPage}
      <a
        href={backUrl}
        class="flex h-10 w-10 items-center justify-center rounded-lg text-[#0B1F2E] hover:bg-[#F7F7F2] press"
        aria-label="Back"
      >
        <svg class="h-6 w-6 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    {:else}
      <button
        onclick={toggleMenu}
        class="flex h-10 w-10 items-center justify-center rounded-lg text-[#0B1F2E] hover:bg-[#F7F7F2] press"
        aria-label="Open Navigation Menu"
      >
        <svg class="h-6 w-6 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
          <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    {/if}

    <!-- Center: Brand Logo -->
    <a
      href="/"
      class="flex items-center justify-center press focus:outline-none"
      aria-label="Only Superfoods Home"
    >
      <img
        src="/logo.png"
        alt="Only Superfoods"
        class="h-10 sm:h-11 w-auto object-contain"
        width="155"
        height="44"
        loading="eager"
      />
    </a>

    <!-- Right: Search & Orders & Cart Action Icons -->
    <div class="flex items-center gap-1">
      <!-- Search Icon -->
      <button
        onclick={toggleSearch}
        class="flex h-10 w-10 items-center justify-center rounded-lg text-[#0B1F2E] hover:bg-[#F7F7F2] press"
        aria-label="Search Produce"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
      </button>

      <!-- My Orders / Profile Icon -->
      <button
        onclick={openMyOrders}
        class="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#0B1F2E] hover:bg-[#F7F7F2] press"
        aria-label="My Orders & Re-order"
        title="My Orders"
      >
        <span class="text-lg">📦</span>
        {#if customer?.phone}
          <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#25D366] ring-2 ring-white"></span>
        {/if}
      </button>

      <!-- Cart Icon with Dynamic Lime-Green Badge (matches grocery trolley in design) -->
      <button
        onclick={openCartDrawer}
        class="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#0B1F2E] hover:bg-[#F7F7F2] press"
        aria-label="View Shopping Cart ({totals.totalCount} items)"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="20" r="1.2" fill="currentColor"/>
          <circle cx="19" cy="20" r="1.2" fill="currentColor"/>
          <path d="M1 2h3.5l2.6 12.2a1.8 1.8 0 0 0 1.8 1.4h9.8a1.8 1.8 0 0 0 1.8-1.4L22.5 6H5.2"/>
        </svg>

        {#if totals.totalCount > 0}
          <span class="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#8DC63F] px-1 text-[10px] font-bold text-white shadow-xs">
            {totals.totalCount}
          </span>
        {/if}
      </button>
    </div>
  </div>

  <!-- Search Bar Dropdown (when toggled) -->
  {#if isSearchOpen}
    <div class="mx-auto max-w-[440px] pt-2 pb-1">
      <form onsubmit={handleSearchSubmit} class="relative flex items-center">
        <input
          type="search"
          bind:value={searchQuery}
          placeholder="Search mushrooms, microgreens, kombucha..."
          class="w-full rounded-full border border-[#E4E4DC] bg-[#F7F7F2] py-2 pl-4 pr-10 text-xs text-[#0B1F2E] outline-none focus:border-[#A8D632] focus:bg-white transition-all"
        />
        <button
          type="submit"
          class="absolute right-3 text-xs font-bold text-[#2B5A16]"
        >
          Go
        </button>
      </form>
    </div>
  {/if}
</header>

<!-- Mobile Slide-In Navigation Drawer -->
{#if isMenuOpen}
  <div
    class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
    onclick={closeMenu}
    aria-hidden="true"
  ></div>

  <nav
    class="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white p-6 shadow-2xl transition-transform duration-300"
    role="dialog"
    aria-label="Site Navigation"
  >
    <!-- Brand Info -->
    <div class="flex items-center justify-between border-b border-[#E4E4DC] pb-4">
      <img src="/logo.png" alt="Only Superfoods" class="h-9 w-auto" />
      <button
        onclick={closeMenu}
        class="flex h-8 w-8 items-center justify-center rounded-full text-[#4A5A52] hover:bg-[#F7F7F2]"
        aria-label="Close Navigation"
      >
        ✕
      </button>
    </div>

    <!-- Navigation Links -->
    <div class="mt-6 flex flex-col gap-4 text-sm font-semibold text-[#0B1F2E]">
      <a href="/" onclick={closeMenu} class="hover:text-[#2B5A16] transition-colors">
        🏠 Home
      </a>
      <button
        type="button"
        onclick={() => { closeMenu(); openMyOrders(); }}
        class="flex items-center justify-between text-left hover:text-[#2B5A16] transition-colors"
      >
        <span>📦 My Orders &amp; Reorder</span>
        {#if customer?.phone}
          <span class="rounded-full bg-[#E8F8EE] px-2 py-0.5 text-[10px] font-bold text-[#25D366]">
            +91 {customer.phone}
          </span>
        {/if}
      </button>
      <a href="/#products" onclick={closeMenu} class="hover:text-[#2B5A16] transition-colors">
        🍄 Farm Produce Collection
      </a>
      <a href="/recipes" onclick={closeMenu} class="hover:text-[#2B5A16] transition-colors">
        📖 Superfood Recipes Hub
      </a>
      <a href="/#delivery" onclick={closeMenu} class="hover:text-[#2B5A16] transition-colors">
        📍 Delivery Zones (Bangalore)
      </a>
      <a href="/subscribe" onclick={closeMenu} class="hover:text-[#2B5A16] transition-colors">
        🔄 Routine Harvest Subscription
      </a>
      <button
        type="button"
        onclick={() => { closeMenu(); window.dispatchEvent(new CustomEvent('osf:trigger-install')); }}
        class="flex items-center justify-between text-left text-sm font-semibold text-[#2B5A16] hover:underline pt-1"
      >
        <span>📲 Install Mobile App</span>
        <span class="rounded-full bg-[#EBF7DC] px-2 py-0.5 text-[9.5px] font-bold text-[#2B5A16] border border-[#A8D632]/50">
          Fast PWA
        </span>
      </button>
    </div>

    <!-- Direct WhatsApp Order CTA in Menu -->
    <div class="mt-auto border-t border-[#E4E4DC] pt-4 space-y-2">
      <p class="text-[11px] text-[#4A5A52]">
        Kadugodi &amp; Whitefield, Bangalore
      </p>
      <a
        href={site.whatsapp.link}
        target="_blank"
        rel="noopener noreferrer"
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-xs font-bold text-white press"
      >
        Order on WhatsApp 💬
      </a>
    </div>
  </nav>
{/if}

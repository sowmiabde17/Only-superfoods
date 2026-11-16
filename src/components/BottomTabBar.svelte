<!--
  BottomTabBar.svelte — Persistent bottom navigation
  5 tabs: Home, Shop, Bag (with badge), Recipes, WhatsApp.
  Filled icons + labels, brand green active state.
  Fixed to viewport with iOS safe-area padding.
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { getCartItems, getCartTotals, openCartDrawer } from '../lib/cart.js';

  let activeTab = $state('home');
  let isRecipesPage = $state(false);
  let cartItems = $state([]);

  let totals = $derived(getCartTotals(cartItems));

  function handleCartUpdated(e) {
    cartItems = e.detail?.items || getCartItems();
  }

  onMount(() => {
    cartItems = getCartItems();
    window.addEventListener('osf:cart-updated', handleCartUpdated);

    isRecipesPage = window.location.pathname.startsWith('/recipes');
    if (isRecipesPage) {
      activeTab = 'recipes';
      return;
    }

    if (window.location.pathname.startsWith('/subscribe')) {
      activeTab = 'box';
      return;
    }

    // On homepage, detect active section via IntersectionObserver
    const sections = document.querySelectorAll('[data-section]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const section = entry.target.getAttribute('data-section');
            if (section === 'hero' || section === 'story') activeTab = 'home';
            else if (section === 'products' || section === 'delivery' || section === 'subscribe') activeTab = 'shop';
            else if (section === 'content') activeTab = 'recipes';
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );

    sections.forEach((s) => observer.observe(s));

    return () => {
      observer.disconnect();
      window.removeEventListener('osf:cart-updated', handleCartUpdated);
    };
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:cart-updated', handleCartUpdated);
    }
  });

  function handleTab(tab) {
    if (tab === 'box') {
      if (window.location.pathname !== '/subscribe') {
        window.location.href = '/subscribe';
      }
      return;
    }
    if (tab === 'bag') {
      openCartDrawer();
      return;
    }
    if (tab === 'whatsapp') {
      window.open('https://wa.me/917019760360', '_blank');
      return;
    }
    if (tab === 'recipes') {
      if (!isRecipesPage) {
        window.location.href = '/recipes';
      }
      return;
    }
    if (isRecipesPage || window.location.pathname.startsWith('/subscribe')) {
      window.location.href = tab === 'shop' ? '/#products' : '/';
      return;
    }

    const sectionMap = { home: 'hero', shop: 'products' };
    const target = document.querySelector(`[data-section="${sectionMap[tab]}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
    activeTab = tab;
  }
</script>

<nav
  class="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E4E4DC] bg-white/95 backdrop-blur-sm"
  style="padding-bottom: env(safe-area-inset-bottom, 0px);"
  aria-label="Main navigation"
>
  <div class="mx-auto flex max-w-[430px] items-stretch justify-around">
    <!-- 1. Home -->
    <button
      onclick={() => handleTab('home')}
      class="flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors press
             {activeTab === 'home' ? 'text-[#2B5A16]' : 'text-[#4A5A52]'}"
      aria-label="Home"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
        <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.97-.97V19.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-3.75h-3V19.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-6.88l-.97.97a.75.75 0 01-1.06-1.06l8.69-8.69z"/>
      </svg>
      <span class="text-[9.5px] font-bold">Home</span>
    </button>

    <!-- 2. Shop -->
    <button
      onclick={() => handleTab('shop')}
      class="flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors press
             {activeTab === 'shop' ? 'text-[#2B5A16]' : 'text-[#4A5A52]'}"
      aria-label="Shop"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
        <path fill-rule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 004.25 22.5h15.5a1.875 1.875 0 001.865-2.071l-1.263-12a1.875 1.875 0 00-1.865-1.679H16.5V6a4.5 4.5 0 10-9 0zM12 3a3 3 0 00-3 3v.75h6V6a3 3 0 00-3-3zm-3 8.25a3 3 0 106 0v-.75a.75.75 0 011.5 0v.75a4.5 4.5 0 11-9 0v-.75a.75.75 0 011.5 0v.75z" clip-rule="evenodd"/>
      </svg>
      <span class="text-[9.5px] font-bold">Shop</span>
    </button>

    <!-- 3. Box (Recurring Weekly Subscription) -->
    <button
      onclick={() => handleTab('box')}
      class="relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors press
             {activeTab === 'box' ? 'text-[#2B5A16]' : 'text-[#4A5A52]'}"
      aria-label="Weekly Routine Box"
    >
      <div class="relative">
        <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
          <path d="M12.378 1.602a.75.75 0 00-.756 0L3.37 6.232a.75.75 0 00-.37.649v10.238a.75.75 0 00.37.649l8.252 4.63a.75.75 0 00.756 0l8.252-4.63a.75.75 0 00.37-.649V6.881a.75.75 0 00-.37-.649l-8.252-4.63zM12 3.328l6.814 3.824-2.822 1.583L9.178 4.912 12 3.328zm-4.222 2.37l6.814 3.824-2.592 1.454L5.186 7.152l2.592-1.454zM4.5 8.44l6.75 3.788v7.945L4.5 16.384V8.44zm8.25 11.733v-7.945l6.75-3.788v7.945l-6.75 3.788z"/>
        </svg>
      </div>
      <span class="text-[9.5px] font-bold">Box</span>
    </button>

    <!-- 4. Recipes -->
    <button
      onclick={() => handleTab('recipes')}
      class="flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors press
             {activeTab === 'recipes' ? 'text-[#2B5A16]' : 'text-[#4A5A52]'}"
      aria-label="Recipes"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
        <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z"/>
      </svg>
      <span class="text-[9.5px] font-bold">Recipes</span>
    </button>

    <!-- 5. WhatsApp -->
    <button
      onclick={() => handleTab('whatsapp')}
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[#25D366] transition-colors press"
      aria-label="WhatsApp"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
        <path fill-rule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97zM6.75 8.25a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H7.5z" clip-rule="evenodd"/>
      </svg>
      <span class="text-[9.5px] font-bold">Chat</span>
    </button>
  </div>
</nav>

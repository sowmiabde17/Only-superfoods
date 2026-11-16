<!--
  AdminDashboard.svelte — Desktop-Prioritized Farm Operations Hub & Dispatch Console
  Matches specifications:
  - Strict Insider PIN Gate (farm560067)
  - Tab 1: Daily Harvest Stock & Priority Subscription Reservation Table
  - Tab 2: Flexible Products Catalog (Full CRUD: Add, Edit, Delete, 3 Categories)
  - Tab 3: Recipes Hub Manager (Full CRUD: Add, Edit, Delete, Linked Produce)
  - Tab 4: Dispatch & Fulfillment Checklist (Morning/Evening slots, WhatsApp pings)
  - Emergency Harvest Wipe & Real-time Storefront Sync
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { isAdminLoggedIn, logoutAdmin, callAdminApi } from '../../lib/adminAuth.js';
  import { getEdgeFunctionUrl } from '../../lib/supabase.js';
  import AdminLogin from './AdminLogin.svelte';
  import ProductEditorModal from './ProductEditorModal.svelte';
  import RecipeEditorModal from './RecipeEditorModal.svelte';
  import DeliverySettingsTab from './DeliverySettingsTab.svelte';

  import {
    getProducts,
    deleteProduct,
    resetToDefaultProducts,
    setProductsFromServer,
    PRODUCT_CATEGORIES,
  } from '../../lib/productsStore.js';

  import {
    getRecipes,
    deleteRecipe,
    resetToDefaultRecipes,
  } from '../../lib/recipesStore.js';

  import {
    getInventory,
    getProductInventory,
    getAvailableStock,
    getEffectiveStatus,
    updateDailyYield,
    updateSubscriptionReserve,
    setProductStatus,
    emergencyHarvestWipe,
    resetInventoryDefaults,
    setInventoryFromServer,
  } from '../../lib/inventory.js';

  /* ── State ──────────────────────────────────────── */
  let isLoggedIn = $state(false);
  let activeTab = $state('stock'); // 'stock' | 'products' | 'recipes' | 'dispatch'
  let toastMessage = $state('');
  let toastIsError = $state(false);
  let isSyncing = $state(false);
  let metaInstantConfigured = $state(false);
  const metaFeedUrl = getEdgeFunctionUrl('meta-catalog-feed');

  // Catalog & Inventory Data
  let products = $state([]);
  let recipes = $state([]);
  let inventory = $state({});

  // Modals
  let editingProduct = $state(null);
  let isProductModalOpen = $state(false);

  let editingRecipe = $state(null);
  let isRecipeModalOpen = $state(false);

  // Dispatch Tab state
  let selectedDispatchSlot = $state('morning'); // 'morning' | 'evening'
  let localOrders = $state([]);
  let dispatchChecks = $state({});

  /* ── Derived Top KPIs ───────────────────────────── */
  let totalYieldPacks = $derived.by(() => {
    return products.reduce((sum, p) => {
      const inv = inventory[p.id] || getProductInventory(p.id);
      return sum + (Number(inv.dailyYield) || 0);
    }, 0);
  });

  let totalReservedPacks = $derived.by(() => {
    return products.reduce((sum, p) => {
      const inv = inventory[p.id] || getProductInventory(p.id);
      return sum + (Number(inv.reservedSubscribers) || 0);
    }, 0);
  });

  let totalWebSold = $derived.by(() => {
    return products.reduce((sum, p) => {
      const inv = inventory[p.id] || getProductInventory(p.id);
      return sum + (Number(inv.webSold) || 0);
    }, 0);
  });

  function computeReactiveAvailable(pInv) {
    if (pInv?.syncedFromDb && pInv?.availableStock !== undefined && pInv?.availableStock !== null) {
      return Math.max(0, Number(pInv.availableStock) || 0);
    }
    return Math.max(0, (Number(pInv?.dailyYield) || 0) - (Number(pInv?.reservedSubscribers) || 0) - (Number(pInv?.webSold) || 0));
  }

  function computeReactiveStatus(pInv) {
    if (pInv?.manualStatus && pInv.manualStatus !== 'AUTO') return pInv.manualStatus;
    if (pInv?.isSoldOut || computeReactiveAvailable(pInv) <= 0) return 'OUT_OF_STOCK';
    return 'IN_STOCK';
  }

  let totalAvailablePacks = $derived.by(() => {
    return products.reduce((sum, p) => {
      const inv = inventory[p.id] || getProductInventory(p.id);
      return sum + computeReactiveAvailable(inv);
    }, 0);
  });

  let soldOutCount = $derived.by(() => {
    return products.filter((p) => {
      const inv = inventory[p.id] || getProductInventory(p.id);
      return computeReactiveStatus(inv) === 'OUT_OF_STOCK';
    }).length;
  });

  /* ── Lifecycle & Sync ───────────────────────────── */
  async function reloadAllData() {
    products = getProducts();
    recipes = getRecipes();
    inventory = getInventory();
    loadOrders();

    isSyncing = true;
    try {
      const state = await callAdminApi('get_admin_state');
      if (Array.isArray(state.products)) {
        setProductsFromServer(state.products);
        products = getProducts();
      }
      if (Array.isArray(state.inventory)) {
        setInventoryFromServer(state.inventory);
        inventory = getInventory();
      }
      metaInstantConfigured = Boolean(state.metaInstantPushConfigured);
    } catch (err) {
      showToast(err?.message || 'Could not refresh live state from Supabase', true);
    } finally {
      isSyncing = false;
    }
  }

  function loadOrders() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('osf_orders');
      const saved = raw ? JSON.parse(raw) : [];
      // Combine with realistic demo orders for dispatch testing if empty
      if (saved.length === 0) {
        localOrders = [
          {
            id: 'OSF-9102',
            createdAt: new Date().toISOString(),
            customer: {
              name: 'Arjun Nambiar',
              phone: '9845012345',
              address: 'Villa 14, Prestige Ozone, Whitefield',
              zoneStatus: 'CORE',
            },
            deliverySlot: 'Morning Drop (7:00 AM – 10:00 AM)',
            items: [
              { name: 'Grey Oyster Mushrooms', packSize: '250 g', quantity: 2, price: 100 },
              { name: 'Sunflower Microgreens', packSize: '50 g', quantity: 1, price: 90 },
            ],
            total: 290,
            status: 'Ready to Harvest',
          },
          {
            id: 'OSF-9103',
            createdAt: new Date().toISOString(),
            customer: {
              name: 'Deepa Varma',
              phone: '9740123987',
              address: 'Apt 402, Godrej Air, Hoodi',
              zoneStatus: 'CORE',
            },
            deliverySlot: 'Morning Drop (7:00 AM – 10:00 AM)',
            items: [
              { name: 'Pink Oyster Mushrooms', packSize: '250 g', quantity: 1, price: 120 },
              { name: 'Raw Kombucha', packSize: '250 ml', quantity: 2, price: 120 },
            ],
            total: 360,
            status: 'Harvested',
          },
          {
            id: 'OSF-9104',
            createdAt: new Date().toISOString(),
            customer: {
              name: 'Vikram Sundaram',
              phone: '9900223344',
              address: 'House 8, TC Palya Main Road',
              zoneStatus: 'EXTENDED',
            },
            deliverySlot: 'Morning Drop (7:00 AM – 10:00 AM)',
            items: [
              { name: 'Mixed Oyster Mushrooms', packSize: '250 g', quantity: 2, price: 120 },
            ],
            total: 240,
            status: 'Scheduled',
          },
        ];
      } else {
        localOrders = saved;
      }
    } catch (e) {
      console.error(e);
    }
  }

  function showToast(msg, isError = false) {
    toastMessage = msg;
    toastIsError = isError;
    setTimeout(() => {
      if (toastMessage === msg) {
        toastMessage = '';
        toastIsError = false;
      }
    }, isError ? 5000 : 3200);
  }

  onMount(() => {
    isLoggedIn = isAdminLoggedIn();
    if (isLoggedIn) {
      reloadAllData();
    }

    const onAuthChange = (e) => {
      isLoggedIn = Boolean(e.detail?.loggedIn);
      if (isLoggedIn) reloadAllData();
    };

    const onProdUpdate = () => (products = getProducts());
    const onRecipeUpdate = () => (recipes = getRecipes());
    const onInvUpdate = () => (inventory = getInventory());
    const onOrderPlaced = (e) => {
      loadOrders();
      showToast(`🔔 New Order: ${e.detail?.order?.orderId || e.detail?.order?.id || 'Fresh Drop'}!`);
    };

    window.addEventListener('osf:admin-auth-changed', onAuthChange);
    window.addEventListener('osf:products-updated', onProdUpdate);
    window.addEventListener('osf:recipes-updated', onRecipeUpdate);
    window.addEventListener('osf:inventory-updated', onInvUpdate);
    window.addEventListener('osf:order-placed', onOrderPlaced);

    return () => {
      window.removeEventListener('osf:admin-auth-changed', onAuthChange);
      window.removeEventListener('osf:products-updated', onProdUpdate);
      window.removeEventListener('osf:recipes-updated', onRecipeUpdate);
      window.removeEventListener('osf:inventory-updated', onInvUpdate);
      window.removeEventListener('osf:order-placed', onOrderPlaced);
    };
  });

  /* ── Tab 1 Actions (Stock) ──────────────────────── */
  async function handleYieldChange(productId, val) {
    isSyncing = true;
    const res = await updateDailyYield(productId, Number(val));
    isSyncing = false;
    if (res?.success) {
      inventory = res.inventory || getInventory();
      showToast(`Saved harvest yield for ${productId} to Supabase`);
    } else {
      inventory = getInventory();
      showToast(res?.error || `Failed to update harvest yield for ${productId}`, true);
    }
  }

  async function handleReserveChange(productId, val) {
    isSyncing = true;
    const res = await updateSubscriptionReserve(productId, Number(val));
    isSyncing = false;
    if (res?.success) {
      inventory = res.inventory || getInventory();
      showToast(`Saved subscriber reserve for ${productId} to Supabase`);
    } else {
      inventory = getInventory();
      showToast(res?.error || `Failed to update subscriber reserve for ${productId}`, true);
    }
  }

  async function handleStatusChange(productId, status) {
    isSyncing = true;
    const res = await setProductStatus(productId, status);
    isSyncing = false;
    if (res?.success) {
      inventory = res.inventory || getInventory();
      showToast(`Saved status (${status}) for ${productId} to Supabase`);
    } else {
      inventory = getInventory();
      showToast(res?.error || `Failed to update status for ${productId}`, true);
    }
  }

  async function handleEmergencyWipe() {
    if (confirm('🚨 EMERGENCY HARVEST WIPE: Are you sure you want to mark all harvest items OUT OF STOCK immediately?')) {
      isSyncing = true;
      const res = await emergencyHarvestWipe();
      isSyncing = false;
      if (res?.success) {
        inventory = res.inventory || getInventory();
        showToast('🚨 All items marked OUT OF STOCK in Supabase!');
      } else {
        showToast(res?.error || 'Emergency wipe failed on Supabase!', true);
      }
    }
  }

  async function handleResetInventory() {
    if (confirm('Reset daily inventory yields and reservations back to morning seed defaults?')) {
      isSyncing = true;
      const res = await resetInventoryDefaults();
      isSyncing = false;
      if (res?.success) {
        inventory = res.inventory || getInventory();
        showToast('Inventory reset to morning defaults in Supabase.');
      } else {
        showToast(res?.error || 'Failed to reset inventory in Supabase.', true);
      }
    }
  }

  /* ── Tab 2 Actions (Products) ───────────────────── */
  function openAddProduct() {
    editingProduct = null;
    isProductModalOpen = true;
  }

  function openEditProduct(p) {
    editingProduct = p;
    isProductModalOpen = true;
  }

  async function handleDeleteProduct(p) {
    if (confirm(`Are you sure you want to delete "${p.name}" from the product catalog?`)) {
      isSyncing = true;
      const res = await deleteProduct(p.id);
      isSyncing = false;
      if (res?.success) {
        products = getProducts();
        showToast(`Deleted ${p.name} from Supabase`);
      } else {
        showToast(res?.error || `Failed to delete ${p.name}`, true);
      }
    }
  }

  async function handleResetProducts() {
    if (confirm('Reset products catalog to original default items in Supabase?')) {
      isSyncing = true;
      const res = await resetToDefaultProducts();
      isSyncing = false;
      if (res?.success) {
        products = getProducts();
        showToast('Products reset to defaults in Supabase.');
      } else {
        showToast(res?.error || 'Failed to reset products in Supabase.', true);
      }
    }
  }

  async function handleSyncMetaCatalogNow() {
    isSyncing = true;
    try {
      const res = await callAdminApi('sync_meta_catalog');
      if (typeof res?.metaInstantPushConfigured === 'boolean') {
        metaInstantConfigured = res.metaInstantPushConfigured;
      }
      const isFailure = Boolean(metaInstantConfigured && res?.metaSync && !res.metaSync.synced);
      showToast(res?.metaSync?.detail || 'Meta catalog feed verified live!', isFailure);
    } catch (err) {
      showToast(err?.message || 'Meta sync check failed.', true);
    } finally {
      isSyncing = false;
    }
  }

  /* ── Tab 3 Actions (Recipes) ────────────────────── */
  function openAddRecipe() {
    editingRecipe = null;
    isRecipeModalOpen = true;
  }

  function openEditRecipe(r) {
    editingRecipe = r;
    isRecipeModalOpen = true;
  }

  async function handleDeleteRecipe(r) {
    if (confirm(`Are you sure you want to delete the recipe "${r.title}"?`)) {
      isSyncing = true;
      const res = await deleteRecipe(r.slug || r.id);
      isSyncing = false;
      if (res?.success) {
        recipes = getRecipes();
        showToast(`Deleted ${r.title} from Supabase`);
      } else {
        showToast(res?.error || `Failed to delete ${r.title}`, true);
      }
    }
  }

  async function handleResetRecipes() {
    if (confirm('Reset recipe catalog to original default recipes in Supabase?')) {
      isSyncing = true;
      const res = await resetToDefaultRecipes();
      isSyncing = false;
      if (res?.success) {
        recipes = getRecipes();
        showToast('Recipes reset to defaults in Supabase.');
      } else {
        showToast(res?.error || 'Failed to reset recipes.', true);
      }
    }
  }

  /* ── Tab 4 Actions (Dispatch) ───────────────────── */
  function toggleDispatchCheck(orderId, step) {
    const key = `${orderId}__${step}`;
    dispatchChecks[key] = !dispatchChecks[key];
    dispatchChecks = { ...dispatchChecks };
  }

  function sendWhatsAppDispatch(order) {
    const text = encodeURIComponent(
      `Hi ${order.customer.name}! 🍄 Only Superfoods update: Your fresh harvest order (${order.id || order.orderId}) has been packed at Kadugodi and is out for delivery! Track your morning drop.`
    );
    window.open(`https://wa.me/91${order.customer.phone}?text=${text}`, '_blank');
  }

  function printPackingManifest() {
    window.print();
  }

  function exportOrdersCSV() {
    if (localOrders.length === 0) {
      alert('No orders to export.');
      return;
    }
    const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Zone', 'Address', 'Delivery Slot', 'Items', 'Total (INR)'];
    const rows = localOrders.map((o) => [
      `"${o.id || o.orderId}"`,
      `"${new Date(o.createdAt || o.date || Date.now()).toLocaleDateString()}"`,
      `"${o.customer?.name || ''}"`,
      `"${o.customer?.phone || ''}"`,
      `"${o.customer?.zoneStatus || 'CORE'}"`,
      `"${(o.customer?.address || '').replace(/"/g, '""')}"`,
      `"${o.deliverySlot || ''}"`,
      `"${(o.items || []).map((i) => `${i.quantity}x ${i.name} (${i.packSize})`).join('; ')}"`,
      `"${o.total || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `only_superfoods_dispatch_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported dispatch orders CSV');
  }
</script>

{#if !isLoggedIn}
  <AdminLogin onLoginSuccess={() => { isLoggedIn = true; reloadAllData(); }} />
{:else}
  <div class="min-h-screen w-full bg-[#F4F6F0] text-[#0B1F2E] flex flex-col font-sans">
    
    <!-- ═══ TOP WORKBENCH HEADER BAR (Desktop Prioritized) ═══ -->
    <header class="sticky top-0 z-50 border-b border-[#2B5A16]/20 bg-[#0B1F2E] text-white px-6 py-3.5 shadow-md">
      <div class="mx-auto flex max-w-[1440px] items-center justify-between">
        
        <!-- Left: Branding & Status Badge -->
        <div class="flex items-center gap-3.5">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2B5A16] border border-[#8DC63F] text-xl shadow-xs">
            🌱
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base font-bold tracking-tight text-white">
                Only Superfoods — Farm Operations Desk
              </h1>
              <span class="rounded-full bg-[#2B5A16] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#8DC63F] border border-[#8DC63F]/40 flex items-center gap-1">
                <span class="h-1.5 w-1.5 rounded-full bg-[#8DC63F] animate-pulse"></span>
                {isSyncing ? 'Syncing Supabase...' : 'Live Sync Active'}
              </span>
            </div>
            <p class="text-[11px] text-[#9BB1A5]">
              Kadugodi Fruiting Hub • PIN Protected Console • Zero Public Links
            </p>
          </div>
        </div>

        <!-- Right: Actions & Logout -->
        <div class="flex items-center gap-3">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-all cursor-pointer"
          >
            <span>Preview Storefront</span>
            <span class="text-xs">↗</span>
          </a>

          <button
            onclick={() => { logoutAdmin(); isLoggedIn = false; }}
            class="flex items-center gap-1 rounded-xl bg-red-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer shadow-xs"
          >
            <span>Log Out</span>
            <span class="text-xs">🔒</span>
          </button>
        </div>

      </div>
    </header>

    <!-- Toast Notification Overlay -->
    {#if toastMessage}
      <div class="fixed bottom-6 right-6 z-[999] flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-white shadow-2xl border {toastIsError ? 'bg-red-700 border-red-300' : 'bg-[#0B1F2E] border-[#8DC63F]'}">
        <span>{toastIsError ? '⚠️' : '✅'}</span>
        <span>{toastMessage}</span>
      </div>
    {/if}

    <!-- ═══ MAIN WORKBENCH VIEWPORT (1280px+ desktop optimized) ═══ -->
    <main class="mx-auto w-full max-w-[1440px] flex-1 p-6 space-y-6">

      <!-- ─── 1. TOP STAT KPI CARDS ─── -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        <!-- Card 1: Today's Harvest Yield -->
        <div class="rounded-2xl border border-[#D5E2C4] bg-white p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs font-semibold text-[#4A5A52]">
            <span>Today's Harvest Yield</span>
            <span class="text-base">🍄</span>
          </div>
          <div class="mt-2 text-2xl font-extrabold text-[#2B5A16]">
            {totalYieldPacks} <span class="text-xs font-medium text-[#4A5A52]">packs</span>
          </div>
          <p class="mt-1 text-[11px] text-[#4A5A52]">
            ~{(totalYieldPacks * 0.25).toFixed(1)} kg logged at 5:30 AM
          </p>
        </div>

        <!-- Card 2: Priority Subscription Lock -->
        <div class="rounded-2xl border border-[#D5E2C4] bg-white p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs font-semibold text-[#4A5A52]">
            <span>Subscribers Reserved</span>
            <span class="text-base">📦</span>
          </div>
          <div class="mt-2 text-2xl font-extrabold text-[#B45309]">
            {totalReservedPacks} <span class="text-xs font-medium text-[#4A5A52]">packs</span>
          </div>
          <p class="mt-1 text-[11px] text-[#B45309] font-medium">
            Strictly locked first for repeat boxes
          </p>
        </div>

        <!-- Card 3: Web Orders Sold -->
        <div class="rounded-2xl border border-[#D5E2C4] bg-white p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs font-semibold text-[#4A5A52]">
            <span>Web Orders Sold</span>
            <span class="text-base">🛒</span>
          </div>
          <div class="mt-2 text-2xl font-extrabold text-[#0B1F2E]">
            {totalWebSold} <span class="text-xs font-medium text-[#4A5A52]">packs</span>
          </div>
          <p class="mt-1 text-[11px] text-[#4A5A52]">
            Decremented from harvest pool
          </p>
        </div>

        <!-- Card 4: Net Available for Public -->
        <div class="rounded-2xl border border-[#D5E2C4] bg-[#F7FAF2] p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs font-semibold text-[#2B5A16]">
            <span>Net Available Web Stock</span>
            <span class="text-base">🌱</span>
          </div>
          <div class="mt-2 text-2xl font-extrabold text-[#2B5A16]">
            {totalAvailablePacks} <span class="text-xs font-medium text-[#2B5A16]">packs</span>
          </div>
          <p class="mt-1 text-[11px] text-[#2B5A16]">
            Yield minus Subscribers &amp; Orders
          </p>
        </div>

        <!-- Card 5: Low Stock / Sold Out Alerts -->
        <div class="rounded-2xl border border-[#D5E2C4] bg-white p-4 shadow-xs">
          <div class="flex items-center justify-between text-xs font-semibold text-[#4A5A52]">
            <span>Sold Out Items</span>
            <span class="text-base">⚠️</span>
          </div>
          <div class="mt-2 text-2xl font-extrabold {soldOutCount > 0 ? 'text-red-600' : 'text-[#2B5A16]'}">
            {soldOutCount} <span class="text-xs font-medium text-[#4A5A52]">items</span>
          </div>
          <p class="mt-1 text-[11px] text-[#4A5A52]">
            {soldOutCount > 0 ? 'Disabled on storefront' : 'All produce in stock'}
          </p>
        </div>

      </div>

      <!-- ─── 2. DESKTOP TAB NAVIGATION BAR ─── -->
      <div class="flex items-center justify-between border-b border-[#D5E2C4] pb-2">
        <div class="flex items-center gap-2">
          
          <button
            onclick={() => (activeTab = 'stock')}
            class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer {activeTab === 'stock' ? 'bg-[#2B5A16] text-white shadow-sm' : 'bg-white text-[#4A5A52] hover:bg-[#EBF7DC] border border-[#D5E2C4]'}"
          >
            <span>📦 Daily Stock &amp; Harvest Control</span>
          </button>

          <button
            onclick={() => (activeTab = 'products')}
            class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer {activeTab === 'products' ? 'bg-[#2B5A16] text-white shadow-sm' : 'bg-white text-[#4A5A52] hover:bg-[#EBF7DC] border border-[#D5E2C4]'}"
          >
            <span>🍄 Products Catalog ({products.length})</span>
          </button>

          <button
            onclick={() => (activeTab = 'recipes')}
            class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer {activeTab === 'recipes' ? 'bg-[#2B5A16] text-white shadow-sm' : 'bg-white text-[#4A5A52] hover:bg-[#EBF7DC] border border-[#D5E2C4]'}"
          >
            <span>🍳 Recipes Hub ({recipes.length})</span>
          </button>

          <button
            onclick={() => (activeTab = 'dispatch')}
            class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer {activeTab === 'dispatch' ? 'bg-[#2B5A16] text-white shadow-sm' : 'bg-white text-[#4A5A52] hover:bg-[#EBF7DC] border border-[#D5E2C4]'}"
          >
            <span>🚚 Packing &amp; Dispatch Checklist ({localOrders.length})</span>
          </button>

          <button
            onclick={() => (activeTab = 'delivery')}
            class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer {activeTab === 'delivery' ? 'bg-[#2B5A16] text-white shadow-sm' : 'bg-white text-[#4A5A52] hover:bg-[#EBF7DC] border border-[#D5E2C4]'}"
          >
            <span>⚙️ Delivery Pricing &amp; Promos</span>
          </button>

        </div>

        <!-- Tab Contextual Emergency Action -->
        {#if activeTab === 'stock'}
          <div class="flex items-center gap-2">
            <button
              onclick={handleResetInventory}
              class="rounded-xl border border-[#D5E2C4] bg-white px-3 py-1.5 text-xs font-semibold text-[#4A5A52] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              🔄 Reset Seed
            </button>
            <button
              onclick={handleEmergencyWipe}
              class="rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>🚨 Emergency Harvest Wipe</span>
            </button>
          </div>
        {:else if activeTab === 'products'}
          <div class="flex items-center gap-2">
            <button
              onclick={handleResetProducts}
              class="rounded-xl border border-[#D5E2C4] bg-white px-3 py-1.5 text-xs font-semibold text-[#4A5A52] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              🔄 Reset Catalog
            </button>
            <button
              onclick={openAddProduct}
              class="rounded-xl bg-[#2B5A16] px-4 py-2 text-xs font-bold text-white hover:bg-[#1f4210] shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Add New Product</span>
            </button>
          </div>
        {:else if activeTab === 'recipes'}
          <div class="flex items-center gap-2">
            <button
              onclick={handleResetRecipes}
              class="rounded-xl border border-[#D5E2C4] bg-white px-3 py-1.5 text-xs font-semibold text-[#4A5A52] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              🔄 Reset Recipes
            </button>
            <button
              onclick={openAddRecipe}
              class="rounded-xl bg-[#2B5A16] px-4 py-2 text-xs font-bold text-white hover:bg-[#1f4210] shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Add New Recipe</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- ─── 3. TAB 1: DAILY STOCK & HARVEST CONTROL ─── -->
      {#if activeTab === 'stock'}
        <div class="rounded-3xl border border-[#D5E2C4] bg-white shadow-xs overflow-hidden">
          
          <div class="bg-[#FAFBF7] border-b border-[#E4E4DC] px-6 py-4 flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-[#0B1F2E]">
                Daily Dawn Harvest Yields &amp; Priority Subscription Allocation
              </h2>
              <p class="text-xs text-[#4A5A52] mt-0.5">
                Subscribers reserve their quota first. Remaining stock is automatically opened for public web sales.
              </p>
            </div>
            <div class="text-right">
              <span class="text-[11px] font-semibold text-[#4A5A52]">Kadugodi Harvest Room • 5:30 AM Shift</span>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-[#E4E4DC] bg-[#F7F8F4] text-[11px] font-bold uppercase tracking-wider text-[#4A5A52]">
                  <th class="py-3.5 px-6">Product</th>
                  <th class="py-3.5 px-4">Category</th>
                  <th class="py-3.5 px-4 text-center">Pack Size</th>
                  <th class="py-3.5 px-4 text-center">Harvest Yield (Packs)</th>
                  <th class="py-3.5 px-4 text-center">Priority Reserved (Subs)</th>
                  <th class="py-3.5 px-4 text-center">Web Sold</th>
                  <th class="py-3.5 px-4 text-center font-extrabold text-[#2B5A16]">Available Stock</th>
                  <th class="py-3.5 px-6">Storefront Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E4E4DC]">
                {#each products as p}
                  {@const pInv = inventory[p.id] || getProductInventory(p.id)}
                  {@const available = computeReactiveAvailable(pInv)}
                  {@const effStatus = computeReactiveStatus(pInv)}
                  <tr class="hover:bg-[#FAFBF7] transition-colors">
                    
                    <!-- Product Info -->
                    <td class="py-3 px-6">
                      <div class="flex items-center gap-3">
                        <img src={p.image} alt={p.name} class="h-10 w-10 rounded-xl object-cover border border-[#E4E4DC]" />
                        <div>
                          <div class="font-bold text-[#0B1F2E]">{p.name}</div>
                          <div class="text-[11px] text-[#4A5A52]">₹{p.price}</div>
                        </div>
                      </div>
                    </td>

                    <!-- Category -->
                    <td class="py-3 px-4">
                      <span class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider {p.category === 'Mushrooms' ? 'bg-[#EBF7DC] text-[#2B5A16]' : p.category === 'Microgreens' ? 'bg-[#E2F0D0] text-[#1E3F20]' : 'bg-[#FFF3E8] text-[#B45309]'}">
                        {p.category}
                      </span>
                    </td>

                    <!-- Pack Size -->
                    <td class="py-3 px-4 text-center font-medium text-[#4A5A52]">
                      {p.unit}
                    </td>

                    <!-- Harvest Yield Input -->
                    <td class="py-3 px-4 text-center">
                      <input
                        type="number"
                        min="0"
                        value={pInv.dailyYield}
                        onchange={(e) => handleYieldChange(p.id, e.target.value)}
                        class="w-20 rounded-lg border border-[#D5E2C4] bg-white px-2 py-1.5 text-center text-xs font-bold text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F]"
                      />
                    </td>

                    <!-- Subscriber Reserve Input -->
                    <td class="py-3 px-4 text-center">
                      <div class="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={pInv.reservedSubscribers}
                          onchange={(e) => handleReserveChange(p.id, e.target.value)}
                          class="w-20 rounded-lg border border-[#FCD34D] bg-[#FFFBEB] px-2 py-1.5 text-center text-xs font-bold text-[#B45309] outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]"
                        />
                        <span class="text-[10px] font-bold text-[#B45309] bg-[#FEF3C7] px-1.5 py-0.5 rounded">🔒</span>
                      </div>
                    </td>

                    <!-- Web Sold -->
                    <td class="py-3 px-4 text-center font-bold text-[#4A5A52]">
                      {pInv.webSold || 0}
                    </td>

                    <!-- Available Stock Calculation -->
                    <td class="py-3 px-4 text-center">
                      <span class="inline-block px-2.5 py-1 rounded-full text-xs font-extrabold {available <= 0 ? 'bg-red-100 text-red-700 border border-red-300' : available <= 5 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-[#EBF7DC] text-[#2B5A16] border border-[#A8D632]'}">
                        {available <= 0 ? '0 (SOLD OUT)' : `${available} left`}
                      </span>
                    </td>

                    <!-- Status Override Dropdown -->
                    <td class="py-3 px-6">
                      <select
                        value={pInv.manualStatus || 'AUTO'}
                        onchange={(e) => handleStatusChange(p.id, e.target.value)}
                        class="rounded-lg border border-[#D5E2C4] px-2.5 py-1.5 text-xs font-semibold outline-none bg-white cursor-pointer {effStatus === 'OUT_OF_STOCK' ? 'text-red-600 border-red-300' : effStatus === 'COMING_SOON' ? 'text-amber-600' : 'text-[#2B5A16]'}"
                      >
                        <option value="AUTO">🤖 Auto (Stock Math)</option>
                        <option value="IN_STOCK">🟢 In Stock (Force Open)</option>
                        <option value="OUT_OF_STOCK">🔴 Out of Stock (Sold Out)</option>
                        <option value="COMING_SOON">🟡 Coming Soon (Flush Maturing)</option>
                        <option value="HIDDEN">👁️ Hidden from Website</option>
                      </select>
                    </td>

                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

        </div>
      {/if}

      <!-- ─── 4. TAB 2: PRODUCTS CATALOG MANAGER (Full CRUD) ─── -->
      {#if activeTab === 'products'}
        <div class="rounded-3xl border border-[#D5E2C4] bg-white shadow-xs overflow-hidden">
          
          <div class="bg-[#FAFBF7] border-b border-[#E4E4DC] px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-bold text-[#0B1F2E]">
                Flexible Farm Produce Catalog (Full CRUD)
              </h2>
              <p class="text-xs text-[#4A5A52] mt-0.5">
                All price &amp; pack updates persist directly to Supabase, Storefront, WhatsApp Bot &amp; Meta Catalog Feed.
              </p>
              <div class="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                <span class="font-semibold text-[#2B5A16]">Meta Catalog Feed:</span>
                <code class="rounded bg-[#EBF7DC] px-2 py-0.5 font-mono text-[10px] text-[#2B5A16] border border-[#D5E2C4] select-all">{metaFeedUrl}</code>
                <span class="text-[#4A5A52]">({metaInstantConfigured ? 'Instant Graph Push Active' : '1-Hourly Scheduled Refresh'})</span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                onclick={handleSyncMetaCatalogNow}
                class="rounded-xl border border-[#D5E2C4] bg-white px-3 py-2 text-xs font-bold text-[#2B5A16] hover:bg-[#EBF7DC] transition-all cursor-pointer"
              >
                🔄 Sync Meta Feed
              </button>
              <button
                onclick={openAddProduct}
                class="rounded-xl bg-[#2B5A16] px-4 py-2 text-xs font-bold text-white hover:bg-[#1f4210] shadow-sm transition-all cursor-pointer"
              >
                + Add Product
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-[#E4E4DC] bg-[#F7F8F4] text-[11px] font-bold uppercase tracking-wider text-[#4A5A52]">
                  <th class="py-3.5 px-6">Product &amp; Thumbnail</th>
                  <th class="py-3.5 px-4">Category</th>
                  <th class="py-3.5 px-4">Price / Pack</th>
                  <th class="py-3.5 px-4">Shelf Life Guide</th>
                  <th class="py-3.5 px-4">Badge</th>
                  <th class="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E4E4DC]">
                {#each products as p}
                  <tr class="hover:bg-[#FAFBF7] transition-colors">
                    <td class="py-3.5 px-6">
                      <div class="flex items-center gap-3">
                        <img src={p.image} alt={p.name} class="h-12 w-12 rounded-xl object-cover border border-[#E4E4DC]" />
                        <div>
                          <div class="font-bold text-sm text-[#0B1F2E]">{p.name}</div>
                          <div class="text-[11px] text-[#4A5A52] max-w-xs truncate">{p.shortDescription}</div>
                        </div>
                      </div>
                    </td>

                    <td class="py-3.5 px-4">
                      <span class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#EBF7DC] text-[#2B5A16]">
                        {p.category}
                      </span>
                    </td>

                    <td class="py-3.5 px-4">
                      <div>
                        <span class="font-extrabold text-[#0B1F2E]">₹{p.price}</span>
                        <span class="text-[#4A5A52] text-[11px]"> / {p.unit}</span>
                      </div>
                      {#if p.packSizes && p.packSizes.length > 1}
                        <div class="mt-1 flex flex-wrap gap-1">
                          {#each p.packSizes.slice(1) as ps}
                            <span class="rounded bg-[#F7F8F4] px-1.5 py-0.5 text-[10px] font-semibold text-[#4A5A52] border border-[#E4E4DC]">
                              {ps.size}: ₹{ps.price}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </td>

                    <td class="py-3.5 px-4 text-[#4A5A52]">
                      {p.shelfLife || '5 to 7 days in fridge'}
                    </td>

                    <td class="py-3.5 px-4">
                      <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase {p.badgeType === 'orange' ? 'bg-[#FFEDE0] text-[#FF5E00]' : 'bg-[#EBF7DC] text-[#2B5A16]'}">
                        {p.badge || 'Fresh Harvest'}
                      </span>
                    </td>

                    <td class="py-3.5 px-6 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <button
                          onclick={() => openEditProduct(p)}
                          class="rounded-lg border border-[#D5E2C4] bg-white px-3 py-1.5 text-xs font-bold text-[#2B5A16] hover:bg-[#EBF7DC] transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onclick={() => handleDeleteProduct(p)}
                          class="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

        </div>
      {/if}

      <!-- ─── 5. TAB 3: RECIPES HUB MANAGER (Full CRUD) ─── -->
      {#if activeTab === 'recipes'}
        <div class="rounded-3xl border border-[#D5E2C4] bg-white shadow-xs overflow-hidden">
          
          <div class="bg-[#FAFBF7] border-b border-[#E4E4DC] px-6 py-4 flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-[#0B1F2E]">
                Farm Culinary Recipes &amp; Produce Pairings
              </h2>
              <p class="text-xs text-[#4A5A52] mt-0.5">
                Every recipe links with live farm produce to enable the 1-click "Cook This Dish" bundle checkout.
              </p>
            </div>
            <button
              onclick={openAddRecipe}
              class="rounded-xl bg-[#2B5A16] px-4 py-2 text-xs font-bold text-white hover:bg-[#1f4210] shadow-sm transition-all cursor-pointer"
            >
              + Add Recipe
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-[#E4E4DC] bg-[#F7F8F4] text-[11px] font-bold uppercase tracking-wider text-[#4A5A52]">
                  <th class="py-3.5 px-6">Recipe &amp; Photo</th>
                  <th class="py-3.5 px-4">Linked Produce</th>
                  <th class="py-3.5 px-4 text-center">Timing &amp; Servings</th>
                  <th class="py-3.5 px-4 text-center">Difficulty</th>
                  <th class="py-3.5 px-4 text-center">Ingredients</th>
                  <th class="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E4E4DC]">
                {#each recipes as r}
                  <tr class="hover:bg-[#FAFBF7] transition-colors">
                    <td class="py-3.5 px-6">
                      <div class="flex items-center gap-3">
                        <img src={r.thumbnail} alt={r.title} class="h-12 w-12 rounded-xl object-cover border border-[#E4E4DC]" />
                        <div>
                          <div class="font-bold text-sm text-[#0B1F2E]">{r.title}</div>
                          <div class="text-[11px] text-[#4A5A52]">{r.category}</div>
                        </div>
                      </div>
                    </td>

                    <td class="py-3.5 px-4">
                      <span class="inline-flex items-center gap-1 rounded-full bg-[#EBF7DC] border border-[#A8D632] px-2.5 py-0.5 text-[11px] font-bold text-[#2B5A16]">
                        <span>🍄</span>
                        <span>{r.product || 'Fresh Produce'}</span>
                      </span>
                    </td>

                    <td class="py-3.5 px-4 text-center text-[#4A5A52]">
                      <div>{r.prepTime} prep • {r.cookTime} cook</div>
                      <div class="text-[10px] text-slate-400">{r.servings || 2} servings</div>
                    </td>

                    <td class="py-3.5 px-4 text-center">
                      <span class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-100 text-[#0B1F2E]">
                        {r.difficulty || 'Easy'}
                      </span>
                    </td>

                    <td class="py-3.5 px-4 text-center font-medium text-[#4A5A52]">
                      {r.ingredients?.length || 0} items
                    </td>

                    <td class="py-3.5 px-6 text-right">
                      <div class="flex items-center justify-end gap-2">
                        <button
                          onclick={() => openEditRecipe(r)}
                          class="rounded-lg border border-[#D5E2C4] bg-white px-3 py-1.5 text-xs font-bold text-[#2B5A16] hover:bg-[#EBF7DC] transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onclick={() => handleDeleteRecipe(r)}
                          class="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

        </div>
      {/if}

      <!-- ─── 6. TAB 4: DISPATCH & FULFILLMENT CHECKLIST ─── -->
      {#if activeTab === 'dispatch'}
        <div class="space-y-4">
          
          <!-- Slot Filter Pill Bar -->
          <div class="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#D5E2C4] shadow-xs">
            <div class="flex items-center gap-3">
              <span class="text-xs font-bold uppercase tracking-wider text-[#4A5A52]">Delivery Slot:</span>
              <div class="rounded-xl px-4 py-2 text-xs font-bold bg-[#2B5A16] text-white shadow-xs flex items-center gap-1.5">
                <span>🌅</span>
                <span>Morning Dawn Drop (7:00 AM – 10:00 AM)</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-[#4A5A52] mr-2">
                {localOrders.length} active orders
              </span>
              <button
                type="button"
                onclick={exportOrdersCSV}
                class="rounded-xl border border-[#D5E2C4] bg-white px-3 py-1.5 text-xs font-bold text-[#4A5A52] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>📥 Export CSV</span>
              </button>
              <button
                type="button"
                onclick={printPackingManifest}
                class="rounded-xl bg-[#2B5A16] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1f4210] shadow-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <span>🖨️ Print Manifest</span>
              </button>
            </div>
          </div>

          <!-- Order Cards Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {#each localOrders as order}
              <div class="rounded-3xl border border-[#D5E2C4] bg-white p-5 shadow-xs flex flex-col justify-between">
                
                <div>
                  <!-- Order Card Header -->
                  <div class="flex items-start justify-between border-b border-[#E4E4DC] pb-3 mb-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-extrabold text-[#0B1F2E] text-base">{order.id}</span>
                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider {order.customer.zoneStatus === 'CORE' ? 'bg-[#EBF7DC] text-[#2B5A16]' : 'bg-[#FFF3E8] text-[#B45309]'}">
                          {order.customer.zoneStatus === 'CORE' ? 'Core 0 km Zone' : 'Extended Buffer Zone'}
                        </span>
                      </div>
                      <div class="font-semibold text-xs text-[#0B1F2E] mt-1">{order.customer.name} • 📞 +91 {order.customer.phone}</div>
                      <div class="text-[11px] text-[#4A5A52]">{order.customer.address}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-xs font-extrabold text-[#2B5A16]">₹{order.total}</div>
                      <div class="text-[10px] text-slate-400">{order.deliverySlot}</div>
                    </div>
                  </div>

                  <!-- Packing Items -->
                  <div class="space-y-1.5 mb-4 bg-[#FAFBF7] rounded-xl p-3 border border-[#E4E4DC]/60">
                    <div class="text-[11px] font-bold text-[#4A5A52] uppercase tracking-wider mb-1">Items to Pack:</div>
                    {#each order.items as item}
                      <div class="flex items-center justify-between text-xs text-[#0B1F2E]">
                        <span>• {item.name} ({item.packSize})</span>
                        <span class="font-bold text-[#2B5A16]">Qty: {item.quantity}</span>
                      </div>
                    {/each}
                  </div>

                  <!-- Packing Workflow Checkboxes -->
                  <div class="grid grid-cols-3 gap-2 mb-4 text-xs font-medium">
                    <label class="flex items-center gap-1.5 rounded-xl border p-2 cursor-pointer transition-colors {dispatchChecks[`${order.id}__harvest`] ? 'bg-[#EBF7DC] border-[#A8D632] text-[#2B5A16] font-bold' : 'border-[#E4E4DC] bg-white text-[#4A5A52]'}">
                      <input
                        type="checkbox"
                        checked={dispatchChecks[`${order.id}__harvest`]}
                        onchange={() => toggleDispatchCheck(order.id, 'harvest')}
                        class="accent-[#2B5A16]"
                      />
                      <span>1. Harvested</span>
                    </label>

                    <label class="flex items-center gap-1.5 rounded-xl border p-2 cursor-pointer transition-colors {dispatchChecks[`${order.id}__boxed`] ? 'bg-[#EBF7DC] border-[#A8D632] text-[#2B5A16] font-bold' : 'border-[#E4E4DC] bg-white text-[#4A5A52]'}">
                      <input
                        type="checkbox"
                        checked={dispatchChecks[`${order.id}__boxed`]}
                        onchange={() => toggleDispatchCheck(order.id, 'boxed')}
                        class="accent-[#2B5A16]"
                      />
                      <span>2. Boxed</span>
                    </label>

                    <label class="flex items-center gap-1.5 rounded-xl border p-2 cursor-pointer transition-colors {dispatchChecks[`${order.id}__van`] ? 'bg-[#EBF7DC] border-[#A8D632] text-[#2B5A16] font-bold' : 'border-[#E4E4DC] bg-white text-[#4A5A52]'}">
                      <input
                        type="checkbox"
                        checked={dispatchChecks[`${order.id}__van`]}
                        onchange={() => toggleDispatchCheck(order.id, 'van')}
                        class="accent-[#2B5A16]"
                      />
                      <span>3. In Van</span>
                    </label>
                  </div>
                </div>

                <!-- 1-Click WhatsApp Dispatch Ping -->
                <button
                  type="button"
                  onclick={() => sendWhatsAppDispatch(order)}
                  class="flex items-center justify-center gap-2 rounded-xl bg-[#8DC63F] py-2.5 text-xs font-bold text-[#0B1F2E] hover:bg-[#7db534] transition-colors cursor-pointer shadow-xs"
                >
                  <span>Send WhatsApp Dispatch Ping to Customer</span>
                  <span class="text-sm">💬</span>
                </button>

              </div>
            {/each}
          </div>

        </div>
      {/if}

      <!-- ─── 7. TAB 5: DELIVERY & PROMOTIONAL RULES ─── -->
      {#if activeTab === 'delivery'}
        <DeliverySettingsTab />
      {/if}

    </main>

    <!-- Modals -->
    {#if isProductModalOpen}
      <ProductEditorModal
        product={editingProduct}
        onClose={() => (isProductModalOpen = false)}
        onSaved={(p, metaSync) => {
          reloadAllData();
          const syncNote = metaSync?.synced ? ' & pushed to Meta Catalog!' : ' & synced to Supabase + live feed!';
          showToast(`Saved ${p.name} (₹${p.price} / ${p.unit})${syncNote}`);
        }}
      />
    {/if}

    {#if isRecipeModalOpen}
      <RecipeEditorModal
        recipe={editingRecipe}
        onClose={() => (isRecipeModalOpen = false)}
        onSaved={(r) => {
          recipes = getRecipes();
          showToast(`Saved recipe to Supabase: ${r.title}`);
        }}
      />
    {/if}

  </div>
{/if}

<style>
  @media print {
    :global(header), :global(nav), :global(.border-b) button {
      display: none !important;
    }
    :global(body) {
      background: #ffffff !important;
      color: #000000 !important;
    }
    :global(main) {
      padding: 0 !important;
      max-width: 100% !important;
    }
    :global(.rounded-3xl) {
      border: 1px solid #ccc !important;
      box-shadow: none !important;
      break-inside: avoid;
      margin-bottom: 12px !important;
    }
  }
</style>


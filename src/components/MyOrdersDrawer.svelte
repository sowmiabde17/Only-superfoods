<!--
  MyOrdersDrawer.svelte — Slide-Over Order History & 1-Click Re-Order Drawer
  Features:
  - Slide-in panel showing customer's past orders
  - WhatsApp phone session check
  - 1-Click "Reorder This Basket" (repopulates cart instantly)
  - 1-Click WhatsApp support link with prefilled Order ID
  - Svelte 5 runes mode.
-->
<script>
  import { onMount } from 'svelte';
  import {
    getCurrentCustomer,
    isCustomerLoggedIn,
    getCustomerOrders,
    openAuthModal,
    logoutCustomer,
    closeMyOrders,
  } from '../lib/auth.js';
  import { addToCart, openCartDrawer, clearCart } from '../lib/cart.js';
  import { getProducts } from '../lib/productsStore.js';
  import { getAvailableStock, isProductAvailable } from '../lib/inventory.js';
  import {
    getSavedSubscriptions,
    updateSubscriptionStatus,
    getNextDropDate,
  } from '../lib/subscriptionStore.js';

  let isOpen = $state(false);
  let activeTab = $state('orders'); // 'orders' | 'subscriptions'
  let customer = $state(null);
  let orders = $state([]);
  let subscriptions = $state([]);
  let reorderToast = $state('');

  function refresh() {
    customer = getCurrentCustomer();
    orders = getCustomerOrders(customer?.phone);
    subscriptions = getSavedSubscriptions(customer?.phone);
  }

  function handleOpen(e) {
    isOpen = true;
    if (e?.detail?.tab) {
      activeTab = e.detail.tab;
    }
    refresh();
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  function handleClose() {
    isOpen = false;
    reorderToast = '';
    closeMyOrders();
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  function toggleSubPause(sub) {
    const nextStatus = sub.status === 'paused' ? 'active' : 'paused';
    updateSubscriptionStatus(sub.id, nextStatus);
    refresh();
    reorderToast = nextStatus === 'paused'
      ? `Subscription #${sub.id} paused.`
      : `Subscription #${sub.id} resumed!`;
    setTimeout(() => { reorderToast = ''; }, 3000);
  }

  onMount(() => {
    refresh();
    window.addEventListener('osf:open-my-orders', handleOpen);
    window.addEventListener('osf:close-my-orders', handleClose);
    window.addEventListener('osf:auth-changed', refresh);
    window.addEventListener('osf:order-placed', refresh);
    window.addEventListener('osf:subscription-updated', refresh);
    return () => {
      window.removeEventListener('osf:open-my-orders', handleOpen);
      window.removeEventListener('osf:close-my-orders', handleClose);
      window.removeEventListener('osf:auth-changed', refresh);
      window.removeEventListener('osf:order-placed', refresh);
      window.removeEventListener('osf:subscription-updated', refresh);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  });

  function handleReorder(order) {
    if (!order?.items || order.items.length === 0) return;

    clearCart();
    const liveProducts = getProducts();
    let addedCount = 0;
    let skippedNames = [];

    order.items.forEach((item) => {
      const catalogProd =
        liveProducts.find((p) => p.id === item.productId) || {
          id: item.productId || 'custom',
          name: item.name,
          image: item.image || '/images/prod-grey-oyster.jpg',
          price: item.price,
          unit: item.packSize || '250 g',
          whatsappMessage: 'I would like to order {{size}}',
        };

      const avail = getAvailableStock(catalogProd.id);
      if (!isProductAvailable(catalogProd.id, 1) || avail <= 0) {
        skippedNames.push(catalogProd.name);
        return;
      }

      const matchedPack = (catalogProd.packSizes || []).find((pk) => pk.size === item.packSize);
      const livePrice = Number(matchedPack?.price ?? catalogProd.price ?? item.price);

      const pack = {
        size: item.packSize || catalogProd.unit || '250 g',
        price: livePrice,
      };

      const safeQty = Math.min(item.quantity || 1, avail);
      addToCart(catalogProd, pack, safeQty);
      addedCount++;
    });

    if (addedCount === 0) {
      reorderToast = 'Previous items are currently sold out for today.';
      return;
    }

    reorderToast = skippedNames.length
      ? `Reloaded ${addedCount} items (${skippedNames.join(', ')} sold out today).`
      : `Basket reloaded with ${addedCount} items at live farm prices!`;
    setTimeout(() => {
      handleClose();
      window.location.href = '/cart';
    }, 650);
  }

  function getWhatsAppSupportUrl(orderId) {
    const msg = `Hi Only Superfoods! I need assistance with my order #${orderId}. 🌱`;
    return `https://wa.me/917019760360?text=${encodeURIComponent(msg)}`;
  }
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
    onclick={handleClose}
    aria-hidden="true"
  ></div>

  <!-- Slide-Over Drawer -->
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <div
    class="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white shadow-2xl transition-transform duration-300"
    role="dialog"
    aria-modal="true"
    aria-label="My Harvest Orders"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[#E4E4DC] px-5 py-4 bg-[#FAF7F0]">
      <div class="flex items-center gap-2.5">
        <span class="text-xl">📦</span>
        <div>
          <h2 class="text-base font-bold text-[#0B1F2E]">
            {activeTab === 'subscriptions' ? 'My Harvest Subscriptions' : 'My Harvest Orders'}
          </h2>
          {#if customer?.phone}
            <p class="text-[11px] text-[#2B5A16] font-medium">
              +91 {customer.phone} {customer.name ? `(${customer.name})` : ''}
            </p>
          {/if}
        </div>
      </div>

      <div class="flex items-center gap-2">
        {#if customer?.phone}
          <button
            type="button"
            onclick={() => logoutCustomer()}
            class="text-[11px] font-semibold text-[#4A5A52] hover:text-red-600 transition-colors"
          >
            Log Out
          </button>
        {/if}
        <button
          type="button"
          onclick={handleClose}
          class="flex h-8 w-8 items-center justify-center rounded-full text-[#4A5A52] hover:bg-[#F7F7F2]"
          aria-label="Close Orders"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Mode Switcher Tabs: Orders vs Subscriptions -->
    <div class="flex border-b border-[#E4E4DC] bg-[#FAF7F0] px-4 pt-2">
      <button
        type="button"
        onclick={() => (activeTab = 'orders')}
        class="flex-1 pb-2.5 text-xs font-bold transition-all relative {activeTab === 'orders' ? 'text-[#2B5A16]' : 'text-[#4A5A52] hover:text-[#0B1F2E]'}"
      >
        <span class="inline-flex items-center justify-center gap-1.5 w-full">
          <span>📦</span> Orders
          {#if orders.length > 0}
            <span class="rounded-full bg-white px-1.5 py-0.2 text-[10px] font-bold border border-[#E4E4DC] text-[#0B1F2E]">
              {orders.length}
            </span>
          {/if}
        </span>
        {#if activeTab === 'orders'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2B5A16]"></span>
        {/if}
      </button>

      <button
        type="button"
        onclick={() => (activeTab = 'subscriptions')}
        class="flex-1 pb-2.5 text-xs font-bold transition-all relative {activeTab === 'subscriptions' ? 'text-[#2B5A16]' : 'text-[#4A5A52] hover:text-[#0B1F2E]'}"
      >
        <span class="inline-flex items-center justify-center gap-1.5 w-full">
          <span>🔁</span> Subscriptions
          {#if subscriptions.length > 0}
            <span class="rounded-full bg-[#EBF7DC] px-1.5 py-0.2 text-[10px] font-bold border border-[#A8D632] text-[#2B5A16]">
              {subscriptions.length}
            </span>
          {/if}
        </span>
        {#if activeTab === 'subscriptions'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2B5A16]"></span>
        {/if}
      </button>
    </div>

    <!-- Reorder Toast Feedback -->
    {#if reorderToast}
      <div class="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-bold text-emerald-800">
        🎉 {reorderToast}
      </div>
    {/if}

    <!-- Content Body -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- If NOT logged in: Prompt WhatsApp Login -->
      {#if !customer?.phone}
        <div class="rounded-2xl border border-[#A8D632]/50 bg-[#FAF7F0] p-5 text-center">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F8EE] text-[#25D366] text-2xl shadow-xs">
            💬
          </div>
          <h3 class="mt-3 text-sm font-bold text-[#0B1F2E]">
            Quick WhatsApp Login
          </h3>
          <p class="mt-1.5 text-xs text-[#4A5A52] leading-relaxed">
            Enter your WhatsApp number to view your previous morning harvest orders, active subscriptions, and re-order in 1 tap.
          </p>
          <button
            type="button"
            onclick={() => openAuthModal('login')}
            class="mt-4 w-full rounded-xl bg-[#25D366] py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#20BA59] active:scale-98 transition-all"
          >
            Log in with WhatsApp
          </button>
        </div>
      {/if}

      {#if activeTab === 'orders'}
        <!-- Order List -->
        {#if orders.length === 0}
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <span class="text-4xl">🍄🌱</span>
            <p class="mt-3 text-sm font-bold text-[#0B1F2E]">
              No orders found yet
            </p>
            <p class="mt-1 max-w-[240px] text-xs text-[#4A5A52]">
              Once you place an order, your fresh harvest history and 1-tap re-order button will appear right here.
            </p>
            <button
              type="button"
              onclick={handleClose}
              class="mt-4 rounded-xl bg-[#2B5A16] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1E3F20] transition-all"
            >
              Explore Farm Harvest →
            </button>
          </div>
        {:else}
          <div class="space-y-3.5">
            {#each orders as order (order.order_number || order.orderId || order.id || Math.random())}
              <div class="overflow-hidden rounded-2xl border border-[#E4E4DC] bg-white p-4 shadow-2xs">
                <!-- Order Header -->
                <div class="flex items-start justify-between border-b border-[#F0F0EA] pb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs font-bold text-[#0B1F2E]">
                        #{order.order_number || order.orderId || order.id}
                      </span>
                      <span class="rounded-full bg-[#EBF7DC] px-2 py-0.5 text-[9.5px] font-bold text-[#2B5A16] border border-[#A8D632]/50">
                        Confirmed
                      </span>
                    </div>
                    <p class="mt-0.5 text-[10.5px] text-[#4A5A52]">
                      {order.created_at || order.date ? new Date(order.created_at || order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                    </p>
                  </div>

                  <div class="text-right">
                    <span class="text-sm font-bold text-[#0B1F2E]">
                      ₹{order.total_amount ?? order.total ?? 0}
                    </span>
                    <p class="text-[9.5px] text-[#4A5A52]">
                      {(order.payment_method || order.paymentMethod || '').toLowerCase().includes('cod') || (order.payment_method || order.paymentMethod || '').toLowerCase().includes('cash') || (order.payment_method || order.paymentMethod || '').toLowerCase().includes('delivery') ? 'Pay on Delivery' : 'Online'}
                    </p>
                  </div>
                </div>

                <!-- Delivery Slot -->
                <div class="mt-2.5 flex items-center justify-between text-[11px] text-[#4A5A52] bg-[#FAF7F0] px-2.5 py-1.5 rounded-lg">
                  <span>🗓 {order.deliveryDay || 'Next Harvest Drop'}</span>
                  <span>⏰ {order.delivery_slot || order.deliverySlot || 'Morning Drop (7-10 AM)'}</span>
                </div>

                <!-- Items List -->
                <div class="mt-3 space-y-2">
                  {#each order.items || [] as item}
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-[#2B5A16]">{item.quantity}x</span>
                        <span class="text-[#0B1F2E]">{item.name}</span>
                        <span class="text-[10.5px] text-[#4A5A52]">({item.packSize})</span>
                      </div>
                      <span class="font-semibold text-[#0B1F2E]">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  {/each}

                  <!-- Delivery Fee Line -->
                  <div class="flex items-center justify-between text-[11px] text-[#4A5A52] pt-1 border-t border-dashed border-[#F0F0EA]">
                    <span>Dawn Delivery</span>
                    {#if Number(order.delivery_fee ?? order.deliveryFee ?? 0) > 0}
                      <span>₹{order.delivery_fee ?? order.deliveryFee}</span>
                    {:else}
                      <span class="text-[#2B5A16] font-semibold">FREE</span>
                    {/if}
                  </div>
                </div>

                <!-- Action Row: 1-Click Reorder & WhatsApp Support -->
                <div class="mt-4 flex items-center gap-2 border-t border-[#F0F0EA] pt-3">
                  <button
                    type="button"
                    onclick={() => handleReorder(order)}
                    class="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#2B5A16] py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1E3F20] active:scale-98 transition-all"
                  >
                    <span>🔄</span>
                    Reorder Basket
                  </button>

                  <a
                    href={getWhatsAppSupportUrl(order.order_number || order.orderId || order.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center justify-center rounded-xl border border-[#E4E4DC] bg-[#FAF7F0] px-3 py-2 text-xs font-bold text-[#25D366] hover:bg-white transition-all"
                    aria-label="WhatsApp Support for Order #{order.order_number || order.orderId || order.id}"
                  >
                    💬 Help
                  </a>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <!-- Active Subscriptions List -->
        {#if subscriptions.length === 0}
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <span class="text-4xl">🔁🥗</span>
            <p class="mt-3 text-sm font-bold text-[#0B1F2E]">
              No active subscriptions yet
            </p>
            <p class="mt-1 max-w-[260px] text-xs text-[#4A5A52] leading-relaxed">
              Set up a recurring morning harvest routine of oyster mushrooms, living greens, and desi eggs with up to 10% savings & free delivery.
            </p>
            <a
              href="/subscribe"
              onclick={handleClose}
              class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2B5A16] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1E3F20] transition-all"
            >
              <span>Build Harvest Routine</span>
              <span>→</span>
            </a>
          </div>
        {:else}
          <div class="space-y-4">
            {#each subscriptions as sub (sub.id)}
              <div class="overflow-hidden rounded-2xl border border-[#E4E4DC] bg-white p-4 shadow-2xs">
                <!-- Subscription Header -->
                <div class="flex items-start justify-between border-b border-[#F0F0EA] pb-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs font-bold text-[#0B1F2E]">
                        #{sub.id}
                      </span>
                      <span
                        class="rounded-full px-2 py-0.5 text-[9.5px] font-bold border {sub.status === 'paused'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-[#EBF7DC] text-[#2B5A16] border-[#A8D632]/50'}"
                      >
                        {sub.status === 'paused' ? '⏸ Paused' : '● Active Routine'}
                      </span>
                    </div>
                    <p class="mt-0.5 text-[11px] font-semibold text-[#0B1F2E]">
                      {sub.planName || (sub.planDuration === 'quarterly' ? 'Quarterly Seasonal' : sub.planDuration === 'rolling' ? 'Flexible Rolling' : 'Monthly Routine')}
                      {#if sub.discountPercent > 0}
                        <span class="text-[10px] text-[#2B5A16] font-bold">({sub.discountPercent}% OFF)</span>
                      {/if}
                    </p>
                  </div>

                  <div class="text-right">
                    <span class="text-sm font-bold text-[#2B5A16]">
                      ₹{sub.finalPayable ?? sub.weeklyBaseTotal ?? 0}
                    </span>
                    <p class="text-[9.5px] text-[#4A5A52]">
                      {sub.planDuration === 'rolling' ? 'per week' : `total for ${sub.weeks || 4} wks`}
                    </p>
                  </div>
                </div>

                <!-- Next Drop Banner -->
                <div class="mt-2.5 rounded-xl bg-[#FAF7F0] border border-[#E4E4DC] p-2.5 text-xs space-y-1">
                  <div class="flex items-center justify-between text-[#0B1F2E]">
                    <span class="font-bold flex items-center gap-1.5">
                      <span>🚚</span> Next Harvest Drop:
                    </span>
                    <span class="font-extrabold text-[#2B5A16]">
                      {getNextDropDate(sub.selectedDays || ['Monday'])}
                    </span>
                  </div>
                  <div class="flex items-center justify-between text-[10.5px] text-[#4A5A52]">
                    <span>Days: {(sub.selectedDays || []).join(' & ')}</span>
                    <span>7:00 AM – 10:00 AM</span>
                  </div>
                </div>

                <!-- Day-by-Day Customized Produce Baskets -->
                <div class="mt-3 space-y-2.5">
                  <p class="text-[10.5px] font-bold uppercase tracking-wider text-[#4A5A52]">
                    Produce Selected Per Day:
                  </p>
                  {#each (sub.selectedDays || ['Monday']) as day}
                    {@const dayItems = sub.dayBaskets?.[day] || []}
                    <div class="rounded-lg bg-[#F7F7F2] p-2 border border-[#E4E4DC]/60">
                      <div class="flex items-center justify-between text-[11px] font-bold text-[#0B1F2E] border-b border-[#E4E4DC]/40 pb-1 mb-1.5">
                        <span class="flex items-center gap-1">
                          <span>🌱</span> {day}'s Harvest Box
                        </span>
                        <span class="text-[10px] text-[#4A5A52] font-medium">
                          {dayItems.length} item{dayItems.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      {#if dayItems.length > 0}
                        <div class="space-y-1">
                          {#each dayItems as item}
                            <div class="flex items-center justify-between text-[11px]">
                              <span class="text-[#0B1F2E]">
                                <span class="font-bold text-[#2B5A16]">{item.quantity}x</span> {item.name} <span class="text-[9.5px] text-[#4A5A52]">({item.packSize})</span>
                              </span>
                              <span class="font-semibold text-[#0B1F2E]">
                                ₹{item.price * item.quantity}
                              </span>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="text-[10px] text-[#4A5A52] italic">No items customized for this day.</p>
                      {/if}
                    </div>
                  {/each}
                </div>

                <!-- Delivery Address & Savings Summary -->
                <div class="mt-3 border-t border-[#F0F0EA] pt-2 text-[11px] text-[#4A5A52] space-y-1">
                  {#if sub.deliveryAddress}
                    <div class="flex items-start gap-1">
                      <span>📍</span>
                      <span class="line-clamp-2">{sub.deliveryAddress}</span>
                    </div>
                  {/if}
                  <div class="flex items-center justify-between pt-1">
                    <span>Dawn Delivery</span>
                    <span class="font-bold text-[#2B5A16]">FREE (Subscriber Perk)</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span>Payment Method</span>
                    <span class="font-medium text-[#0B1F2E]">
                      {sub.paymentMethod === 'pod' ? 'Pay on Delivery' : 'Online (Razorpay)'}
                    </span>
                  </div>
                </div>

                <!-- Actions: Pause/Resume + Concierge WhatsApp -->
                <div class="mt-4 flex items-center gap-2 border-t border-[#F0F0EA] pt-3">
                  <button
                    type="button"
                    onclick={() => toggleSubPause(sub)}
                    class="flex-1 rounded-xl border border-[#E4E4DC] py-2 text-xs font-bold transition-all {sub.status === 'paused'
                      ? 'bg-[#2B5A16] text-white hover:bg-[#1E3F20]'
                      : 'bg-[#FAF7F0] text-[#0B1F2E] hover:bg-white'}"
                  >
                    {sub.status === 'paused' ? '▶ Resume Routine' : '⏸ Pause Routine'}
                  </button>

                  <a
                    href="https://wa.me/917760350360?text=Hi%20Only%20Superfoods!%20I%20need%20assistance%20with%20my%20subscription%20%23{sub.id}."
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center justify-center rounded-xl border border-[#E4E4DC] bg-[#FAF7F0] px-3 py-2 text-xs font-bold text-[#25D366] hover:bg-white transition-all"
                    aria-label="WhatsApp Concierge for Subscription #{sub.id}"
                  >
                    💬 Concierge
                  </a>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}


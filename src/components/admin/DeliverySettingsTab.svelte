<!--
  DeliverySettingsTab.svelte — Live Delivery Pricing & Promotional Rules Console
  Empowers the founder to configure base delivery fees, free delivery thresholds,
  promotional discount percentages (e.g. ₹100 base fee with 70% off promo), and marketing banners.
  Persisted directly into Supabase 'store_settings' and consumed by both Web Storefront and WhatsApp Bot.
-->
<script>
  import { onMount } from 'svelte';
  import {
    getStoreSettings,
    updateStoreSettings,
    DEFAULT_SETTINGS,
    parseNumericSetting,
  } from '../../lib/settingsStore.js';

  let settings = $state({ ...DEFAULT_SETTINGS });
  let isSaving = $state(false);
  let statusMessage = $state('');
  let isError = $state(false);

  // Live simulation for preview card
  let simulatedCartSubtotal = $state(200);

  let effectivePreview = $derived.by(() => {
    const base = parseNumericSetting(settings.base_delivery_fee, 40);
    const threshold = parseNumericSetting(settings.free_delivery_threshold, 350);
    const discountPct = parseNumericSetting(settings.delivery_discount_percent, 0);
    const isPromoActive = Boolean(settings.is_promotional_active);

    if (base === 0) {
      return {
        fee: 0,
        original: 0,
        discount: 0,
        isFree: true,
        label: 'FREE (Base Delivery Fee is ₹0 for all orders)',
      };
    }

    if (threshold <= 0 || simulatedCartSubtotal >= threshold) {
      return {
        fee: 0,
        original: base,
        discount: base,
        isFree: true,
        label: threshold <= 0 ? 'FREE (Free Delivery Threshold is ₹0)' : `FREE (Cart ₹${simulatedCartSubtotal} ≥ ₹${threshold})`,
      };
    }

    const discountAmount = isPromoActive ? (base * (discountPct / 100)) : 0;
    const finalFee = Math.max(0, Math.round(base - discountAmount));

    return {
      fee: finalFee,
      original: base,
      discount: Math.round(discountAmount),
      isFree: finalFee === 0,
      label: isPromoActive && discountPct > 0
        ? `₹${finalFee} (${discountPct}% promo applied, saved ₹${Math.round(discountAmount)})`
        : `₹${finalFee} (Standard rate under ₹${threshold})`,
    };
  });

  onMount(() => {
    settings = { ...getStoreSettings() };

    const handleUpdate = (e) => {
      if (e.detail) settings = { ...e.detail };
    };

    window.addEventListener('osf:settings-updated', handleUpdate);
    return () => window.removeEventListener('osf:settings-updated', handleUpdate);
  });

  async function handleSave() {
    isSaving = true;
    statusMessage = '';
    isError = false;

    const res = await updateStoreSettings(settings);
    isSaving = false;

    if (res.success) {
      statusMessage = '✅ Saved & Synced! Live on Web & WhatsApp.';
      setTimeout(() => (statusMessage = ''), 3500);
    } else {
      isError = true;
      statusMessage = `❌ Error: ${res.error || 'Failed to save to Supabase'}`;
    }
  }

  function handleReset() {
    if (confirm('Reset delivery pricing rules back to default (₹40 base / ₹350 free threshold)?')) {
      settings = { ...DEFAULT_SETTINGS };
      handleSave();
    }
  }
</script>

<div class="space-y-6">
  
  <!-- Header Card -->
  <div class="rounded-2xl border border-[#D5E2C4] bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-bold text-[#0B1F2E]">
          🚚 Delivery Pricing &amp; Promotional Strategy
        </h2>
        <span class="rounded-full bg-[#2B5A16]/10 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-[#2B5A16] border border-[#2B5A16]/20">
          Supabase Connected
        </span>
      </div>
      <p class="text-xs text-[#4A5A52] mt-1 max-w-2xl">
        Adjust delivery fees, free delivery basket thresholds, and launch promotional delivery discounts (e.g. ₹100 delivery fee with 70% off discount).
        Changes take effect immediately across both your <strong>Astro Web Storefront</strong> and <strong>WhatsApp Ordering Bot</strong>.
      </p>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button
        onclick={handleReset}
        type="button"
        class="rounded-xl border border-[#D5E2C4] bg-slate-50 px-3.5 py-2 text-xs font-semibold text-[#4A5A52] hover:bg-slate-100 transition-colors cursor-pointer"
      >
        🔄 Reset Defaults
      </button>

      <button
        onclick={handleSave}
        disabled={isSaving}
        type="button"
        class="rounded-xl bg-[#2B5A16] px-5 py-2 text-xs font-bold text-white hover:bg-[#224711] transition-all cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-50"
      >
        {#if isSaving}
          <span class="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
          <span>Saving to Supabase...</span>
        {:else}
          <span>💾 Save &amp; Broadcast</span>
        {/if}
      </button>
    </div>
  </div>

  {#if statusMessage}
    <div class="rounded-xl p-3 text-xs font-bold transition-all {isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}">
      {statusMessage}
    </div>
  {/if}

  <!-- Main Grid: Settings Form & Live Simulator -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

    <!-- Column 1 & 2: Form Controls -->
    <div class="lg:col-span-2 space-y-6">

      <!-- Section A: Base Delivery Rules -->
      <div class="rounded-2xl border border-[#D5E2C4] bg-white p-6 shadow-xs space-y-5">
        <h3 class="text-sm font-bold text-[#0B1F2E] flex items-center gap-2 border-b border-[#D5E2C4] pb-3">
          <span>📦</span>
          <span>Core Delivery Fee Structure</span>
        </h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <!-- Base Delivery Fee -->
          <div>
            <label for="base-fee-input" class="block text-xs font-bold text-[#0B1F2E] mb-1.5">
              Base Delivery Fee (₹)
            </label>
            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#4A5A52]">₹</span>
              <input
                id="base-fee-input"
                type="number"
                min="0"
                step="5"
                bind:value={settings.base_delivery_fee}
                class="w-full rounded-xl border border-[#D5E2C4] bg-slate-50/50 pl-8 pr-3.5 py-2 text-sm font-bold text-[#0B1F2E] focus:border-[#2B5A16] focus:bg-white focus:outline-hidden"
              />
            </div>
            <p class="text-[11px] text-[#4A5A52] mt-1">
              Standard fee charged when cart is below the free delivery threshold.
            </p>
          </div>

          <!-- Free Delivery Threshold -->
          <div>
            <label for="free-threshold-input" class="block text-xs font-bold text-[#0B1F2E] mb-1.5">
              Free Delivery Basket Threshold (₹)
            </label>
            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#4A5A52]">₹</span>
              <input
                id="free-threshold-input"
                type="number"
                min="0"
                step="25"
                bind:value={settings.free_delivery_threshold}
                class="w-full rounded-xl border border-[#D5E2C4] bg-slate-50/50 pl-8 pr-3.5 py-2 text-sm font-bold text-[#0B1F2E] focus:border-[#2B5A16] focus:bg-white focus:outline-hidden"
              />
            </div>
            <p class="text-[11px] text-[#4A5A52] mt-1">
              Orders equal to or above this subtotal get 100% Free Morning Drop delivery.
            </p>
          </div>
        </div>
      </div>

      <!-- Section B: Promotional Discount Tactics -->
      <div class="rounded-2xl border border-[#D5E2C4] bg-white p-6 shadow-xs space-y-5">
        <div class="flex items-center justify-between border-b border-[#D5E2C4] pb-3">
          <h3 class="text-sm font-bold text-[#0B1F2E] flex items-center gap-2">
            <span>🎉</span>
            <span>Promotional Delivery Discount &amp; Coupons</span>
          </h3>

          <!-- Active Toggle Switch -->
          <label class="flex items-center gap-2.5 cursor-pointer">
            <span class="text-xs font-bold {settings.is_promotional_active ? 'text-[#2B5A16]' : 'text-slate-400'}">
              {settings.is_promotional_active ? 'Promo Active' : 'Promo Inactive'}
            </span>
            <div class="relative inline-flex items-center">
              <input
                type="checkbox"
                bind:checked={settings.is_promotional_active}
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2B5A16]"></div>
            </div>
          </label>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <!-- Discount Percentage Slider & Number -->
          <div>
            <label for="discount-pct-input" class="block text-xs font-bold text-[#0B1F2E] mb-1.5">
              Delivery Discount Percentage: <span class="text-[#2B5A16] text-sm">{settings.delivery_discount_percent}%</span>
            </label>
            <div class="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                bind:value={settings.delivery_discount_percent}
                class="w-full accent-[#2B5A16] cursor-pointer"
              />
              <input
                id="discount-pct-input"
                type="number"
                min="0"
                max="100"
                step="5"
                bind:value={settings.delivery_discount_percent}
                class="w-16 rounded-xl border border-[#D5E2C4] bg-slate-50 px-2 py-1.5 text-center text-xs font-bold text-[#0B1F2E]"
              />
            </div>
            <p class="text-[11px] text-[#4A5A52] mt-1">
              Example: Setting Base Fee to ₹100 with 70% discount charges customer ₹30.
            </p>
          </div>

          <!-- Promo Code -->
          <div>
            <label for="promo-code-input" class="block text-xs font-bold text-[#0B1F2E] mb-1.5">
              Promotional Coupon Code
            </label>
            <input
              id="promo-code-input"
              type="text"
              placeholder="e.g. SUPER70"
              bind:value={settings.promo_code}
              class="w-full uppercase font-mono tracking-wider rounded-xl border border-[#D5E2C4] bg-slate-50/50 px-3.5 py-2 text-sm font-bold text-[#0B1F2E] focus:border-[#2B5A16] focus:bg-white focus:outline-hidden"
            />
            <p class="text-[11px] text-[#4A5A52] mt-1">
              Customers can text this code on WhatsApp or apply it in web cart.
            </p>
          </div>
        </div>

        <!-- Promotional Banner Text -->
        <div>
          <label for="banner-text-input" class="block text-xs font-bold text-[#0B1F2E] mb-1.5">
            Storefront &amp; WhatsApp Announcement Banner
          </label>
          <input
            id="banner-text-input"
            type="text"
            placeholder="e.g. 70% Off Morning Delivery This Week Only!"
            bind:value={settings.promotional_banner}
            class="w-full rounded-xl border border-[#D5E2C4] bg-slate-50/50 px-3.5 py-2 text-sm text-[#0B1F2E] focus:border-[#2B5A16] focus:bg-white focus:outline-hidden"
          />
          <p class="text-[11px] text-[#4A5A52] mt-1">
            Displayed on top header and included in the bot's morning broadcast menu.
          </p>
        </div>
      </div>

    </div>

    <!-- Column 3: Live Simulator & Preview Card -->
    <div class="space-y-6">
      
      <!-- Live Calculation Card -->
      <div class="rounded-2xl border border-[#D5E2C4] bg-white p-6 shadow-xs space-y-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-[#4A5A52] flex items-center gap-1.5">
          <span>📱</span>
          <span>Live Customer Experience Simulator</span>
        </h3>

        <!-- Cart Subtotal Slider -->
        <div>
          <div class="flex items-center justify-between text-xs font-semibold text-[#0B1F2E] mb-1">
            <span>Simulate Basket Subtotal:</span>
            <span class="text-sm font-bold text-[#2B5A16]">₹{simulatedCartSubtotal}</span>
          </div>
          <input
            type="range"
            min="50"
            max="600"
            step="10"
            bind:value={simulatedCartSubtotal}
            class="w-full accent-[#2B5A16] cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-[#4A5A52]">
            <span>₹50 (Small pack)</span>
            <span>₹350 (Free Drop)</span>
            <span>₹600 (Family box)</span>
          </div>
        </div>

        <!-- Simulated WhatsApp Receipt Box -->
        <div class="rounded-xl border border-slate-200 bg-[#EFEAE2] p-4 font-mono text-[11px] space-y-2 shadow-inner">
          <div class="text-center font-bold text-[#075E54] border-b border-slate-300 pb-1">
            🍄 Only SuperFoods Basket Preview
          </div>
          
          <div class="flex justify-between text-slate-700">
            <span>Produce Subtotal:</span>
            <span class="font-bold">₹{simulatedCartSubtotal}</span>
          </div>

          <div class="flex justify-between text-slate-700">
            <span>Delivery Fee:</span>
            {#if effectivePreview.isFree}
              <span class="font-bold text-emerald-700">FREE</span>
            {:else}
              <span class="font-bold">
                {#if effectivePreview.discount > 0}
                  <span class="line-through text-slate-400 mr-1">₹{effectivePreview.original}</span>
                {/if}
                ₹{effectivePreview.fee}
              </span>
            {/if}
          </div>

          {#if effectivePreview.discount > 0}
            <div class="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-sm">
              ✨ Saved ₹{effectivePreview.discount} on delivery!
            </div>
          {/if}

          <div class="border-t border-slate-300 pt-1.5 flex justify-between font-bold text-slate-900 text-xs">
            <span>Total Payable:</span>
            <span>₹{simulatedCartSubtotal + effectivePreview.fee}</span>
          </div>

          <div class="text-[9px] text-slate-500 text-center pt-1 italic">
            Slot: Tomorrow Morning Drop (7:00 AM – 10:00 AM)
          </div>
        </div>

        <!-- Status Summary Badge -->
        <div class="rounded-xl bg-[#F7FAF2] border border-[#D5E2C4] p-3 text-xs space-y-1">
          <div class="font-bold text-[#2B5A16] flex items-center gap-1.5">
            <span>✨</span>
            <span>Policy Status:</span>
          </div>
          <p class="text-[11px] text-[#4A5A52] leading-relaxed">
            {effectivePreview.label}
          </p>
        </div>
      </div>

      <!-- Sync Info Card -->
      <div class="rounded-2xl border border-dashed border-[#2B5A16]/30 bg-[#2B5A16]/5 p-5 text-xs text-[#2B5A16] space-y-2">
        <div class="font-bold flex items-center gap-1.5">
          <span>⚡</span>
          <span>Zero Server Restarts Needed</span>
        </div>
        <p class="text-[11px] text-[#4A5A52] leading-relaxed">
          When you click <strong>Save &amp; Broadcast</strong>, values write directly to Supabase table <code>store_settings</code>. Both your Astro cart checkout and your WhatsApp Edge Function query this table on every checkout in real-time.
        </p>
      </div>

    </div>

  </div>

</div>


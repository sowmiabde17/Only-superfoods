<!--
  DesktopCartCheckout.svelte — 2-Column Wide Desktop Cart & Checkout Experience (1024px+ only)
  Hyperlocal Serviceability-First Architecture:
  Left Column: Progress Stepper + Cart Bag OR Unified [1. Delivery Details & Radar -> 2. Payment Method]
  Right Column: Sticky Live Order Summary, Coupon Code, Delivery Calculator & Dynamic Action CTA
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    getCartItems,
    getCartTotals,
    updateItemQuantity,
    removeItem,
    clearCart,
    saveOrderToHistory,
    generateOrderId,
    refreshCartPrices,
  } from '../../lib/cart.js';
  import { getProducts } from '../../lib/productsStore.js';
  import { site } from '../../data/site.js';
  import CheckoutMiniMap from '../CheckoutMiniMap.svelte';
  import { evaluateDeliveryZone } from '../../lib/geo.js';
  import {
    getAvailableDeliveryDates,
    formatSelectedDeliveryDates,
  } from '../../lib/deliveryDates.js';
  import {
    getCurrentCustomer,
    openAuthModal,
    updateCustomerProfile,
  } from '../../lib/auth.js';
  import { deductStockOnOrder, isProductAvailable, getAvailableStock } from '../../lib/inventory.js';
  import { calculateDelivery, getStoreSettings } from '../../lib/settingsStore.js';

  let step = $state('cart'); // 'cart' | 'checkout' | 'confirmed'
  let items = $state([]);
  let loggedInCustomer = $state(null);

  let couponInput = $state('');
  let appliedCoupon = $state(null);
  let couponError = $state('');
  let settingsVersion = $state(0);

  let paymentMethod = $state('razorpay'); // 'razorpay' | 'pod'
  let paymentDetails = $state(null);
  let currentOrderId = $state('');
  const razorpayKeyId =
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_RAZORPAY_KEY_ID) || '';

  let customerName = $state('');
  let customerPhone = $state('');
  let addressLine = $state('');
  let deliveryZone = $state('Kadugodi (Free / Local)');

  // Dynamic 7-day Delivery Dates Engine (users can never select today after 7 AM; next day is Tomorrow)
  let deliveryDates = $state(getAvailableDeliveryDates());
  let selectedDates = $state([deliveryDates[0]?.id || '']);

  function toggleDeliveryDate(dateId) {
    if (selectedDates.includes(dateId)) {
      if (selectedDates.length > 1) {
        selectedDates = selectedDates.filter((id) => id !== dateId);
      }
    } else {
      selectedDates = [...selectedDates, dateId];
    }
  }

  let customerLat = $state(12.9698);
  let customerLng = $state(77.7499);
  let currentZoneEval = $state(evaluateDeliveryZone(12.9698, 77.7499));

  let isFetchingLocation = $state(false);
  let locationFeedback = $state('');
  let locationError = $state('');

  let isSubmitting = $state(false);
  let formError = $state('');
  let invTick = $state(0);
  let confirmedOrder = $state(null);

  let hasSoldOutItems = $derived.by(() => {
    invTick;
    return items.some((it) => !isProductAvailable(it.productId, it.quantity));
  });

  let rawTotals = $derived(getCartTotals(items));
  let discountAmount = $derived.by(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percent') {
      return Math.round((rawTotals.totalPrice * appliedCoupon.value) / 100);
    }
    return Math.min(appliedCoupon.value, rawTotals.totalPrice);
  });

  let itemsSubtotal = $derived(Math.max(0, rawTotals.totalPrice - discountAmount));
  let dropCount = $derived(Math.max(1, selectedDates.length));
  let effectiveItemsSubtotal = $derived(itemsSubtotal * dropCount);
  let deliveryCalc = $derived.by(() => {
    settingsVersion;
    return calculateDelivery(effectiveItemsSubtotal, appliedCoupon?.code);
  });
  let deliveryFee = $derived(deliveryCalc.fee);
  let podFee = $derived(paymentMethod === 'pod' ? 10 : 0);
  let finalPayable = $derived(effectiveItemsSubtotal + deliveryFee + podFee);

  function handleCartUpdated(e) {
    items = e.detail?.items || getCartItems();
    if (items.length === 0 && step !== 'confirmed') {
      step = 'cart';
    }
  }

  function syncCustomerData() {
    loggedInCustomer = getCurrentCustomer();
    if (loggedInCustomer) {
      if (loggedInCustomer.phone && !customerPhone) customerPhone = loggedInCustomer.phone;
      if (loggedInCustomer.name && !customerName) customerName = loggedInCustomer.name;
      if (loggedInCustomer.address && !addressLine) addressLine = loggedInCustomer.address;
      if (loggedInCustomer.deliveryZone) deliveryZone = loggedInCustomer.deliveryZone;
    }
  }

  const onInv = () => invTick++;
  const onSettings = () => settingsVersion++;

  onMount(() => {
    refreshCartPrices(getProducts());
    items = getCartItems();
    syncCustomerData();
    window.addEventListener('osf:cart-updated', handleCartUpdated);
    window.addEventListener('osf:auth-changed', syncCustomerData);
    window.addEventListener('osf:inventory-updated', onInv);
    window.addEventListener('osf:settings-updated', onSettings);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:cart-updated', handleCartUpdated);
      window.removeEventListener('osf:auth-changed', syncCustomerData);
      window.removeEventListener('osf:inventory-updated', onInv);
      window.removeEventListener('osf:settings-updated', onSettings);
    }
  });

  function handleApplyCoupon() {
    couponError = '';
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const liveSettings = getStoreSettings();
    const dynamicPromo = (liveSettings?.promo_code || 'SUPER70').toUpperCase();

    if (code === dynamicPromo) {
      appliedCoupon = { code, type: 'flat', value: 30, label: 'PROMO SAVINGS' };
    } else if (code === 'FRESH10') {
      appliedCoupon = { code, type: 'percent', value: 10, label: '10% OFF' };
    } else if (code === 'SUPERFOODS' || code === 'SUPER30' || code === 'SUPER70') {
      appliedCoupon = { code, type: 'flat', value: 30, label: '₹30 OFF' };
    } else if (code === 'WELCOME') {
      appliedCoupon = { code, type: 'flat', value: 50, label: '₹50 OFF' };
    } else {
      couponError = `Invalid coupon code. Try ${dynamicPromo} or FRESH10`;
    }
  }

  function handleRemoveCoupon() {
    appliedCoupon = null;
    couponInput = '';
    couponError = '';
  }

  function handleProceedToCheckout() {
    if (items.length === 0 || hasSoldOutItems) return;
    step = 'checkout';
    formError = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleMiniMapPositionChanged(data) {
    customerLat = data.lat;
    customerLng = data.lng;
    currentZoneEval = data.zone;
    if (
      data.suggestedAddress &&
      (!addressLine.trim() || addressLine.includes('GPS') || addressLine.includes('Whitefield / Kadugodi'))
    ) {
      addressLine = data.suggestedAddress;
    }

    const areaLower = (data.suggestedAddress || '').toLowerCase();
    if (areaLower.includes('kadugodi')) deliveryZone = 'Kadugodi (Free / Local)';
    else if (areaLower.includes('whitefield')) deliveryZone = 'Whitefield Core (Free / Local)';
    else if (areaLower.includes('hoodi')) deliveryZone = 'Hoodi (Free / Local)';
    else if (areaLower.includes('seegehalli')) deliveryZone = 'Seegehalli (Free / Local)';
    else if (areaLower.includes('belthur')) deliveryZone = 'Belthur & Kumbena Agrahara (Free / Local)';
    else if (areaLower.includes('varthur')) deliveryZone = 'Varthur & Balagere (Free / Local)';
    else if (areaLower.includes('hoskote')) deliveryZone = 'Hoskote & Huskuru (Free / Local)';
    else if (areaLower.includes('tc palya') || areaLower.includes('ramamurthy')) deliveryZone = 'TC Palya & Ramamurthy Nagar (Free / Local)';
    else if (areaLower.includes('mahadevapura') || areaLower.includes('kr puram')) deliveryZone = 'Mahadevapura & KR Puram (Free / Local)';
    if (data.zone.status === 'CORE') {
      locationFeedback = 'Prime Harvest Zone (Morning Drop 7–10 AM)';
    } else if (data.zone.status === 'EXTENDED') {
      locationFeedback = `Extended 2 km Zone (~${data.zone.distanceKm} km from border) — Deliveries available!`;
    } else {
      locationFeedback = `Outside regular morning route (~${data.zone.distanceKm} km away) — WhatsApp Express Delivery`;
    }
  }

  function captureLiveLocation() {
    if (!navigator.geolocation) {
      locationError = 'Geolocation is not supported on this device.';
      return;
    }
    isFetchingLocation = true;
    locationError = '';
    locationFeedback = '';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        customerLat = latitude;
        customerLng = longitude;
        currentZoneEval = evaluateDeliveryZone(latitude, longitude);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          if (data?.address) {
            const a = data.address;
            const parts = [
              a.road || a.street || '',
              a.suburb || a.neighbourhood || a.quarter || '',
              a.city_district || a.district || '',
              `${a.city || a.town || 'Bangalore'}${a.postcode ? ` - ${a.postcode}` : ''}`,
            ].filter(Boolean);
            addressLine = parts.join(', ') || data.display_name;
            locationFeedback = currentZoneEval.status === 'CORE'
              ? 'Prime Harvest Zone detected! Adjust flat/house number if needed.'
              : currentZoneEval.status === 'EXTENDED'
                ? 'Extended Harvest Zone detected! Deliveries available.'
                : 'Outside morning route. Connect via WhatsApp for express delivery.';
          } else {
            addressLine = `Near Whitefield, Bangalore (GPS: ${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
          }
        } catch (e) {
          addressLine = 'Whitefield / Kadugodi, Bangalore';
          locationFeedback = 'Approximated to Whitefield zone.';
        } finally {
          isFetchingLocation = false;
        }
      },
      () => {
        isFetchingLocation = false;
        locationError = 'Location permission denied. Please enter your delivery address manually.';
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  }

  async function handlePlaceAndPay() {
    formError = '';
    if (!customerName.trim()) {
      formError = 'Please enter your full name.';
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      formError = 'Please enter a valid 10-digit WhatsApp phone number.';
      return;
    }
    if (!addressLine.trim()) {
      formError = 'Please enter or autofill your delivery address.';
      return;
    }
    if (currentZoneEval?.status === 'OUTSIDE') {
      formError = 'Your address is outside our regular morning route. Please connect with our team on WhatsApp for express delivery.';
      return;
    }

    for (const it of items) {
      if (!isProductAvailable(it.productId, it.quantity)) {
        formError = `Sorry, "${it.name}" is sold out or exceeds available harvest stock.`;
        return;
      }
    }

    const orderId = currentOrderId || generateOrderId();
    currentOrderId = orderId;

    const baseOrderData = {
      id: orderId,
      orderId,
      date: new Date().toISOString(),
      customer: {
        name: customerName.trim(),
        phone: cleanPhone,
        address: `${addressLine.trim()} [Zone: ${deliveryZone}]`,
        coords: [customerLat, customerLng],
        zoneStatus: currentZoneEval?.status || 'CORE',
      },
      deliveryDay: formatSelectedDeliveryDates(selectedDates, deliveryDates),
      deliveryDates: [...selectedDates],
      dropCount,
      deliverySlot: 'Morning Drop (7:00 AM – 10:00 AM)',
      paymentMethod: paymentMethod === 'razorpay' ? 'razorpay' : 'cod',
      paymentStatus: paymentMethod === 'razorpay' ? 'pending' : 'cod',
      orderStatus: 'placed',
      items: [...items],
      subtotal: rawTotals.totalPrice * dropCount,
      discount: discountAmount * dropCount,
      deliveryFee,
      total: finalPayable,
    };

    if (paymentMethod === 'pod') {
      isSubmitting = true;
      try {
        await saveOrderToHistory(baseOrderData);
        deductStockOnOrder(items);
        updateCustomerProfile({
          name: customerName.trim(),
          phone: cleanPhone,
          address: addressLine.trim(),
          deliveryZone,
        });
        confirmedOrder = baseOrderData;
        clearCart();
        step = 'confirmed';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        console.error('Order submission failed:', e);
        formError = e?.message || 'Failed to place order. Please try again.';
      } finally {
        isSubmitting = false;
      }
    } else {
      // Razorpay UPI / Online
      isSubmitting = true;
      try {
        // Phase 1: Pre-register order in Supabase before gateway modal opens
        await saveOrderToHistory(baseOrderData);
      } catch (e) {
        console.warn('Pre-registration order note:', e);
      }

      if (typeof window !== 'undefined' && window.Razorpay) {
        const activeKey = razorpayKeyId || 'rzp_test_placeholder';
        try {
          const rzp = new window.Razorpay({
            key: activeKey,
            amount: Math.round(finalPayable * 100),
            currency: 'INR',
            name: 'Only Superfoods',
            description: `Only SuperFoods Harvest #${orderId}`,
            image: '/logo.png',
            theme: { color: '#2B5A16' },
            prefill: {
              name: customerName.trim(),
              contact: cleanPhone,
            },
            notes: {
              order_number: orderId,
              source: 'desktop_checkout',
              address: addressLine.trim(),
            },
            handler: async function (resp) {
              try {
                const confirmedData = {
                  ...baseOrderData,
                  paymentId: resp.razorpay_payment_id,
                  paymentStatus: 'paid',
                  orderStatus: 'confirmed',
                };
                await saveOrderToHistory(confirmedData);
                deductStockOnOrder(items);
                updateCustomerProfile({
                  name: customerName.trim(),
                  phone: cleanPhone,
                  address: addressLine.trim(),
                  deliveryZone,
                });
                confirmedOrder = confirmedData;
                clearCart();
                step = 'confirmed';
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } catch (err) {
                console.error('Paid order finalization error:', err);
              } finally {
                isSubmitting = false;
              }
            },
            modal: {
              ondismiss: function () {
                isSubmitting = false;
                formError = 'Payment was not completed. You can try again or choose Pay on Delivery below.';
              },
            },
          });
          rzp.open();
        } catch (e) {
          console.error('Razorpay invocation error', e);
          isSubmitting = false;
          formError = 'Could not open payment gateway. Please try again or choose Pay on Delivery.';
        }
      } else {
        isSubmitting = false;
        formError = 'Payment gateway could not load. Please choose Pay on Delivery.';
      }
    }
  }

  function getWhatsAppReceiptLink() {
    if (!confirmedOrder) return site.whatsapp.link;
    const itemsSummary = confirmedOrder.items
      .map((i) => `• ${i.quantity}x ${i.name} (${i.packSize}) — ₹${i.price * i.quantity}`)
      .join('\n');
    const msg =
      `*Order Confirmation — Only Superfoods* 🌱\n\n` +
      `🧾 *Order ID:* #${confirmedOrder.orderId}\n` +
      `👤 *Customer:* ${confirmedOrder.customer.name}\n` +
      `📞 *Phone:* ${confirmedOrder.customer.phone}\n` +
      `📍 *Address:* ${confirmedOrder.customer.address}\n` +
      `🗓 *Delivery Day:* Every ${confirmedOrder.deliveryDay}\n` +
      `⏰ *Time Slot:* ${confirmedOrder.deliverySlot}\n` +
      `💳 *Payment:* ${confirmedOrder.paymentMethod}\n\n` +
      `*Harvest Items:*\n${itemsSummary}\n\n` +
      `*Total Paid/Payable:* ₹${confirmedOrder.total}\n\n` +
      `Please prepare my fresh morning harvest bag! 🍄🌿`;
    return `https://wa.me/91${site.whatsapp.number}?text=${encodeURIComponent(msg)}`;
  }
</script>

<div class="mx-auto max-w-[1200px] px-8 py-12 text-[#0B1F2E]">
  <!-- Top Breadcrumb & Step Indicator -->
  <div class="mb-8 flex items-center justify-between border-b border-[#E4E4DC] pb-5">
    <div class="flex items-center gap-4">
      <button
        type="button"
        onclick={() => {
          if (step === 'checkout') step = 'cart';
          else window.location.href = '/';
        }}
        class="inline-flex items-center gap-2 rounded-full border border-[#E4E4DC] bg-white px-4 py-2 text-xs font-bold text-[#0B1F2E] hover:border-[#2B5A16] press"
      >
        <span>←</span>
        <span>{step === 'cart' || step === 'confirmed' ? 'Continue Shopping' : 'Back to Fresh Bag'}</span>
      </button>
      <h1 class="text-3xl font-black text-[#0B1F2E]" style="font-family: 'Playfair Display', Georgia, serif;">
        {#if step === 'cart'}Your Fresh Harvest Bag ({rawTotals.totalCount})
        {:else if step === 'checkout'}Delivery Location &amp; Checkout
        {:else}Order Confirmed!{/if}
      </h1>
    </div>

    <div class="flex items-center gap-3 text-xs font-bold">
      <span class="rounded-full px-3 py-1 {step === 'cart' ? 'bg-[#143922] text-white' : 'bg-[#EBF5E4] text-[#2B5A16]'}">
        1. Fresh Bag
      </span>
      <span class="text-[#CBD5E1]">→</span>
      <span class="rounded-full px-3 py-1 {step === 'checkout' ? 'bg-[#143922] text-white' : step === 'confirmed' ? 'bg-[#EBF5E4] text-[#2B5A16]' : 'bg-[#F7F7F2] text-[#94A3B8]'}">
        2. Delivery &amp; Payment
      </span>
      <span class="text-[#CBD5E1]">→</span>
      <span class="rounded-full px-3 py-1 {step === 'confirmed' ? 'bg-[#143922] text-white' : 'bg-[#F7F7F2] text-[#94A3B8]'}">
        3. Confirmed!
      </span>
    </div>
  </div>

  {#if step === 'cart' && items.length === 0}
    <div class="mx-auto max-w-lg rounded-3xl border border-[#E4E4DC] bg-white p-14 text-center space-y-4 shadow-2xs">
      <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#FAF7F0] text-4xl">🧺</div>
      <h2 class="text-2xl font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
        Your Fresh Bag is Empty
      </h2>
      <p class="text-sm text-[#4A5A52]">
        Explore our 5:30 AM harvest of oyster mushrooms, living microgreens, kombucha, and desi eggs.
      </p>
      <a
        href="/#desktop-catalog"
        class="inline-flex items-center rounded-full bg-[#143922] px-7 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#2B5A16] transition-colors press"
      >
        Browse Morning Harvest →
      </a>
    </div>
  {:else if step === 'confirmed' && confirmedOrder}
    <div class="mx-auto max-w-2xl rounded-3xl border border-[#D4E3C5] bg-white p-10 shadow-lg space-y-6">
      <div class="text-center space-y-2">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EBF5D9] text-3xl">🌱</div>
        <h2 class="text-3xl font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
          Order Confirmed!
        </h2>
        <p class="text-sm text-[#4A5A52]">
          Order ID: <strong class="text-[#2B5A16]">#{confirmedOrder.orderId}</strong>
        </p>
      </div>

      <div class="rounded-2xl border border-[#E4E4DC] bg-[#FAF7F0] p-6 space-y-4 text-sm">
        <div class="grid grid-cols-2 gap-4 border-b border-[#E4E4DC] pb-4 text-xs text-[#4A5A52]">
          <div><strong>Recipient:</strong><br />{confirmedOrder.customer.name} ({confirmedOrder.customer.phone})</div>
          <div><strong>Delivery Date:</strong><br />{confirmedOrder.deliveryDay} • {confirmedOrder.deliverySlot}</div>
          <div class="col-span-2"><strong>Delivery Address:</strong><br />{confirmedOrder.customer.address}</div>
          <div>
            <strong>Payment:</strong>
            {confirmedOrder.paymentMethod === 'razorpay' ? 'UPI / Cards (Razorpay)' : 'Pay on Delivery (Cash / UPI)'}
          </div>
          <div><strong>Total Payable/Paid:</strong> ₹{confirmedOrder.total}</div>
        </div>

        <div class="space-y-2">
          {#each confirmedOrder.items as itm}
            <div class="flex justify-between text-xs">
              <span>{itm.quantity}× {itm.name} ({itm.packSize})</span>
              <span class="font-bold">₹{itm.price * itm.quantity}</span>
            </div>
          {/each}
        </div>
      </div>

      {#if confirmedOrder.paymentStatus === 'paid'}
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-center text-xs font-bold text-emerald-800">
          ✅ Payment Verified &amp; Confirmed via Razorpay
        </div>
      {:else if confirmedOrder.paymentMethod === 'razorpay'}
        <div class="rounded-xl border border-amber-200 bg-amber-50 py-3 text-center text-xs font-semibold text-amber-800">
          ⏳ Payment Pending — Send order to WhatsApp to complete payment
        </div>
      {/if}

      <div class="flex items-center gap-4">
        <a
          href={getWhatsAppReceiptLink()}
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#25D366] hover:bg-[#1ebd5a] py-3.5 text-sm font-bold text-white shadow-sm press"
        >
          <span>💬 Send Order to Farm WhatsApp →</span>
        </a>
        <a
          href="/"
          class="rounded-full border border-[#E4E4DC] bg-white px-6 py-3.5 text-sm font-bold text-[#4A5A52] hover:bg-[#FAF7F0]"
        >
          Done Shopping
        </a>
      </div>
    </div>
  {:else}
    <!-- 2-Column Active Checkout Workspace -->
    <div class="grid grid-cols-12 gap-10 items-start">
      <!-- Left 7 Cols: Main Step Content -->
      <div class="col-span-7 space-y-6">
        {#if step === 'cart'}
          <div class="rounded-2xl border border-[#E2F0D9] bg-[#F2F8EA] p-5 flex items-start gap-4">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-2xs">🌱</div>
            <div>
              <h3 class="text-sm font-bold text-[#2B5A16]">Harvest Guarantee</h3>
              <p class="text-xs text-[#4A5A52] leading-relaxed mt-0.5">
                Every pack is freshly picked at 5:30 AM dawn in Kadugodi for your chosen morning drop. 100% chemical-free.
              </p>
            </div>
          </div>

          <div class="space-y-3">
            {#each items as item (item.key || `${item.productId}__${item.packSize}`)}
              {@const itemKey = item.key || `${item.productId}__${item.packSize}`}
              <div class="flex items-center justify-between gap-4 rounded-2xl border border-[#E4E4DC] bg-white p-4 shadow-2xs">
                <div class="flex items-center gap-4 min-w-0">
                  <img src={item.image} alt={item.name} class="h-20 w-20 rounded-xl object-cover border border-[#E4E4DC] shrink-0" />
                  <div class="min-w-0 space-y-1">
                    <h4 class="text-base font-bold text-[#0B1F2E] truncate">{item.name}</h4>
                    <div class="text-xs text-[#4A5A52]">{item.packSize} · ₹{item.price} / pack</div>
                    <div class="text-sm font-black text-[#2B5A16]">₹{item.price * item.quantity}</div>
                  </div>
                </div>

                <div class="flex items-center gap-4 shrink-0">
                  <div class="flex items-center gap-3 rounded-full border border-[#E4E4DC] bg-[#FAF7F0] px-3 py-1.5 text-sm font-bold">
                    <button
                      type="button"
                      onclick={() => updateItemQuantity(itemKey, -1)}
                      class="hover:text-[#2B5A16]"
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onclick={() => {
                        const usedForProduct = items
                          .filter((x) => x.productId === item.productId)
                          .reduce((s, x) => s + x.quantity, 0);
                        if (usedForProduct < getAvailableStock(item.productId)) {
                          updateItemQuantity(itemKey, 1);
                        }
                      }}
                      disabled={items
                        .filter((x) => x.productId === item.productId)
                        .reduce((s, x) => s + x.quantity, 0) >=
                        getAvailableStock(item.productId)}
                      class="hover:text-[#2B5A16] disabled:opacity-35"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onclick={() => removeItem(itemKey)}
                    class="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4E4DC] text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else if step === 'checkout'}
          <!-- Unified Progressive Checkout: Step 1 (Address & Radar) -> Step 2 (Payment Method) on one page -->
          <div class="space-y-6">
            <!-- SECTION 1: Delivery Details & Radar -->
            <div class="rounded-3xl border border-[#E4E4DC] bg-white p-7 space-y-5 shadow-2xs">
              <div class="flex items-center justify-between border-b border-[#E4E4DC] pb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">📍</span>
                  <h3 class="text-base font-bold text-[#0B1F2E]">1. Delivery Details &amp; Serviceability Radar</h3>
                </div>
                <span class="text-[11px] font-bold uppercase tracking-wider text-[#2B5A16] bg-[#EBF5E4] px-3 py-1 rounded-full border border-[#A8D632]/40">
                  {currentZoneEval.badge || 'Local Harvest'}
                </span>
              </div>

              {#if !loggedInCustomer?.phone}
                <div class="flex items-center justify-between rounded-2xl border border-[#E4E4DC] bg-[#FAF7F0] p-4 text-xs">
                  <div>
                    <strong>Returning Customer?</strong> Sign in with WhatsApp to auto-fill saved address.
                  </div>
                  <button
                    type="button"
                    onclick={() => openAuthModal()}
                    class="rounded-full bg-[#2B5A16] px-4 py-1.5 font-bold text-white hover:bg-[#1f420f]"
                  >
                    Login
                  </button>
                </div>
              {/if}

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    bind:value={customerName}
                    placeholder="Enter your full name"
                    class="w-full rounded-xl border border-[#E4E4DC] bg-[#FAF7F0] px-3.5 py-2.5 text-xs outline-none focus:border-[#2B5A16] focus:bg-white"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold mb-1.5">WhatsApp Phone *</label>
                  <input
                    type="tel"
                    bind:value={customerPhone}
                    placeholder="10-digit WhatsApp number"
                    class="w-full rounded-xl border border-[#E4E4DC] bg-[#FAF7F0] px-3.5 py-2.5 text-xs outline-none focus:border-[#2B5A16] focus:bg-white"
                  />
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold">Pin Exact Doorstep &amp; Address *</label>
                  <button
                    type="button"
                    onclick={captureLiveLocation}
                    disabled={isFetchingLocation}
                    class="rounded-full bg-[#EBF5D9] px-3 py-1 text-[11px] font-bold text-[#2B5A16] hover:bg-[#dcecb9] transition-colors"
                  >
                    {isFetchingLocation ? 'Detecting GPS...' : '📍 Auto-Fill via GPS'}
                  </button>
                </div>
                <CheckoutMiniMap lat={customerLat} lng={customerLng} onPositionChanged={handleMiniMapPositionChanged} />
                {#if locationFeedback}<p class="text-[11px] font-semibold text-[#2B5A16]">✓ {locationFeedback}</p>{/if}
                {#if locationError}<p class="text-[11px] font-semibold text-amber-700">⚠️ {locationError}</p>{/if}

                <textarea
                  rows="2"
                  bind:value={addressLine}
                  placeholder="Flat No, Building / Society Name, Street, Landmark"
                  class="w-full rounded-xl border border-[#E4E4DC] bg-[#FAF7F0] px-3.5 py-2.5 text-xs outline-none focus:border-[#2B5A16] focus:bg-white"
                ></textarea>
              </div>

              <!-- Real-time Serviceability Status Box -->
              {#if currentZoneEval.status === 'CORE'}
                <div class="rounded-2xl border border-[#A8D632] bg-[#F2F8EA] p-4 flex items-start gap-3">
                  <span class="text-xl">✅</span>
                  <div>
                    <h4 class="text-xs font-bold text-[#2B5A16]">Prime Harvest Zone: Kadugodi, Whitefield &amp; East Bengaluru</h4>
                    <p class="text-[11px] text-[#4A5A52] mt-0.5">
                      Your kitchen is on our dawn harvest route! Picked fresh at 5:30 AM, delivered 7:00 AM – 10:00 AM.
                    </p>
                  </div>
                </div>
              {:else if currentZoneEval.status === 'EXTENDED'}
                <div class="rounded-2xl border border-lime-300 bg-lime-50/70 p-4 flex items-start gap-3">
                  <span class="text-xl">📍</span>
                  <div>
                    <h4 class="text-xs font-bold text-lime-900">Extended Harvest Zone (~{currentZoneEval.distanceKm} km from route)</h4>
                    <p class="text-[11px] text-lime-800 mt-0.5">
                      Deliveries available! You are within our morning extended harvest buffer.
                    </p>
                  </div>
                </div>
              {:else}
                <!-- OUTSIDE ZONE NOTICE & WHATSAPP CONCIERGE -->
                <div class="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 space-y-3">
                  <div class="flex items-start gap-3">
                    <span class="text-2xl shrink-0">🌾</span>
                    <div class="space-y-1">
                      <h4 class="text-xs font-bold text-amber-900">
                        Sorry, you are outside our direct morning delivery zone (~{currentZoneEval.distanceKm} km away)
                      </h4>
                      <p class="text-[11px] leading-relaxed text-amber-800">
                        Our growers harvest daily at 5:30 AM dawn in Kadugodi. To guarantee peak mushroom texture and living microgreen freshness, our morning direct vans operate within Whitefield &amp; East Bengaluru.
                      </p>
                    </div>
                  </div>

                  <div class="border-t border-amber-200/80 pt-3">
                    <p class="text-xs font-medium text-amber-950 mb-2">
                      Connect with the <strong>Only Superfoods</strong> team for express (Porter, Rapido, etc.) delivery within Bangalore:
                    </p>
                    <a
                      href="https://wa.me/917760350360?text={encodeURIComponent(
                        `Hi Only Superfoods! I am located at ${addressLine.trim() || 'my address'} (outside the regular morning route) and would like to arrange an express delivery via Porter/Rapido for fresh superfoods.`
                      )}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[#25D366] hover:bg-[#1ebd5a] px-4 py-3 text-xs font-bold text-white shadow-xs press transition-colors"
                    >
                      <span>💬 Connect with Team for Express Delivery (WhatsApp: 7760350360) →</span>
                    </a>

                    <div class="mt-2.5 text-center">
                      <a
                        href="/#desktop-delivery"
                        class="inline-flex items-center gap-1 text-xs font-semibold text-[#2B5A16] hover:underline"
                      >
                        <span>🗺️</span> View our serviceable morning delivery zones on map →
                      </a>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Preferred Delivery Date Selector (7-Day horizon, "Tomorrow" label, Multi-Select) -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-xs font-bold text-[#0B1F2E]">
                    <span>🗓</span> Preferred Delivery Date *
                  </label>
                  <span class="text-[11px] text-[#4A5A52] font-medium">
                    Multi-select available
                  </span>
                </div>

                <div class="grid grid-cols-7 gap-2">
                  {#each deliveryDates as d}
                    {@const isSelected = selectedDates.includes(d.id)}
                    <button
                      type="button"
                      onclick={() => toggleDeliveryDate(d.id)}
                      class={`flex flex-col items-center justify-center rounded-xl py-2.5 px-2 text-center transition-all press ${
                        isSelected
                          ? 'border-2 border-[#2B5A16] bg-[#2B5A16] text-white shadow-xs font-bold'
                          : 'border border-[#E4E4DC] bg-[#FAF7F0] text-[#4A5A52] hover:border-[#A8D632] font-medium'
                      }`}
                    >
                      <span class="text-xs font-bold leading-tight flex items-center gap-1">
                        {#if isSelected}<span>✓</span>{/if}
                        {d.displayLabel}
                      </span>
                      <span class="text-[10px] opacity-80 mt-0.5 whitespace-nowrap">{d.subLabel}</span>
                    </button>
                  {/each}
                </div>

                {#if selectedDates.length > 1}
                  <div class="mt-2.5 flex items-center justify-between rounded-xl bg-[#EBF5D9] px-3.5 py-2 border border-[#A8D632]/50 text-xs text-[#2B5A16]">
                    <span class="font-bold flex items-center gap-1.5">
                      <span>🧺</span> {selectedDates.length} Morning Drops Selected
                    </span>
                    <span class="text-[11px] font-semibold text-[#2B5A16]/80">
                      Cart items multiplied by {selectedDates.length} drops
                    </span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- SECTION 2: Payment Method (Below Address on the same page) -->
            <div class="rounded-3xl border border-[#E4E4DC] bg-white p-7 space-y-4 shadow-2xs">
              <div class="flex items-center gap-2 border-b border-[#E4E4DC] pb-3">
                <span class="text-lg">💳</span>
                <h3 class="text-base font-bold text-[#0B1F2E]">2. Choose a Payment Method</h3>
              </div>

              {#if currentZoneEval.status === 'OUTSIDE'}
                <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                  🔒 Online payment is locked because your address is outside our morning van route. Please use the WhatsApp button above to coordinate express delivery via Porter or Rapido.
                </div>
              {:else}
                <div class="space-y-3">
                  <!-- Razorpay UPI / Cards -->
                  <button
                    type="button"
                    onclick={() => (paymentMethod = 'razorpay')}
                    class="w-full rounded-2xl border p-5 text-left transition-all press {paymentMethod === 'razorpay'
                      ? 'border-[#2B5A16] bg-[#F2F8EA]/60 ring-1 ring-[#2B5A16]'
                      : 'border-[#E4E4DC] bg-white hover:border-[#A8D632]'}"
                  >
                    <div class="flex items-start justify-between">
                      <div class="space-y-1">
                        <span class="inline-block rounded-full bg-[#FF6B35] px-2.5 py-0.5 text-[9.5px] font-bold text-white uppercase">
                          Recommended • Zero Fee
                        </span>
                        <div class="text-base font-bold text-[#0B1F2E]">UPI / Cards (Razorpay Instant Auto-Confirm)</div>
                        <p class="text-xs text-[#4A5A52]">Fast &amp; secure via GPay, PhonePe, Paytm, Visa, or Mastercard.</p>
                      </div>
                      <div class="h-5 w-5 rounded-full border flex items-center justify-center {paymentMethod === 'razorpay' ? 'border-[#2B5A16] bg-[#2B5A16]' : 'border-[#CBD5E1]'}">
                        {#if paymentMethod === 'razorpay'}<div class="h-2 w-2 rounded-full bg-white"></div>{/if}
                      </div>
                    </div>
                  </button>

                  <!-- Pay on Delivery -->
                  <button
                    type="button"
                    onclick={() => (paymentMethod = 'pod')}
                    class="w-full rounded-2xl border p-5 text-left transition-all press {paymentMethod === 'pod'
                      ? 'border-[#2B5A16] bg-[#F2F8EA]/60 ring-1 ring-[#2B5A16]'
                      : 'border-[#E4E4DC] bg-white hover:border-[#A8D632]'}"
                  >
                    <div class="flex items-start justify-between">
                      <div class="space-y-1">
                        <div class="flex items-center gap-2">
                          <span class="text-base font-bold text-[#0B1F2E]">Pay on Delivery (UPI / Cash)</span>
                          <span class="rounded-full bg-[#FFEDD5] px-2 py-0.5 text-[10px] font-bold text-[#C2410C]">+ ₹10</span>
                        </div>
                        <p class="text-xs text-[#4A5A52]">₹10 convenience fee applies to support doorstep collections.</p>
                      </div>
                      <div class="h-5 w-5 rounded-full border flex items-center justify-center {paymentMethod === 'pod' ? 'border-[#2B5A16] bg-[#2B5A16]' : 'border-[#CBD5E1]'}">
                        {#if paymentMethod === 'pod'}<div class="h-2 w-2 rounded-full bg-white"></div>{/if}
                      </div>
                    </div>
                  </button>
                </div>
              {/if}

              {#if formError}
                <div class="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
                  {formError}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Right 5 Cols: Sticky Order Summary & Primary Action -->
      <div class="col-span-5 sticky top-24">
        <div class="rounded-3xl border border-[#E4E4DC] bg-white p-7 shadow-lg space-y-5">
          <h2 class="text-xl font-bold text-[#0B1F2E] border-b border-[#E4E4DC] pb-3" style="font-family: 'Playfair Display', serif;">
            Order Summary
          </h2>

          <!-- Promo Code -->
          <div class="space-y-2">
            {#if appliedCoupon}
              <div class="flex items-center justify-between rounded-xl border border-[#A8D632] bg-[#F2F8EA] px-3.5 py-2 text-xs">
                <span class="font-bold text-[#2B5A16]">🎟️ {appliedCoupon.code} (−₹{discountAmount})</span>
                <button type="button" onclick={handleRemoveCoupon} class="font-bold text-red-600">Remove</button>
              </div>
            {:else}
              <div class="flex gap-2">
                <input
                  type="text"
                  bind:value={couponInput}
                  placeholder="Promo code (e.g. FRESH10)"
                  class="flex-1 rounded-xl border border-[#E4E4DC] bg-[#FAF7F0] px-3 py-2 text-xs outline-none focus:border-[#2B5A16]"
                />
                <button
                  type="button"
                  onclick={handleApplyCoupon}
                  class="rounded-xl bg-[#143922] px-4 py-2 text-xs font-bold text-white hover:bg-[#2B5A16]"
                >
                  Apply
                </button>
              </div>
              {#if couponError}<p class="text-[11px] text-red-600 font-semibold">{couponError}</p>{/if}
            {/if}
          </div>

          <!-- Totals -->
          <div class="space-y-2.5 border-t border-[#E4E4DC] pt-4 text-xs">
            <div class="flex justify-between text-[#4A5A52]">
              <span>Items Subtotal ({rawTotals.totalCount} items{#if selectedDates.length > 1} × {selectedDates.length} drops{/if})</span>
              <span class="font-bold text-[#0B1F2E]">₹{effectiveItemsSubtotal}</span>
            </div>
            {#if appliedCoupon}
              <div class="flex justify-between font-semibold text-[#2B5A16]">
                <span>Promo Discount ({appliedCoupon.code})</span>
                <span>−₹{discountAmount * dropCount}</span>
              </div>
            {/if}
            <div class="flex justify-between text-[#4A5A52]">
              <span>Dawn Delivery</span>
              <div class="flex items-center gap-1">
                {#if deliveryCalc.isFree}
                  {#if deliveryCalc.originalFee > 0}
                    <span class="line-through text-[#9CA3AF]">₹{deliveryCalc.originalFee}</span>
                  {/if}
                  <span class="font-bold text-[#2B5A16]">FREE</span>
                {:else if deliveryCalc.discountAmount > 0}
                  {#if deliveryCalc.originalFee > 0}
                    <span class="line-through text-[#9CA3AF]">₹{deliveryCalc.originalFee}</span>
                  {/if}
                  <span class="font-bold text-[#2B5A16]">₹{deliveryCalc.fee}</span>
                {:else}
                  <span class="font-bold text-[#0B1F2E]">₹{deliveryCalc.fee}</span>
                {/if}
              </div>
            </div>
            {#if paymentMethod === 'pod' && currentZoneEval.status !== 'OUTSIDE'}
              <div class="flex justify-between text-[#C2410C]">
                <span>Pay on Delivery Fee</span>
                <span>+₹10</span>
              </div>
            {/if}
            <div class="flex items-baseline justify-between border-t border-[#E4E4DC] pt-3">
              <span class="text-sm font-bold text-[#0B1F2E]">Total Payable</span>
              <span class="text-2xl font-black text-[#143922]">₹{finalPayable}</span>
            </div>
          </div>

          <!-- Step-Specific Primary Action CTA -->
          {#if step === 'cart'}
            <button
              type="button"
              onclick={handleProceedToCheckout}
              disabled={hasSoldOutItems}
              class="w-full rounded-full bg-[#143922] hover:bg-[#2B5A16] disabled:bg-slate-300 py-4 text-sm font-bold text-white shadow-md transition-all press"
            >
              {hasSoldOutItems ? 'Remove Sold-Out Item(s) to Proceed' : 'Proceed to Delivery & Checkout →'}
            </button>
          {:else if step === 'checkout'}
            {#if currentZoneEval.status === 'OUTSIDE'}
              <div class="space-y-2">
                <a
                  href="https://wa.me/917760350360?text={encodeURIComponent(
                    `Hi Only Superfoods! I am located at ${addressLine.trim() || 'my address'} (outside the regular morning route) and would like to arrange an express delivery via Porter/Rapido for fresh superfoods.`
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="w-full flex items-center justify-center gap-2 rounded-full bg-[#25D366] hover:bg-[#1ebd5a] py-4 text-sm font-bold text-white shadow-md transition-all press"
                >
                  <span>💬 Connect with Team for Express Delivery →</span>
                </a>
                <p class="text-center text-[10.5px] text-amber-700 font-medium leading-snug">
                  Online payment disabled outside East Bengaluru route. Deliveries fulfilled via Porter/Rapido.
                </p>
              </div>
            {:else if paymentMethod === 'razorpay'}
              <button
                type="button"
                onclick={handlePlaceAndPay}
                disabled={isSubmitting}
                class="w-full rounded-full bg-[#143922] hover:bg-[#2B5A16] disabled:bg-slate-300 py-4 text-sm font-bold text-white shadow-md transition-all press"
              >
                {isSubmitting ? 'Securing Morning Slot...' : `Pay ₹${finalPayable} via UPI & Confirm ${selectedDates.length > 1 ? `${selectedDates.length} Drops` : 'Drop'} →`}
              </button>
            {:else if paymentMethod === 'pod'}
              <button
                type="button"
                onclick={handlePlaceAndPay}
                disabled={isSubmitting}
                class="w-full rounded-full bg-[#143922] hover:bg-[#2B5A16] disabled:bg-slate-300 py-4 text-sm font-bold text-white shadow-md transition-all press"
              >
                {isSubmitting ? 'Placing Order...' : `Place Order (Pay ₹${finalPayable} on Delivery) →`}
              </button>
            {/if}
          {/if}

          <div class="flex items-center justify-around border-t border-[#E4E4DC] pt-3 text-[11px] text-[#4A5A52]">
            <span>🌱 5:30 AM Pick</span>
            <span>🚚 7–10 AM Drop</span>
            <span>🔒 Razorpay Safe</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

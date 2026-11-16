<!--
  SubscriptionPicker.svelte — Self-Serve Multi-Day Harvest Subscription Engine (Mobile & Tablet)
  Features:
  - Step 1: Frequency Selector (1x, 2x, 3x, 4x per week) with Mon-Sat day selection
  - Step 2: Plan Duration Selector (Monthly 4 Wks [5% OFF], Quarterly 12 Wks [10% OFF], Flexible Rolling)
  - Step 3: Freedom to choose DIFFERENT produce on DIFFERENT days with day tabs & 1-click "Copy to other days"
  - Step 4: Doorstep Address with Live GPS auto-detect, CheckoutMiniMap radar & geofence verification
  - Step 5: Payment (Razorpay UPI/Cards or Pay on Delivery for 1st drop)
  - Step 6: Confirmed Routine Success Screen with 1-click link to "My Subscriptions"
  Svelte 5 runes mode.
-->
<script>
  import { onMount } from 'svelte';
  import { getProducts } from '../lib/productsStore.js';
  import {
    DAYS_OF_WEEK,
    PLAN_DURATIONS,
    calculateSubscriptionTotals,
    generateSubscriptionId,
    saveSubscriptionRecord,
    getNextDropDate,
    copyBasketToOtherDays,
  } from '../lib/subscriptionStore.js';
  import {
    getCurrentCustomer,
    updateCustomerProfile,
  } from '../lib/auth.js';
  import { saveOrderToHistory } from '../lib/cart.js';
  import { evaluateDeliveryZone } from '../lib/geo.js';
  import CheckoutMiniMap from './CheckoutMiniMap.svelte';

  /* ── Core State ─────────────────────────────────────────── */
  let currentProducts = $state(getProducts());
  let frequency = $state('1x'); // '1x' | '2x' | '3x' | '4x'
  let selectedDays = $state(['Monday']);
  let planDuration = $state('monthly'); // 'monthly' | 'quarterly' | 'rolling'

  // Day Baskets: { [day]: Array<{ productId, name, packSize, price, quantity, image }> }
  let dayBaskets = $state({});
  let activeCustomizingDay = $state('Monday');

  // Customer & Delivery Address State
  let customerName = $state('');
  let customerPhone = $state('');
  let addressLine = $state('');
  let deliveryZone = $state('Kadugodi & Whitefield');
  let customerLat = $state(12.9698);
  let customerLng = $state(77.7499);
  let showMiniMap = $state(false);
  let isLocating = $state(false);
  let locationFeedback = $state('');

  // Payment & Submission State
  let paymentMethod = $state('online'); // 'online' | 'pod'
  let isSubmitting = $state(false);
  let formError = $state('');
  let confirmedSubscription = $state(null);

  const razorpayKeyId =
    (typeof import.meta !== 'undefined' &&
      import.meta.env?.PUBLIC_RAZORPAY_KEY_ID) ||
    '';

  /* ── Initialize Starter Produce Basket ─────────────────── */
  function initStarterBasket() {
    const starterProd = currentProducts[0] || {
      id: 'grey-oyster',
      name: 'Grey Oyster Mushrooms',
      unit: '250 g',
      price: 100,
      image: '/images/product-grey-oyster.jpg',
    };
    const initialItem = {
      productId: starterProd.id,
      name: starterProd.name,
      packSize: starterProd.unit || '250 g',
      price: starterProd.price || 100,
      quantity: 1,
      image: starterProd.image || '/images/product-grey-oyster.jpg',
    };

    const newBaskets = {};
    DAYS_OF_WEEK.forEach((d) => {
      newBaskets[d.id] = [{ ...initialItem }];
    });
    dayBaskets = newBaskets;
  }

  onMount(() => {
    currentProducts = getProducts();
    initStarterBasket();

    // Autofill from customer session if available
    const existing = getCurrentCustomer();
    if (existing) {
      if (existing.name) customerName = existing.name;
      if (existing.phone) customerPhone = existing.phone;
      if (existing.address) addressLine = existing.address;
      if (existing.deliveryZone) deliveryZone = existing.deliveryZone;
    }

    const onProducts = (e) => {
      currentProducts = e.detail?.products || getProducts();
    };
    window.addEventListener('osf:products-updated', onProducts);
    return () => {
      window.removeEventListener('osf:products-updated', onProducts);
    };
  });

  /* ── Frequency & Day Selection Logic ────────────────────── */
  const targetDayCount = $derived(
    frequency === '4x' ? 4 : frequency === '3x' ? 3 : frequency === '2x' ? 2 : 1
  );

  function setFrequency(nextFreq) {
    frequency = nextFreq;
    const target = nextFreq === '4x' ? 4 : nextFreq === '3x' ? 3 : nextFreq === '2x' ? 2 : 1;
    const defaultPairs = ['Monday', 'Thursday', 'Tuesday', 'Friday'];

    if (selectedDays.length < target) {
      const needed = defaultPairs.filter((d) => !selectedDays.includes(d));
      selectedDays = [...selectedDays, ...needed.slice(0, target - selectedDays.length)];
    } else if (selectedDays.length > target) {
      selectedDays = selectedDays.slice(0, target);
    }

    if (!selectedDays.includes(activeCustomizingDay)) {
      activeCustomizingDay = selectedDays[0] || 'Monday';
    }
  }

  function toggleDay(dayId) {
    if (targetDayCount === 1) {
      selectedDays = [dayId];
      activeCustomizingDay = dayId;
      return;
    }

    if (selectedDays.includes(dayId)) {
      if (selectedDays.length > 1) {
        selectedDays = selectedDays.filter((d) => d !== dayId);
        if (activeCustomizingDay === dayId) {
          activeCustomizingDay = selectedDays[0];
        }
      }
      return;
    }

    if (selectedDays.length < targetDayCount) {
      selectedDays = [...selectedDays, dayId];
      activeCustomizingDay = dayId;
    } else {
      // Rotate out oldest
      const updated = [...selectedDays.slice(1), dayId];
      selectedDays = updated;
      activeCustomizingDay = dayId;
    }
  }

  /* ── Produce Customization for Active Day ───────────────── */
  function isProductInActiveBasket(productId) {
    const items = dayBaskets[activeCustomizingDay] || [];
    return items.some((i) => i.productId === productId);
  }

  function getActiveBasketItem(productId) {
    const items = dayBaskets[activeCustomizingDay] || [];
    return items.find((i) => i.productId === productId);
  }

  function toggleProductInActiveDay(product) {
    const currentItems = [...(dayBaskets[activeCustomizingDay] || [])];
    const existingIndex = currentItems.findIndex((i) => i.productId === product.id);

    if (existingIndex >= 0) {
      // Only remove if more than 1 item remains in this day's basket
      if (currentItems.length > 1) {
        currentItems.splice(existingIndex, 1);
        dayBaskets = { ...dayBaskets, [activeCustomizingDay]: currentItems };
      }
    } else {
      const defaultPack = product.packSizes?.[0] || { size: product.unit || '250 g', price: product.price };
      currentItems.push({
        productId: product.id,
        name: product.name,
        packSize: defaultPack.size,
        price: defaultPack.price,
        quantity: 1,
        image: product.image,
      });
      dayBaskets = { ...dayBaskets, [activeCustomizingDay]: currentItems };
    }
  }

  function setPackForProduct(productId, packSize, price) {
    const currentItems = [...(dayBaskets[activeCustomizingDay] || [])];
    const target = currentItems.find((i) => i.productId === productId);
    if (target) {
      target.packSize = packSize;
      target.price = price;
      dayBaskets = { ...dayBaskets, [activeCustomizingDay]: currentItems };
    }
  }

  function updateQtyForProduct(productId, delta) {
    const currentItems = [...(dayBaskets[activeCustomizingDay] || [])];
    const target = currentItems.find((i) => i.productId === productId);
    if (target) {
      const nextQty = (target.quantity || 1) + delta;
      if (nextQty <= 0) {
        if (currentItems.length > 1) {
          dayBaskets = {
            ...dayBaskets,
            [activeCustomizingDay]: currentItems.filter((i) => i.productId !== productId),
          };
        }
      } else {
        target.quantity = nextQty;
        dayBaskets = { ...dayBaskets, [activeCustomizingDay]: currentItems };
      }
    }
  }

  function handleCopyCurrentBasketToAllDays() {
    dayBaskets = copyBasketToOtherDays(activeCustomizingDay, selectedDays, dayBaskets);
    locationFeedback = `Copied ${activeCustomizingDay}'s harvest box to all selected days! ⚡`;
    setTimeout(() => { locationFeedback = ''; }, 3000);
  }

  /* ── Calculations & Geofencing ──────────────────────────── */
  let totals = $derived(calculateSubscriptionTotals(dayBaskets, selectedDays, planDuration));
  let planInfo = $derived(PLAN_DURATIONS[planDuration] || PLAN_DURATIONS.monthly);
  let nextDropString = $derived(getNextDropDate(selectedDays));
  let zoneEval = $derived(evaluateDeliveryZone(customerLat, customerLng));
  let isOutOfZone = $derived(zoneEval.status === 'OUT_OF_BOUNDS');

  /* ── Live Geolocation Auto-Detect ───────────────────────── */
  async function useLiveLocation() {
    if (!navigator.geolocation) {
      locationFeedback = 'Geolocation is not supported by your browser.';
      return;
    }
    isLocating = true;
    locationFeedback = 'Detecting exact harvest delivery coordinates...';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          customerLat = latitude;
          customerLng = longitude;
          const currentZoneEval = evaluateDeliveryZone(latitude, longitude);

          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await res.json();
          if (data && data.address) {
            const a = data.address;
            const road = a.road || a.street || a.pedestrian || '';
            const suburb = a.suburb || a.neighbourhood || a.quarter || '';
            const cityDistrict = a.city_district || a.district || '';
            const city = a.city || a.town || 'Bangalore';
            const postcode = a.postcode ? ` - ${a.postcode}` : '';

            const parts = [road, suburb, cityDistrict, `${city}${postcode}`].filter(Boolean);
            addressLine = parts.join(', ') || data.display_name || '';

            const fullStr = (road + ' ' + suburb + ' ' + (data.display_name || '')).toLowerCase();
            if (fullStr.includes('kadugodi')) deliveryZone = 'Kadugodi & Whitefield';
            else if (fullStr.includes('whitefield')) deliveryZone = 'Whitefield Core';
            else if (fullStr.includes('hoodi')) deliveryZone = 'Hoodi & ITPL';
            else deliveryZone = currentZoneEval.label || 'Whitefield & East Bengaluru';

            locationFeedback = currentZoneEval.status === 'CORE'
              ? '✓ Prime Harvest Zone verified! 5:30 AM harvest, 7-10 AM drop.'
              : currentZoneEval.status === 'EXTENDED'
                ? '✓ Extended Harvest Zone verified! Morning drop scheduled.'
                : 'Outside direct morning route. Connect with us for express delivery.';
          } else {
            addressLine = `Near Whitefield, Bangalore (GPS: ${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
            locationFeedback = '✓ Location coordinates captured!';
          }
        } catch (err) {
          console.warn('Geocoding error:', err);
          locationFeedback = 'Coordinates captured! Please complete flat/door number below.';
        } finally {
          isLocating = false;
        }
      },
      (err) => {
        console.warn('Geolocation failed:', err);
        isLocating = false;
        locationFeedback = 'Could not access location. Please enter address manually below.';
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function handleMapPositionChanged(pos) {
    if (pos.lat && pos.lng) {
      customerLat = pos.lat;
      customerLng = pos.lng;
      if (pos.address) {
        addressLine = pos.address;
      }
      if (pos.zone?.label) {
        deliveryZone = pos.zone.label;
      }
    }
  }

  /* ── Confirm & Place Subscription Order ─────────────────── */
  async function handleConfirmSubscription() {
    formError = '';

    if (!customerName.trim()) {
      formError = 'Please enter your full name for morning delivery.';
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      formError = 'Please enter a valid 10-digit WhatsApp number.';
      return;
    }
    if (!addressLine.trim() || addressLine.trim().length < 6) {
      formError = 'Please enter your complete doorstep delivery address.';
      return;
    }

    const subId = generateSubscriptionId();
    const subRecord = {
      id: subId,
      planDuration,
      planName: planInfo.name,
      weeks: planInfo.weeks,
      discountPercent: totals.discountPercent,
      frequency,
      selectedDays: [...selectedDays],
      dayBaskets,
      weeklyBaseTotal: totals.weeklyBaseTotal,
      totalDrops: totals.totalDrops,
      totalBasePrice: totals.totalBasePrice,
      discountAmount: totals.discountAmount,
      deliverySavings: totals.deliverySavings,
      finalPayable: totals.finalPayable,
      customerName: customerName.trim(),
      customerPhone: cleanPhone,
      deliveryAddress: addressLine.trim(),
      deliveryZone,
      paymentMethod,
      paymentStatus: paymentMethod === 'online' ? 'paid' : 'pending',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    // Flatten items for initial drop reservation
    const flattenedItems = [];
    selectedDays.forEach((day) => {
      (dayBaskets[day] || []).forEach((item) => {
        flattenedItems.push({
          id: item.productId,
          name: `${item.name} (${day} Drop)`,
          packSize: item.packSize,
          price: item.price,
          quantity: item.quantity,
        });
      });
    });

    const orderData = {
      order_number: subId,
      channel: 'subscription',
      customer_phone: cleanPhone,
      customer_name: customerName.trim(),
      items: flattenedItems,
      subtotal: totals.weeklyBaseTotal,
      delivery_fee: 0,
      total_amount: totals.finalPayable,
      delivery_address: addressLine.trim(),
      delivery_slot: 'Morning Drop (7:00 AM – 10:00 AM)',
      payment_method: paymentMethod === 'online' ? 'razorpay' : 'cod',
      payment_status: paymentMethod === 'online' ? 'paid' : 'pending',
      order_status: 'confirmed',
      notes: `Recurring Harvest Routine: ${planInfo.name} (${selectedDays.join(', ')})`,
      deliveryDay: nextDropString,
      created_at: new Date().toISOString(),
    };

    if (paymentMethod === 'pod') {
      isSubmitting = true;
      try {
        saveSubscriptionRecord(subRecord);
        await saveOrderToHistory(orderData);
        updateCustomerProfile({
          name: customerName.trim(),
          phone: cleanPhone,
          address: addressLine.trim(),
          deliveryZone,
        });
        confirmedSubscription = subRecord;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error('POD subscription creation error:', err);
        // Fallback: save locally
        saveSubscriptionRecord(subRecord);
        confirmedSubscription = subRecord;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } finally {
        isSubmitting = false;
      }
    } else {
      // Razorpay Online Payment Flow
      if (typeof window !== 'undefined' && window.Razorpay) {
        isSubmitting = true;
        const activeKey = razorpayKeyId || 'rzp_test_placeholder';
        try {
          const options = {
            key: activeKey,
            amount: Math.round(totals.finalPayable * 100),
            currency: 'INR',
            name: 'Only Superfoods',
            description: `Harvest Subscription #${subId} (${planInfo.name})`,
            image: '/logo.png',
            theme: { color: '#2B5A16' },
            prefill: {
              name: customerName.trim(),
              contact: cleanPhone,
            },
            notes: {
              subscription_id: subId,
              source: 'web_subscription',
              days: selectedDays.join(','),
            },
            handler: async function (resp) {
              try {
                const paidSubRecord = {
                  ...subRecord,
                  paymentId: resp.razorpay_payment_id,
                  paymentStatus: 'paid',
                };
                const paidOrderData = {
                  ...orderData,
                  payment_id: resp.razorpay_payment_id,
                  payment_status: 'paid',
                };
                saveSubscriptionRecord(paidSubRecord);
                await saveOrderToHistory(paidOrderData);
                updateCustomerProfile({
                  name: customerName.trim(),
                  phone: cleanPhone,
                  address: addressLine.trim(),
                  deliveryZone,
                });
                confirmedSubscription = paidSubRecord;
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } catch (e) {
                console.error('Finalizing paid subscription error:', e);
                saveSubscriptionRecord(subRecord);
                confirmedSubscription = subRecord;
                window.scrollTo({ top: 0, behavior: 'smooth' });
              } finally {
                isSubmitting = false;
              }
            },
            modal: {
              ondismiss: function () {
                isSubmitting = false;
                formError = 'Payment was cancelled. You can choose Pay on Delivery below if you prefer.';
              },
            },
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        } catch (e) {
          console.error('Razorpay invocation error:', e);
          isSubmitting = false;
          formError = 'Could not launch payment gateway. Please choose Pay on Delivery.';
        }
      } else {
        // Fallback if Razorpay script not yet available: activate as POD
        isSubmitting = true;
        subRecord.paymentMethod = 'pod';
        orderData.payment_method = 'cod';
        saveSubscriptionRecord(subRecord);
        await saveOrderToHistory(orderData);
        confirmedSubscription = subRecord;
        isSubmitting = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  function openMySubscriptions() {
    window.dispatchEvent(new CustomEvent('osf:open-my-orders', { detail: { tab: 'subscriptions' } }));
  }
</script>

<section id="subscribe" data-section="subscribe" class="w-full bg-white px-4 pt-6 pb-12">
  <div class="mx-auto max-w-[480px]">

    {#if confirmedSubscription}
      <!-- ═══ CONFIRMATION SCREEN ═══ -->
      <div class="rounded-3xl border border-[#A8D632] bg-[#FAFBF7] p-6 text-center shadow-lg animate-in fade-in">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EBF7DC] text-[#2B5A16] text-3xl shadow-xs">
          ✓
        </div>
        <span class="mt-4 inline-block rounded-full bg-[#2B5A16] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Routine Activated
        </span>
        <h2 class="mt-2 text-2xl font-black text-[#0B1F2E]" style="font-family: 'Playfair Display', Georgia, serif;">
          Harvest Scheduled!
        </h2>
        <p class="mt-1 text-xs text-[#4A5A52]">
          Subscription <span class="font-mono font-bold text-[#0B1F2E]">#{confirmedSubscription.id}</span> is now active.
        </p>

        <!-- Next Drop Banner -->
        <div class="mt-5 rounded-2xl bg-white border border-[#E4E4DC] p-4 text-left shadow-2xs space-y-2">
          <div class="flex items-center justify-between text-xs text-[#0B1F2E]">
            <span class="font-bold flex items-center gap-1.5">
              <span>🚚</span> First Morning Drop:
            </span>
            <span class="font-extrabold text-[#2B5A16]">
              {nextDropString}
            </span>
          </div>
          <div class="text-[11px] text-[#4A5A52] flex items-center justify-between">
            <span>Harvest Days:</span>
            <span class="font-bold text-[#0B1F2E]">Every {confirmedSubscription.selectedDays.join(' & ')}</span>
          </div>
          <div class="text-[11px] text-[#4A5A52] flex items-center justify-between">
            <span>Delivery Time:</span>
            <span class="font-bold text-[#0B1F2E]">7:00 AM – 10:00 AM (Dawn Harvest)</span>
          </div>
          <div class="text-[11px] text-[#4A5A52] flex items-center justify-between border-t border-[#F0F0EA] pt-2">
            <span>Plan Duration:</span>
            <span class="font-semibold text-[#0B1F2E]">{confirmedSubscription.planName} ({confirmedSubscription.weeks} wks)</span>
          </div>
          <div class="text-[11px] text-[#4A5A52] flex items-center justify-between">
            <span>Total Payable:</span>
            <span class="font-black text-sm text-[#2B5A16]">₹{confirmedSubscription.finalPayable}</span>
          </div>
        </div>

        <!-- Buttons -->
        <div class="mt-6 space-y-2.5">
          <button
            type="button"
            onclick={openMySubscriptions}
            class="w-full rounded-2xl bg-[#2B5A16] py-3.5 text-xs font-bold text-white shadow-md hover:bg-[#1E3F20] active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <span>🔁</span>
            <span>View in My Subscriptions</span>
            <span>→</span>
          </button>

          <a
            href="/"
            class="block w-full rounded-2xl border border-[#E4E4DC] bg-white py-3 text-xs font-bold text-[#4A5A52] hover:bg-[#FAF7F0] transition-colors"
          >
            Explore More Farm Produce
          </a>
        </div>
      </div>

    {:else}

      <!-- ═══ STEP-BY-STEP BUILDER ═══ -->

      <!-- Hero Header -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#FAF7F0] via-[#FDFBF7] to-[#F5EFE4] p-5 border border-[#EAE3D2] shadow-2xs">
        <div class="relative z-10 flex items-start justify-between">
          <div class="max-w-[230px]">
            <span class="block text-[11px] font-black uppercase tracking-widest text-[#2B5A16]">
              HARVEST ROUTINE
            </span>
            <h1
              class="mt-1 text-2xl sm:text-3xl font-black leading-tight text-[#0B1F2E]"
              style="font-family: 'Playfair Display', Georgia, serif;"
            >
              Fresh goodness,<br />on repeat.
            </h1>
            <p class="mt-2 text-[11.5px] leading-relaxed text-[#4A5A52]">
              Set your morning harvest schedule. Pause, adjust, or cancel anytime in 1 tap.
            </p>
          </div>
          <div class="w-[36%] pt-1">
            <img
              src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/about%20footer.webp"
              alt="Only Superfoods weekly harvest box"
              class="h-28 w-full rounded-2xl object-cover shadow-sm border border-[#E4E4DC]"
            />
          </div>
        </div>
      </div>

      <!-- Trust Badges Strip -->
      <div class="mt-3 grid grid-cols-4 gap-1.5 rounded-2xl bg-[#FAFBF7] p-2.5 border border-[#E4E4DC] shadow-2xs text-center">
        <div class="flex flex-col items-center gap-1">
          <span class="text-sm">🌱</span>
          <span class="text-[9.5px] font-bold text-[#0B1F2E]">5:30 AM<br />Harvest</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-sm">🚚</span>
          <span class="text-[9.5px] font-bold text-[#0B1F2E]">7-10 AM<br />Dawn Drop</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-sm">⏸</span>
          <span class="text-[9.5px] font-bold text-[#0B1F2E]">Pause<br />Anytime</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-sm">🎁</span>
          <span class="text-[9.5px] font-bold text-[#0B1F2E]">Free<br />Delivery</span>
        </div>
      </div>

      <!-- STEP 1: Frequency & Days -->
      <div class="mt-6 rounded-3xl border border-[#E4E4DC] bg-white p-4 sm:p-5 shadow-2xs">
        <div class="flex items-center gap-2 mb-3">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
            1
          </span>
          <h2 class="text-sm font-bold text-[#0B1F2E] uppercase tracking-wider">
            Choose Delivery Frequency
          </h2>
        </div>

        <!-- 4 Frequency Pills: 1x, 2x, 3x, 4x -->
        <div class="grid grid-cols-4 gap-2">
          {#each ['1x', '2x', '3x', '4x'] as freq}
            <button
              type="button"
              onclick={() => setFrequency(freq)}
              class="rounded-xl py-2.5 text-center text-xs font-bold transition-all border {frequency === freq
                ? 'bg-[#2B5A16] text-white border-[#2B5A16] shadow-sm'
                : 'bg-[#FAF7F0] text-[#0B1F2E] border-[#E4E4DC] hover:border-[#8DC63F]'}"
            >
              {freq} / wk
            </button>
          {/each}
        </div>

        <!-- Pick Harvest Days (Mon - Sat) -->
        <div class="mt-4">
          <div class="flex items-center justify-between text-xs mb-2">
            <span class="font-semibold text-[#4A5A52]">
              Select {targetDayCount} harvest day{targetDayCount === 1 ? '' : 's'}:
            </span>
            <span class="font-bold text-[#2B5A16]">
              {selectedDays.length} / {targetDayCount} selected
            </span>
          </div>

          <div class="grid grid-cols-6 gap-1.5">
            {#each DAYS_OF_WEEK as day}
              {@const isSelected = selectedDays.includes(day.id)}
              <button
                type="button"
                onclick={() => toggleDay(day.id)}
                class="rounded-xl py-2 text-center text-xs font-bold transition-all border {isSelected
                  ? 'bg-[#EBF7DC] text-[#2B5A16] border-[#A8D632] shadow-2xs'
                  : 'bg-white text-[#4A5A52] border-[#E4E4DC] hover:bg-[#FAF7F0]'}"
              >
                {day.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- STEP 2: Plan Duration -->
      <div class="mt-4 rounded-3xl border border-[#E4E4DC] bg-white p-4 sm:p-5 shadow-2xs">
        <div class="flex items-center gap-2 mb-3">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
            2
          </span>
          <h2 class="text-sm font-bold text-[#0B1F2E] uppercase tracking-wider">
            Choose Plan Duration
          </h2>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <!-- Monthly Routine (4 Weeks, 5% off) -->
          <button
            type="button"
            onclick={() => (planDuration = 'monthly')}
            class="relative rounded-2xl p-3 text-left border transition-all {planDuration === 'monthly'
              ? 'border-2 border-[#2B5A16] bg-[#F4F8EE] shadow-2xs'
              : 'border-[#E4E4DC] bg-white hover:border-[#8DC63F]'}"
          >
            <span class="rounded-full bg-[#FF5500] px-2 py-0.5 text-[8.5px] font-black uppercase text-white">
              5% OFF · POPULAR
            </span>
            <h3 class="mt-2 text-xs font-bold text-[#0B1F2E]">Monthly Routine</h3>
            <p class="text-[10.5px] text-[#4A5A52]">4 Weeks (Steady Supply)</p>
          </button>

          <!-- Quarterly Seasonal (12 Weeks, 10% off) -->
          <button
            type="button"
            onclick={() => (planDuration = 'quarterly')}
            class="relative rounded-2xl p-3 text-left border transition-all {planDuration === 'quarterly'
              ? 'border-2 border-[#2B5A16] bg-[#F4F8EE] shadow-2xs'
              : 'border-[#E4E4DC] bg-white hover:border-[#8DC63F]'}"
          >
            <span class="rounded-full bg-[#2B5A16] px-2 py-0.5 text-[8.5px] font-black uppercase text-white">
              10% OFF · BEST VALUE
            </span>
            <h3 class="mt-2 text-xs font-bold text-[#0B1F2E]">Quarterly Seasonal</h3>
            <p class="text-[10.5px] text-[#4A5A52]">12 Weeks (VIP Picking)</p>
          </button>

          <!-- Flexible Rolling (1 Week, 0% off) -->
          <button
            type="button"
            onclick={() => (planDuration = 'rolling')}
            class="relative rounded-2xl p-3 text-left border transition-all {planDuration === 'rolling'
              ? 'border-2 border-[#2B5A16] bg-[#F4F8EE] shadow-2xs'
              : 'border-[#E4E4DC] bg-white hover:border-[#8DC63F]'}"
          >
            <span class="rounded-full bg-[#FAF7F0] border border-[#E4E4DC] px-2 py-0.5 text-[8.5px] font-bold text-[#4A5A52]">
              ZERO LOCK-IN
            </span>
            <h3 class="mt-2 text-xs font-bold text-[#0B1F2E]">Flexible Rolling</h3>
            <p class="text-[10.5px] text-[#4A5A52]">Weekly renewal, pause anytime</p>
          </button>
        </div>
      </div>

      <!-- STEP 3: Customize Produce Per Day -->
      <div class="mt-4 rounded-3xl border border-[#E4E4DC] bg-white p-4 sm:p-5 shadow-2xs">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
              3
            </span>
            <h2 class="text-sm font-bold text-[#0B1F2E] uppercase tracking-wider">
              Customize Each Day's Harvest
            </h2>
          </div>
        </div>
        <p class="text-xs text-[#4A5A52] mb-3">
          Choose different superfoods for different days (e.g. Eggs on Monday, Mushrooms on Thursday)!
        </p>

        <!-- Day Selector Tabs (if multiple days) -->
        {#if selectedDays.length > 1}
          <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {#each selectedDays as day}
              {@const dayCount = (dayBaskets[day] || []).length}
              <button
                type="button"
                onclick={() => (activeCustomizingDay = day)}
                class="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all border {activeCustomizingDay === day
                  ? 'bg-[#2B5A16] text-white border-[#2B5A16] shadow-2xs'
                  : 'bg-[#FAF7F0] text-[#0B1F2E] border-[#E4E4DC]'}"
              >
                <span>🌱 {day}'s Box</span>
                <span class="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                  {dayCount}
                </span>
              </button>
            {/each}

            <!-- 1-Click Copy Button -->
            <button
              type="button"
              onclick={handleCopyCurrentBasketToAllDays}
              class="shrink-0 rounded-xl border border-dashed border-[#A8D632] bg-[#F4F9EE] px-2.5 py-1.5 text-[11px] font-bold text-[#2B5A16] hover:bg-[#EBF7DC] transition-colors"
              title="Copy this day's produce selection to all selected days"
            >
              ⚡ Copy to all days
            </button>
          </div>
        {/if}

        <!-- Active Day Header -->
        <div class="mt-2.5 flex items-center justify-between rounded-xl bg-[#FAF7F0] px-3 py-2 text-xs border border-[#E4E4DC]">
          <span class="font-bold text-[#0B1F2E]">
            Customizing: <span class="text-[#2B5A16]">{activeCustomizingDay}'s Harvest Box</span>
          </span>
          <span class="text-[#4A5A52] font-semibold">
            {(dayBaskets[activeCustomizingDay] || []).length} item{(dayBaskets[activeCustomizingDay] || []).length === 1 ? '' : 's'}
          </span>
        </div>

        <!-- Produce Selection Grid -->
        <div class="mt-3 space-y-2.5">
          {#each currentProducts as product (product.id)}
            {@const inBasket = isProductInActiveBasket(product.id)}
            {@const basketItem = getActiveBasketItem(product.id)}
            {@const packs = product.packSizes && product.packSizes.length > 0 ? product.packSizes : [{ size: product.unit || '250 g', price: product.price }]}

            <div class="rounded-2xl border p-3 transition-all {inBasket ? 'border-[#8DC63F] bg-[#FAFBF7]' : 'border-[#E4E4DC] bg-white opacity-90'}">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 flex-1 min-w-0">
                  <!-- Checkbox -->
                  <button
                    type="button"
                    onclick={() => toggleProductInActiveDay(product)}
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all {inBasket ? 'bg-[#2B5A16] border-[#2B5A16] text-white' : 'border-[#C4C4BC] bg-white'}"
                    aria-label="Toggle {product.name}"
                  >
                    {#if inBasket}
                      <span class="text-xs">✓</span>
                    {/if}
                  </button>

                  <img
                    src={product.image}
                    alt={product.name}
                    class="h-10 w-10 shrink-0 rounded-xl object-cover border border-[#E4E4DC]"
                  />

                  <div class="min-w-0 flex-1">
                    <h3 class="text-xs font-bold text-[#0B1F2E] truncate">{product.name}</h3>
                    <p class="text-[10px] text-[#4A5A52]">{product.tagline || 'Living Farm Harvest'}</p>
                  </div>
                </div>

                <!-- Price -->
                <div class="text-right shrink-0">
                  <span class="text-xs font-bold text-[#0B1F2E]">
                    ₹{(basketItem?.price || packs[0].price) * (basketItem?.quantity || 1)}
                  </span>
                </div>
              </div>

              {#if inBasket}
                <!-- Controls: Pack Size & Quantity Stepper -->
                <div class="mt-2.5 flex items-center justify-between gap-2 border-t border-[#F0F0EA] pt-2">
                  <select
                    class="rounded-lg border border-[#D5E2C4] bg-white px-2 py-1 text-[11px] font-medium text-[#0B1F2E] outline-none"
                    value={basketItem?.packSize}
                    onchange={(e) => {
                      const selectedPack = packs.find((p) => p.size === e.target.value);
                      if (selectedPack) setPackForProduct(product.id, selectedPack.size, selectedPack.price);
                    }}
                  >
                    {#each packs as p}
                      <option value={p.size}>{p.size} — ₹{p.price}</option>
                    {/each}
                  </select>

                  <!-- Quantity Stepper -->
                  <div class="flex items-center gap-2 bg-white rounded-lg border border-[#D5E2C4] px-1.5 py-0.5">
                    <button
                      type="button"
                      onclick={() => updateQtyForProduct(product.id, -1)}
                      class="h-5 w-5 flex items-center justify-center text-xs font-bold text-[#4A5A52] hover:text-[#0B1F2E]"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <span class="text-xs font-bold text-[#0B1F2E] min-w-4 text-center">
                      {basketItem?.quantity || 1}
                    </span>
                    <button
                      type="button"
                      onclick={() => updateQtyForProduct(product.id, 1)}
                      class="h-5 w-5 flex items-center justify-center text-xs font-bold text-[#4A5A52] hover:text-[#0B1F2E]"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- STEP 4: Doorstep Address & Radar -->
      <div class="mt-4 rounded-3xl border border-[#E4E4DC] bg-white p-4 sm:p-5 shadow-2xs">
        <div class="flex items-center gap-2 mb-3">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
            4
          </span>
          <h2 class="text-sm font-bold text-[#0B1F2E] uppercase tracking-wider">
            Doorstep Delivery Details
          </h2>
        </div>

        <div class="space-y-3">
          <!-- Full Name -->
          <div>
            <label for="sub-name" class="block text-xs font-bold text-[#0B1F2E] mb-1">Full Name *</label>
            <input
              id="sub-name"
              type="text"
              bind:value={customerName}
              placeholder="e.g. Aditi Sharma"
              class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2.5 text-xs text-[#0B1F2E] outline-none"
            />
          </div>

          <!-- WhatsApp Number -->
          <div>
            <label for="sub-phone" class="block text-xs font-bold text-[#0B1F2E] mb-1">WhatsApp Mobile Number *</label>
            <div class="flex">
              <span class="inline-flex items-center rounded-l-xl border border-r-0 border-[#D5E2C4] bg-[#FAF7F0] px-3 text-xs font-bold text-[#4A5A52]">
                +91
              </span>
              <input
                id="sub-phone"
                type="tel"
                bind:value={customerPhone}
                placeholder="9876543210"
                class="flex-1 rounded-r-xl border border-[#D5E2C4] px-3.5 py-2.5 text-xs text-[#0B1F2E] outline-none"
              />
            </div>
          </div>

          <!-- Address Header with Live GPS and Map toggle -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="sub-addr" class="text-xs font-bold text-[#0B1F2E]">Doorstep Address *</label>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  onclick={useLiveLocation}
                  disabled={isLocating}
                  class="rounded-lg bg-[#EBF7DC] border border-[#A8D632] px-2 py-0.8 text-[10.5px] font-bold text-[#2B5A16] hover:bg-[#d9f2c2] transition-colors"
                >
                  {isLocating ? 'Locating...' : '📍 Use Live Location'}
                </button>
                <button
                  type="button"
                  onclick={() => (showMiniMap = !showMiniMap)}
                  class="rounded-lg bg-[#FAF7F0] border border-[#E4E4DC] px-2 py-0.8 text-[10.5px] font-bold text-[#4A5A52] hover:bg-white transition-colors"
                >
                  {showMiniMap ? '✕ Hide Map' : '🗺️ Map'}
                </button>
              </div>
            </div>

            <!-- Mini Map Drawer -->
            {#if showMiniMap}
              <div class="mb-2 rounded-2xl border border-[#E4E4DC] p-2 bg-[#FAF7F0]">
                <CheckoutMiniMap
                  lat={customerLat}
                  lng={customerLng}
                  onPositionChanged={handleMapPositionChanged}
                />
              </div>
            {/if}

            <textarea
              id="sub-addr"
              bind:value={addressLine}
              rows="3"
              placeholder="Flat / Villa No., Apartment Name, Street, Kadugodi / Whitefield"
              class="w-full rounded-xl border border-[#D5E2C4] p-3 text-xs text-[#0B1F2E] outline-none"
            ></textarea>
          </div>

          <!-- Geofence Radar Status -->
          {#if locationFeedback}
            <div class="rounded-xl p-2.5 text-xs font-semibold {isOutOfZone ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'}">
              {locationFeedback}
            </div>
          {/if}

          <!-- Out of Service Area Alert -->
          {#if isOutOfZone}
            <div class="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 space-y-2">
              <div class="flex items-start gap-2">
                <span class="text-base">📍</span>
                <div>
                  <h4 class="text-xs font-bold text-amber-950">Outside Direct Harvest Radius</h4>
                  <p class="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                    We currently harvest & deliver directly within East Bangalore (Kadugodi, Whitefield, Hoodi, ITPL). For other areas, our farm team can coordinate express delivery (Porter / Rapido).
                  </p>
                </div>
              </div>

              <a
                href="https://wa.me/917760350360?text=Hi%20Only%20Superfoods!%20I%20am%20located%20outside%20Whitefield%20and%20would%20like%20to%20request%20an%20express%20harvest%20subscription."
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2 text-xs font-bold text-white shadow-xs hover:bg-[#20BA59]"
              >
                <span>💬</span>
                <span>Connect for Express Delivery (+91 7760350360)</span>
              </a>
            </div>
          {/if}
        </div>
      </div>

      <!-- STEP 5: Routine Blueprint & Payment Method -->
      <div class="mt-4 rounded-3xl border border-[#E4E4DC] bg-white p-4 sm:p-5 shadow-2xs">
        <div class="flex items-center gap-2 mb-3">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
            5
          </span>
          <h2 class="text-sm font-bold text-[#0B1F2E] uppercase tracking-wider">
            Routine Summary & Payment
          </h2>
        </div>

        <!-- Routine Summary Card -->
        <div class="rounded-2xl bg-[#FAF7F0] p-3.5 border border-[#E4E4DC] space-y-2 text-xs">
          <div class="flex items-center justify-between text-[#0B1F2E]">
            <span class="font-bold">Next Harvest Drop:</span>
            <span class="font-bold text-[#2B5A16]">{nextDropString}</span>
          </div>
          <div class="flex items-center justify-between text-[#4A5A52]">
            <span>Drops Per Week:</span>
            <span class="font-semibold text-[#0B1F2E]">{selectedDays.length}x ({selectedDays.join(' & ')})</span>
          </div>
          <div class="flex items-center justify-between text-[#4A5A52]">
            <span>Plan Duration:</span>
            <span class="font-semibold text-[#0B1F2E]">{planInfo.name} ({totals.totalDrops} total drops)</span>
          </div>
          <div class="flex items-center justify-between text-[#4A5A52]">
            <span>Weekly Produce Subtotal:</span>
            <span class="font-semibold text-[#0B1F2E]">₹{totals.weeklyBaseTotal}</span>
          </div>

          {#if totals.discountAmount > 0}
            <div class="flex items-center justify-between text-[#2B5A16] font-bold">
              <span>Duration Savings ({totals.discountPercent}% OFF):</span>
              <span>-₹{totals.discountAmount}</span>
            </div>
          {/if}

          <div class="flex items-center justify-between text-[#2B5A16]">
            <span>Dawn Delivery (Subscriber Perk):</span>
            <span class="font-bold">FREE (Saved ₹{totals.deliverySavings})</span>
          </div>

          <div class="flex items-center justify-between border-t border-[#E4E4DC] pt-2 text-[#0B1F2E]">
            <span class="text-sm font-black">Total Payable:</span>
            <span class="text-lg font-black text-[#2B5A16]">₹{totals.finalPayable}</span>
          </div>
        </div>

        <!-- Payment Method Toggle (Razorpay or Pay on Delivery) -->
        <div class="mt-4 space-y-2">
          <p class="text-xs font-bold text-[#0B1F2E]">Select Payment Preference:</p>

          <button
            type="button"
            onclick={() => (paymentMethod = 'online')}
            class="w-full flex items-center justify-between rounded-2xl p-3 border text-left transition-all {paymentMethod === 'online'
              ? 'border-2 border-[#2B5A16] bg-[#F4F8EE]'
              : 'border-[#E4E4DC] bg-white'}"
          >
            <div class="flex items-center gap-2.5">
              <span class="text-lg">⚡</span>
              <div>
                <h4 class="text-xs font-bold text-[#0B1F2E]">UPI / Cards (Razorpay Auto-Confirm)</h4>
                <p class="text-[10.5px] text-[#4A5A52]">Instant activation with any UPI app, GPay, or Cards</p>
              </div>
            </div>
            <span class="h-4 w-4 rounded-full border flex items-center justify-center {paymentMethod === 'online' ? 'border-[#2B5A16] bg-[#2B5A16]' : 'border-gray-300'}">
              {#if paymentMethod === 'online'}<span class="h-1.5 w-1.5 rounded-full bg-white"></span>{/if}
            </span>
          </button>

          <button
            type="button"
            onclick={() => (paymentMethod = 'pod')}
            class="w-full flex items-center justify-between rounded-2xl p-3 border text-left transition-all {paymentMethod === 'pod'
              ? 'border-2 border-[#2B5A16] bg-[#F4F8EE]'
              : 'border-[#E4E4DC] bg-white'}"
          >
            <div class="flex items-center gap-2.5">
              <span class="text-lg">💵</span>
              <div>
                <h4 class="text-xs font-bold text-[#0B1F2E]">Pay on Delivery (for 1st Drop)</h4>
                <p class="text-[10.5px] text-[#4A5A52]">Zero advance payment. Pay via Cash or UPI at your doorstep.</p>
              </div>
            </div>
            <span class="h-4 w-4 rounded-full border flex items-center justify-center {paymentMethod === 'pod' ? 'border-[#2B5A16] bg-[#2B5A16]' : 'border-gray-300'}">
              {#if paymentMethod === 'pod'}<span class="h-1.5 w-1.5 rounded-full bg-white"></span>{/if}
            </span>
          </button>
        </div>

        {#if formError}
          <div class="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 font-medium">
            ⚠️ {formError}
          </div>
        {/if}

        <!-- Big CTA Button -->
        <button
          type="button"
          onclick={handleConfirmSubscription}
          disabled={isSubmitting || totals.finalPayable <= 0}
          class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2B5A16] py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#1E3F20] active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
        >
          {#if isSubmitting}
            <span>Processing Harvest Order...</span>
          {:else if paymentMethod === 'online'}
            <span>Pay ₹{totals.finalPayable} & Activate Routine →</span>
          {:else}
            <span>Confirm Routine (Pay on 1st Drop) →</span>
          {/if}
        </button>

        <p class="mt-2 text-center text-[10px] text-[#4A5A52]">
          🔒 Zero commitment. Pause, skip, or cancel anytime from "My Subscriptions".
        </p>
      </div>

    {/if}

  </div>
</section>

<!--
  DesktopSubscriptionSection.svelte — Wide 2-Column Multi-Day Harvest Box Builder (1024px+ only)
  Features:
  - Step 1: Frequency Selector (1x, 2x, 3x, 4x)
  - Step 2: Pick Harvest Days (Mon-Sat up to frequency limit)
  - Step 3: Plan Duration (Monthly 4 Wks 5% off, Quarterly 12 Wks 10% off, Flexible Rolling)
  - Step 4: Freedom to customize DIFFERENT produce on DIFFERENT days with tabs & 1-click "Copy to other days"
  - Step 5: Doorstep Delivery Address with Live GPS auto-detect, CheckoutMiniMap radar & geofence validation
  - Step 6: Payment (Razorpay UPI/Cards or Pay on Delivery)
  - Right: Sticky Live Routine Blueprint Card detailing day-by-day boxes, savings & 1-click activation
  - Success: Celebratory confirmation card with direct link to "My Subscriptions" drawer
  Svelte 5 runes mode.
-->
<script>
  import { onMount } from 'svelte';
  import { getProducts } from '../../lib/productsStore.js';
  import {
    DAYS_OF_WEEK,
    PLAN_DURATIONS,
    calculateSubscriptionTotals,
    generateSubscriptionId,
    saveSubscriptionRecord,
    getNextDropDate,
    copyBasketToOtherDays,
  } from '../../lib/subscriptionStore.js';
  import {
    getCurrentCustomer,
    updateCustomerProfile,
  } from '../../lib/auth.js';
  import { saveOrderToHistory } from '../../lib/cart.js';
  import { evaluateDeliveryZone } from '../../lib/geo.js';
  import CheckoutMiniMap from '../CheckoutMiniMap.svelte';

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
        saveSubscriptionRecord(subRecord);
        confirmedSubscription = subRecord;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } finally {
        isSubmitting = false;
      }
    } else {
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
              source: 'web_desktop_subscription',
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
                formError = 'Payment was cancelled. You can choose Pay on Delivery below.';
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

<section id="desktop-subscribe" class="w-full scroll-mt-20 bg-[#FAF7F0] py-16 border-b border-[#E4E4DC]">
  <div class="mx-auto max-w-[1280px] px-8">

    {#if confirmedSubscription}
      <!-- ═══ DESKTOP CONFIRMATION SCREEN ═══ -->
      <div class="max-w-2xl mx-auto rounded-3xl border border-[#A8D632] bg-white p-10 text-center shadow-xl animate-in fade-in">
        <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#EBF7DC] text-[#2B5A16] text-4xl shadow-xs">
          ✓
        </div>
        <span class="mt-5 inline-block rounded-full bg-[#2B5A16] px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
          Harvest Routine Activated
        </span>
        <h2 class="mt-3 text-3xl font-black text-[#0B1F2E]" style="font-family: 'Playfair Display', Georgia, serif;">
          Welcome to Living Freshness!
        </h2>
        <p class="mt-2 text-sm text-[#4A5A52]">
          Subscription <span class="font-mono font-bold text-[#0B1F2E]">#{confirmedSubscription.id}</span> has been confirmed.
        </p>

        <div class="mt-8 rounded-2xl bg-[#FAF7F0] border border-[#E4E4DC] p-6 text-left space-y-3">
          <div class="flex items-center justify-between text-sm text-[#0B1F2E]">
            <span class="font-bold flex items-center gap-2">
              <span>🚚</span> First Morning Harvest Drop:
            </span>
            <span class="font-extrabold text-[#2B5A16]">
              {nextDropString}
            </span>
          </div>
          <div class="text-xs text-[#4A5A52] flex items-center justify-between">
            <span>Recurring Schedule:</span>
            <span class="font-bold text-[#0B1F2E]">Every {confirmedSubscription.selectedDays.join(' & ')} (7:00 AM – 10:00 AM)</span>
          </div>
          <div class="text-xs text-[#4A5A52] flex items-center justify-between">
            <span>Plan Duration:</span>
            <span class="font-bold text-[#0B1F2E]">{confirmedSubscription.planName} ({confirmedSubscription.weeks} Weeks)</span>
          </div>
          <div class="text-xs text-[#4A5A52] flex items-center justify-between border-t border-[#E4E4DC] pt-3">
            <span>Total Payable:</span>
            <span class="font-black text-base text-[#2B5A16]">₹{confirmedSubscription.finalPayable}</span>
          </div>
          <div class="text-xs text-[#4A5A52] flex items-center justify-between">
            <span>Doorstep Address:</span>
            <span class="font-medium text-[#0B1F2E] max-w-sm truncate">{confirmedSubscription.deliveryAddress}</span>
          </div>
        </div>

        <div class="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onclick={openMySubscriptions}
            class="rounded-2xl bg-[#2B5A16] px-8 py-4 text-sm font-bold text-white shadow-md hover:bg-[#1E3F20] transition-all cursor-pointer flex items-center gap-2"
          >
            <span>🔁</span>
            <span>View in My Subscriptions</span>
            <span>→</span>
          </button>

          <a
            href="/"
            class="rounded-2xl border border-[#E4E4DC] bg-white px-8 py-4 text-sm font-bold text-[#4A5A52] hover:bg-[#FAF7F0] transition-colors"
          >
            Back to Farm
          </a>
        </div>
      </div>

    {:else}

      <!-- ═══ DESKTOP 2-COLUMN SPLIT CANVAS ═══ -->
      <!-- Section Top Hero Strip -->
      <div class="mb-10 grid grid-cols-12 items-center gap-8 rounded-3xl border border-[#D4E3C5] bg-gradient-to-r from-white via-[#FAFDF6] to-[#EFF5E4] p-8 xl:p-10 shadow-2xs">
        <div class="col-span-7 space-y-3">
          <span class="inline-flex items-center gap-2 rounded-full bg-[#EBF5E4] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-[#2B5A16]">
            <span>📦</span>
            <span>Living Harvest Routine</span>
          </span>
          <h1
            class="text-3xl xl:text-4xl font-black leading-tight text-[#0B1F2E]"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Fresh Goodness, On Repeat.
          </h1>
          <p class="text-sm leading-relaxed text-[#4A5A52] max-w-xl">
            Living microgreens, velvet gourmet mushrooms, 21-day raw kombucha, and pasture-foraged desi eggs. Picked at 5:30 AM dawn and delivered directly to your doorstep.
          </p>

          <div class="grid grid-cols-4 gap-3 pt-3 text-center max-w-lg">
            <div class="rounded-xl border border-[#E4E4DC] bg-white p-2 text-xs font-bold text-[#0B1F2E]">
              <div class="text-base mb-0.5">🌱</div>
              <div>5:30 AM Picked</div>
            </div>
            <div class="rounded-xl border border-[#E4E4DC] bg-white p-2 text-xs font-bold text-[#0B1F2E]">
              <div class="text-base mb-0.5">🚚</div>
              <div>7–10 AM Drop</div>
            </div>
            <div class="rounded-xl border border-[#E4E4DC] bg-white p-2 text-xs font-bold text-[#0B1F2E]">
              <div class="text-base mb-0.5">⏸</div>
              <div>Pause Anytime</div>
            </div>
            <div class="rounded-xl border border-[#E4E4DC] bg-white p-2 text-xs font-bold text-[#0B1F2E]">
              <div class="text-base mb-0.5">🎁</div>
              <div>Free Delivery</div>
            </div>
          </div>
        </div>

        <div class="col-span-5">
          <div class="overflow-hidden rounded-2xl border-2 border-white shadow-lg">
            <img
              src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/about%20footer.webp"
              alt="Only Superfoods curated weekly harvest crate"
              class="aspect-[16/10] w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      <!-- Main Configurator Split -->
      <div class="grid grid-cols-12 gap-8 items-start">

        <!-- ── Left 7 Cols: Configuration Steps ── -->
        <div class="col-span-7 space-y-6">

          <!-- 1. Frequency Selection -->
          <div class="rounded-3xl border border-[#E4E4DC] bg-white p-6 shadow-2xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
                  1
                </span>
                <h2 class="text-base font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
                  Choose Delivery Frequency
                </h2>
              </div>
              <span class="text-xs font-semibold text-[#4A5A52]">Zero contracts</span>
            </div>

            <div class="grid grid-cols-4 gap-3">
              {#each ['1x', '2x', '3x', '4x'] as freq}
                <button
                  type="button"
                  onclick={() => setFrequency(freq)}
                  class="rounded-2xl border p-3.5 text-center transition-all cursor-pointer {frequency === freq
                    ? 'border-2 border-[#2B5A16] bg-[#F2F8EA] shadow-2xs font-bold text-[#2B5A16]'
                    : 'border-[#E4E4DC] bg-white hover:border-[#A8D632] text-[#0B1F2E]'}"
                >
                  <div class="text-base font-black">{freq}</div>
                  <div class="text-[11px] text-[#4A5A52]">per week</div>
                </button>
              {/each}
            </div>
          </div>

          <!-- 2. Harvest Days -->
          <div class="rounded-3xl border border-[#E4E4DC] bg-white p-6 shadow-2xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
                  2
                </span>
                <h2 class="text-base font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
                  Pick Preferred Harvest Day{targetDayCount === 1 ? '' : 's'}
                </h2>
              </div>
              <span class="text-xs font-bold text-[#2B5A16]">
                {selectedDays.length} / {targetDayCount} selected
              </span>
            </div>

            <div class="grid grid-cols-6 gap-2">
              {#each DAYS_OF_WEEK as day}
                {@const isSelected = selectedDays.includes(day.id)}
                <button
                  type="button"
                  onclick={() => toggleDay(day.id)}
                  class="rounded-xl py-3 text-center text-xs font-bold transition-all border cursor-pointer {isSelected
                    ? 'bg-[#2B5A16] text-white border-[#2B5A16] shadow-2xs'
                    : 'bg-[#FAF7F0] text-[#0B1F2E] border-[#E4E4DC] hover:border-[#8DC63F]'}"
                >
                  <div>{day.full}</div>
                </button>
              {/each}
            </div>
          </div>

          <!-- 3. Plan Duration -->
          <div class="rounded-3xl border border-[#E4E4DC] bg-white p-6 shadow-2xs space-y-3">
            <div class="flex items-center gap-2.5">
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
                3
              </span>
              <h2 class="text-base font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
                Choose Plan Duration
              </h2>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <button
                type="button"
                onclick={() => (planDuration = 'monthly')}
                class="rounded-2xl p-4 text-left border transition-all cursor-pointer {planDuration === 'monthly'
                  ? 'border-2 border-[#2B5A16] bg-[#F2F8EA] shadow-2xs'
                  : 'border-[#E4E4DC] bg-white hover:border-[#8DC63F]'}"
              >
                <span class="rounded-full bg-[#FF5500] px-2 py-0.5 text-[9px] font-black uppercase text-white">
                  5% OFF · POPULAR
                </span>
                <h3 class="mt-2 text-sm font-bold text-[#0B1F2E]">Monthly Routine</h3>
                <p class="text-[11px] text-[#4A5A52] mt-0.5">4 Weeks (Steady replenishment)</p>
              </button>

              <button
                type="button"
                onclick={() => (planDuration = 'quarterly')}
                class="rounded-2xl p-4 text-left border transition-all cursor-pointer {planDuration === 'quarterly'
                  ? 'border-2 border-[#2B5A16] bg-[#F2F8EA] shadow-2xs'
                  : 'border-[#E4E4DC] bg-white hover:border-[#8DC63F]'}"
              >
                <span class="rounded-full bg-[#2B5A16] px-2 py-0.5 text-[9px] font-black uppercase text-white">
                  10% OFF · BEST VALUE
                </span>
                <h3 class="mt-2 text-sm font-bold text-[#0B1F2E]">Quarterly Seasonal</h3>
                <p class="text-[11px] text-[#4A5A52] mt-0.5">12 Weeks (VIP farm harvest)</p>
              </button>

              <button
                type="button"
                onclick={() => (planDuration = 'rolling')}
                class="rounded-2xl p-4 text-left border transition-all cursor-pointer {planDuration === 'rolling'
                  ? 'border-2 border-[#2B5A16] bg-[#F2F8EA] shadow-2xs'
                  : 'border-[#E4E4DC] bg-white hover:border-[#8DC63F]'}"
              >
                <span class="rounded-full bg-[#FAF7F0] border border-[#E4E4DC] px-2 py-0.5 text-[9px] font-bold text-[#4A5A52]">
                  ZERO LOCK-IN
                </span>
                <h3 class="mt-2 text-sm font-bold text-[#0B1F2E]">Flexible Rolling</h3>
                <p class="text-[11px] text-[#4A5A52] mt-0.5">Weekly renewal, pause anytime</p>
              </button>
            </div>
          </div>

          <!-- 4. Customize Harvest Items (Per Day) -->
          <div class="rounded-3xl border border-[#E4E4DC] bg-white p-6 shadow-2xs space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
                  4
                </span>
                <h2 class="text-base font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
                  Customize Each Day's Harvest
                </h2>
              </div>
            </div>
            <p class="text-xs text-[#4A5A52]">
              Customers have the freedom to select different items for different harvest days.
            </p>

            <!-- Day Tabs if > 1 day -->
            {#if selectedDays.length > 1}
              <div class="flex items-center gap-2.5 border-b border-[#E4E4DC] pb-3">
                {#each selectedDays as day}
                  {@const count = (dayBaskets[day] || []).length}
                  <button
                    type="button"
                    onclick={() => (activeCustomizingDay = day)}
                    class="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all border cursor-pointer {activeCustomizingDay === day
                      ? 'bg-[#2B5A16] text-white border-[#2B5A16] shadow-2xs'
                      : 'bg-[#FAF7F0] text-[#0B1F2E] border-[#E4E4DC] hover:border-[#8DC63F]'}"
                  >
                    <span>🌱 {day}'s Box</span>
                    <span class="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                      {count}
                    </span>
                  </button>
                {/each}

                <button
                  type="button"
                  onclick={handleCopyCurrentBasketToAllDays}
                  class="ml-auto rounded-xl border border-dashed border-[#A8D632] bg-[#F4F9EE] px-3 py-2 text-xs font-bold text-[#2B5A16] hover:bg-[#EBF7DC] transition-colors cursor-pointer"
                  title="Copy this day's items to all selected days"
                >
                  ⚡ Copy to all other days
                </button>
              </div>
            {/if}

            <!-- Produce Cards Grid -->
            <div class="grid grid-cols-2 gap-3.5">
              {#each currentProducts as product (product.id)}
                {@const inBasket = isProductInActiveBasket(product.id)}
                {@const basketItem = getActiveBasketItem(product.id)}
                {@const packs = product.packSizes && product.packSizes.length > 0 ? product.packSizes : [{ size: product.unit || '250 g', price: product.price }]}

                <div class="rounded-2xl border p-3.5 transition-all {inBasket ? 'border-[#8DC63F] bg-[#FAFBF7] shadow-2xs' : 'border-[#E4E4DC] bg-white'}">
                  <div class="flex items-start justify-between gap-2.5">
                    <button
                      type="button"
                      onclick={() => toggleProductInActiveDay(product)}
                      class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all mt-0.5 cursor-pointer {inBasket ? 'bg-[#2B5A16] border-[#2B5A16] text-white' : 'border-[#C4C4BC] bg-white'}"
                      aria-label="Toggle {product.name}"
                    >
                      {#if inBasket}✓{/if}
                    </button>

                    <img
                      src={product.image}
                      alt={product.name}
                      class="h-12 w-12 rounded-xl object-cover border border-[#E4E4DC] shrink-0"
                    />

                    <div class="flex-1 min-w-0">
                      <h3 class="text-xs font-bold text-[#0B1F2E] truncate">{product.name}</h3>
                      <p class="text-[10.5px] text-[#4A5A52]">
                        ₹{basketItem?.price || packs[0].price} • {basketItem?.packSize || packs[0].size}
                      </p>
                    </div>
                  </div>

                  {#if inBasket}
                    <div class="mt-3 flex items-center justify-between gap-2 border-t border-[#F0F0EA] pt-2.5">
                      <select
                        class="rounded-lg border border-[#D5E2C4] bg-white px-2 py-1 text-xs text-[#0B1F2E] outline-none cursor-pointer"
                        value={basketItem?.packSize}
                        onchange={(e) => {
                          const p = packs.find((pk) => pk.size === e.target.value);
                          if (p) setPackForProduct(product.id, p.size, p.price);
                        }}
                      >
                        {#each packs as pk}
                          <option value={pk.size}>{pk.size} — ₹{pk.price}</option>
                        {/each}
                      </select>

                      <div class="flex items-center gap-2 bg-white rounded-lg border border-[#D5E2C4] px-2 py-0.5">
                        <button
                          type="button"
                          onclick={() => updateQtyForProduct(product.id, -1)}
                          class="text-xs font-bold text-[#4A5A52] hover:text-[#0B1F2E] cursor-pointer"
                        >
                          -
                        </button>
                        <span class="text-xs font-bold text-[#0B1F2E] min-w-4 text-center">
                          {basketItem?.quantity || 1}
                        </span>
                        <button
                          type="button"
                          onclick={() => updateQtyForProduct(product.id, 1)}
                          class="text-xs font-bold text-[#4A5A52] hover:text-[#0B1F2E] cursor-pointer"
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

          <!-- 5. Doorstep Delivery Address -->
          <div class="rounded-3xl border border-[#E4E4DC] bg-white p-6 shadow-2xs space-y-4">
            <div class="flex items-center gap-2.5">
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
                5
              </span>
              <h2 class="text-base font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
                Doorstep Delivery Address
              </h2>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="desk-sub-name" class="block text-xs font-bold text-[#0B1F2E] mb-1">Full Name *</label>
                <input
                  id="desk-sub-name"
                  type="text"
                  bind:value={customerName}
                  placeholder="e.g. Aditi Sharma"
                  class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2 text-xs text-[#0B1F2E] outline-none"
                />
              </div>

              <div>
                <label for="desk-sub-phone" class="block text-xs font-bold text-[#0B1F2E] mb-1">WhatsApp Number *</label>
                <div class="flex">
                  <span class="inline-flex items-center rounded-l-xl border border-r-0 border-[#D5E2C4] bg-[#FAF7F0] px-3 text-xs font-bold text-[#4A5A52]">
                    +91
                  </span>
                  <input
                    id="desk-sub-phone"
                    type="tel"
                    bind:value={customerPhone}
                    placeholder="9876543210"
                    class="flex-1 rounded-r-xl border border-[#D5E2C4] px-3.5 py-2 text-xs text-[#0B1F2E] outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label for="desk-sub-addr" class="text-xs font-bold text-[#0B1F2E]">Complete Address *</label>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    onclick={useLiveLocation}
                    disabled={isLocating}
                    class="rounded-lg bg-[#EBF7DC] border border-[#A8D632] px-2.5 py-1 text-xs font-bold text-[#2B5A16] hover:bg-[#d9f2c2] transition-colors cursor-pointer"
                  >
                    {isLocating ? 'Locating...' : '📍 Use Live Location'}
                  </button>
                  <button
                    type="button"
                    onclick={() => (showMiniMap = !showMiniMap)}
                    class="rounded-lg bg-[#FAF7F0] border border-[#E4E4DC] px-2.5 py-1 text-xs font-bold text-[#4A5A52] hover:bg-white transition-colors cursor-pointer"
                  >
                    {showMiniMap ? '✕ Close Map' : '🗺️ Select from Map'}
                  </button>
                </div>
              </div>

              {#if showMiniMap}
                <div class="mb-3 rounded-2xl border border-[#E4E4DC] p-2 bg-[#FAF7F0]">
                  <CheckoutMiniMap
                    lat={customerLat}
                    lng={customerLng}
                    onPositionChanged={handleMapPositionChanged}
                  />
                </div>
              {/if}

              <textarea
                id="desk-sub-addr"
                bind:value={addressLine}
                rows="2"
                placeholder="Flat / Villa No., Apartment Name, Street, Kadugodi / Whitefield"
                class="w-full rounded-xl border border-[#D5E2C4] p-3 text-xs text-[#0B1F2E] outline-none"
              ></textarea>
            </div>

            {#if locationFeedback}
              <div class="rounded-xl p-2.5 text-xs font-semibold {isOutOfZone ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'}">
                {locationFeedback}
              </div>
            {/if}

            {#if isOutOfZone}
              <div class="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2">
                <div class="flex items-start gap-2">
                  <span class="text-base">📍</span>
                  <div>
                    <h4 class="text-xs font-bold text-amber-950">Outside Direct Harvest Delivery Route</h4>
                    <p class="text-xs text-amber-900 mt-0.5">
                      We harvest & deliver directly within East Bangalore (Kadugodi, Whitefield, Hoodi, ITPL). For other areas, we arrange express drops (Porter / Rapido).
                    </p>
                  </div>
                </div>
                <a
                  href="https://wa.me/917760350360?text=Hi%20Only%20Superfoods!%20I%20am%20located%20outside%20Whitefield%20and%20would%20like%20to%20request%20an%20express%20harvest%20subscription."
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#20BA59]"
                >
                  <span>💬 Connect with Team for Express Delivery (+91 7760350360)</span>
                </a>
              </div>
            {/if}
          </div>

          <!-- 6. Payment Method Preference -->
          <div class="rounded-3xl border border-[#E4E4DC] bg-white p-6 shadow-2xs space-y-3">
            <div class="flex items-center gap-2.5">
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-xs font-black text-white">
                6
              </span>
              <h2 class="text-base font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
                Choose Payment Method
              </h2>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <button
                type="button"
                onclick={() => (paymentMethod = 'online')}
                class="rounded-2xl border p-4 text-left transition-all cursor-pointer {paymentMethod === 'online'
                  ? 'border-2 border-[#2B5A16] bg-[#F2F8EA]'
                  : 'border-[#E4E4DC] bg-white'}"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-[#0B1F2E]">⚡ UPI / Cards (Razorpay)</span>
                  <span class="h-4 w-4 rounded-full border flex items-center justify-center {paymentMethod === 'online' ? 'border-[#2B5A16] bg-[#2B5A16]' : 'border-gray-300'}">
                    {#if paymentMethod === 'online'}<span class="h-1.5 w-1.5 rounded-full bg-white"></span>{/if}
                  </span>
                </div>
                <p class="text-[11px] text-[#4A5A52] mt-1">Instant activation via GPay, PhonePe, Cards</p>
              </button>

              <button
                type="button"
                onclick={() => (paymentMethod = 'pod')}
                class="rounded-2xl border p-4 text-left transition-all cursor-pointer {paymentMethod === 'pod'
                  ? 'border-2 border-[#2B5A16] bg-[#F2F8EA]'
                  : 'border-[#E4E4DC] bg-white'}"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-[#0B1F2E]">💵 Pay on Delivery</span>
                  <span class="h-4 w-4 rounded-full border flex items-center justify-center {paymentMethod === 'pod' ? 'border-[#2B5A16] bg-[#2B5A16]' : 'border-gray-300'}">
                    {#if paymentMethod === 'pod'}<span class="h-1.5 w-1.5 rounded-full bg-white"></span>{/if}
                  </span>
                </div>
                <p class="text-[11px] text-[#4A5A52] mt-1">Zero advance. Pay at doorstep for 1st drop.</p>
              </button>
            </div>
          </div>

        </div>

        <!-- ── Right 5 Cols: Sticky Routine Blueprint Card ── -->
        <div class="col-span-5 sticky top-24">
          <div class="rounded-3xl border border-[#D5E2C4] bg-white p-6 xl:p-8 shadow-xl space-y-5">
            <!-- Header -->
            <div class="border-b border-[#E4E4DC] pb-4">
              <span class="rounded-full bg-[#EBF5E4] px-3 py-1 text-[10.5px] font-bold text-[#2B5A16] uppercase">
                {planInfo.name} ({planInfo.weeks} Weeks)
              </span>
              <h3 class="mt-2 text-xl font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', Georgia, serif;">
                Your Harvest Routine
              </h3>
              <p class="text-xs text-[#4A5A52] mt-0.5">
                Next Drop: <strong class="text-[#2B5A16]">{nextDropString}</strong>
              </p>
            </div>

            <!-- Day-by-day itemization -->
            <div class="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {#each selectedDays as day}
                {@const items = dayBaskets[day] || []}
                <div class="rounded-xl bg-[#FAF7F0] p-3 border border-[#E4E4DC]/70">
                  <div class="flex items-center justify-between text-xs font-bold text-[#0B1F2E] border-b border-[#E4E4DC]/50 pb-1.5 mb-2">
                    <span>🌱 {day}'s Harvest Box</span>
                    <span class="text-[11px] text-[#4A5A52] font-semibold">{items.length} items</span>
                  </div>

                  {#if items.length > 0}
                    <div class="space-y-1.5">
                      {#each items as it}
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-[#0B1F2E]">
                            <strong class="text-[#2B5A16]">{it.quantity}x</strong> {it.name} <span class="text-[10px] text-[#4A5A52]">({it.packSize})</span>
                          </span>
                          <span class="font-bold text-[#0B1F2E]">₹{it.price * it.quantity}</span>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-[11px] text-gray-400 italic">No produce selected for {day}.</p>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Pricing Breakdown -->
            <div class="border-t border-[#E4E4DC] pt-4 space-y-2 text-xs">
              <div class="flex items-center justify-between text-[#4A5A52]">
                <span>Weekly Produce Subtotal:</span>
                <span class="font-semibold text-[#0B1F2E]">₹{totals.weeklyBaseTotal}</span>
              </div>
              <div class="flex items-center justify-between text-[#4A5A52]">
                <span>Total Routine Drops:</span>
                <span class="font-semibold text-[#0B1F2E]">{totals.totalDrops} morning drops</span>
              </div>

              {#if totals.discountAmount > 0}
                <div class="flex items-center justify-between text-[#2B5A16] font-bold">
                  <span>Duration Discount ({totals.discountPercent}% OFF):</span>
                  <span>-₹{totals.discountAmount}</span>
                </div>
              {/if}

              <div class="flex items-center justify-between text-[#2B5A16]">
                <span>Morning Delivery:</span>
                <span class="font-bold">FREE (Saved ₹{totals.deliverySavings})</span>
              </div>

              <div class="flex items-center justify-between border-t border-[#E4E4DC] pt-3 text-[#0B1F2E]">
                <span class="text-base font-black">Total Payable:</span>
                <span class="text-2xl font-black text-[#2B5A16]">₹{totals.finalPayable}</span>
              </div>
            </div>

            {#if formError}
              <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">
                ⚠️ {formError}
              </div>
            {/if}

            <!-- Confirm Routine CTA -->
            <button
              type="button"
              onclick={handleConfirmSubscription}
              disabled={isSubmitting || totals.finalPayable <= 0}
              class="w-full rounded-2xl bg-[#2B5A16] py-4 text-sm font-bold text-white shadow-md hover:bg-[#1E3F20] active:scale-98 transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
            >
              {#if isSubmitting}
                <span>Processing Harvest Order...</span>
              {:else if paymentMethod === 'online'}
                <span>Pay ₹{totals.finalPayable} & Activate Routine →</span>
              {:else}
                <span>Confirm Routine (Pay on 1st Drop) →</span>
              {/if}
            </button>

            <div class="text-center text-[11px] text-[#4A5A52] space-y-1">
              <p>🔒 Bank-grade 256-bit encryption. Zero contracts.</p>
              <p>Pause, skip drops, or cancel anytime from <strong>My Subscriptions</strong>.</p>
            </div>
          </div>
        </div>

      </div>

    {/if}

  </div>
</section>

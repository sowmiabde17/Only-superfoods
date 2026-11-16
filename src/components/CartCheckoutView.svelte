<!--
  CartCheckoutView.svelte — Dedicated Full-Page View for /cart
  Hyperlocal Serviceability-First Architecture:
  - Screen 1: "Your Fresh Bag (qty)" with Harvest Guarantee, items list, quantity pill, delete icon, coupon box, and order summary
  - Screen 2: Unified Progressive Checkout [1. Delivery Details & Serviceability Radar -> 2. Payment Method -> Order Placement]
  - Screen 3: "All Set!" Order confirmation receipt with 1-click WhatsApp dispatch
  Svelte 5 runes mode.
-->
<script>
  import { onMount } from "svelte";
  import {
    getCartItems,
    getCartTotals,
    updateItemQuantity,
    removeItem,
    clearCart,
    saveOrderToHistory,
    generateOrderId,
    refreshCartPrices,
  } from "../lib/cart.js";
  import { getProducts } from "../lib/productsStore.js";
  import { site } from "../data/site.js";
  import CheckoutMiniMap from "./CheckoutMiniMap.svelte";
  import { evaluateDeliveryZone } from "../lib/geo.js";
  import {
    getAvailableDeliveryDates,
    formatSelectedDeliveryDates,
  } from "../lib/deliveryDates.js";
  import {
    getCurrentCustomer,
    isCustomerLoggedIn,
    openAuthModal,
    updateCustomerProfile,
  } from "../lib/auth.js";
  import { deductStockOnOrder, isProductAvailable, getAvailableStock } from "../lib/inventory.js";
  import { calculateDelivery, getStoreSettings } from "../lib/settingsStore.js";

  // 'cart' | 'checkout' | 'confirmed'
  let step = $state("cart");
  let items = $state([]);

  // Auth & Customer State
  let loggedInCustomer = $state(null);

  // Coupon Code State
  let couponInput = $state("");
  let appliedCoupon = $state(null);
  let couponError = $state("");
  let settingsVersion = $state(0);

  // Payment Method State
  let paymentMethod = $state("razorpay"); // 'razorpay' | 'pod'
  let paymentDetails = $state(null);
  let currentOrderId = $state("");
  const razorpayKeyId =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.PUBLIC_RAZORPAY_KEY_ID) ||
    "";

  // Delivery Details State
  let customerName = $state("");
  let customerPhone = $state("");
  let addressLine = $state("");
  let deliveryZone = $state("Kadugodi (Free / Local)");
  let deliverySlot = $state("morning"); // Strict Morning Drop only

  // Dynamic 7-day Delivery Dates Engine (users can never select today after 7 AM; next day is Tomorrow)
  let deliveryDates = $state(getAvailableDeliveryDates());
  let selectedDates = $state([deliveryDates[0]?.id || ""]);
  let showMapPicker = $state(false);

  function toggleDeliveryDate(dateId) {
    if (selectedDates.includes(dateId)) {
      if (selectedDates.length > 1) {
        selectedDates = selectedDates.filter((id) => id !== dateId);
      }
    } else {
      selectedDates = [...selectedDates, dateId];
    }
  }

  // Coordinates & Geofencing
  let customerLat = $state(12.9698);
  let customerLng = $state(77.7499);
  let currentZoneEval = $state(evaluateDeliveryZone(12.9698, 77.7499));

  // Geolocation states
  let isFetchingLocation = $state(false);
  let locationFeedback = $state("");
  let locationError = $state("");

  let isSubmitting = $state(false);
  let formError = $state("");
  let invTick = $state(0);

  // Check if any cart item exceeds available stock
  let hasSoldOutItems = $derived.by(() => {
    invTick;
    return items.some((it) => !isProductAvailable(it.productId, it.quantity));
  });

  // Confirmed Order State
  let confirmedOrder = $state(null);

  // Derived Totals (Multiplied by dropCount when multiple dates selected)
  let rawTotals = $derived(getCartTotals(items));
  let discountAmount = $derived.by(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === "percent") {
      return Math.round((rawTotals.totalPrice * appliedCoupon.value) / 100);
    }
    return Math.min(appliedCoupon.value, rawTotals.totalPrice);
  });

  let itemsSubtotal = $derived(
    Math.max(0, rawTotals.totalPrice - discountAmount),
  );
  let dropCount = $derived(Math.max(1, selectedDates.length));
  let effectiveItemsSubtotal = $derived(itemsSubtotal * dropCount);
  let deliveryCalc = $derived.by(() => {
    settingsVersion;
    return calculateDelivery(effectiveItemsSubtotal, appliedCoupon?.code);
  });
  let deliveryFee = $derived(deliveryCalc.fee);
  let podFee = $derived(paymentMethod === "pod" ? 10 : 0);
  let finalPayable = $derived(effectiveItemsSubtotal + deliveryFee + podFee);

  function handleCartUpdated(e) {
    items = e.detail?.items || getCartItems();
    if (items.length === 0 && step !== "confirmed") {
      step = "cart";
    }
  }

  function syncCustomerData() {
    loggedInCustomer = getCurrentCustomer();
    if (loggedInCustomer) {
      if (loggedInCustomer.phone && !customerPhone) {
        customerPhone = loggedInCustomer.phone;
      }
      if (loggedInCustomer.name && !customerName) {
        customerName = loggedInCustomer.name;
      }
      if (loggedInCustomer.address && !addressLine) {
        addressLine = loggedInCustomer.address;
      }
      if (loggedInCustomer.deliveryZone) {
        deliveryZone = loggedInCustomer.deliveryZone;
      }
    }
  }

  function handleMiniMapPositionChanged(data) {
    customerLat = data.lat;
    customerLng = data.lng;
    currentZoneEval = data.zone;

    if (
      data.suggestedAddress &&
      (!addressLine.trim() ||
        addressLine.includes("GPS") ||
        addressLine.includes("Whitefield / Kadugodi"))
    ) {
      addressLine = data.suggestedAddress;
    }

    const areaLower = (data.suggestedAddress || "").toLowerCase();
    if (areaLower.includes("kadugodi")) deliveryZone = "Kadugodi (Free / Local)";
    else if (areaLower.includes("whitefield")) deliveryZone = "Whitefield Core (Free / Local)";
    else if (areaLower.includes("hoodi")) deliveryZone = "Hoodi (Free / Local)";
    else if (areaLower.includes("seegehalli")) deliveryZone = "Seegehalli (Free / Local)";
    else if (areaLower.includes("belthur")) deliveryZone = "Belthur & Kumbena Agrahara (Free / Local)";
    else if (areaLower.includes("varthur")) deliveryZone = "Varthur & Balagere (Free / Local)";
    else if (areaLower.includes("hoskote")) deliveryZone = "Hoskote & Huskuru (Free / Local)";
    else if (areaLower.includes("tc palya") || areaLower.includes("ramamurthy")) deliveryZone = "TC Palya & Ramamurthy Nagar (Free / Local)";
    else if (areaLower.includes("mahadevapura") || areaLower.includes("kr puram")) deliveryZone = "Mahadevapura & KR Puram (Free / Local)";

    if (data.zone.status === "CORE") {
      locationFeedback = "Prime Harvest Zone (Morning Drop 7–10 AM)";
    } else if (data.zone.status === "EXTENDED") {
      locationFeedback = `Extended 2 km Zone (~${data.zone.distanceKm} km from border) — Deliveries available!`;
    } else {
      locationFeedback = `Outside regular morning route (~${data.zone.distanceKm} km away) — WhatsApp Express Delivery`;
    }
  }

  onMount(() => {
    refreshCartPrices(getProducts());
    items = getCartItems();
    syncCustomerData();

    const onInv = () => invTick++;
    const onSettings = () => settingsVersion++;
    window.addEventListener("osf:cart-updated", handleCartUpdated);
    window.addEventListener("osf:auth-changed", syncCustomerData);
    window.addEventListener("osf:inventory-updated", onInv);
    window.addEventListener("osf:settings-updated", onSettings);
    return () => {
      window.removeEventListener("osf:cart-updated", handleCartUpdated);
      window.removeEventListener("osf:auth-changed", syncCustomerData);
      window.removeEventListener("osf:inventory-updated", onInv);
      window.removeEventListener("osf:settings-updated", onSettings);
    };
  });

  function handleApplyCoupon() {
    couponError = "";
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    const liveSettings = getStoreSettings();
    const dynamicPromo = (liveSettings?.promo_code || "SUPER70").toUpperCase();

    if (code === dynamicPromo) {
      appliedCoupon = { code, type: "flat", value: 30, label: "PROMO SAVINGS" };
    } else if (code === "FRESH10") {
      appliedCoupon = {
        code: "FRESH10",
        type: "percent",
        value: 10,
        label: "10% OFF",
      };
    } else if (
      code === "SUPERFOODS" ||
      code === "SUPER30" ||
      code === "SUPER70"
    ) {
      appliedCoupon = { code, type: "flat", value: 30, label: "₹30 OFF" };
    } else if (code === "WELCOME") {
      appliedCoupon = {
        code: "WELCOME",
        type: "flat",
        value: 50,
        label: "₹50 OFF",
      };
    } else {
      couponError = `Invalid coupon code. Try ${dynamicPromo} or FRESH10`;
    }
  }

  function handleRemoveCoupon() {
    appliedCoupon = null;
    couponInput = "";
    couponError = "";
  }

  function handleProceedToCheckout() {
    if (items.length === 0) return;
    if (hasSoldOutItems) {
      alert(
        "Please remove sold out items from your bag before proceeding to checkout.",
      );
      return;
    }
    step = "checkout";
    formError = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function captureLiveLocation() {
    if (!navigator.geolocation) {
      locationError = "Geolocation is not supported on this device.";
      return;
    }
    isFetchingLocation = true;
    locationError = "";
    locationFeedback = "";

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        customerLat = latitude;
        customerLng = longitude;
        currentZoneEval = evaluateDeliveryZone(latitude, longitude);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          );
          const data = await res.json();
          if (data && data.address) {
            const a = data.address;
            const road = a.road || a.street || a.pedestrian || "";
            const suburb =
              a.suburb || a.neighbourhood || a.quarter || a.residential || "";
            const cityDistrict = a.city_district || a.district || "";
            const city = a.city || a.town || a.village || "Bangalore";
            const postcode = a.postcode ? ` - ${a.postcode}` : "";

            const parts = [
              road,
              suburb,
              cityDistrict,
              `${city}${postcode}`,
            ].filter(Boolean);
            const formatted = parts.join(", ");

            // Cleanly replace address without duplication
            addressLine = formatted || data.display_name || "";

            // Auto-detect zone internally
            const fullStr = (road + " " + suburb + " " + (data.display_name || "")).toLowerCase();
            if (fullStr.includes("kadugodi")) deliveryZone = "Kadugodi (Free / Local)";
            else if (fullStr.includes("whitefield")) deliveryZone = "Whitefield Core (Free / Local)";
            else if (fullStr.includes("hoodi")) deliveryZone = "Hoodi (Free / Local)";
            else if (fullStr.includes("seegehalli")) deliveryZone = "Seegehalli (Free / Local)";
            else if (fullStr.includes("belthur")) deliveryZone = "Belthur & Kumbena Agrahara (Free / Local)";
            else if (fullStr.includes("varthur")) deliveryZone = "Varthur & Balagere (Free / Local)";
            else if (fullStr.includes("hoskote")) deliveryZone = "Hoskote & Huskuru (Free / Local)";
            else if (fullStr.includes("tc palya") || fullStr.includes("ramamurthy")) deliveryZone = "TC Palya & Ramamurthy Nagar (Free / Local)";
            else if (fullStr.includes("mahadevapura") || fullStr.includes("kr puram")) deliveryZone = "Mahadevapura & KR Puram (Free / Local)";
            else deliveryZone = currentZoneEval?.label || "Whitefield & East Bengaluru";

            locationFeedback = currentZoneEval.status === "CORE"
              ? "Prime Harvest Zone detected! Adjust flat/door no. below."
              : currentZoneEval.status === "EXTENDED"
                ? "Extended Harvest Zone detected! Deliveries available."
                : "Outside morning route. Connect via WhatsApp for express delivery.";
          } else {
            addressLine = `Near Whitefield, Bangalore (GPS: ${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
            locationFeedback = "Location coordinates captured.";
          }
        } catch (e) {
          console.warn("Geocoding error", e);
          addressLine = `Whitefield / Kadugodi, Bangalore`;
          locationFeedback = "Approximated to Whitefield zone.";
        } finally {
          isFetchingLocation = false;
        }
      },
      (err) => {
        isFetchingLocation = false;
        locationError =
          "GPS permission denied or timeout. Please type your address manually.";
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
    );
  }

  async function handlePlaceAndPay() {
    formError = "";
    if (!customerName.trim()) {
      formError = "Please enter your full name.";
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      formError = "Please enter a valid 10-digit WhatsApp phone number.";
      return;
    }
    if (!addressLine.trim()) {
      formError = "Please enter or autofill your delivery address.";
      return;
    }
    if (currentZoneEval?.status === "OUTSIDE") {
      formError =
        "Your address is outside our regular morning route. Please connect with our team on WhatsApp for express delivery.";
      return;
    }

    // Check stock availability before confirming
    for (const it of items) {
      if (!isProductAvailable(it.productId, it.quantity)) {
        formError = `Sorry, "${it.name}" is sold out or exceeds available morning harvest stock. Please adjust your bag.`;
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
        zoneStatus: currentZoneEval?.status || "CORE",
      },
      deliveryDay: formatSelectedDeliveryDates(selectedDates, deliveryDates),
      deliveryDates: [...selectedDates],
      dropCount,
      deliverySlot: "Morning Drop (7:00 AM – 10:00 AM)",
      paymentMethod: paymentMethod === "razorpay" ? "razorpay" : "cod",
      paymentStatus: paymentMethod === "razorpay" ? "pending" : "cod",
      orderStatus: "placed",
      items: [...items],
      subtotal: rawTotals.totalPrice * dropCount,
      discount: discountAmount * dropCount,
      deliveryFee,
      total: finalPayable,
    };

    if (paymentMethod === "pod") {
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
        step = "confirmed";
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        console.error("Order submission failed:", err);
        formError = err?.message || "Failed to place order. Please try again.";
      } finally {
        isSubmitting = false;
      }
    } else {
      // Razorpay UPI / Online
      isSubmitting = true;
      try {
        // Phase 1: Pre-register order in Supabase before gateway modal opens
        await saveOrderToHistory(baseOrderData);
      } catch (err) {
        console.warn("Pre-registration note:", err);
      }

      if (typeof window !== "undefined" && window.Razorpay) {
        const activeKey = razorpayKeyId || "rzp_test_placeholder";
        try {
          const options = {
            key: activeKey,
            amount: Math.round(finalPayable * 100),
            currency: "INR",
            name: "Only Superfoods",
            description: `Only SuperFoods Harvest #${orderId}`,
            image: "/logo.png",
            theme: { color: "#2B5A16" },
            prefill: {
              name: customerName.trim(),
              contact: cleanPhone,
            },
            notes: {
              order_number: orderId,
              source: "web_checkout",
              address: addressLine.trim(),
            },
            handler: async function (resp) {
              try {
                const confirmedData = {
                  ...baseOrderData,
                  paymentId: resp.razorpay_payment_id,
                  paymentStatus: "paid",
                  orderStatus: "confirmed",
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
                step = "confirmed";
                window.scrollTo({ top: 0, behavior: "smooth" });
              } catch (err) {
                console.error("Paid order finalization error:", err);
              } finally {
                isSubmitting = false;
              }
            },
            modal: {
              ondismiss: function () {
                isSubmitting = false;
                formError =
                  "Payment was not completed. You can try again or choose Pay on Delivery below.";
              },
            },
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        } catch (e) {
          console.error("Razorpay invocation error", e);
          isSubmitting = false;
          formError =
            "Could not open payment gateway. Please try again or choose Pay on Delivery.";
        }
      } else {
        isSubmitting = false;
        formError =
          "Payment gateway could not load. Please choose Pay on Delivery.";
      }
    }
  }

  function getWhatsAppReceiptLink() {
    if (!confirmedOrder) return site.whatsapp.link;
    const itemsSummary = confirmedOrder.items
      .map(
        (i) =>
          `• ${i.quantity}x ${i.name} (${i.packSize}) — ₹${i.price * i.quantity}`,
      )
      .join("\n");

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

    return `https://wa.me/917019760360?text=${encodeURIComponent(msg)}`;
  }
</script>

<div class="mx-auto max-w-[440px] px-4 pt-2 pb-12 font-sans text-[#0B1F2E]">
  <!-- Sub Header Nav -->
  <div
    class="flex items-center justify-between pb-3 border-b border-[#E4E4DC]/80 mb-3"
  >
    <button
      onclick={() => {
        if (step === "checkout") step = "cart";
        else if (step === "confirmed") step = "cart";
        else window.location.href = "/";
      }}
      class="inline-flex items-center gap-1.5 text-xs font-bold text-[#2B5A16] hover:text-[#1e3f0f] transition-colors press"
    >
      <div
        class="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F7F2] text-[#0B1F2E] border border-[#E4E4DC]"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
      <span class="text-[13px] font-semibold text-[#0B1F2E]/80">
        {step === "cart" ? "Continue Shopping" : "Back to Fresh Bag"}
      </span>
    </button>

    <span
      class="text-[11px] font-bold uppercase tracking-wider text-[#2B5A16] bg-[#A8D632]/15 px-2.5 py-1 rounded-full border border-[#A8D632]/30"
    >
      Farm Bag
    </span>
  </div>

  <!-- ════════════════════════════════════════════════════════ -->
  <!-- SCREEN 1: "Your Fresh Bag (qty)" -->
  <!-- ════════════════════════════════════════════════════════ -->
  {#if step === "cart"}
    <div class="space-y-4">
      <div>
        <h1
          class="text-[1.65rem] font-bold text-[#0B1F2E] leading-tight"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Your Fresh Bag ({rawTotals.totalCount})
        </h1>
        <p class="mt-0.5 text-xs text-[#4A5A52]">
          Fresh, local and harvested for your chosen morning drop.
        </p>
      </div>

      <!-- Harvest Guarantee Banner -->
      <div
        class="flex items-center gap-3 rounded-2xl bg-[#F2F8EA] p-3.5 border border-[#A8D632]/40 shadow-2xs"
      >
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#2B5A16] shadow-2xs"
        >
          <svg class="h-5 w-5 fill-current" viewBox="0 0 24 24">
            <path
              d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"
            />
          </svg>
        </div>
        <div>
          <div class="text-xs font-bold text-[#0B1F2E]">Harvest Guarantee</div>
          <div class="text-[11px] leading-snug text-[#4A5A52]">
            All items will be harvested and packed at 5:30 AM dawn in Kadugodi.
          </div>
        </div>
      </div>

      {#if items.length === 0}
        <div
          class="rounded-2xl border border-[#E4E4DC] p-8 text-center bg-[#F7F7F2]/50"
        >
          <div
            class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EBF5D9] text-[#2B5A16]"
          >
            🧺
          </div>
          <h3 class="text-base font-bold text-[#0B1F2E]">Your bag is empty</h3>
          <p class="mt-1 text-xs text-[#4A5A52]">
            Explore our fresh oyster mushrooms, microgreens, and kombucha!
          </p>
          <a
            href="/#products"
            class="mt-4 inline-block rounded-xl bg-[#2B5A16] px-5 py-2.5 text-xs font-bold text-white press"
          >
            Start Shopping
          </a>
        </div>
      {:else}
        <!-- Items List -->
        <div class="space-y-3">
          {#each items as item (item.key)}
            {@const isAvail = isProductAvailable(item.productId, item.quantity)}
            <div
              class="flex items-center gap-3 rounded-2xl border p-3 bg-white shadow-2xs {isAvail
                ? 'border-[#E4E4DC]'
                : 'border-red-300 bg-red-50/40'}"
            >
              <img
                src={item.image}
                alt={item.name}
                class="h-16 w-16 shrink-0 rounded-xl object-cover bg-[#F7F7F2] border border-[#E4E4DC]/80"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-1">
                  <h4 class="text-xs font-bold text-[#0B1F2E] truncate">
                    {item.name}
                  </h4>
                  <span class="text-xs font-bold text-[#0B1F2E] shrink-0">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
                <p class="text-[11px] text-[#4A5A52] mt-0.5">
                  {item.packSize} • ₹{item.price}
                </p>

                {#if !isAvail}
                  <div
                    class="mt-1 inline-flex items-center gap-1 rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-[9.5px] font-bold"
                  >
                    <span>⚠️ Sold Out for Today</span>
                  </div>
                {/if}

                <div class="mt-2.5 flex items-center justify-between">
                  <div
                    class="flex items-center rounded-lg border border-[#E4E4DC] bg-[#F7F7F2] px-1 py-0.5"
                  >
                    <button
                      type="button"
                      onclick={() => updateItemQuantity(item.key, -1)}
                      class="flex h-5 w-5 items-center justify-center text-xs font-bold text-[#4A5A52] hover:text-[#0B1F2E] press"
                    >
                      −
                    </button>
                    <span
                      class="w-6 text-center text-xs font-bold text-[#0B1F2E]"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onclick={() => {
                        const usedForProduct = items
                          .filter((x) => x.productId === item.productId)
                          .reduce((s, x) => s + x.quantity, 0);
                        if (usedForProduct < getAvailableStock(item.productId)) {
                          updateItemQuantity(item.key, 1);
                        }
                      }}
                      disabled={items
                        .filter((x) => x.productId === item.productId)
                        .reduce((s, x) => s + x.quantity, 0) >=
                        getAvailableStock(item.productId)}
                      class="flex h-5 w-5 items-center justify-center text-xs font-bold text-[#4A5A52] hover:text-[#0B1F2E] disabled:opacity-35 press"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onclick={() => removeItem(item.key)}
                    class="p-1 text-[#EF4444] hover:bg-red-50 rounded-md transition-colors press"
                    aria-label="Remove item"
                  >
                    <svg
                      class="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="3 6 5 6 21 6" /><path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Upsell Card -->
        <a
          href="/#products"
          class="flex w-full items-center justify-between rounded-2xl bg-[#F7F7F2] p-3 text-left border border-[#E4E4DC] hover:border-[#A8D632] transition-colors press block"
        >
          <div class="flex items-center gap-3">
            <span class="text-xl">🌱</span>
            <div>
              <div class="text-xs font-bold text-[#0B1F2E]">
                Add more to your bag?
              </div>
              <div class="text-[11px] text-[#4A5A52]">
                Explore mushrooms, microgreens, kombucha and more fresh picks.
              </div>
            </div>
          </div>
          <svg
            class="h-4 w-4 text-[#4A5A52]"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clip-rule="evenodd"
            />
          </svg>
        </a>

        <!-- Coupon Code Box -->
        <div class="rounded-2xl border border-[#E4E4DC] p-3 bg-white space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-base">🎟️</span>
            <span class="text-xs font-bold text-[#0B1F2E]"
              >Have a coupon code?</span
            >
          </div>
          {#if appliedCoupon}
            <div
              class="flex items-center justify-between rounded-xl bg-[#EBF5D9] p-2 text-xs font-bold text-[#2B5A16] border border-[#A8D632]/40"
            >
              <span>✓ {appliedCoupon.code} Applied ({appliedCoupon.label})</span>
              <button
                onclick={handleRemoveCoupon}
                class="text-[11px] underline text-[#4A5A52] hover:text-[#0B1F2E]"
              >
                Remove
              </button>
            </div>
          {:else}
            <div class="flex gap-2">
              <input
                type="text"
                bind:value={couponInput}
                placeholder="Enter code (e.g. FRESH10)"
                class="flex-1 rounded-xl border border-[#E4E4DC] bg-[#F7F7F2] px-3 py-2 text-xs uppercase font-semibold text-[#0B1F2E] placeholder-[#9CA3AF] focus:border-[#2B5A16] focus:outline-none"
              />
              <button
                type="button"
                onclick={handleApplyCoupon}
                class="rounded-xl bg-[#2B5A16] hover:bg-[#224711] px-4 py-2 text-xs font-bold text-white press"
              >
                Apply
              </button>
            </div>
            {#if couponError}
              <p class="text-[10px] text-red-500 font-medium">{couponError}</p>
            {/if}
          {/if}
        </div>

        <!-- Order Summary -->
        <div
          class="rounded-2xl border border-[#E4E4DC] p-4 bg-white space-y-2.5"
        >
          <h3
            class="text-sm font-bold text-[#0B1F2E]"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Order Summary
          </h3>

          <div class="flex justify-between text-xs text-[#4A5A52]">
            <span>Subtotal ({rawTotals.totalCount} items)</span>
            <span class="font-bold text-[#0B1F2E]">₹{rawTotals.totalPrice}</span>
          </div>

          {#if appliedCoupon}
            <div class="flex justify-between text-xs text-[#2B5A16] font-semibold">
              <span>Coupon ({appliedCoupon.code})</span>
              <span>−₹{discountAmount}</span>
            </div>
          {/if}

          <div class="flex justify-between text-xs text-[#4A5A52]">
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

          <div
            class="flex items-baseline justify-between border-t border-[#E4E4DC] pt-2 text-sm font-bold text-[#0B1F2E]"
          >
            <span>Total Payable</span>
            <span class="text-lg font-black text-[#2B5A16]">₹{finalPayable}</span>
          </div>
        </div>

        {#if hasSoldOutItems}
          <div
            class="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2"
          >
            <span>⚠️</span>
            <span>Some harvest items have sold out for today. Please remove them to proceed.</span>
          </div>
          <button
            type="button"
            disabled
            class="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-200 py-3.5 text-xs font-bold text-slate-400 cursor-not-allowed border border-slate-300"
          >
            <span>Remove Sold-Out Item(s) to Proceed</span>
          </button>
        {:else}
          <button
            type="button"
            onclick={handleProceedToCheckout}
            class="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2B5A16] hover:bg-[#224711] py-3.5 text-xs font-bold text-white shadow-xs active:scale-98 transition-all press"
          >
            <span>Proceed to Delivery &amp; Checkout</span>
            <span aria-hidden="true">→</span>
          </button>
        {/if}

        <div
          class="flex items-center justify-around border-t border-[#E4E4DC] pt-3 text-[10px] text-[#4A5A52]"
        >
          <div class="flex items-center gap-1">
            🌱 <span>Freshly harvested</span>
          </div>
          <div class="flex items-center gap-1">
            🚚 <span>On-time delivery</span>
          </div>
          <div class="flex items-center gap-1">
            💚 <span>Same fair price</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- SCREEN 2: Unified Progressive Checkout (Address & Radar First -> Payment) -->
    <!-- ════════════════════════════════════════════════════════ -->
  {:else if step === "checkout"}
    <div class="space-y-4">
      <!-- 2-Step Stepper Header -->
      <div
        class="flex items-center justify-between border-b border-[#E4E4DC] pb-3 text-center"
      >
        <div class="flex-1">
          <div class="flex items-center justify-center">
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-white text-[11px] font-bold"
            >
              1
            </div>
          </div>
          <div class="mt-1 text-[11px] font-bold text-[#2B5A16]">Delivery &amp; Details</div>
          <div class="text-[9px] text-[#4A5A52] leading-tight">
            Verified Zone
          </div>
        </div>
        <div class="h-0.5 w-8 bg-[#E4E4DC]"></div>

        <div class="flex-1">
          <div class="flex items-center justify-center">
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-white text-[11px] font-bold"
            >
              2
            </div>
          </div>
          <div class="mt-1 text-[11px] font-bold text-[#2B5A16]">
            Payment &amp; Drop
          </div>
          <div class="text-[9px] text-[#4A5A52] leading-tight">
            UPI / Pay on Delivery
          </div>
        </div>
        <div class="h-0.5 w-8 bg-[#E4E4DC]"></div>

        <div class="flex-1">
          <div class="flex items-center justify-center">
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full border border-[#CBD5E1] bg-white text-[#94A3B8] text-[11px] font-bold"
            >
              3
            </div>
          </div>
          <div class="mt-1 text-[11px] font-semibold text-[#94A3B8]">
            All Set!
          </div>
          <div class="text-[9px] text-[#94A3B8] leading-tight">
            Fresh bag ready
          </div>
        </div>
      </div>

      <!-- SECTION 1: Delivery Details Card -->
      <div
        class="rounded-2xl border border-[#E4E4DC] p-4 bg-white space-y-4 shadow-2xs"
      >
        <div class="flex items-center justify-between pb-2 border-b border-[#E4E4DC]">
          <div class="flex items-center gap-2">
            <span class="text-base">📍</span>
            <h3 class="text-sm font-bold text-[#0B1F2E]">1. Delivery Details &amp; Radar</h3>
          </div>
          <span class="text-[10px] font-bold text-[#2B5A16] bg-[#EBF5D9] px-2 py-0.5 rounded-full border border-[#A8D632]/50">
            {currentZoneEval.badge || 'Local Drop'}
          </span>
        </div>

        <!-- WhatsApp Fast Login Auto-fill Banner -->
        {#if !loggedInCustomer?.phone}
          <div
            class="flex items-center justify-between rounded-xl bg-[#FAF7F0] border border-[#E4E4DC] p-3 text-xs"
          >
            <div class="flex items-center gap-2">
              <span class="text-base text-[#25D366]">💬</span>
              <span class="text-[#0B1F2E] font-medium"
                >Already ordered before?</span
              >
            </div>
            <button
              type="button"
              onclick={() => openAuthModal("login")}
              class="font-bold text-[#25D366] hover:underline"
            >
              Log In &amp; Auto-fill →
            </button>
          </div>
        {:else}
          <div
            class="flex items-center justify-between rounded-xl bg-[#E8F8EE] border border-[#A8D632]/50 p-2.5 text-xs"
          >
            <div class="flex items-center gap-2">
              <span class="text-emerald-600 font-bold">✓</span>
              <span class="text-[#0B1F2E]">
                Auto-filled for <strong>+91 {loggedInCustomer.phone}</strong>
                {loggedInCustomer.name ? `(${loggedInCustomer.name})` : ""}
              </span>
            </div>
            <button
              type="button"
              onclick={() => openAuthModal("login")}
              class="text-[10.5px] font-semibold text-[#4A5A52] hover:underline"
            >
              Switch
            </button>
          </div>
        {/if}

        <div>
          <label
            for="cart-page-name"
            class="block text-xs font-bold text-[#0B1F2E] mb-1"
          >
            Full Name *
          </label>
          <input
            id="cart-page-name"
            type="text"
            bind:value={customerName}
            placeholder="e.g. Priya Sharma"
            class="w-full rounded-xl border border-[#E4E4DC] bg-[#F7F7F2] px-3.5 py-2.5 text-xs font-medium text-[#0B1F2E] placeholder-[#9CA3AF] focus:border-[#2B5A16] focus:outline-none"
          />
        </div>

        <div>
          <label
            for="cart-page-phone"
            class="block text-xs font-bold text-[#0B1F2E] mb-1"
          >
            WhatsApp Mobile Number *
          </label>
          <div class="flex gap-2">
            <div
              class="flex items-center justify-center rounded-xl border border-[#E4E4DC] bg-[#F7F7F2] px-3 text-xs font-bold text-[#0B1F2E]"
            >
              +91
            </div>
            <div class="relative flex-1">
              <input
                id="cart-page-phone"
                type="tel"
                bind:value={customerPhone}
                placeholder="9876543210"
                maxlength="10"
                class="w-full rounded-xl border border-[#E4E4DC] bg-[#F7F7F2] pl-3.5 pr-9 py-2.5 text-xs font-medium text-[#0B1F2E] placeholder-[#9CA3AF] focus:border-[#2B5A16] focus:outline-none"
              />
              <div
                class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#25D366]"
              >
                <svg class="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path
                    d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Address with Select from Map & Live Location buttons -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label
              for="cart-page-address"
              class="text-xs font-bold text-[#0B1F2E]"
            >
              Delivery Address *
            </label>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onclick={() => (showMapPicker = !showMapPicker)}
                class={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10.5px] font-bold border transition-colors press ${
                  showMapPicker
                    ? "bg-[#2B5A16] text-white border-[#2B5A16]"
                    : "bg-[#F2F8EA] hover:bg-[#E4F0D2] text-[#2B5A16] border-[#A8D632]/60"
                }`}
              >
                <span>🗺️</span>
                <span>{showMapPicker ? "Close Map" : "Select from Map"}</span>
              </button>
              <button
                type="button"
                onclick={captureLiveLocation}
                disabled={isFetchingLocation}
                class="inline-flex items-center gap-1 rounded-lg bg-[#EBF5D9] hover:bg-[#E0EFC9] px-2.5 py-1 text-[10.5px] font-bold text-[#2B5A16] border border-[#A8D632]/50 transition-colors press"
              >
                <span>📍</span>
                <span>{isFetchingLocation ? "Locating..." : "Use Live Location"}</span>
              </button>
            </div>
          </div>

          <!-- Interactive Checkout Mini-Map (toggled via "Select from Map" button) -->
          {#if showMapPicker}
            <div class="mb-3 rounded-2xl border border-[#A8D632] p-2 bg-[#FAF7F0] space-y-1.5 shadow-xs">
              <div class="flex items-center justify-between text-[11px] font-bold text-[#2B5A16] px-1">
                <span class="flex items-center gap-1"><span>📍</span> Tap or drag pin to your exact delivery doorstep</span>
                <button
                  type="button"
                  onclick={() => (showMapPicker = false)}
                  class="text-xs text-[#4A5A52] hover:text-[#0B1F2E]"
                >
                  ✕ Close
                </button>
              </div>
              <CheckoutMiniMap
                lat={customerLat}
                lng={customerLng}
                onPositionChanged={handleMiniMapPositionChanged}
              />
            </div>
          {/if}

          <textarea
            id="cart-page-address"
            bind:value={addressLine}
            rows="3"
            placeholder="Flat 402, Building / Society Name, Street, Landmark, Whitefield"
            class="w-full rounded-xl border border-[#E4E4DC] bg-[#F7F7F2] p-3 text-xs font-medium text-[#0B1F2E] placeholder-[#9CA3AF] focus:border-[#2B5A16] focus:outline-none leading-relaxed"
          ></textarea>

          {#if locationFeedback}
            <p
              class="mt-1 text-[10px] font-bold text-[#2B5A16] flex items-center gap-1"
            >
              <span>✓</span>
              {locationFeedback}
            </p>
          {/if}
          {#if locationError}
            <p class="mt-1 text-[10px] font-semibold text-red-500">
              {locationError}
            </p>
          {/if}
        </div>

        <!-- Real-time Serviceability Status Box -->
        {#if currentZoneEval.status === "CORE"}
          <div
            class="flex items-center gap-3 rounded-xl bg-[#EBF5D9] p-3 border border-[#A8D632]/50"
          >
            <span class="text-xl shrink-0">✅</span>
            <div class="text-[11px] leading-snug text-[#2B5A16]">
              <strong>Prime Harvest Zone: Kadugodi &amp; Whitefield</strong><br />
              Harvested fresh at 5:30 AM dawn in Kadugodi, delivered between 7:00 AM – 10:00 AM.
            </div>
          </div>
        {:else if currentZoneEval.status === "EXTENDED"}
          <div
            class="flex items-center gap-3 rounded-xl bg-lime-50 p-3 border border-lime-300"
          >
            <span class="text-xl shrink-0">📍</span>
            <div class="text-[11px] leading-snug text-lime-900">
              <strong>Extended Harvest Zone (~{currentZoneEval.distanceKm} km from route)</strong><br />
              Deliveries available! You are within our morning extended harvest buffer.
            </div>
          </div>
        {:else}
          <!-- OUTSIDE ZONE NOTICE & WHATSAPP CONCIERGE -->
          <div class="rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-3">
            <div class="flex items-start gap-2.5">
              <span class="text-xl shrink-0">🌾</span>
              <div class="space-y-1">
                <h4 class="text-xs font-bold text-amber-900">
                  Sorry, you are outside our direct morning delivery zone (~{currentZoneEval.distanceKm} km away)
                </h4>
                <p class="text-[10.5px] leading-relaxed text-amber-800">
                  Our growers harvest daily at 5:30 AM dawn in Kadugodi. To guarantee peak mushroom texture and living microgreen freshness, our morning direct vans operate within Whitefield &amp; East Bengaluru.
                </p>
              </div>
            </div>

            <div class="border-t border-amber-200/80 pt-2.5">
              <p class="text-xs font-medium text-amber-950 mb-2">
                Connect with the <strong>Only Superfoods</strong> team for express (Porter, Rapido, etc.) delivery within Bangalore:
              </p>
              <a
                href="https://wa.me/917760350360?text={encodeURIComponent(
                  `Hi Only Superfoods! I am located at ${addressLine.trim() || 'my address'} (outside the regular morning route) and would like to arrange an express delivery via Porter/Rapido for fresh superfoods.`
                )}"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[#25D366] hover:bg-[#1ebd5a] px-3.5 py-2.5 text-xs font-bold text-white shadow-xs press transition-colors"
              >
                <span>💬 Connect with Team for Express Delivery (WhatsApp) →</span>
              </a>

              <div class="mt-2 text-center">
                <a
                  href="/#delivery"
                  class="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2B5A16] hover:underline"
                >
                  <span>🗺️</span> View our serviceable morning delivery zones on map →
                </a>
              </div>
            </div>
          </div>
        {/if}

        <!-- Preferred Delivery Date Selector (7-Day horizon, "Tomorrow" label, Multi-Select) -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span
              class="block text-xs font-bold text-[#0B1F2E] flex items-center gap-1"
            >
              <span>🗓</span> Preferred Delivery Date *
            </span>
            <span class="text-[10px] text-[#4A5A52] font-medium">
              Multi-select available
            </span>
          </div>

          <div class="flex items-center gap-1.5 overflow-x-auto pb-1.5 -mx-1 px-1 scrollbar-none">
            {#each deliveryDates as d}
              {@const isSelected = selectedDates.includes(d.id)}
              <button
                type="button"
                onclick={() => toggleDeliveryDate(d.id)}
                class={`shrink-0 flex flex-col items-center justify-center rounded-xl py-2 px-3 text-center transition-all press min-w-[70px] ${
                  isSelected
                    ? "border-2 border-[#2B5A16] bg-[#F2F8EA] text-[#2B5A16] shadow-2xs font-bold ring-1 ring-[#2B5A16]"
                    : "border border-[#E4E4DC] bg-[#F7F7F2] text-[#4A5A52] hover:border-[#A8D632] font-medium"
                }`}
              >
                <span class="text-xs font-bold leading-tight flex items-center gap-1">
                  {#if isSelected}<span>✓</span>{/if}
                  {d.displayLabel}
                </span>
                <span class="text-[9.5px] opacity-75 mt-0.5 whitespace-nowrap">{d.subLabel}</span>
              </button>
            {/each}
          </div>

          {#if selectedDates.length > 1}
            <div class="mt-2 flex items-center justify-between rounded-lg bg-[#EBF5D9] px-2.5 py-1.5 border border-[#A8D632]/50 text-[11px] text-[#2B5A16]">
              <span class="font-bold flex items-center gap-1">
                <span>🧺</span> {selectedDates.length} Morning Drops Selected
              </span>
              <span class="text-[10px] font-semibold text-[#2B5A16]/80">
                Cart items multiplied by {selectedDates.length} drops
              </span>
            </div>
          {/if}
        </div>

        <div>
          <div
            class="block text-xs font-bold text-[#0B1F2E] mb-1.5 flex items-center justify-between"
          >
            <span class="flex items-center gap-1"
              ><span>🌅</span> Delivery Window</span
            >
            <span
              class="rounded-full bg-[#E2F0D9] px-2 py-0.5 text-[10px] font-bold text-[#2B5A16]"
              >Strict Dawn Drop</span
            >
          </div>
          <div
            class="rounded-xl border border-[#2B5A16] bg-[#FDF8EE] p-3 text-left ring-1 ring-[#2B5A16]"
          >
            <div class="flex items-center justify-between">
              <div
                class="flex items-center gap-1.5 text-xs font-bold text-[#0B1F2E]"
              >
                <span>☀️</span>
                <span>Morning Drop (7:00 AM – 10:00 AM)</span>
              </div>
            </div>
            <p class="text-[10px] text-[#4A5A52] mt-1 leading-snug">
              Harvested fresh at 5:30 AM dawn in Kadugodi. Orders placed before <strong
                >11:59 PM</strong
              > receive next-morning delivery (7:00 AM – 10:00 AM).
            </p>
          </div>
        </div>
      </div>

      <!-- SECTION 2: Payment Method Card (Directly Below Section 1 on Same Page) -->
      <div
        class="rounded-2xl border border-[#E4E4DC] p-4 bg-white space-y-3.5 shadow-2xs"
      >
        <div class="flex items-center gap-2 pb-2 border-b border-[#E4E4DC]">
          <span class="text-base">💳</span>
          <h3 class="text-sm font-bold text-[#0B1F2E]">2. Choose a Payment Method</h3>
        </div>

        {#if currentZoneEval.status === "OUTSIDE"}
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-500">
            🔒 Online payment is locked because your address is outside our morning van route. Please use the WhatsApp button above to coordinate express delivery via Porter or Rapido.
          </div>
        {:else}
          <div class="space-y-3">
            <!-- Razorpay UPI / Cards -->
            <button
              type="button"
              onclick={() => (paymentMethod = "razorpay")}
              class={`w-full rounded-2xl border p-3.5 text-left transition-all press ${
                paymentMethod === "razorpay"
                  ? "border-[#2B5A16] bg-[#F2F8EA]/40 ring-1 ring-[#2B5A16]"
                  : "border-[#E4E4DC] bg-white hover:border-[#A8D632]"
              }`}
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2.5">
                  <div
                    class="flex h-7 w-7 items-center justify-center rounded-full bg-[#2B5A16] text-white"
                  >
                    ⚡
                  </div>
                  <div>
                    <div
                      class="inline-block rounded-full bg-[#FF6B35] px-2 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider mb-1"
                    >
                      Recommended • Zero Fee
                    </div>
                    <div class="text-xs font-bold text-[#0B1F2E]">
                      UPI / Cards (Razorpay Auto-Confirm)
                    </div>
                  </div>
                </div>

                <div
                  class={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "razorpay"
                      ? "border-[#2B5A16] bg-[#2B5A16]"
                      : "border-[#CBD5E1]"
                  }`}
                >
                  {#if paymentMethod === "razorpay"}
                    <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
                  {/if}
                </div>
              </div>

              <p class="mt-2 text-[11px] leading-relaxed text-[#4A5A52] pl-9">
                Fast, secure and no convenience charges. GPay, PhonePe, Paytm, Cards.
              </p>
            </button>

            <!-- Pay on Delivery -->
            <button
              type="button"
              onclick={() => (paymentMethod = "pod")}
              class={`w-full rounded-2xl border p-3.5 text-left transition-all press ${
                paymentMethod === "pod"
                  ? "border-[#2B5A16] bg-[#F2F8EA]/40 ring-1 ring-[#2B5A16]"
                  : "border-[#E4E4DC] bg-white hover:border-[#A8D632]"
              }`}
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2.5">
                  <div
                    class="flex h-7 w-7 items-center justify-center rounded-full bg-[#F7F7F2] text-sm border border-[#E4E4DC]"
                  >
                    💵
                  </div>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold text-[#0B1F2E]"
                        >Pay on Delivery (UPI / Cash)</span
                      >
                      <span
                        class="rounded-full bg-[#FFEDD5] px-2 py-0.2 text-[9px] font-bold text-[#C2410C]"
                      >
                        + ₹10
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  class={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "pod"
                      ? "border-[#2B5A16] bg-[#2B5A16]"
                      : "border-[#CBD5E1]"
                  }`}
                >
                  {#if paymentMethod === "pod"}
                    <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
                  {/if}
                </div>
              </div>

              <p class="mt-2 text-[11px] leading-relaxed text-[#4A5A52] pl-9">
                ₹10 convenience fee applies to support doorstep handling.
              </p>
            </button>
          </div>
        {/if}

        <!-- 100% Secure Payments Box -->
        <div
          class="flex items-center gap-3 rounded-xl bg-[#F7F7F2] p-3 border border-[#E4E4DC]"
        >
          <span class="text-base">🔒</span>
          <div class="text-[11px] text-[#4A5A52]">
            Bank-grade 256-bit encryption. Handled securely via Razorpay.
          </div>
        </div>
      </div>

      <!-- SECTION 3: Summary & Final Order Action -->
      <div class="rounded-2xl border border-[#E4E4DC] p-4 bg-white space-y-2.5 shadow-2xs">
        <div class="flex justify-between text-xs text-[#4A5A52]">
          <span>Items Total ({rawTotals.totalCount} items{#if selectedDates.length > 1} × {selectedDates.length} drops{/if})</span>
          <span class="font-bold text-[#0B1F2E]">₹{effectiveItemsSubtotal}</span>
        </div>

        <div class="flex justify-between text-xs text-[#4A5A52]">
          <span>Dawn Express Delivery</span>
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

        {#if paymentMethod === "pod" && currentZoneEval.status !== "OUTSIDE"}
          <div class="flex justify-between text-xs text-[#C2410C]">
            <span>Convenience fee (POD)</span>
            <span>+₹10</span>
          </div>
        {/if}

        <div class="flex items-baseline justify-between border-t border-[#E4E4DC] pt-2 text-sm font-bold text-[#0B1F2E]">
          <span>Total Payable</span>
          <span class="text-lg font-black text-[#2B5A16]">₹{finalPayable}</span>
        </div>

        {#if formError}
          <div
            class="rounded-xl bg-red-50 p-2.5 text-xs text-red-600 font-semibold border border-red-200"
          >
            {formError}
          </div>
        {/if}

        <!-- Step-Specific Primary Action CTA -->
        {#if currentZoneEval.status === "OUTSIDE"}
          <div class="space-y-1.5 pt-1">
            <a
              href="https://wa.me/917760350360?text={encodeURIComponent(
                `Hi Only Superfoods! I am located at ${addressLine.trim() || 'my address'} (outside the regular morning route) and would like to arrange an express delivery via Porter/Rapido for fresh superfoods.`
              )}"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebd5a] py-3.5 text-xs font-bold text-white shadow-xs press transition-colors"
            >
              <span>💬 Connect with Team for Express Delivery →</span>
            </a>
            <p class="text-center text-[10px] text-amber-700 font-medium">
              Online checkout is disabled outside East Bengaluru. We fulfill Bangalore-wide orders via Porter/Rapido.
            </p>
          </div>
        {:else if paymentMethod === "razorpay"}
          <button
            type="button"
            onclick={handlePlaceAndPay}
            disabled={isSubmitting}
            class="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2B5A16] hover:bg-[#224711] disabled:bg-slate-300 py-3.5 text-xs font-bold text-white shadow-xs active:scale-98 transition-all press"
          >
            <span>{isSubmitting ? "Securing Morning Slot..." : `Pay ₹${finalPayable} via UPI & Confirm ${selectedDates.length > 1 ? `${selectedDates.length} Drops` : "Drop"} →`}</span>
          </button>
        {:else if paymentMethod === "pod"}
          <button
            type="button"
            onclick={handlePlaceAndPay}
            disabled={isSubmitting}
            class="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2B5A16] hover:bg-[#224711] disabled:bg-slate-300 py-3.5 text-xs font-bold text-white shadow-xs active:scale-98 transition-all press"
          >
            <span>{isSubmitting ? "Placing Order..." : `Place Order (Pay ₹${finalPayable} on Delivery) →`}</span>
          </button>
        {/if}
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- SCREEN 3: "All Set!" (Confirmed Order View) -->
    <!-- ════════════════════════════════════════════════════════ -->
  {:else if step === "confirmed" && confirmedOrder}
    <div class="space-y-4">
      <div
        class="flex items-center justify-between border-b border-[#E4E4DC] pb-3 text-center"
      >
        <div class="flex-1">
          <div class="flex items-center justify-center">
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-white text-[11px] font-bold"
            >
              ✓
            </div>
          </div>
          <div class="mt-1 text-[11px] font-bold text-[#2B5A16]">Delivery</div>
        </div>
        <div class="h-0.5 w-8 bg-[#2B5A16]"></div>

        <div class="flex-1">
          <div class="flex items-center justify-center">
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-white text-[11px] font-bold"
            >
              ✓
            </div>
          </div>
          <div class="mt-1 text-[11px] font-bold text-[#2B5A16]">Payment</div>
        </div>
        <div class="h-0.5 w-8 bg-[#2B5A16]"></div>

        <div class="flex-1">
          <div class="flex items-center justify-center">
            <div
              class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2B5A16] text-white text-[11px] font-bold"
            >
              3
            </div>
          </div>
          <div class="mt-1 text-[11px] font-bold text-[#2B5A16]">All Set!</div>
        </div>
      </div>

      <div class="text-center pt-2">
        <div
          class="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[#EBF5D9] text-3xl shadow-sm"
        >
          🌱
        </div>
        <h2
          class="text-[1.65rem] font-bold text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Order Confirmed!
        </h2>
        <p class="mt-1 text-xs text-[#4A5A52]">
          Order ID: <strong class="text-[#2B5A16]"
            >#{confirmedOrder.orderId}</strong
          >
        </p>
      </div>

      <div
        class="rounded-2xl border border-[#E4E4DC] p-4 bg-white space-y-3 shadow-2xs"
      >
        <div
          class="text-xs font-bold text-[#0B1F2E] pb-2 border-b border-[#E4E4DC]"
        >
          Delivery Summary
        </div>

        <div class="text-xs space-y-1.5 text-[#4A5A52]">
          <div>
            <strong>Recipient:</strong>
            {confirmedOrder.customer.name} ({confirmedOrder.customer.phone})
          </div>
          <div><strong>Address:</strong> {confirmedOrder.customer.address}</div>
          <div>
            <strong>Delivery Date:</strong> {confirmedOrder.deliveryDay} • {confirmedOrder.deliverySlot}
          </div>
          <div>
            <strong>Payment:</strong>
            {confirmedOrder.paymentMethod === "razorpay"
              ? "UPI / Cards (Razorpay)"
              : "Pay on Delivery (Cash / UPI)"}
          </div>
          <div><strong>Total:</strong> ₹{confirmedOrder.total}</div>
        </div>

        {#if confirmedOrder.paymentStatus === "paid"}
          <div
            class="rounded-xl bg-[#EBF5D9] p-2.5 text-center text-xs font-bold text-[#2B5A16] border border-[#A8D632]/50"
          >
            ✓ Payment Verified &amp; Confirmed
          </div>
        {:else if confirmedOrder.paymentMethod === "razorpay"}
          <div
            class="rounded-xl bg-amber-50 p-2.5 text-center text-xs font-semibold text-amber-700 border border-amber-200"
          >
            ⏳ Payment Pending — Share to WhatsApp to complete
          </div>
        {/if}

        <div class="border-t border-[#E4E4DC] pt-3 space-y-2">
          <div class="text-xs font-bold text-[#0B1F2E]">Items in Bag</div>
          {#each confirmedOrder.items as itm}
            <div class="flex justify-between text-xs text-[#4A5A52]">
              <span>{itm.quantity}× {itm.name} ({itm.packSize})</span>
              <span class="font-bold text-[#0B1F2E]">₹{itm.price * itm.quantity}</span>
            </div>
          {/each}
        </div>
      </div>

      <a
        href={getWhatsAppReceiptLink()}
        target="_blank"
        rel="noopener noreferrer"
        class="w-full flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebd5a] py-3.5 text-xs font-bold text-white shadow-xs active:scale-98 transition-all press"
      >
        <svg class="h-4 w-4 fill-current" viewBox="0 0 24 24">
          <path
            d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92z"
          />
        </svg>
        <span>Send Order to Farm WhatsApp</span>
      </a>

      <a
        href="/"
        class="w-full flex items-center justify-center rounded-xl border border-[#E4E4DC] bg-white hover:bg-[#F7F7F2] py-3 text-xs font-bold text-[#4A5A52] press"
      >
        Done Shopping
      </a>
    </div>
  {/if}
</div>

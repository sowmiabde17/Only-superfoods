/**
 * src/lib/subscriptionStore.js — Centralized Subscription Management Engine
 *
 * Core capabilities:
 * 1. Multi-day independent basket customization (e.g. Eggs on Monday, Mushrooms on Thursday)
 * 2. Frequency support: 1x, 2x, 3x, 4x drops per week (selectable Mon-Sat)
 * 3. Plan durations: Monthly (4 wks - 5% off), Quarterly (12 wks - 10% off), Rolling (flexible weekly)
 * 4. Free morning harvest delivery for subscribers
 * 5. Persistence in localStorage ('osf_subscriptions') and sync to Supabase
 * 6. Active subscription management (pause, resume, cancel)
 */

export const SUBSCRIPTIONS_STORAGE_KEY = 'osf_subscriptions';

export const DAYS_OF_WEEK = [
  { id: 'Monday', label: 'Mon', full: 'Monday' },
  { id: 'Tuesday', label: 'Tue', full: 'Tuesday' },
  { id: 'Wednesday', label: 'Wed', full: 'Wednesday' },
  { id: 'Thursday', label: 'Thu', full: 'Thursday' },
  { id: 'Friday', label: 'Fri', full: 'Friday' },
  { id: 'Saturday', label: 'Sat', full: 'Saturday' },
];

export const PLAN_DURATIONS = {
  monthly: {
    id: 'monthly',
    name: 'Monthly Routine',
    weeks: 4,
    discountPercent: 5,
    tag: '5% OFF · POPULAR',
    description: '4-week steady replenishment with 5% harvest savings & free delivery.',
  },
  quarterly: {
    id: 'quarterly',
    name: 'Quarterly Seasonal',
    weeks: 12,
    discountPercent: 10,
    tag: '10% OFF · BEST VALUE',
    description: '12-week seasonal routine with maximum savings & VIP harvest picking.',
  },
  rolling: {
    id: 'rolling',
    name: 'Flexible Rolling',
    weeks: 1,
    discountPercent: 0,
    tag: 'ZERO LOCK-IN',
    description: 'Weekly flexible replenishment. Pause, skip, or cancel anytime.',
  },
};

/**
 * Calculates financial breakdown for a subscription configuration.
 *
 * @param {Record<string, Array<{ productId: string, name: string, packSize: string, price: number, quantity: number }>>} dayBaskets
 * @param {string[]} selectedDays
 * @param {'monthly' | 'quarterly' | 'rolling'} planDuration
 * @returns {{
 *   weeklyBaseTotal: number,
 *   totalDrops: number,
 *   totalBasePrice: number,
 *   discountAmount: number,
 *   deliveryFee: number,
 *   deliverySavings: number,
 *   finalPayable: number,
 *   discountPercent: number
 * }}
 */
export function calculateSubscriptionTotals(dayBaskets, selectedDays, planDuration = 'monthly') {
  const plan = PLAN_DURATIONS[planDuration] || PLAN_DURATIONS.monthly;
  const numDays = Math.max(1, selectedDays.length);

  // 1. Calculate weekly produce subtotal across all selected days
  let weeklyBaseTotal = 0;
  selectedDays.forEach((day) => {
    const items = dayBaskets[day] || [];
    const dayTotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    weeklyBaseTotal += dayTotal;
  });

  // 2. Multiply by duration weeks
  const totalDrops = numDays * plan.weeks;
  const totalBasePrice = weeklyBaseTotal * plan.weeks;

  // 3. Apply duration discount
  const discountPercent = plan.discountPercent || 0;
  const discountAmount = Math.round((totalBasePrice * discountPercent) / 100);

  // 4. Free morning harvest delivery for subscribers (standard base delivery fee is waived)
  const deliveryFee = 0;
  const deliverySavings = totalDrops * 40; // ₹40 saved per drop

  // 5. Final payable
  const finalPayable = Math.max(0, totalBasePrice - discountAmount);

  return {
    weeklyBaseTotal,
    totalDrops,
    totalBasePrice,
    discountAmount,
    deliveryFee,
    deliverySavings,
    finalPayable,
    discountPercent,
  };
}

/**
 * Generates a unique subscription ID: SUB-XXXXXX
 */
export function generateSubscriptionId() {
  const timeSuffix = Date.now().toString().slice(-4);
  const randSuffix = Math.floor(10 + Math.random() * 90);
  return `SUB-${timeSuffix}${randSuffix}`;
}

/**
 * Retrieves all stored customer subscriptions from localStorage
 * @param {string} [phone] - Optional phone filter
 * @returns {Array<object>}
 */
export function getSavedSubscriptions(phone) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SUBSCRIPTIONS_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : [];
    if (!phone) return all;
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    return all.filter((s) => {
      const sPhone = (s.customerPhone || s.customer?.phone || '').replace(/\D/g, '').slice(-10);
      return !sPhone || sPhone === cleanPhone;
    });
  } catch (e) {
    console.error('Error reading saved subscriptions', e);
    return [];
  }
}

/**
 * Saves a new or updated subscription to local history and dispatches event.
 * @param {object} subscription
 */
export function saveSubscriptionRecord(subscription) {
  if (typeof window === 'undefined') return;
  try {
    const current = getSavedSubscriptions();
    const existingIndex = current.findIndex((s) => s.id === subscription.id);
    if (existingIndex >= 0) {
      current[existingIndex] = { ...current[existingIndex], ...subscription };
    } else {
      current.unshift(subscription);
    }
    localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(
      new CustomEvent('osf:subscription-updated', { detail: { subscription } })
    );
  } catch (e) {
    console.error('Error saving subscription record', e);
  }
}

/**
 * Updates status of a subscription (e.g. 'active', 'paused', 'cancelled')
 * @param {string} subscriptionId
 * @param {'active' | 'paused' | 'cancelled'} newStatus
 */
export function updateSubscriptionStatus(subscriptionId, newStatus) {
  if (typeof window === 'undefined') return;
  try {
    const current = getSavedSubscriptions();
    const target = current.find((s) => s.id === subscriptionId);
    if (target) {
      target.status = newStatus;
      target.updatedAt = new Date().toISOString();
      localStorage.setItem(SUBSCRIPTIONS_STORAGE_KEY, JSON.stringify(current));
      window.dispatchEvent(
        new CustomEvent('osf:subscription-updated', { detail: { subscription: target } })
      );
    }
  } catch (e) {
    console.error('Error updating subscription status', e);
  }
}

/**
 * Computes next drop date string for an active subscription
 * @param {string[]} selectedDays - array of day names e.g. ['Monday', 'Thursday']
 * @returns {string} Human-friendly next drop string, e.g. "Tomorrow (Mon, 16 Nov)"
 */
export function getNextDropDate(selectedDays = []) {
  if (!selectedDays || selectedDays.length === 0) return 'Next Harvest Drop';
  const now = new Date();
  const currentDayIndex = now.getDay(); // 0 is Sun, 1 is Mon, etc.
  const dayNameMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const dayIndices = selectedDays.map((d) => dayNameMap[d]).filter((idx) => idx !== undefined);
  if (dayIndices.length === 0) return selectedDays[0];

  // Find lowest positive offset
  let minOffset = 999;
  dayIndices.forEach((targetDay) => {
    let offset = (targetDay - currentDayIndex + 7) % 7;
    // If today is the delivery day, but past 7 AM harvest cutoff, look to next week
    if (offset === 0 && now.getHours() >= 7) {
      offset = 7;
    }
    if (offset < minOffset) {
      minOffset = offset;
    }
  });

  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + (minOffset === 999 ? 1 : minOffset));

  const dayOfWeek = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = nextDate.getDate();
  const monthStr = nextDate.toLocaleDateString('en-US', { month: 'short' });

  if (minOffset === 1) {
    return `Tomorrow (${dayOfWeek}, ${dayNum} ${monthStr})`;
  }
  if (minOffset === 0) {
    return `Today (${dayOfWeek}, ${dayNum} ${monthStr})`;
  }
  return `${dayOfWeek}, ${dayNum} ${monthStr}`;
}

/**
 * Clones produce items from one day's basket to all other selected delivery days
 * @param {string} sourceDay
 * @param {string[]} targetDays
 * @param {Record<string, Array<any>>} currentBaskets
 * @returns {Record<string, Array<any>>}
 */
export function copyBasketToOtherDays(sourceDay, targetDays, currentBaskets) {
  const sourceItems = currentBaskets[sourceDay] || [];
  const updated = { ...currentBaskets };
  targetDays.forEach((day) => {
    if (day !== sourceDay) {
      updated[day] = sourceItems.map((item) => ({ ...item }));
    }
  });
  return updated;
}

/**
 * Toggles a product in a specific day's harvest box
 * @param {string} day
 * @param {object} product
 * @param {number} packIndex
 * @param {Record<string, Array<any>>} currentBaskets
 * @returns {Record<string, Array<any>>}
 */
export function toggleProductInDayBasket(day, product, packIndex = 0, currentBaskets = {}) {
  const existingItems = currentBaskets[day] ? [...currentBaskets[day]] : [];
  const existingIdx = existingItems.findIndex((it) => it.productId === product.id);

  const packs = product.packSizes && product.packSizes.length > 0
    ? product.packSizes
    : [{ size: product.unit || 'Standard', price: product.price }];
  const chosenPack = packs[packIndex] || packs[0];

  if (existingIdx >= 0) {
    // Remove if already in basket
    existingItems.splice(existingIdx, 1);
  } else {
    // Add to basket
    existingItems.push({
      productId: product.id,
      name: product.name,
      packSize: chosenPack.size,
      packIndex,
      price: Number(chosenPack.price),
      quantity: 1,
      image: product.image || '/images/prod-grey-oyster.jpg',
    });
  }

  return {
    ...currentBaskets,
    [day]: existingItems,
  };
}

/**
 * Changes the selected pack size for an item in a specific day's harvest box
 * @param {string} day
 * @param {string} productId
 * @param {object} product
 * @param {number} packIndex
 * @param {Record<string, Array<any>>} currentBaskets
 * @returns {Record<string, Array<any>>}
 */
export function setDayBasketItemPack(day, productId, product, packIndex, currentBaskets = {}) {
  const existingItems = currentBaskets[day] ? [...currentBaskets[day]] : [];
  const idx = existingItems.findIndex((it) => it.productId === productId);
  const packs = product.packSizes && product.packSizes.length > 0
    ? product.packSizes
    : [{ size: product.unit || 'Standard', price: product.price }];
  const chosenPack = packs[packIndex] || packs[0];

  if (idx >= 0) {
    existingItems[idx] = {
      ...existingItems[idx],
      packSize: chosenPack.size,
      packIndex,
      price: Number(chosenPack.price),
    };
  } else {
    existingItems.push({
      productId,
      name: product.name,
      packSize: chosenPack.size,
      packIndex,
      price: Number(chosenPack.price),
      quantity: 1,
      image: product.image || '/images/prod-grey-oyster.jpg',
    });
  }

  return {
    ...currentBaskets,
    [day]: existingItems,
  };
}

/**
 * Adjusts quantity of an item in a specific day's harvest box
 * @param {string} day
 * @param {string} productId
 * @param {number} delta - e.g. +1 or -1
 * @param {Record<string, Array<any>>} currentBaskets
 * @returns {Record<string, Array<any>>}
 */
export function updateDayBasketItemQty(day, productId, delta, currentBaskets = {}) {
  const existingItems = currentBaskets[day] ? [...currentBaskets[day]] : [];
  const idx = existingItems.findIndex((it) => it.productId === productId);
  if (idx >= 0) {
    const newQty = existingItems[idx].quantity + delta;
    if (newQty <= 0) {
      existingItems.splice(idx, 1);
    } else {
      existingItems[idx] = { ...existingItems[idx], quantity: newQty };
    }
  }
  return {
    ...currentBaskets,
    [day]: existingItems,
  };
}


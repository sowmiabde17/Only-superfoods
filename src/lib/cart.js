/**
 * Only Superfoods — Global Cart & Order State Manager
 * Synchronizes across separate Astro Svelte islands via CustomEvents and localStorage.
 */

import { supabase, getEdgeFunctionUrl, supabaseAnonKey } from './supabase.js';
import { syncInventoryFromSupabase } from './inventory.js';

const STORAGE_KEY = 'osf_cart_items';
const ORDERS_STORAGE_KEY = 'osf_orders';
let cartSyncBound = false;

export function refreshCartPrices(liveProducts) {
  if (typeof window === 'undefined' || !Array.isArray(liveProducts) || liveProducts.length === 0) return;
  const items = getCartItems();
  if (items.length === 0) return;

  let changed = false;
  const updated = items.map((item) => {
    if (item.isBundleDiscount) return item;
    const prod = liveProducts.find((p) => p.id === item.productId);
    if (!prod) return item;

    const matchedPack = (prod.packSizes || []).find((pk) => pk.size === item.packSize);
    const livePrice = Number(matchedPack?.price ?? (item.packSize === prod.unit ? prod.price : item.price));
    if (Number.isFinite(livePrice) && livePrice > 0 && livePrice !== Number(item.price)) {
      changed = true;
      return { ...item, name: prod.name, image: prod.image || item.image, price: livePrice };
    }
    return item;
  });

  if (changed) {
    saveCartItems(updated);
  }
}

function bindCartPriceListener() {
  if (typeof window === 'undefined' || cartSyncBound) return;
  cartSyncBound = true;
  window.addEventListener('osf:products-updated', (e) => {
    if (Array.isArray(e?.detail?.products)) {
      refreshCartPrices(e.detail.products);
    }
  });
}

/**
 * Get current cart items from localStorage
 * @returns {Array}
 */
export function getCartItems() {
  if (typeof window === 'undefined') return [];
  bindCartPriceListener();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading cart from localStorage', e);
    return [];
  }
}

/**
 * Save cart items to localStorage and notify all islands
 * @param {Array} items
 */
function saveCartItems(items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(
      new CustomEvent('osf:cart-updated', { detail: { items } })
    );
  } catch (e) {
    console.error('Error saving cart to localStorage', e);
  }
}

/**
 * Add product to cart
 * @param {object} product
 * @param {object} pack - { size, price }
 * @param {number} quantity
 */
export function addToCart(product, pack, quantity = 1) {
  const items = getCartItems();
  const itemKey = `${product.id}__${pack.size}`;
  const existingIdx = items.findIndex((i) => i.key === itemKey);

  if (existingIdx > -1) {
    items[existingIdx].quantity += quantity;
  } else {
    items.push({
      key: itemKey,
      productId: product.id,
      name: product.name,
      packSize: pack.size,
      price: pack.price,
      quantity,
      image: product.image,
      whatsappMessage: product.whatsappMessage,
      ...(product.isBundleDiscount || pack.isBundleDiscount ? { isBundleDiscount: true } : {}),
    });
  }

  saveCartItems(items);
  // Auto-open drawer on addition
  openCartDrawer();
}

/**
 * Update quantity of an item
 * @param {string} itemKey
 * @param {number} delta - e.g. +1 or -1
 */
export function updateItemQuantity(itemKey, delta) {
  let items = getCartItems();
  const idx = items.findIndex((i) => i.key === itemKey);
  if (idx === -1) return;

  items[idx].quantity += delta;
  if (items[idx].quantity <= 0) {
    items.splice(idx, 1);
  }
  saveCartItems(items);
}

/**
 * Remove an item completely
 * @param {string} itemKey
 */
export function removeItem(itemKey) {
  const items = getCartItems().filter((i) => i.key !== itemKey);
  saveCartItems(items);
}

/**
 * Clear the entire cart
 */
export function clearCart() {
  saveCartItems([]);
}

/**
 * Calculate totals
 * @param {Array} items
 */
export function getCartTotals(items = getCartItems()) {
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return { totalCount, totalPrice };
}

/**
 * Open the Cart Drawer
 */
export function openCartDrawer() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('osf:open-cart'));
  }
}

/**
 * Close the Cart Drawer
 */
export function closeCartDrawer() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('osf:close-cart'));
  }
}

/**
 * Save placed order to local history and sync to Supabase
 * @param {object} order
 */
export async function saveOrderToHistory(order) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    const orders = raw ? JSON.parse(raw) : [];
    orders.unshift(order);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders.slice(0, 50)));
    window.dispatchEvent(
      new CustomEvent('osf:order-placed', { detail: { order } })
    );
  } catch (e) {
    console.error('Error saving order history locally', e);
  }

  // Remote Supabase persistence & atomic inventory deduction via `place-web-order`
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (supabaseAnonKey) {
      headers.apikey = supabaseAnonKey;
      headers.Authorization = `Bearer ${supabaseAnonKey}`;
    }

    const res = await fetch(getEdgeFunctionUrl('place-web-order'), {
      method: 'POST',
      headers,
      body: JSON.stringify(order),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error || `Order service returned status ${res.status}`);
    }

    // Refresh live inventory from Supabase after authoritative deduction
    setTimeout(() => syncInventoryFromSupabase(true), 400);
  } catch (err) {
    console.error('[Cart] place-web-order execution error:', err?.message || err);
    throw err;
  }
}

/**
 * Generate a unique human-friendly collision-proof 6-digit Order ID
 * Example: OSF-841923
 */
export function generateOrderId() {
  const timeSuffix = Date.now().toString().slice(-4);
  const randSuffix = Math.floor(10 + Math.random() * 90);
  return `OSF-${timeSuffix}${randSuffix}`;
}


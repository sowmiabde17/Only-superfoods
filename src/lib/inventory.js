/**
 * src/lib/inventory.js
 * Central Inventory & Priority Subscription Stock Engine.
 *
 * Core Rules:
 * 1. Morning Dawn Harvest Yield is logged at 5:30 AM (in pack units).
 * 2. Weekly repeat subscribers automatically block/reserve their share first.
 * 3. Public Web Available Stock = available_qty synced live from Supabase `inventory` table.
 * 4. All admin inventory mutations execute via authenticated `admin-api` Edge Function.
 * 5. Dispatches 'osf:inventory-updated' on any state change.
 */

import { getProducts } from './productsStore.js';
import { supabase } from './supabase.js';
import { callAdminApi } from './adminAuth.js';

const INVENTORY_STORAGE_KEY = 'osf_inventory_data';
let hasSynced = false;
let inFlightSync = null;
let syncQueued = false;
let lastSyncAt = 0;
let listenersBound = false;

export function formatInventoryRow(row) {
  return {
    productId: row.product_id,
    dailyYield: Number(row.daily_harvest_batch) || 0,
    reservedSubscribers: Number(row.reserved_subscribers) || 0,
    webSold: Number(row.web_sold) || 0,
    availableStock: Math.max(0, Number(row.available_qty) || 0),
    manualStatus: row.manual_status || (row.is_sold_out ? 'OUT_OF_STOCK' : 'AUTO'),
    isSoldOut: Boolean(row.is_sold_out),
    lastHarvestTime: row.harvest_time || 'Today, 5:30 AM',
    syncedFromDb: true,
  };
}

function bindLiveInventoryListeners() {
  if (typeof window === 'undefined' || listenersBound) return;
  listenersBound = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastSyncAt > 10000) {
      syncInventoryFromSupabase(true);
    }
  });

  try {
    supabase
      .channel('osf-inventory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        syncInventoryFromSupabase(true);
      })
      .subscribe();
  } catch (err) {
    console.warn('[InventoryStore] Realtime subscription notice:', err);
  }
}

/**
 * Sync live inventory state from Supabase (read-only)
 * @param {boolean} [force=false]
 */
export async function syncInventoryFromSupabase(force = false) {
  if (typeof window === 'undefined') return getInventory();
  if (inFlightSync) {
    if (force) {
      syncQueued = true;
    }
    return inFlightSync;
  }

  inFlightSync = (async () => {
    try {
      const { data, error } = await supabase.from('inventory').select('*');
      if (error || !data) {
        if (error) console.error('Failed to sync inventory from Supabase:', error);
        return null;
      }

      const nextMap = {};
      data.forEach((row) => {
        nextMap[row.product_id] = formatInventoryRow(row);
      });

      lastSyncAt = Date.now();
      saveInventoryLocally(nextMap);
      return nextMap;
    } catch (err) {
      console.error('Failed to sync inventory from Supabase:', err);
      return null;
    } finally {
      inFlightSync = null;
      if (syncQueued) {
        syncQueued = false;
        syncInventoryFromSupabase(true);
      }
    }
  })();

  return inFlightSync;
}

/**
 * Replace local inventory cache from Admin API full payload
 */
export function setInventoryFromServer(rawRows) {
  if (typeof window === 'undefined' || !Array.isArray(rawRows)) return;
  const nextMap = {};
  rawRows.forEach((row) => {
    nextMap[row.product_id] = formatInventoryRow(row);
  });
  lastSyncAt = Date.now();
  saveInventoryLocally(nextMap);
}

/**
 * Default fallback seed inventory mapping (used strictly before first Supabase fetch resolves)
 */
function createDefaultInventory() {
  const products = getProducts();
  const inv = {};

  products.forEach((p) => {
    let yieldUnits = 40;
    let reservedUnits = 10;

    if (p.id === 'grey-oyster') {
      yieldUnits = 60;
      reservedUnits = 12;
    } else if (p.id === 'pink-oyster') {
      yieldUnits = 30;
      reservedUnits = 15;
    } else if (p.id === 'mixed-oyster') {
      yieldUnits = 40;
      reservedUnits = 9;
    } else if (p.id === 'sunflower-microgreens') {
      yieldUnits = 50;
      reservedUnits = 8;
    } else if (p.id.includes('kombucha')) {
      yieldUnits = 50;
      reservedUnits = 12;
    } else if (p.id.includes('egg')) {
      yieldUnits = 100;
      reservedUnits = 15;
    }

    inv[p.id] = {
      productId: p.id,
      dailyYield: yieldUnits,
      reservedSubscribers: reservedUnits,
      webSold: 0,
      availableStock: Math.max(0, yieldUnits - reservedUnits),
      manualStatus: 'AUTO',
      isSoldOut: false,
      lastHarvestTime: 'Today, 5:30 AM',
      syncedFromDb: false,
    };
  });

  return inv;
}

/**
 * Get the full inventory map synchronously from localStorage cache and trigger live sync
 * @returns {Record<string, object>}
 */
export function getInventory() {
  if (typeof window === 'undefined') return createDefaultInventory();
  bindLiveInventoryListeners();
  if (!hasSynced) {
    hasSynced = true;
    syncInventoryFromSupabase();
  }
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) {
      return createDefaultInventory();
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : createDefaultInventory();
  } catch (err) {
    console.error('Failed to read inventory from localStorage:', err);
    return createDefaultInventory();
  }
}

function saveInventoryLocally(inventory) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
    window.dispatchEvent(
      new CustomEvent('osf:inventory-updated', { detail: { inventory } })
    );
  } catch (err) {
    console.error('Failed to save inventory to localStorage:', err);
  }
}

export function getProductInventory(productId) {
  const inv = getInventory();
  if (inv[productId]) return inv[productId];

  return {
    productId,
    dailyYield: 40,
    reservedSubscribers: 10,
    webSold: 0,
    availableStock: 30,
    manualStatus: 'AUTO',
    isSoldOut: false,
    lastHarvestTime: 'Today, 5:30 AM',
    syncedFromDb: false,
  };
}

/**
 * Compute live available stock for public web buyers.
 * Honors Supabase's authoritative `available_qty` directly whenever synced.
 */
export function getAvailableStock(productId) {
  const pInv = getProductInventory(productId);
  if (pInv.syncedFromDb && pInv.availableStock !== undefined && pInv.availableStock !== null) {
    return Math.max(0, Number(pInv.availableStock) || 0);
  }
  const yieldUnits = Number(pInv.dailyYield) || 0;
  const reserved = Number(pInv.reservedSubscribers) || 0;
  const sold = Number(pInv.webSold) || 0;
  return Math.max(0, yieldUnits - reserved - sold);
}

/**
 * Resolve effective storefront status:
 * 'IN_STOCK' | 'OUT_OF_STOCK' | 'COMING_SOON' | 'HIDDEN'
 */
export function getEffectiveStatus(productId) {
  const pInv = getProductInventory(productId);

  if (pInv.manualStatus && pInv.manualStatus !== 'AUTO') {
    return pInv.manualStatus;
  }

  if (pInv.isSoldOut || getAvailableStock(productId) <= 0) {
    return 'OUT_OF_STOCK';
  }

  return 'IN_STOCK';
}

export function isProductAvailable(productId, requestedQty = 1) {
  const status = getEffectiveStatus(productId);
  if (status !== 'IN_STOCK') return false;
  const pInv = getProductInventory(productId);
  if (pInv.manualStatus === 'IN_STOCK') return true;
  return getAvailableStock(productId) >= requestedQty;
}

async function persistInventoryRow(updatedRow) {
  const res = await callAdminApi('update_inventory', { item: updatedRow });
  const invMap = { ...getInventory() };
  (res.inventory || []).forEach((row) => {
    invMap[row.product_id] = formatInventoryRow(row);
  });
  saveInventoryLocally(invMap);
  return { success: true, inventory: invMap, metaSync: res.metaSync };
}

export async function updateDailyYield(productId, yieldUnits) {
  try {
    const current = getProductInventory(productId);
    const updated = {
      ...current,
      productId,
      dailyYield: Math.max(0, Number(yieldUnits) || 0),
    };
    return await persistInventoryRow(updated);
  } catch (err) {
    console.error('[InventoryStore] updateDailyYield failed:', err);
    return { success: false, error: err?.message || 'Failed to save harvest yield to Supabase.' };
  }
}

export async function updateSubscriptionReserve(productId, reservedUnits) {
  try {
    const current = getProductInventory(productId);
    const updated = {
      ...current,
      productId,
      reservedSubscribers: Math.max(0, Number(reservedUnits) || 0),
    };
    return await persistInventoryRow(updated);
  } catch (err) {
    console.error('[InventoryStore] updateSubscriptionReserve failed:', err);
    return { success: false, error: err?.message || 'Failed to save subscriber reserve to Supabase.' };
  }
}

export async function setProductStatus(productId, status) {
  try {
    const current = getProductInventory(productId);
    const updated = {
      ...current,
      productId,
      manualStatus: status,
    };
    return await persistInventoryRow(updated);
  } catch (err) {
    console.error('[InventoryStore] setProductStatus failed:', err);
    return { success: false, error: err?.message || 'Failed to save storefront status to Supabase.' };
  }
}

/**
 * Optimistically reflect stock deduction locally after web order placement;
 * Authoritative Supabase deduction runs via `place-web-order` Edge Function.
 */
export function deductStockOnOrder(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  const inv = { ...getInventory() };

  items.forEach((item) => {
    const pid = item.productId || item.id;
    if (!pid) return;
    const current = inv[pid] || getProductInventory(pid);
    const qty = Number(item.quantity) || 1;
    const prevSold = Number(current.webSold) || 0;
    const prevAvail = Number(current.availableStock ?? getAvailableStock(pid)) || 0;
    const nextAvail = Math.max(0, prevAvail - qty);
    inv[pid] = {
      ...current,
      webSold: prevSold + qty,
      availableStock: nextAvail,
      isSoldOut: current.manualStatus === 'AUTO' ? nextAvail <= 0 : current.isSoldOut,
    };
  });

  saveInventoryLocally(inv);
}

export async function emergencyHarvestWipe(productIds = null) {
  try {
    const res = await callAdminApi('emergency_wipe', { productIds });
    const invMap = { ...getInventory() };
    (res.inventory || []).forEach((row) => {
      invMap[row.product_id] = formatInventoryRow(row);
    });
    saveInventoryLocally(invMap);
    return { success: true, inventory: invMap, metaSync: res.metaSync };
  } catch (err) {
    console.error('[InventoryStore] emergencyHarvestWipe failed:', err);
    return { success: false, error: err?.message || 'Emergency wipe failed on Supabase.' };
  }
}

export async function resetInventoryDefaults() {
  if (typeof window === 'undefined') return { success: false, error: 'Browser required' };
  try {
    const fresh = createDefaultInventory();
    const res = await callAdminApi('update_inventory', { items: Object.values(fresh) });
    const invMap = { ...getInventory() };
    (res.inventory || []).forEach((row) => {
      invMap[row.product_id] = formatInventoryRow(row);
    });
    saveInventoryLocally(invMap);
    return { success: true, inventory: invMap, metaSync: res.metaSync };
  } catch (err) {
    console.error('[InventoryStore] resetInventoryDefaults failed:', err);
    return { success: false, error: err?.message || 'Failed to reset inventory in Supabase.' };
  }
}

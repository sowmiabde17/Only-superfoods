/**
 * src/lib/productsStore.js
 * Central Reactive Store for Dynamic Product Catalog Management.
 * Synchronizes live from Supabase (Postgres + Realtime + Focus refresh),
 * persists admin mutations strictly through authenticated `admin-api` Edge Function,
 * and broadcasts updates across Svelte islands via CustomEvent ('osf:products-updated').
 */

import { products as defaultProducts } from '../data/products.js';
import { supabase } from './supabase.js';
import { callAdminApi } from './adminAuth.js';

const STORAGE_KEY = 'osf_products_catalog';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh cache TTL
let hasSynced = false;
let inFlightSync = null;
let syncQueued = false;
let lastSyncAt = 0;
let listenersBound = false;

export const PRODUCT_CATEGORIES = [
  { id: 'mushrooms', name: 'Gourmet Mushrooms', icon: '🍄' },
  { id: 'microgreens', name: 'Living Microgreens', icon: '🌱' },
  { id: 'elixirs', name: 'Farm Elixirs & Picks', icon: '🌿' },
];

export function normalizeCategoryName(cat) {
  const clean = (cat || 'Mushrooms').trim();
  const map = {
    mushrooms: 'Mushrooms',
    microgreens: 'Microgreens',
    kombucha: 'Kombucha',
    'desi eggs': 'Desi Eggs',
    elixirs: 'Elixirs',
    'fresh produce': 'Fresh Produce',
  };
  return map[clean.toLowerCase()] || clean;
}

export function formatProductRow(p) {
  const sortedPacks = (p.product_pack_sizes || [])
    .slice()
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    .map((s) => ({ size: s.size, price: Number(s.price) }));

  const packSizes = sortedPacks.length > 0
    ? sortedPacks
    : [{ size: p.unit || 'Standard', price: Number(p.price) || 0 }];

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: normalizeCategoryName(p.category),
    badge: p.badge,
    badgeType: p.badge_type || 'green',
    shortDescription: p.short_description || '',
    longDescription: p.long_description || '',
    price: Number(packSizes[0]?.price ?? p.price),
    unit: packSizes[0]?.size || p.unit,
    freshnessBadge: p.freshness_badge,
    shelfLife: p.shelf_life,
    storageGuide: p.storage_guide,
    culinaryTips: p.culinary_tips,
    recipePairings: p.recipe_pairings || [],
    minOrder: p.min_order || 1,
    image: p.image_url,
    nutritionFacts: p.nutrition_facts || [],
    whatsappMessage: p.whatsapp_message,
    isActive: p.is_active !== false,
    packSizes,
  };
}

function bindLiveSyncListeners() {
  if (typeof window === 'undefined' || listenersBound) return;
  listenersBound = true;

  // Refresh catalog whenever customer returns to tab (throttled to 10s)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastSyncAt > 10000) {
      syncProductsFromSupabase(true);
    }
  });

  // Fallback periodic poll every 45s if tab remains active
  setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && Date.now() - lastSyncAt > 45000) {
      syncProductsFromSupabase(true);
    }
  }, 45000);

  // Subscribe to real-time price/catalog updates from Supabase Postgres
  try {
    supabase
      .channel('osf-products-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        syncProductsFromSupabase(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_pack_sizes' }, () => {
        syncProductsFromSupabase(true);
      })
      .subscribe();
  } catch (err) {
    console.warn('[ProductsStore] Realtime subscription notice:', err);
  }
}

/**
 * Sync products catalog live from Supabase
 * @param {boolean} [force=false]
 */
export async function syncProductsFromSupabase(force = false) {
  if (typeof window === 'undefined') return getProducts();
  if (inFlightSync) {
    if (force) {
      syncQueued = true;
    }
    return inFlightSync;
  }

  inFlightSync = (async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_pack_sizes(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error || !data) {
        if (error) console.error('Failed to sync products from Supabase:', error);
        return null;
      }

      const formatted = data.map(formatProductRow);
      lastSyncAt = Date.now();
      saveProductsLocally(formatted);
      return formatted;
    } catch (err) {
      console.error('Failed to sync products from Supabase:', err);
      return null;
    } finally {
      inFlightSync = null;
      if (syncQueued) {
        syncQueued = false;
        syncProductsFromSupabase(true);
      }
    }
  })();

  return inFlightSync;
}

/**
 * Replace local product cache from Admin API full payload (includes inactive products)
 */
export function setProductsFromServer(rawRows) {
  if (typeof window === 'undefined' || !Array.isArray(rawRows)) return;
  const formatted = rawRows.map(formatProductRow);
  lastSyncAt = Date.now();
  saveProductsLocally(formatted);
}

/**
 * Get current products catalog synchronously from cache and trigger background Supabase sync
 * @returns {Array<object>}
 */
export function getProducts() {
  if (typeof window === 'undefined') return defaultProducts;
  bindLiveSyncListeners();
  if (!hasSynced) {
    hasSynced = true;
    syncProductsFromSupabase();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultProducts;
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : null);
    if (parsed?.timestamp && Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      // Background re-fetch if cache is older than TTL
      syncProductsFromSupabase(true);
    }
    return list && list.length > 0 ? list : defaultProducts;
  } catch (err) {
    console.error('Failed to read products catalog from localStorage:', err);
    return defaultProducts;
  }
}

function saveProductsLocally(items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      data: items,
      timestamp: Date.now(),
    }));
    window.dispatchEvent(
      new CustomEvent('osf:products-updated', { detail: { products: items } })
    );
  } catch (err) {
    console.error('Failed to save products catalog to localStorage:', err);
  }
}

export function getProductById(id) {
  const all = getProducts();
  return all.find((p) => p.id === id) || null;
}

/**
 * Add a new product to Supabase catalog via authenticated Admin Edge Function
 * @param {object} productData
 */
export async function addProduct(productData) {
  const slug = (productData.name || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const id = productData.id || `${slug}-${Date.now().toString(36)}`;
  const packSizes = productData.packSizes && productData.packSizes.length > 0
    ? productData.packSizes.map((ps) => ({ size: String(ps.size).trim(), price: Number(ps.price) }))
    : [{ size: productData.unit || '250 g', price: Number(productData.price) || 100 }];

  const newProduct = {
    id,
    name: productData.name.trim(),
    slug: productData.slug || slug,
    category: normalizeCategoryName(productData.category || 'Mushrooms'),
    badge: productData.badge || 'Fresh Harvest',
    badgeType: productData.badgeType || 'green',
    shortDescription: productData.shortDescription || 'Freshly harvested daily in Kadugodi.',
    longDescription: productData.longDescription || productData.shortDescription || '',
    price: Number(packSizes[0]?.price ?? productData.price) || 100,
    unit: packSizes[0]?.size || productData.unit || '250 g',
    packSizes,
    freshnessBadge: productData.freshnessBadge || 'Harvested at dawn (5:30 AM)',
    shelfLife: productData.shelfLife || '5 to 7 days in refrigerator',
    storageGuide: productData.storageGuide || 'Store in vegetable crisper drawer in breathable container.',
    culinaryTips: productData.culinaryTips || 'Pan-sear on high heat for optimal flavor and texture.',
    recipePairings: productData.recipePairings || [],
    minOrder: 1,
    image: productData.image || '/images/prod-grey-oyster.jpg',
    nutritionFacts: productData.nutritionFacts || [
      { label: 'Harvest Quality', value: '100% Chemical-free' },
    ],
    whatsappMessage:
      productData.whatsappMessage ||
      `Hi Only Superfoods! I'd like to order ${productData.name} ({{size}}). Please confirm availability and delivery slot! 🍄`,
    isActive: true,
  };

  try {
    const res = await callAdminApi('upsert_product', { product: newProduct });
    const all = [newProduct, ...getProducts().filter((p) => p.id !== newProduct.id)];
    saveProductsLocally(all);
    return { success: true, product: newProduct, metaSync: res.metaSync };
  } catch (err) {
    console.error('[ProductsStore] addProduct failed:', err);
    return { success: false, error: err?.message || 'Failed to save product to Supabase.' };
  }
}

/**
 * Update an existing product in Supabase via authenticated Admin Edge Function
 * @param {string} id
 * @param {object} updates
 */
export async function updateProduct(id, updates) {
  const all = getProducts();
  const index = all.findIndex((p) => p.id === id);
  const existing = index >= 0 ? all[index] : { id };

  const mergedPackSizes = updates.packSizes && updates.packSizes.length > 0
    ? updates.packSizes.map((ps) => ({ size: String(ps.size).trim(), price: Number(ps.price) }))
    : (existing.packSizes ? [...existing.packSizes] : [{ size: updates.unit || existing.unit || '250 g', price: Number(updates.price || existing.price || 100) }]);

  if ((updates.price !== undefined || updates.unit !== undefined) && !updates.packSizes && mergedPackSizes.length > 0) {
    mergedPackSizes[0] = {
      size: updates.unit ?? mergedPackSizes[0].size,
      price: Number(updates.price ?? mergedPackSizes[0].price),
    };
  }

  const updated = {
    ...existing,
    ...updates,
    id: existing.id,
    category: normalizeCategoryName(updates.category || existing.category),
    packSizes: mergedPackSizes,
    price: Number(mergedPackSizes[0]?.price ?? updates.price ?? existing.price),
    unit: mergedPackSizes[0]?.size || updates.unit || existing.unit,
  };

  try {
    const res = await callAdminApi('upsert_product', { product: updated });
    if (index >= 0) all[index] = updated;
    else all.unshift(updated);
    saveProductsLocally(all);
    return { success: true, product: updated, metaSync: res.metaSync };
  } catch (err) {
    console.error('[ProductsStore] updateProduct failed:', err);
    return { success: false, error: err?.message || 'Failed to update product in Supabase.' };
  }
}

/**
 * Delete a product from Supabase catalog via authenticated Admin Edge Function
 * @param {string} id
 */
export async function deleteProduct(id) {
  try {
    const res = await callAdminApi('delete_product', { id });
    const filtered = getProducts().filter((p) => p.id !== id);
    saveProductsLocally(filtered);
    return { success: true, metaSync: res.metaSync };
  } catch (err) {
    console.error('[ProductsStore] deleteProduct failed:', err);
    return { success: false, error: err?.message || 'Failed to delete product from Supabase.' };
  }
}

/**
 * Reset products catalog in Supabase back to default seed items
 */
export async function resetToDefaultProducts() {
  if (typeof window === 'undefined') return { success: false, error: 'Browser required' };
  try {
    for (const prod of defaultProducts) {
      await callAdminApi('upsert_product', { product: prod });
    }
    await syncProductsFromSupabase(true);
    return { success: true };
  } catch (err) {
    console.error('[ProductsStore] resetToDefaultProducts failed:', err);
    return { success: false, error: err?.message || 'Failed to reset products catalog.' };
  }
}

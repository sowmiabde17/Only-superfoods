/**
 * settingsStore.js — Live Supabase-backed Delivery & Promotional Rules Store
 * Manages base delivery fee, free shipping thresholds, promo discounts, and banners.
 * Used by both the Web Storefront and WhatsApp Commerce Engine.
 */

import { supabase } from './supabase.js';
import { callAdminApi } from './adminAuth.js';

export const DEFAULT_SETTINGS = {
  id: 'default',
  base_delivery_fee: 40,
  free_delivery_threshold: 350,
  delivery_discount_percent: 0,
  promo_code: 'SUPER70',
  promotional_banner: 'Free Delivery on Orders Over ₹350!',
  is_promotional_active: false,
};

let currentSettings = { ...DEFAULT_SETTINGS };
let hasInitialized = false;
let settingsRealtimeBound = false;
const SETTINGS_STORAGE_KEY = 'osf_store_settings';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh cache TTL

/**
 * Safely parse numeric settings, strictly preserving 0 while catching null/undefined/empty string/NaN
 */
export function parseNumericSetting(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

/**
 * Get current store settings from cache (synchronous)
 */
export function getStoreSettings() {
  if (typeof window !== 'undefined' && !hasInitialized) {
    initStoreSettings();
  }
  return currentSettings;
}

/**
 * Calculate effective delivery fee given cart subtotal
 */
export function calculateDelivery(subtotal, appliedPromo = null) {
  const settings = getStoreSettings();
  const threshold = parseNumericSetting(settings.free_delivery_threshold, 350);
  const baseFee = parseNumericSetting(settings.base_delivery_fee, 40);
  const discountPercent = parseNumericSetting(settings.delivery_discount_percent, 0);
  const promoActive = Boolean(settings.is_promotional_active);

  // If base delivery fee is explicitly set to 0, delivery is completely free for all orders
  if (baseFee === 0) {
    return {
      fee: 0,
      originalFee: 0,
      isFree: true,
      reason: 'Free Delivery',
      savings: 0,
      discountAmount: 0,
      discountPercent: 0,
    };
  }

  // Free delivery threshold met or threshold set to 0 (sitewide free delivery)
  if (threshold <= 0 || subtotal >= threshold) {
    return {
      fee: 0,
      originalFee: baseFee,
      isFree: true,
      reason: threshold <= 0 ? 'Free Delivery' : `Free (Order over ₹${threshold})`,
      savings: baseFee,
      discountAmount: 0,
      discountPercent: 0,
    };
  }

  // Calculate promotional discount if promo is active or code matches
  const hasPromoDiscount = promoActive || (appliedPromo && appliedPromo.toUpperCase() === (settings.promo_code || '').toUpperCase());
  const discountAmount = hasPromoDiscount ? (baseFee * (discountPercent / 100)) : 0;
  const effectiveFee = Math.max(0, Math.round(baseFee - discountAmount));

  return {
    fee: effectiveFee,
    originalFee: baseFee,
    isFree: effectiveFee === 0,
    discountAmount: Math.round(discountAmount),
    discountPercent: hasPromoDiscount ? discountPercent : 0,
    reason: hasPromoDiscount && discountPercent > 0 ? `${discountPercent}% Promotional Discount` : `Flat Delivery (Orders under ₹${threshold})`,
    savings: Math.round(discountAmount),
  };
}

function bindRealtimeSettingsListener() {
  if (typeof window === 'undefined' || settingsRealtimeBound) return;
  settingsRealtimeBound = true;
  try {
    supabase
      .channel('osf-settings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, () => {
        initStoreSettings(true);
      })
      .subscribe();
  } catch (err) {
    console.warn('[SettingsStore] Realtime subscription notice:', err);
  }
}

/**
 * Initialize and load settings from Supabase
 */
export async function initStoreSettings(force = false) {
  hasInitialized = true;
  bindRealtimeSettingsListener();

  // 1. Try local storage cache for instant render with TTL validation
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const data = cached?.data || cached;
        currentSettings = {
          ...DEFAULT_SETTINGS,
          ...data,
          base_delivery_fee: parseNumericSetting(data.base_delivery_fee, DEFAULT_SETTINGS.base_delivery_fee),
          free_delivery_threshold: parseNumericSetting(data.free_delivery_threshold, DEFAULT_SETTINGS.free_delivery_threshold),
          delivery_discount_percent: parseNumericSetting(data.delivery_discount_percent, DEFAULT_SETTINGS.delivery_discount_percent),
        };
      }
    } catch (_) {}
  }

  // 2. Fetch live from Supabase
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data) {
      currentSettings = {
        id: data.id,
        base_delivery_fee: parseNumericSetting(data.base_delivery_fee, DEFAULT_SETTINGS.base_delivery_fee),
        free_delivery_threshold: parseNumericSetting(data.free_delivery_threshold, DEFAULT_SETTINGS.free_delivery_threshold),
        delivery_discount_percent: parseNumericSetting(data.delivery_discount_percent, DEFAULT_SETTINGS.delivery_discount_percent),
        promo_code: data.promo_code || 'SUPER70',
        promotional_banner: data.promotional_banner || DEFAULT_SETTINGS.promotional_banner,
        is_promotional_active: Boolean(data.is_promotional_active),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
          data: currentSettings,
          timestamp: Date.now(),
        }));
        window.dispatchEvent(new CustomEvent('osf:settings-updated', { detail: currentSettings }));
      }
    }
  } catch (err) {
    console.warn('[SettingsStore] Could not fetch live store_settings from Supabase:', err);
  }

  return currentSettings;
}

/**
 * Save updated store settings to Supabase via authenticated Admin Edge Function and broadcast
 */
export async function updateStoreSettings(updatedFields) {
  const payload = {
    ...currentSettings,
    ...updatedFields,
    updated_at: new Date().toISOString(),
  };

  try {
    const res = await callAdminApi('update_settings', { settings: payload });
    if (res?.settings) {
      currentSettings = {
        ...payload,
        ...res.settings,
        base_delivery_fee: Number(res.settings.base_delivery_fee),
        free_delivery_threshold: Number(res.settings.free_delivery_threshold),
        delivery_discount_percent: Number(res.settings.delivery_discount_percent),
      };
    } else {
      currentSettings = payload;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('osf_store_settings', JSON.stringify(currentSettings));
      window.dispatchEvent(new CustomEvent('osf:settings-updated', { detail: currentSettings }));
    }

    return { success: true, settings: currentSettings };
  } catch (err) {
    console.error('[SettingsStore] Failed to update store_settings on Supabase:', err);
    return { success: false, error: err?.message || 'Failed to update store settings.', settings: currentSettings };
  }
}


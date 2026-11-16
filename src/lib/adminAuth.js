/**
 * src/lib/adminAuth.js
 * Insider Operational Authentication & Authenticated Admin Edge API Client.
 * Session & PIN are stored strictly in browser sessionStorage (auto-clears on tab close).
 * All Admin writes execute via Supabase Edge Function `admin-api` (authenticated by x-admin-pin).
 */

import { getEdgeFunctionUrl, supabaseAnonKey } from './supabase.js';

const ADMIN_SESSION_KEY = 'osf_admin_session';
const ADMIN_PIN_KEY = 'osf_admin_pin';

/**
 * Check if admin is currently authenticated
 * @returns {boolean}
 */
export function isAdminLoggedIn() {
  if (typeof window === 'undefined') return false;
  try {
    const session = sessionStorage.getItem(ADMIN_SESSION_KEY);
    const pin = sessionStorage.getItem(ADMIN_PIN_KEY);
    return session === 'authenticated' && Boolean(pin);
  } catch (e) {
    return false;
  }
}

/**
 * Retrieve active operational PIN from sessionStorage
 * @returns {string}
 */
export function getAdminPin() {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(ADMIN_PIN_KEY) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Call the authenticated `admin-api` Supabase Edge Function
 * @param {string} action
 * @param {object} payload
 * @param {string} [overridePin]
 */
export async function callAdminApi(action, payload = {}, overridePin = '') {
  const pin = (overridePin || getAdminPin()).trim();
  if (!pin) {
    throw new Error('Admin session expired. Please log in again.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-admin-pin': pin,
  };
  if (supabaseAnonKey) {
    headers.apikey = supabaseAnonKey;
    headers.Authorization = `Bearer ${supabaseAnonKey}`;
  }

  const res = await fetch(getEdgeFunctionUrl('admin-api'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`Server returned invalid response (${res.status})`);
  }

  if (!res.ok || !data?.success) {
    if (res.status === 401 && !overridePin) {
      logoutAdmin();
    }
    throw new Error(data?.error || `Admin API request failed (${res.status})`);
  }

  return data;
}

/**
 * Verify operational PIN against the server Edge Function and open session
 * @param {string} pin
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function loginAdmin(pin) {
  if (typeof window === 'undefined') return { ok: false, error: 'Browser required' };
  const cleanPin = (pin || '').trim();
  if (!cleanPin) return { ok: false, error: 'PIN is required.' };

  try {
    await callAdminApi('verify_pin', {}, cleanPin);
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'authenticated');
    sessionStorage.setItem(ADMIN_PIN_KEY, cleanPin);
    window.dispatchEvent(new CustomEvent('osf:admin-auth-changed', { detail: { loggedIn: true } }));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Incorrect master PIN. Access restricted to authorized Kadugodi farm staff.',
    };
  }
}

/**
 * Logout admin
 */
export function logoutAdmin() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_PIN_KEY);
    window.dispatchEvent(new CustomEvent('osf:admin-auth-changed', { detail: { loggedIn: false } }));
  } catch (e) {
    console.error('Logout error', e);
  }
}

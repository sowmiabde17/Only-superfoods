/**
 * Supabase Client Singleton
 * Multi-channel database connection for Web Storefront & WhatsApp commerce.
 *
 * Uses static property access so Vite / Astro can replace them at build time.
 */
import { createClient } from '@supabase/supabase-js';

// Static property access is required for Vite AST string-replacement
export const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_URL) ||
  'https://ufewlbjqtxpumwlwkunn.supabase.co';

export const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_ANON_KEY) ||
  '';

export function getEdgeFunctionUrl(functionName) {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`;
}

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn(
      '[Only SuperFoods] Warning: Supabase environment variables are missing. ' +
      'Please ensure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set in your .env file.'
    );
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default supabase;

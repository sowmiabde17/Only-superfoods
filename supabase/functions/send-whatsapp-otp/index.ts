/**
 * send-whatsapp-otp — Only SuperFoods WhatsApp Authentication Dispatcher
 * Dispatches 4-digit OTP via Meta Authentication template (Copy Code button)
 * or creates a 1-tap inbound WhatsApp verification link (Hybrid Engine).
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ufewlbjqtxpumwlwkunn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '1364269023440389';
const ACCESS_TOKEN = (Deno.env.get('WHATSAPP_ACCESS_TOKEN') || Deno.env.get('META_ACCESS_TOKEN') || '').trim();
const TEMPLATE_NAME = (Deno.env.get('WHATSAPP_AUTH_TEMPLATE_NAME') || 'osf_auth_otp').trim();
const FARM_PHONE = '917019760360'; // Only SuperFoods Kadugodi WhatsApp Concierge

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await req.json();
    const rawPhone = String(body.phone || '').trim();
    const mode = body.mode === 'inbound' ? 'inbound' : 'otp';

    const digitsOnly = rawPhone.replace(/\D/g, '');
    const cleanPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

    if (!/^91[6-9]\d{9}$/.test(cleanPhone)) {
      return json({
        success: false,
        error: 'Please enter a valid 10-digit Indian WhatsApp mobile number.',
      }, 400);
    }

    const tenDigit = cleanPhone.slice(-10);

    // ── 1. INBOUND 1-TAP VERIFICATION MODE ───────────────────────────────────
    if (mode === 'inbound') {
      const token = `OSF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes TTL

      await supabase.from('customer_otps').insert({
        phone: cleanPhone,
        token,
        otp_code: '',
        type: 'inbound_tap',
        attempts: 0,
        expires_at: expiresAt,
      });

      const messageText = `Please verify my Only SuperFoods login: ${token}`;
      const waLink = `https://wa.me/${FARM_PHONE}?text=${encodeURIComponent(messageText)}`;

      return json({
        success: true,
        mode: 'inbound',
        token,
        waLink,
        message: 'Tap the link to send your verification message on WhatsApp.',
      });
    }

    // ── 2. OUTBOUND 4-DIGIT OTP MODE ─────────────────────────────────────────
    // Rate limit check: max 1 request per 60 seconds per phone number
    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentRequests } = await supabase
      .from('customer_otps')
      .select('id, created_at')
      .eq('phone', cleanPhone)
      .eq('type', 'otp')
      .gt('created_at', oneMinAgo)
      .limit(1);

    if (recentRequests && recentRequests.length > 0) {
      return json({
        success: false,
        error: 'Please wait 60 seconds before requesting another code.',
        rateLimited: true,
      }, 429);
    }

    // Generate cryptographically random 4-digit code (e.g. 7492)
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const code = String(1000 + (randomArray[0] % 9000));

    const token = `OSF-OTP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes TTL

    // Store in Supabase customer_otps table
    const { error: dbError } = await supabase.from('customer_otps').insert({
      phone: cleanPhone,
      token,
      otp_code: code,
      type: 'otp',
      attempts: 0,
      expires_at: expiresAt,
    });

    if (dbError) {
      console.error('[send-whatsapp-otp] Database error:', dbError);
      return json({ success: false, error: 'Could not initialize verification session.' }, 500);
    }

    // Dispatch Meta WhatsApp Cloud API Authentication template
    let metaSuccess = false;
    let metaErrorMsg = '';
    let metaDebugResponse = null;

    if (ACCESS_TOKEN && PHONE_NUMBER_ID) {
      try {
        const trySendMeta = async (langCode: string, components: any[]) => {
          const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'template',
            template: {
              name: TEMPLATE_NAME,
              language: { code: langCode },
              components,
            },
          };
          const metaRes = await fetch(
            `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            }
          );
          const metaData = await metaRes.json();
          return { ok: metaRes.ok && Boolean(metaData.messages?.[0]?.id), data: metaData };
        };

        const compBoth = [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ];
        const compBodyOnly = [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
        ];
        const compButtonOnly = [
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ];

        // 1. Try 'en' (English in Meta Business Suite) with Both
        let attempt = await trySendMeta('en', compBoth);
        if (!attempt.ok) {
          // 2. Try 'en' with Button only (Standard Authentication OTP format)
          attempt = await trySendMeta('en', compButtonOnly);
        }
        if (!attempt.ok) {
          // 3. Try 'en' with Body only
          attempt = await trySendMeta('en', compBodyOnly);
        }
        if (!attempt.ok) {
          // 4. Try 'en_US' with Both
          attempt = await trySendMeta('en_US', compBoth);
        }
        if (!attempt.ok) {
          // 5. Try 'en_US' with Button only
          attempt = await trySendMeta('en_US', compButtonOnly);
        }

        metaDebugResponse = attempt.data;
        if (attempt.ok) {
          metaSuccess = true;
          console.log(`[send-whatsapp-otp] Successfully delivered OTP via Meta to ${cleanPhone}`);
        } else {
          console.warn('[send-whatsapp-otp] Meta API notice:', attempt.data);
          metaErrorMsg = attempt.data?.error?.message || 'Meta template delivery notice.';
        }
      } catch (err: any) {
        console.error('[send-whatsapp-otp] Network error calling Meta:', err);
        metaErrorMsg = err?.message || 'Meta network error.';
      }
    } else {
      metaErrorMsg = 'WhatsApp API credentials not configured in secrets.';
    }

    // Prepare 1-tap fallback link in case customer prefers or if template is still in review
    const fallbackToken = `OSF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    await supabase.from('customer_otps').insert({
      phone: cleanPhone,
      token: fallbackToken,
      otp_code: code,
      type: 'inbound_tap',
      attempts: 0,
      expires_at: expiresAt,
    });
    const fallbackLink = `https://wa.me/${FARM_PHONE}?text=${encodeURIComponent(`Please verify my Only SuperFoods login: ${fallbackToken}`)}`;

    return json({
      success: true,
      mode: 'otp',
      token,
      phone: tenDigit,
      metaSent: metaSuccess,
      metaNotice: metaSuccess ? null : metaErrorMsg,
      metaDebug: metaDebugResponse,
      fallbackToken,
      fallbackLink,
      message: metaSuccess
        ? `4-digit verification PIN sent to +91 ${tenDigit} via WhatsApp.`
        : `Verification code generated. If your WhatsApp template is still in review, use the 1-tap link below.`,
    });
  } catch (err: any) {
    console.error('[send-whatsapp-otp] Error:', err);
    return json({ success: false, error: err?.message || 'Internal server error' }, 500);
  }
});


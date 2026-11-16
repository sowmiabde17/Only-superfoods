/**
 * Only SuperFoods — WhatsApp Cloud API Webhook Edge Function
 * Production-ready V1 conversational commerce & packaging QR concierge engine.
 * 
 * Capabilities:
 * 1. Packaging QR Scan Welcome (3-minute chef pan-sear secret, storage guide, recipes link)
 * 2. Native WhatsApp Catalog Cart Order Interception (type === 'order')
 * 3. Frictionless Location Capture (1-tap location request, reverse-geocoded to words, zero raw GPS numbers)
 * 4. 1-Tap "Repeat My Order" habit engine with saved address in words
 * 5. Strict Morning Harvest Delivery (7:00 AM – 10:00 AM)
 * 6. Dual-line voice calling & Team WhatsApp escalation (+91 77603 50360)
 */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
} | undefined;

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WhatsAppClient } from './whatsapp.ts';
import { pointInPolygon, CORE_POLYGON_COORDS } from './geo.ts';

// ─── Environment & Clients ───────────────────────────────────────────────────

const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '1364269023440389';
const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'onlysuperfoods_wa_2026';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ufewlbjqtxpumwlwkunn.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const wa = new WhatsAppClient(PHONE_NUMBER_ID, ACCESS_TOKEN);

// ─── Core Delivery & Auth Helpers ───────────────────────────────────────────

const CORE_PINCODES = ['560067', '560066', '560087', '560048', '560049', '560036', '562114'];
const CORE_KEYWORDS = [
  'kadugodi', 'whitefield', 'hope farm', 'channasandra', 'seegehalli', 'belathur',
  'kannur', 'kumbena agrahara', 'ecc road', 'itpl', 'pattandur agrahara', 'nallurahalli',
  'hagadur', 'varthur', 'hoodi', 'immadihalli', 'bidarahalli', 'sadaramangala', 'kurudu sonnenahalli',
  'devasandra', 'krishnarajapuram', 'hoskote'
];

async function forwardGeocodeAddress(textAddress: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const query = encodeURIComponent(`${textAddress}, Bangalore, Karnataka, India`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'User-Agent': 'OnlySuperfoodsWhatsAppBot/1.0 (info@onlysuperfoods.in)' },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, displayName: data[0].display_name };
      }
    }
  } catch (e) {
    console.warn('[forwardGeocodeAddress] Geocoding exception:', e);
  }
  return null;
}

function isAddressInCoreZone(textAddress: string, coords?: [number, number]): boolean {
  if (coords && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
    if (pointInPolygon(coords, CORE_POLYGON_COORDS)) {
      return true;
    }
  }
  const lower = textAddress.toLowerCase();
  for (const pin of CORE_PINCODES) {
    if (lower.includes(pin)) return true;
  }
  for (const kw of CORE_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

async function generateAutoLoginToken(phone: string): Promise<string> {
  const cleanPhone = phone.replace(/\D/g, '');
  const token = `OSF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30-day TTL

  await supabase.from('customer_otps').insert({
    phone: cleanPhone,
    token,
    otp_code: 'AUTO',
    type: 'inbound_tap',
    verified_at: new Date().toISOString(),
    expires_at: expiresAt,
  });

  return token;
}

console.log('[Only SuperFoods] WhatsApp Webhook edge function initialized.');

// ─── Main HTTP Handler ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1. GET: Meta Webhook Verification Handshake & Diagnostics
  if (req.method === 'GET') {
    if (url.searchParams.get('diag') === '1' && url.searchParams.get('secret') === 'osf_diag_2026') {
      const to = url.searchParams.get('to') || '917760350360';
      const action = url.searchParams.get('action');
      const RAZORPAY_CONFIG_NAME = Deno.env.get('WHATSAPP_PAYMENT_CONFIG_NAME') || 'onlysuperfoods_pay';
      const ORDER_TEMPLATE_NAME = Deno.env.get('WHATSAPP_ORDER_TEMPLATE_NAME') || 'order_details_pay';

      const sampleItems = [{
        retailer_id: 'sunflower-microgreens',
        name: 'Sunflower Microgreens (50 g)',
        amount: 20,
        quantity: 1,
      }];

      if (action === 'interactive') {
        try {
          const resp = await wa.sendOrderDetailsPayment(
            to,
            'OSF-TEST-INT',
            'Order #OSF-TEST-INT Confirmed! Tap Review and Pay below to complete via UPI.',
            sampleItems,
            20,
            40,
            60,
            RAZORPAY_CONFIG_NAME
          );
          return new Response(JSON.stringify({ success: true, mode: 'interactive', response: resp }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ success: false, mode: 'interactive', error: e.message, stack: e.stack }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (action === 'template') {
        try {
          const resp = await wa.sendOrderDetailsTemplate(
            to,
            'Aadvik',
            'OSF-TEST-TPL',
            sampleItems,
            40,
            RAZORPAY_CONFIG_NAME,
            ORDER_TEMPLATE_NAME
          );
          return new Response(JSON.stringify({ success: true, mode: 'template', response: resp }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ success: false, mode: 'template', error: e.message, stack: e.stack }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (action === 'text') {
        try {
          const resp = await wa.sendText(to, '🌾 Only SuperFoods Test: Diagnostic Ping to WhatsApp.');
          return new Response(JSON.stringify({ success: true, mode: 'text', response: resp }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ success: false, mode: 'text', error: e.message, stack: e.stack }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({
        status: 'healthy',
        phone_number_id: PHONE_NUMBER_ID,
        razorpay_configured: Boolean(Deno.env.get('RAZORPAY_KEY_ID') && Deno.env.get('RAZORPAY_KEY_SECRET')),
        whatsapp_token_configured: Boolean(ACCESS_TOKEN),
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook handshake verified successfully with Meta!');
      return new Response(challenge, { status: 200 });
    }
    console.warn('❌ Webhook handshake failed: token mismatch');
    return new Response('Forbidden', { status: 403 });
  }

  // 2. POST: Meta Incoming Event Webhook
  if (req.method === 'POST') {
    try {
      const body = await req.json();

      // Directly await event processing so the serverless isolate remains active until messages are sent
      await processIncomingEvent(body);

      return new Response('EVENT_RECEIVED', { status: 200 });
    } catch (err: any) {
      console.error('[Webhook Error]:', err);
      // Return 200 to Meta so it does not retry failed business logic in an infinite loop
      return new Response('EVENT_RECEIVED', { status: 200 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
});

// ─── Message Processing Pipeline ──────────────────────────────────────────────

async function processIncomingEvent(body: any): Promise<void> {
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0]?.value;

  if (!change?.messages || change.messages.length === 0) {
    if (change?.statuses) {
      for (const st of change.statuses) {
        if (st.status === 'failed') {
          console.error(`🚨 [Meta Delivery FAILED] id=${st.id} recipient=${st.recipient_id} errors=`, JSON.stringify(st.errors));
        } else {
          console.log(`ℹ️ [Meta Delivery Status] id=${st.id} status=${st.status} recipient=${st.recipient_id}`);
        }
      }
    }
    return;
  }

  const message = change.messages[0];
  const from = message.from; // e.g. "919845012345"
  const contactName = change.contacts?.[0]?.profile?.name || 'Friend';
  const messageId = message.id;

  console.log(`📩 Incoming message from ${contactName} (${from}): type=${message.type}`);

  // Mark message as read (blue ticks)
  await wa.markAsRead(messageId).catch(() => { });

  // 1. Load or Create Customer Record
  let { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', from)
    .maybeSingle();

  if (!customer) {
    const { data: newCustomer } = await supabase
      .from('customers')
      .insert({ phone: from, name: contactName, total_orders: 0, delivery_addresses: [] })
      .select()
      .single();
    customer = newCustomer || { phone: from, name: contactName, total_orders: 0, delivery_addresses: [] };
  }

  // 2. Load or Create Active Session
  let { data: session } = await supabase
    .from('wa_sessions')
    .select('*')
    .eq('phone', from)
    .maybeSingle();

  if (!session) {
    const { data: newSession } = await supabase
      .from('wa_sessions')
      .insert({ phone: from, state: 'idle', cart_items: [] })
      .select()
      .single();
    session = newSession || { phone: from, state: 'idle', cart_items: [] };
  } else if (session.updated_at && message.type === 'text') {
    // Auto-reset stale session (> 24h) if customer sends a new greeting
    const rawText = (message.text?.body || '').trim().toLowerCase();
    if (/^(hi|hello|hey|start|menu|catalog)$/i.test(rawText)) {
      const lastUpdated = new Date(session.updated_at).getTime();
      const hoursSince = (Date.now() - lastUpdated) / (1000 * 60 * 60);
      if (hoursSince > 24 && (session.cart_items?.length > 0 || session.state !== 'idle')) {
        console.log(`[Session Reset] Expiring stale cart (${hoursSince.toFixed(1)}h old) for ${from}`);
        session.cart_items = [];
        session.state = 'idle';
        session.conversation_history = null;
        await supabase.from('wa_sessions').update({ state: 'idle', cart_items: [], conversation_history: null }).eq('phone', from);
      }
    }
  }

  // 3. Dispatch by Message Type
  if (message.type === 'order') {
    // FIX 1: Native WhatsApp Catalog Cart Order intercepted
    await handleCatalogOrder(from, message.order, customer, session);
  } else if (message.type === 'text') {
    const text = message.text.body.trim();
    await handleTextMessage(from, text, customer, session);
  } else if (message.type === 'interactive') {
    await handleInteractiveReply(from, message.interactive, customer, session);
  } else if (message.type === 'location') {
    const loc = message.location;
    await handleLocationMessage(from, loc.latitude, loc.longitude, loc.address || loc.name, customer, session);
  } else if (message.type === 'payment') {
    await handleNativePaymentConfirmation(from, message.payment, customer, session);
  } else {
    // Fallback for media / voice
    await wa.sendText(
      from,
      `Namaskara ${contactName}! 🙏 We received your message. You can tap below to explore our fresh harvest or connect with our farm team:`
    );
    await wa.sendButtons(
      from,
      `How can our Kadugodi farm assist you today?`,
      [
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_repeat', title: '🔁 1-Tap Reorder' },
        { id: 'btn_founder', title: '💬 Connect with Team' },
      ],
      'Only SuperFoods Kadugodi'
    );
  }
}

// Helper: Address vs Produce/Quantity Discrimination
function isValidAddressText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 5 || trimmed.length > 250) return false;

  // Reject produce quantities, grocery units, or food terms
  if (/\b(kg|kilogram|kilograms|kilo|kilos|gm|gms|gram|grams|pack|packs|packet|packets|box|boxes|punnet|punnets|tray|trays|dozen|dozens|mushroom|mushrooms|microgreen|microgreens|egg|eggs|kombucha|tea|oyster|dhingri)\b/i.test(trimmed)) {
    return false;
  }

  // Reject conversational questions, greetings, or common commands
  if (/^(can|how|what|why|is|do|are|where|when|tell|explain|hi|hello|hey|menu|catalog|repeat|reorder|cancel|reset|ok|yes|no)\b/i.test(trimmed) || trimmed.includes('?')) {
    return false;
  }

  return true;
}

// ─── Text Message Router ──────────────────────────────────────────────────────

async function handleTextMessage(
  from: string,
  text: string,
  customer: any,
  session: any
): Promise<void> {
  const lower = text.toLowerCase();

  // Fast-Path 0: PACKAGING QR CODE SCAN
  // Matches exact user copy or any keyword variation:
  if (
    lower.includes('scanned your fresh harvest pack') ||
    lower.includes('scanned') ||
    lower.includes('goodies') ||
    lower.includes('early access') ||
    lower.includes('share the goodies') ||
    lower.includes('pack!')
  ) {
    await sendPackagingQRWelcome(from, customer.name);
    return;
  }

  // Fast-Path 0B: WEBSITE ORDER CONFIRMATION RECEIPT
  if (
    lower.includes('order confirmation — only superfoods') ||
    lower.includes('order confirmation') ||
    lower.includes('please prepare my fresh morning harvest bag') ||
    (lower.includes('order id:') && lower.includes('#osf-'))
  ) {
    const orderMatch = text.match(/#?(OSF-\d+)/i);
    const orderId = orderMatch ? orderMatch[1].toUpperCase() : '';

    await wa.sendText(
      from,
      `*Order ${orderId ? `#${orderId} ` : ''}Received from Website*\n\n` +
      `Thank you ${customer.name || ''}! We have scheduled your order in our morning harvest roster.\n\n` +
      `*Harvest & Delivery:* Your mushrooms and living greens will be harvested fresh at 5:30 AM and delivered during our *Morning Delivery (7:00 AM – 10:00 AM)*.\n\n` +
      `You will receive a live update when our delivery partner leaves the farm hub.`
    );
    await wa.sendButtons(
      from,
      `Need anything else for your morning harvest?`,
      [
        { id: 'btn_recipes', title: '🥗 Check Recipes' },
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_founder', title: '💬 Connect with Team' },
      ],
      'Only SuperFoods'
    );
    return;
  }

  // Fast-Path 0C-LOGIN: 1-TAP INBOUND WEB LOGIN VERIFICATION
  const verifyTokenMatch = text.match(/OSF-VERIFY-([A-Za-z0-9]+)/i) || text.match(/\b(OSF-[A-Z0-9]{4,8})\b/i);
  if (verifyTokenMatch && (lower.includes('verify') || lower.includes('login') || lower.includes('superfoods') || lower.includes('account'))) {
    const matchedToken = (verifyTokenMatch[1] || verifyTokenMatch[0]).toUpperCase();
    const token = matchedToken.startsWith('OSF-') ? matchedToken : `OSF-${matchedToken}`;
    const cleanPhone = from.replace(/\D/g, '');

    const { data: otpRecord } = await supabase
      .from('customer_otps')
      .select('*')
      .eq('token', token)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpRecord) {
      await supabase
        .from('customer_otps')
        .update({
          phone: cleanPhone,
          verified_at: new Date().toISOString(),
        })
        .eq('id', otpRecord.id);

      await supabase.from('customers').upsert({
        phone: cleanPhone,
        name: customer?.name || 'Foodie',
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'phone' });

      const greetingName = customer?.name && customer.name !== 'Foodie' ? `, ${customer.name}` : '';
      await wa.sendText(
        from,
        `*You are verified and ready to harvest${greetingName}!* 🍄\n\n` +
        `Today's fresh mushroom & microgreens harvest is waiting in your bag:\n\n` +
        `👉 https://onlysuperfoods.in/cart\n\n` +
        `Or reply *MENU* anytime to order directly through WhatsApp.`
      );
      return;
    }
  }

  // Fast-Path 0C: FLAT / HOUSE NUMBER INPUT FOR PINNED ADDRESS
  if (session.state === 'awaiting_flat_no') {
    if (!/^(cancel|reset|clear|hi|hello|menu)$/i.test(lower)) {
      if (isValidAddressText(text)) {
        await handleFlatNumberResponse(from, text, customer, session);
        return;
      }
    }
  }

  // Fast-Path 0D: DELIVERY DATE SELECTION VIA TEXT
  if (session.state === 'awaiting_delivery_date') {
    if (/^(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next|date)/i.test(lower)) {
      const formattedSlot = `Morning Delivery (7:00 AM – 10:00 AM), ${text.trim()}`;
      await supabase.from('wa_sessions').update({
        selected_slot: formattedSlot,
        state: 'checkout_pending',
      }).eq('phone', from);
      session.selected_slot = formattedSlot;
      session.state = 'checkout_pending';
      const savedAddress = getSavedAddressString(customer) || 'Kadugodi / Whitefield, Bangalore';
      await sendCheckoutConfirmation(from, savedAddress, session.cart_items || [], customer, formattedSlot);
      return;
    }
  }

  // Fast-Path 0E: COD & UPI TEXT COMMANDS DURING CHECKOUT OR REORDER
  if (session.state === 'checkout_pending' || session.state === 'reorder_confirm') {
    if (/^(cod|cash|pay on delivery|cash on delivery)$/i.test(lower)) {
      await finalizeOrder(from, session, customer, 'cod');
      return;
    }
    if (/^(upi|pay online|pay via upi|online|gpay|phonepe|paytm)$/i.test(lower)) {
      await finalizeOrder(from, session, customer, 'upi');
      return;
    }
  }

  // Fast-Path 1: TEXT ADDRESS INPUT FALLBACK
  // If user is pending address and types their street/flat address instead of GPS pin
  if (
    (session.state === 'checkout_pending' || session.state === 'awaiting_address') &&
    isValidAddressText(text)
  ) {
    await handleTypedAddress(from, text, customer, session);
    return;
  }

  // Fast-Path 2: GREETING & MENU
  if (/^(hi|hello|hey|menu|catalog|start|shop)$/i.test(lower)) {
    await sendGreetingMenu(from, customer);
    return;
  }

  // Fast-Path 3: 1-TAP INSTANT REORDER
  if (/^(repeat|reorder|repeat my order|same again|usual)$/i.test(lower)) {
    await handleInstantReorder(from, customer);
    return;
  }

  // Fast-Path 4: RECIPES & COOKING ADVICE
  if (/^(recipe|recipes|cook|cooking|how to cook|storage|tips)$/i.test(lower)) {
    await sendRecipeAdvice(from, customer.name);
    return;
  }

  // Fast-Path 5: TEAM CONTACT & CALL ESCALATION (including B2B / Cafe / Bulk inquiries)
  if (
    /^(team|call|talk to founder|contact|speak to founder|manager|human|agent|help|support)$/i.test(lower) ||
    lower.includes('bulk') ||
    lower.includes('catering') ||
    lower.includes('cafe') ||
    lower.includes('restaurant') ||
    lower.includes('hotel')
  ) {
    await sendContactTeam(from, customer.name);
    return;
  }

  // Fast-Path 6: ORDER TRACKING (handles "where is my order?", "track", "status", etc.)
  if (
    /^(track|status|where is my order\??|track order|order status)$/i.test(lower) ||
    lower.includes('where is my order') ||
    lower.includes('track my order') ||
    lower.includes('track order')
  ) {
    await handleOrderTracking(from);
    return;
  }

  // Fast-Path 7: CANCEL & RESET
  if (/^(cancel|reset|clear)$/i.test(lower)) {
    await supabase.from('wa_sessions').update({ state: 'idle', cart_items: [] }).eq('phone', from);
    await wa.sendText(from, `Your active basket has been cleared. Text *"Menu"* whenever you're ready to order again.`);
    return;
  }

  // Fast-Path 8: STRICT MORNING DELIVERY POLICY (Handles evening / night slot queries)
  if (lower.includes('evening') || lower.includes('night') || lower.includes('6 pm') || lower.includes('7 pm')) {
    await wa.sendText(
      from,
      `Namaskara ${customer.name || ''}! 🙏 We harvest fresh at 5:30 AM and deliver strictly during our *Morning Delivery (7:00 AM – 10:00 AM)* across Kadugodi & Whitefield.\n\n` +
      `Because gourmet oyster mushrooms and living microgreens are delicate living produce, we do not operate evening deliveries so that your harvest reaches you chilled, crisp, and fresh out of the grow room.\n\n` +
      `Would you like to book tomorrow's morning delivery?`
    );
    await wa.sendButtons(
      from,
      `Select an option below:`,
      [
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_founder', title: '💬 Connect with Team' },
      ],
      'Only SuperFoods'
    );
    return;
  }

  // Fast-Path 9: NATURAL PARSING (e.g. "send 500g grey oyster tomorrow")
  const parsedCart = parseNaturalOrder(lower);
  if (parsedCart.length > 0) {
    await addItemsToCartAndConfirm(from, parsedCart, session, customer);
    return;
  }

  // Fallback: If Groq API Key is configured, run AI tool-calling
  if (GROQ_API_KEY) {
    await handleGroqConversationalAI(from, text, customer, session);
    return;
  }

  // Default Friendly Concierge Fallback
  await sendGreetingMenu(from, customer);
}

// ─── Interactive Message (Buttons & List Clicks) ──────────────────────────────

async function handleInteractiveReply(
  from: string,
  interactive: any,
  customer: any,
  session: any
): Promise<void> {
  const type = interactive.type;
  const id = type === 'button_reply' ? interactive.button_reply?.id : interactive.list_reply?.id;

  console.log(`🔘 User clicked interactive ${type}: id=${id}`);

  if (id === 'btn_catalog') {
    await wa.sendCatalog(
      from,
      `Tap below to open our live fresh harvest store with pictures, pack sizes, and 1-tap ordering:`,
      'grey-oyster_250-g',
      'Only SuperFoods Kadugodi'
    );
    return;
  }

  if (id === 'btn_menu') {
    await sendFreshHarvestMenu(from, customer.name);
    return;
  }

  if (id === 'btn_repeat') {
    await handleInstantReorder(from, customer);
    return;
  }

  if (id === 'btn_recipes') {
    await sendRecipeAdvice(from, customer.name);
    return;
  }

  if (id === 'btn_founder' || id === 'btn_contact_team') {
    await sendContactTeam(from, customer.name);
    return;
  }

  if (id === 'btn_track_order') {
    await handleOrderTracking(from);
    return;
  }

  if (id === 'btn_change_date') {
    await supabase.from('wa_sessions').update({ state: 'awaiting_delivery_date' }).eq('phone', from);
    await wa.send7DayDatePicker(from);
    return;
  }

  if (id === 'btn_express_delivery') {
    const history = session.conversation_history || {};
    const area = history.out_of_zone_area || 'your location';
    await wa.sendText(
      from,
      `Thank you! Our farm team has received your express delivery inquiry for ${area}.\n\n` +
      `We will check direct Porter or Dunzo courier rates and message you the quote shortly.\n\n` +
      `To connect directly with our farm team, call or WhatsApp +91 77603 50360.`
    );
    return;
  }

  if (id && id.startsWith('date_')) {
    const rawDate = id.replace('date_', ''); // YYYY-MM-DD
    const [yearStr, monthStr, dayStr] = rawDate.split('-');
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10) - 1;
    const dayVal = parseInt(dayStr, 10);
    // Midday UTC anchoring guarantees d.getUTCDay() matches the calendar date in any timezone
    const d = new Date(Date.UTC(y, m, dayVal, 12, 0, 0));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[d.getUTCDay()];
    const monthName = months[m];
    const dateNum = dayVal;

    const formattedSlot = `${dayName}, ${monthName} ${dateNum} (7:00 AM – 10:00 AM)`;

    await supabase.from('wa_sessions').update({
      selected_slot: formattedSlot,
      state: 'checkout_pending',
    }).eq('phone', from);

    session.selected_slot = formattedSlot;
    session.state = 'checkout_pending';

    const savedAddress = getSavedAddressString(customer) || 'Kadugodi / Whitefield, Bangalore';
    await sendCheckoutConfirmation(from, savedAddress, session.cart_items || [], customer, formattedSlot);
    return;
  }

  // Stale Button Gating: Intercept clicks on old messages (Edit Address, Pay UPI, Cash on Delivery) after order placed/confirmed
  if (id === 'btn_change_address' || id === 'btn_pay_upi' || id === 'btn_pay_cod') {
    const hasCart = Array.isArray(session?.cart_items) && session.cart_items.length > 0;
    if (!hasCart) {
      const { data: activeOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_phone', from)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeOrder && (activeOrder.order_status === 'placed' || activeOrder.order_status === 'confirmed' || activeOrder.payment_status === 'paid')) {
        const slotText = activeOrder.delivery_slot || 'scheduled morning delivery';
        await wa.sendButtons(
          from,
          `Your *Order #${activeOrder.order_number}* is already confirmed and scheduled for morning harvest on *${slotText}*! 🌿\n\n` +
          `To update your delivery address or doorstep instructions before morning dispatch, please connect directly with our farm team:`,
          [
            { id: 'btn_founder', title: '💬 Connect with Team' },
            { id: 'btn_recipes', title: '🥗 Check Recipes' },
          ],
          'Only SuperFoods Kadugodi'
        );
        return;
      }

      await wa.sendButtons(
        from,
        `Your fresh harvest basket is currently empty. 🧺\n\nTap below to explore today's morning harvest!`,
        [
          { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
          { id: 'btn_founder', title: '💬 Connect with Team' },
        ],
        'Only SuperFoods Kadugodi'
      );
      return;
    }
  }

  if (id === 'btn_change_address') {
    await supabase.from('wa_sessions').update({ state: 'awaiting_address' }).eq('phone', from);
    await wa.sendLocationRequest(
      from,
      `📍 *Update Delivery Address*\n\nTap below to share your current location pin, or reply with your street address:`
    );
    return;
  }

  if (id === 'btn_confirm_pinned_area') {
    const history = session.conversation_history || {};
    const pinnedCoords = history.pinned_coords || [12.9850, 77.7550];
    const pinnedArea = history.pinned_area || 'Kadugodi / Whitefield, Bangalore';

    const addrObj = {
      address: pinnedArea,
      coords: pinnedCoords,
      maps_link: `https://maps.google.com/?q=${pinnedCoords[0]},${pinnedCoords[1]}`,
      zone: 'CORE',
      requires_doorstep_call: true,
    };

    await supabase.from('customers').update({
      delivery_addresses: [addrObj],
      last_active_at: new Date().toISOString(),
    }).eq('phone', from);

    await supabase.from('wa_sessions').update({
      state: 'awaiting_delivery_date',
      conversation_history: null,
    }).eq('phone', from);

    await wa.send7DayDatePicker(
      from,
      undefined,
      `📍 Area saved: *${pinnedArea}* ✅\n\nPlease select which morning you would like your fresh harvest delivered (7:00 AM – 10:00 AM):`
    );
    return;
  }

  // Item selected from List Menu: format `item_<id>_<size>`
  if (id && id.startsWith('item_')) {
    const parts = id.split('_');
    const productId = parts[1];
    const packSize = parts.slice(2).join(' ').replace(/-/g, ' ');

    await addItemsToCartAndConfirm(
      from,
      [{ productId, packSize, quantity: 1 }],
      session,
      customer
    );
    return;
  }

  // Payment Options
  if (id === 'btn_pay_upi') {
    await finalizeOrder(from, session, customer, 'upi');
    return;
  }

  if (id === 'btn_pay_cod') {
    await finalizeOrder(from, session, customer, 'cod');
    return;
  }
}

// ─── Packaging QR Welcome ─────────────────────────────────────────────────────

async function sendPackagingQRWelcome(to: string, name?: string): Promise<void> {
  const greeting = name ? `Namaskara ${name}! Welcome to Only SuperFoods. 🙏` : `Namaskara! Welcome to Only SuperFoods. 🙏`;
  const authToken = await generateAutoLoginToken(to).catch(() => '');
  const recipeUrl = authToken ? `https://onlysuperfoods.in/recipes?auth=${authToken}` : 'https://onlysuperfoods.in/recipes';

  const bodyText =
    `${greeting}\n\n` +
    `Thank you for picking up our fresh Kadugodi harvest pack!\n\n` +
    `*Chef Secret (3-Minute Sauté):*\n` +
    `• Never wash mushrooms with water (they act like sponges). Gently wipe with a dry cloth.\n` +
    `• Tear clusters into bite-sized shreds by hand.\n` +
    `• Sauté on high heat in sizzling butter or olive oil for 3-4 mins until golden crispy edges form.\n` +
    `• Crucial: Add salt only in the last 30 seconds to lock in moisture and develop crispy edges.\n\n` +
    `*Freshness & Storage:*\n` +
    `Keep unwashed in our breathable kraft punnet in your fridge crisper drawer (4°C–7°C). Never seal in plastic. Stays fresh 5–7 days.\n\n` +
    `📖 *Full Chef Recipes & Video Guides:*\n` +
    `${recipeUrl}\n\n` +
    `How can our farm team assist you today?`;

  await wa.sendButtons(
    to,
    bodyText,
    [
      { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
      { id: 'btn_recipes', title: '🥗 Check Recipes' },
      { id: 'btn_founder', title: '💬 Connect with Team' },
    ],
    'Only SuperFoods Kadugodi'
  );
}

// ─── Standard Greeting Menu ───────────────────────────────────────────────────

async function sendGreetingMenu(to: string, customer: any): Promise<void> {
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('customer_phone', to)
    .limit(1)
    .maybeSingle();

  const isReturning = Boolean(lastOrder);

  if (isReturning) {
    await wa.sendButtons(
      to,
      `Namaskara, ${customer.name || 'Friend'}! Welcome back. 🙏\n\n` +
      `Our morning harvest in Kadugodi is ready. What can we harvest fresh for your kitchen tomorrow morning? 🍄\n\n` +
      `Delivered fresh to your doorstep (7:00 AM – 10:00 AM).`,
      [
        { id: 'btn_repeat', title: '🔁 1-Tap Reorder' },
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_founder', title: '💬 Connect with Team' },
      ],
      'Only SuperFoods Kadugodi'
    );
  } else {
    await wa.sendButtons(
      to,
      `Namaskara! Welcome to Only SuperFoods. 🙏\n\n` +
      `We grow gourmet oyster mushrooms, living microgreens, artisanal kombucha & free-range desi eggs in Kadugodi. 🍄🌿\n\n` +
      `Harvested fresh at 5:30 AM and delivered cold to your doorstep between 7:00 AM – 10:00 AM.\n\n` +
      `How would you like to begin?`,
      [
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_recipes', title: '🥗 Check Recipes' },
        { id: 'btn_founder', title: '💬 Connect with Team' },
      ],
      'Only SuperFoods Kadugodi'
    );
  }
}

// ─── Delivery Fee & Customer Address Helpers ─────────────────────────────────

function calculateDelivery(subtotal: number, settings: any) {
  const rawThresh = settings?.free_delivery_threshold;
  const threshold = (rawThresh !== undefined && rawThresh !== null && rawThresh !== '' && !isNaN(Number(rawThresh)))
    ? Number(rawThresh)
    : 350;

  const rawBase = settings?.base_delivery_fee;
  const baseFee = (rawBase !== undefined && rawBase !== null && rawBase !== '' && !isNaN(Number(rawBase)))
    ? Number(rawBase)
    : 40;

  const discountPct = Number(settings?.delivery_discount_percent ?? 0);
  const isPromoActive = Boolean(settings?.is_promotional_active);

  // If base fee is explicitly 0 or threshold is 0 or subtotal meets threshold
  if (baseFee === 0 || threshold <= 0 || subtotal >= threshold) {
    return { fee: 0, line: 'FREE (Morning Delivery)', total: subtotal, threshold };
  }

  const discountAmount = isPromoActive ? (baseFee * (discountPct / 100)) : 0;
  const fee = Math.max(0, Math.round(baseFee - discountAmount));
  const gap = threshold - subtotal;
  const baseStr = isPromoActive && discountPct > 0
    ? `₹${fee} (~₹${baseFee}~ promo applied)`
    : `₹${fee}`;
  const line = fee === 0 ? 'FREE (Morning Delivery)' : `${baseStr} (Add ₹${gap} for free delivery)`;

  return { fee, line, total: subtotal + fee, threshold };
}

function isValidSavedAddress(addr: string | null | undefined): boolean {
  if (!addr || typeof addr !== 'string') return false;
  const trimmed = addr.trim();
  if (trimmed.length < 5) return false;
  // Guard against corrupted values like "2 kilograms", "1 pack", or pure food names
  if (/\b(kg|kilogram|kilograms|kilo|kilos|gm|gms|gram|grams|pack|packs|packet|packets|box|boxes|punnet|punnets|tray|trays)\b/i.test(trimmed)) {
    // Only valid if it contains real address tokens
    const hasRealAddressToken = /\b(flat|apt|apartment|house|door|villa|tower|block|floor|plot|road|rd|street|st|lane|cross|main|layout|nagar|halli|puram|colony|society|phase|sector|56\d{4})\b/i.test(trimmed);
    if (!hasRealAddressToken) return false;
  }
  if (/^(grey|pink|mixed)\s*oyster/i.test(trimmed)) return false;
  return true;
}

function getSavedAddressString(customer: any): string | null {
  if (!customer) return null;
  if (Array.isArray(customer.delivery_addresses) && customer.delivery_addresses.length > 0) {
    for (const entry of customer.delivery_addresses) {
      const candidate = typeof entry === 'string' ? entry : entry?.address;
      if (isValidSavedAddress(candidate)) {
        return candidate.trim();
      }
    }
  }
  if (isValidSavedAddress(customer.address)) {
    return customer.address.trim();
  }
  return null;
}

function isInventoryUnavailable(inv: any, requestedQty = 1): boolean {
  if (!inv) return false;
  const status = inv.manual_status || 'AUTO';
  if (status === 'IN_STOCK') return false;
  if (status === 'OUT_OF_STOCK' || status === 'COMING_SOON' || status === 'HIDDEN') return true;
  return Boolean(inv.is_sold_out) || Number(inv.available_qty) < requestedQty;
}

function getSortedPacks(prod: any): Array<{ size: string; price: number; sort_order?: number }> {
  const packs = Array.isArray(prod?.product_pack_sizes) ? [...prod.product_pack_sizes] : [];
  packs.sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  if (packs.length > 0) return packs;
  return [{ size: prod?.unit || 'Standard', price: Number(prod?.price) || 0, sort_order: 1 }];
}

async function fetchLiveCatalog() {
  const [{ data: dbProducts }, { data: dbInventory }] = await Promise.all([
    supabase
      .from('products')
      .select('*, product_pack_sizes(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase.from('inventory').select('*'),
  ]);

  const inventoryMap: Record<string, any> = {};
  (dbInventory || []).forEach((inv: any) => {
    inventoryMap[inv.product_id] = inv;
  });

  const products = dbProducts || [];
  const productMap: Record<string, any> = {};
  products.forEach((p: any) => {
    productMap[p.id] = p;
  });

  return { products, productMap, inventoryMap };
}

// ─── Native WhatsApp Catalog Cart Order Handler (type === 'order') ────────────

async function handleCatalogOrder(
  from: string,
  order: any,
  customer: any,
  session: any
): Promise<void> {
  const items = order?.product_items || [];
  if (items.length === 0) {
    await wa.sendText(from, `Your cart was empty. Text *"Menu"* to view today's harvest!`);
    return;
  }

  // 1. Fetch live products and inventory from Supabase
  const { products: catalog, inventoryMap } = await fetchLiveCatalog();
  const validatedCart: any[] = [];
  let subtotal = 0;
  const soldOutItems: string[] = [];

  for (const item of items) {
    const retailerId = (item.product_retailer_id || '').toLowerCase();
    const qty = Number(item.quantity) || 1;

    let matchedProd: any = null;
    let matchedPack: any = null;

    for (const p of catalog) {
      const primaryPacks = getSortedPacks(p);
      for (const pk of primaryPacks) {
        const idCandidate = `${p.id}_${(pk.size || '').replace(/[^a-zA-Z0-9]/g, '-')}`.toLowerCase();
        if (idCandidate === retailerId || p.id.toLowerCase() === retailerId) {
          matchedProd = p;
          matchedPack = pk;
          break;
        }
      }
      if (matchedProd) break;
    }

    if (!matchedProd) {
      matchedProd = catalog.find((p: any) => retailerId.startsWith(p.id.toLowerCase()));
      const sorted = matchedProd ? getSortedPacks(matchedProd) : [];
      matchedPack = sorted[0] || { size: matchedProd?.unit || '250 g', price: matchedProd?.price ?? 100 };
    }

    if (matchedProd) {
      const inv = inventoryMap[matchedProd.id];
      if (isInventoryUnavailable(inv, qty)) {
        soldOutItems.push(matchedProd.name);
        continue;
      }

      const price = Number(matchedPack?.price ?? matchedProd.price ?? item.item_price ?? 100);
      const lineTotal = price * qty;
      subtotal += lineTotal;

      validatedCart.push({
        id: matchedProd.id,
        name: matchedProd.name,
        packSize: matchedPack?.size || matchedProd.unit || 'Standard',
        price,
        quantity: qty,
        lineTotal,
      });
    }
  }

  if (soldOutItems.length > 0) {
    await wa.sendText(
      from,
      `Notice: *${soldOutItems.join(', ')}* is currently sold out for today.\n\nOur growers harvest fresh flushes tomorrow morning at 5:30 AM.`
    );
  }

  if (validatedCart.length === 0) {
    if (soldOutItems.length === 0) {
      await wa.sendText(from, `We could not match the items in your cart. Text *"Menu"* to browse our current harvest.`);
    }
    return;
  }

  // If user tapped "Add More Items" from repeat order, merge with existing basket
  const finalCart: any[] = (session.state === 'reorder_confirm' && Array.isArray(session.cart_items) && session.cart_items.length > 0)
    ? [...session.cart_items]
    : [];

  for (const item of validatedCart) {
    const existingIndex = finalCart.findIndex((c: any) => c.id === item.id && c.packSize === item.packSize);
    if (existingIndex >= 0) {
      finalCart[existingIndex].quantity += item.quantity;
      finalCart[existingIndex].lineTotal = finalCart[existingIndex].quantity * item.price;
    } else {
      finalCart.push(item);
    }
  }

  const effectiveCart = finalCart.length > 0 ? finalCart : validatedCart;
  subtotal = effectiveCart.reduce((sum: number, i: any) => sum + (i.lineTotal || i.price), 0);

  // Update session with effectiveCart
  await supabase.from('wa_sessions').update({
    cart_items: effectiveCart,
    state: 'checkout_pending',
  }).eq('phone', from);

  // Delivery fee calculation from store_settings
  const { data: settings } = await supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle();
  const { fee: deliveryFee, line: deliveryLine, total } = calculateDelivery(subtotal, settings);

  const receipt = effectiveCart
    .map((i) => `• ${i.quantity}x ${i.name} (${i.packSize}) — ₹${i.lineTotal}`)
    .join('\n');

  // Check saved customer address in plain words
  const savedAddress = getSavedAddressString(customer);

  if (savedAddress) {
    if (session.selected_slot) {
      await sendCheckoutConfirmation(from, savedAddress, effectiveCart, customer, session.selected_slot);
    } else {
      await supabase.from('wa_sessions').update({
        state: 'awaiting_delivery_date',
      }).eq('phone', from);
      await wa.send7DayDatePicker(from);
    }
  } else {
    // First time customer: Frictionless Location Request
    const message =
      `Got your fresh harvest basket, ${customer.name || 'Friend'}!\n\n` +
      `${receipt}\n\n` +
      `Subtotal: ₹${subtotal}\n` +
      `Morning Delivery: ${deliveryLine}\n\n` +
      `*Morning Harvest Delivery (7:00 AM – 10:00 AM)*\n` +
      `Orders placed before 11:59 PM are fresh-harvested at 5:30 AM for next morning arrival.\n\n` +
      `*Where should we deliver your morning harvest?*\n` +
      `Tap below to share your delivery location with 1 tap, or reply with your street address:`;

    await wa.sendLocationRequest(
      from,
      message
    );
  }
}

// ─── Location Geocoding & Address Handler ──────────────────────────────────────

async function reverseGeocodeCoords(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'User-Agent': 'OnlySuperfoodsWhatsAppBot/1.0 (info@onlysuperfoods.in)' },
    });
    const data = await res.json();
    if (data && data.address) {
      const a = data.address;
      const road = a.road || a.street || a.pedestrian || '';
      const suburb = a.suburb || a.neighbourhood || a.quarter || a.residential || '';
      const cityDistrict = a.city_district || a.district || '';
      const city = a.city || a.town || a.village || 'Bangalore';
      const postcode = a.postcode ? ` - ${a.postcode}` : '';

      const parts = [road, suburb, cityDistrict, `${city}${postcode}`].filter(Boolean);
      return parts.join(', ') || data.display_name || 'Kadugodi / Whitefield, Bangalore';
    }
    return data.display_name || 'Kadugodi / Whitefield, Bangalore';
  } catch (e) {
    console.warn('Geocoding error', e);
    return 'Kadugodi / Whitefield, Bangalore';
  }
}

// ─── Common Checkout Confirmation Helper ────────────────────────────────────

async function sendCheckoutConfirmation(
  to: string,
  address: string,
  cart: any[],
  customer: any,
  deliverySlot?: string
): Promise<void> {
  if (cart.length === 0) {
    await wa.sendButtons(
      to,
      `*Address Saved:*\n${address}\n\nYour address in Kadugodi/Whitefield is saved for morning harvest deliveries (7:00 AM – 10:00 AM). 🌿\n\nBrowse today's harvest:`,
      [
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_recipes', title: '🥗 Check Recipes' },
      ],
      'Only SuperFoods'
    );
    return;
  }

  const subtotal = cart.reduce((sum: number, i: any) => sum + (Number(i.lineTotal) || (Number(i.price) * (Number(i.quantity) || 1))), 0);
  const { data: settings } = await supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle();
  const { fee: deliveryFee, line: deliveryLine, total: onlineTotal } = calculateDelivery(subtotal, settings);

  const codTotal = onlineTotal + 10;
  const slot = deliverySlot || 'Tomorrow Morning (7:00 AM – 10:00 AM)';

  const receipt = cart
    .map((i: any) => `• ${i.quantity || 1}x ${i.name} (${i.packSize || ''}) — ₹${i.lineTotal || (i.price * (i.quantity || 1))}`)
    .join('\n');

  const summary =
    `Your harvest basket is ready, ${customer?.name || 'Friend'}:\n\n` +
    `${receipt}\n\n` +
    `Subtotal: ₹${subtotal}\n` +
    `Morning Delivery: ${deliveryLine}\n\n` +
    `*Delivering to:*\n${address}\n\n` +
    `*Delivery Window:*\n${slot}\n\n` +
    `*Payment:*\n` +
    `• UPI: ₹${onlineTotal} (Instant auto-confirm)\n` +
    `• Doorstep: ₹${codTotal} (+₹10 courier handling)`;

  await wa.sendButtons(
    to,
    summary,
    [
      { id: 'btn_pay_upi', title: '💳 Pay via UPI' },
      { id: 'btn_pay_cod', title: '💵 Cash on Delivery' },
      { id: 'btn_change_address', title: '📍 Edit Address' },
    ],
    'Only SuperFoods Checkout',
    "Reply 'date' to change day, or 'menu' to edit items"
  );
}

async function handleLocationMessage(
  from: string,
  lat: number,
  lng: number,
  addressName: string,
  customer: any,
  session: any
): Promise<void> {
  const isInside = pointInPolygon([lat, lng], CORE_POLYGON_COORDS);

  // Convert GPS coordinates into human-readable area name
  const cleanAddress = (addressName && !addressName.includes('GPS') && !addressName.includes('Pinned'))
    ? addressName
    : await reverseGeocodeCoords(lat, lng);

  // Out-of-Zone Delivery Location Protection (Item 6)
  if (!isInside) {
    await supabase.from('wa_sessions').update({
      state: 'out_of_zone_offer',
      conversation_history: {
        ...(typeof session.conversation_history === 'object' ? session.conversation_history : {}),
        out_of_zone_area: cleanAddress,
      },
    }).eq('phone', from);

    await wa.sendExpressDeliveryOffer(from, cleanAddress);
    return;
  }

  // 2-Step Location Capture: Save pinned coords in session and prompt for Flat / House / Apartment number
  await supabase.from('wa_sessions').update({
    state: 'awaiting_flat_no',
    conversation_history: {
      pinned_coords: [lat, lng],
      pinned_area: cleanAddress,
    },
  }).eq('phone', from);

  await wa.sendButtons(
    from,
    `📍 Area Verified: *${cleanAddress}* ✅\n\n` +
    `🏡 *Final step:* Please reply with your Flat / House No. & Apartment / Society name:\n` +
    `_(e.g., "Flat 402, Tower B, Prestige Boulevard" or "House #12, 3rd Cross")_\n\n` +
    `This ensures our morning harvest delivery partner brings your fresh produce straight to your door.`,
    [
      { id: 'btn_confirm_pinned_area', title: '✅ Use Pinned Area' },
      { id: 'btn_change_address', title: '📍 Repin Location' },
    ],
    'Delivery Doorstep'
  );
}

async function handleFlatNumberResponse(
  from: string,
  flatNumberText: string,
  customer: any,
  session: any
): Promise<void> {
  const history = session.conversation_history || {};
  const pinnedCoords = history.pinned_coords || [12.9850, 77.7550];
  const pinnedArea = history.pinned_area || 'Kadugodi / Whitefield, Bangalore';

  const fullAddress = `${flatNumberText.trim()}, ${pinnedArea}`;
  const addrObj = {
    address: fullAddress,
    flat_no: flatNumberText.trim(),
    area: pinnedArea,
    coords: pinnedCoords,
    maps_link: `https://maps.google.com/?q=${pinnedCoords[0]},${pinnedCoords[1]}`,
    zone: 'CORE',
  };

  await supabase.from('customers').update({
    delivery_addresses: [addrObj],
    last_active_at: new Date().toISOString(),
  }).eq('phone', from);

  await supabase.from('wa_sessions').update({
    state: 'awaiting_delivery_date',
    conversation_history: null,
  }).eq('phone', from);

  await wa.send7DayDatePicker(
    from,
    undefined,
    `📍 Address saved: *${fullAddress}* ✅\n\nPlease select which morning you would like your fresh harvest delivered (7:00 AM – 10:00 AM):`
  );
}

async function handleTypedAddress(
  from: string,
  textAddress: string,
  customer: any,
  session: any
): Promise<void> {
  const cleanAddr = textAddress.trim();
  const geoResult = await forwardGeocodeAddress(cleanAddr);
  const coords: [number, number] | undefined = geoResult ? [geoResult.lat, geoResult.lng] : undefined;
  const inCoreZone = isAddressInCoreZone(cleanAddr, coords);

  if (!inCoreZone) {
    await supabase.from('wa_sessions').update({
      state: 'out_of_zone_offer',
      conversation_history: {
        ...(typeof session.conversation_history === 'object' ? session.conversation_history : {}),
        out_of_zone_area: cleanAddr,
      },
    }).eq('phone', from);

    await wa.sendExpressDeliveryOffer(from, cleanAddr);
    return;
  }

  const addrObj = {
    address: cleanAddr,
    coords: coords,
    zone: 'CORE',
  };

  await supabase.from('customers').update({
    delivery_addresses: [addrObj],
    last_active_at: new Date().toISOString(),
  }).eq('phone', from);

  await supabase.from('wa_sessions').update({
    state: 'awaiting_delivery_date',
    conversation_history: null,
  }).eq('phone', from);

  await wa.send7DayDatePicker(
    from,
    undefined,
    `📍 Address saved: *${cleanAddr}* ✅\n\nPlease select which morning you would like your fresh harvest delivered (7:00 AM – 10:00 AM):`
  );
}

// ─── 1-Tap "Repeat My Order" Handler ──────────────────────────────────────────

async function handleInstantReorder(to: string, customer: any): Promise<void> {
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_phone', to)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastOrder) {
    await wa.sendButtons(
      to,
      `Namaskara ${customer.name || ''}! 🙏 We couldn't find a previous order on this number yet.\n\n` +
      `Let's get your first morning harvest box started:`,
      [
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_recipes', title: '🥗 Check Recipes' },
        { id: 'btn_founder', title: '💬 Connect with Team' },
      ],
      'Only SuperFoods Kadugodi'
    );
    return;
  }

  const rawItems = lastOrder.items || [];
  const { productMap, inventoryMap } = await fetchLiveCatalog();
  const items: any[] = [];
  const unavailableNames: string[] = [];

  for (const oldItem of rawItems) {
    const pid = oldItem.id || oldItem.productId;
    const qty = Number(oldItem.quantity) || 1;
    const liveProd = pid ? productMap[pid] : null;
    const inv = liveProd ? inventoryMap[liveProd.id] : null;

    if (!liveProd || isInventoryUnavailable(inv, qty)) {
      unavailableNames.push(oldItem.name || pid || 'Produce item');
      continue;
    }

    const packs = getSortedPacks(liveProd);
    const matchedPack = packs.find((pk) => pk.size === oldItem.packSize) || packs[0];
    const livePrice = Number(matchedPack?.price ?? liveProd.price ?? oldItem.price ?? 0);

    items.push({
      id: liveProd.id,
      name: liveProd.name,
      packSize: matchedPack?.size || oldItem.packSize || liveProd.unit || '',
      price: livePrice,
      quantity: qty,
      lineTotal: livePrice * qty,
    });
  }

  if (items.length === 0) {
    await wa.sendButtons(
      to,
      `Namaskara, ${customer.name || 'Friend'}!\n\nYour previous items (*${unavailableNames.join(', ')}*) are currently out of stock for today's harvest.\n\nBrowse today's morning harvest:`,
      [
        { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
        { id: 'btn_founder', title: '💬 Connect with Team' },
      ],
      'Only SuperFoods'
    );
    return;
  }

  const list = items.map((i: any) => `• ${i.quantity}x ${i.name} (${i.packSize}) — ₹${i.lineTotal}`).join('\n');
  const savedAddress = lastOrder.delivery_address?.address || getSavedAddressString(customer) || 'Kadugodi / Whitefield, Bangalore';

  // Sync saved address to customer record if not already present
  if (lastOrder.delivery_address && (!customer.delivery_addresses || customer.delivery_addresses.length === 0)) {
    await supabase.from('customers').update({
      delivery_addresses: [lastOrder.delivery_address],
      last_active_at: new Date().toISOString(),
    }).eq('phone', to);
    customer.delivery_addresses = [lastOrder.delivery_address];
  }

  const subtotal = items.reduce((sum: number, i: any) => sum + (Number(i.lineTotal) || Number(i.price) || 0), 0);
  const { data: settings } = await supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle();
  const { fee: deliveryFee, line: deliveryLine, total } = calculateDelivery(subtotal, settings);

  // Save into session for immediate confirmation
  await supabase.from('wa_sessions').update({
    cart_items: items,
    state: 'reorder_confirm',
  }).eq('phone', to);

  const unavailableNote = unavailableNames.length > 0
    ? `\n_Note: ${unavailableNames.join(', ')} is currently sold out and skipped._\n`
    : '';

  await wa.sendButtons(
    to,
    `*Welcome back, ${customer.name || ''}!* Here is your usual harvest basket:\n\n` +
    `${list}\n` +
    `${unavailableNote}\n` +
    `Subtotal: ₹${subtotal}\n` +
    `Morning Delivery: ${deliveryLine}\n` +
    `*Total Payable:* ₹${total} (UPI) / ₹${total + 10} (Doorstep)\n\n` +
    `Delivering to: ${savedAddress}\n` +
    `Delivery Window: Tomorrow Morning (7:00 AM – 10:00 AM)\n\n` +
    `Tap below to confirm via UPI, or reply 'COD' for pay on delivery:`,
    [
      { id: 'btn_pay_upi', title: '💳 Pay via UPI' },
      { id: 'btn_catalog', title: '🛍️ Add More Items' },
      { id: 'btn_change_address', title: '📍 Edit Address' },
    ],
    'Repeat Harvest Order'
  );
}

// ─── Recipe & Storage Advice ──────────────────────────────────────────────────

async function sendRecipeAdvice(to: string, name?: string): Promise<void> {
  const authToken = await generateAutoLoginToken(to).catch(() => '');
  const recipeUrl = authToken ? `https://onlysuperfoods.in/recipes?auth=${authToken}` : 'https://onlysuperfoods.in/recipes';

  const bodyText =
    `*Chef Secrets for Gourmet Oyster Mushrooms:*\n\n` +
    `1. *3-Minute Golden Sauté:*\n` +
    `• Never wash with water (they act like sponges). Wipe gently with a dry cloth.\n` +
    `• Tear clusters by hand into bite-sized shreds.\n` +
    `• Pan-sear on high heat in sizzling butter or olive oil for 3-4 minutes.\n` +
    `• Crucial: Add salt only in the last 30 seconds for crispy edges and locked-in juiciness.\n\n` +
    `2. *Living Microgreens:* Eat 100% raw (never heat!). Snip right above root bed directly onto eggs, salads, or toast.\n\n` +
    `3. *Storage:* Keep unwashed in breathable kraft punnet in vegetable crisper drawer (4°C–7°C). Stays fresh 5-7 days.\n\n` +
    `📖 *Full Chef Recipes & Video Guides:*\n` +
    `${recipeUrl}\n\n` +
    `Ready to harvest your next kitchen box?`;

  await wa.sendButtons(
    to,
    bodyText,
    [
      { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
      { id: 'btn_repeat', title: '🔁 1-Tap Reorder' },
      { id: 'btn_founder', title: '💬 Connect with Team' },
    ],
    'Only SuperFoods Kadugodi'
  );
}

// ─── Team Contact & Escalation ────────────────────────────────────────────────

async function sendContactTeam(to: string, name?: string): Promise<void> {
  const text =
    `Namaskara ${name || ''}! 🙏 You can speak or message our farm team directly:\n\n` +
    `• Call or WhatsApp: +91 77603 50360\n` +
    `• Alternate Farm Line: +91 70197 60360\n\n` +
    `Our Kadugodi farm hub is active daily from 7:00 AM to 8:00 PM.`;

  await wa.sendText(to, text);
}
const sendFounderEscalation = sendContactTeam;

// ─── Fresh Harvest Menu (Interactive List) ────────────────────────────────────

async function sendFreshHarvestMenu(to: string, name: string): Promise<void> {
  const { products: dbProducts, inventoryMap } = await fetchLiveCatalog();
  const { data: settings } = await supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle();

  const mushroomRows: any[] = [];
  const superfoodRows: any[] = [];

  const buildRow = (prod: any, pack: any, inv: any) => {
    const manualStatus = inv?.manual_status || 'AUTO';
    const isSoldOut = isInventoryUnavailable(inv, 1);
    let descSuffix = '';
    if (manualStatus === 'COMING_SOON') descSuffix = ' • [COMING SOON]';
    else if (isSoldOut) descSuffix = ' • [SOLD OUT TODAY]';

    return {
      id: `item_${prod.id}_${(pack.size || '').replace(/ /g, '-')}`,
      title: `${prod.name} ${pack.size}`.slice(0, 24),
      description: `₹${Number(pack.price ?? prod.price)} • ${(prod.short_description || 'Fresh morning harvest')}${descSuffix}`.slice(0, 72),
    };
  };

  if (dbProducts && dbProducts.length > 0) {
    const visibleProducts = dbProducts.filter((prod: any) => inventoryMap[prod.id]?.manual_status !== 'HIDDEN');

    // Pass 1: Add the primary pack of each active product first so all items fit within Meta's 10-row list limit
    for (const prod of visibleProducts) {
      const inv = inventoryMap[prod.id];
      const packs = getSortedPacks(prod);
      const primary = packs[0];
      if (!primary) continue;

      const row = buildRow(prod, primary, inv);
      const isMushroom = (prod.category || '').toLowerCase() === 'mushrooms';
      if (isMushroom && mushroomRows.length < 5) {
        mushroomRows.push(row);
      } else if (!isMushroom && superfoodRows.length < 5) {
        superfoodRows.push(row);
      }
    }

    // Pass 2: Fill any remaining row slots (up to 5 per section) with secondary pack variants
    for (const prod of visibleProducts) {
      const inv = inventoryMap[prod.id];
      const packs = getSortedPacks(prod).slice(1);
      const isMushroom = (prod.category || '').toLowerCase() === 'mushrooms';

      for (const pack of packs) {
        if (mushroomRows.length + superfoodRows.length >= 10) break;
        const row = buildRow(prod, pack, inv);
        if (isMushroom && mushroomRows.length < 5) {
          mushroomRows.push(row);
        } else if (!isMushroom && superfoodRows.length < 5) {
          superfoodRows.push(row);
        }
      }
    }
  }

  // Graceful fallbacks only if DB query returned nothing
  if (mushroomRows.length === 0 && superfoodRows.length === 0) {
    mushroomRows.push(
      { id: 'item_grey-oyster_250-g', title: 'Grey Oyster 250g', description: '₹100 • Meaty, velvety caps, fresh morning harvest' },
      { id: 'item_pink-oyster_250-g', title: 'Pink Oyster 250g', description: '₹120 • Coral-pink clusters, delicate & nutty' }
    );
    superfoodRows.push(
      { id: 'item_sunflower-microgreens_50-g', title: 'Sunflower Greens 50g', description: '₹20 • 40x nutrient density, nutty crunch' },
      { id: 'item_desi-eggs_6-pcs', title: 'Free-Range Eggs 6 pcs', description: '₹90 • Golden amber yolks, pasture-raised' }
    );
  }

  const sections: Array<{ title: string; rows: any[] }> = [];
  if (mushroomRows.length > 0) sections.push({ title: '🍄 Gourmet Mushrooms', rows: mushroomRows });
  if (superfoodRows.length > 0) sections.push({ title: '🌱 Living Greens & Eggs', rows: superfoodRows });

  let bannerMessage = `Good day ${name || ''}! 🙏 Here is today's freshly harvested produce from our Kadugodi farm hub.\n\nTap below to select an item:`;
  if (settings?.is_promotional_active && settings?.promotional_banner) {
    bannerMessage = `🎉 *${settings.promotional_banner}*\n\n` + bannerMessage;
  }

  await wa.sendList(
    to,
    bannerMessage,
    'Select Fresh Harvest',
    sections,
    '🌿 Only SuperFoods Harvest'
  );
}

// ─── Order Placement & Finalization ───────────────────────────────────────────

async function finalizeOrder(to: string, session: any, customer: any, paymentMethod: 'upi' | 'cod'): Promise<void> {
  const rawCart = session.cart_items || [];
  if (rawCart.length === 0) {
    await wa.sendText(to, `Your basket is empty! Text *"Menu"* to choose fresh items.`);
    return;
  }

  // Re-validate live prices & stock from Supabase before finalizing order
  const { productMap, inventoryMap } = await fetchLiveCatalog();
  const cart: any[] = [];
  for (const it of rawCart) {
    const pid = it.id || it.productId;
    const qty = Number(it.quantity) || 1;
    const liveProd = pid ? productMap[pid] : null;
    const inv = liveProd ? inventoryMap[liveProd.id] : null;

    if (liveProd && isInventoryUnavailable(inv, qty)) {
      await wa.sendText(
        to,
        `🍄 Sorry ${customer?.name || ''}! *${liveProd.name}* just sold out (or doesn't have ${qty} packs left) for today's harvest.\n\nText *"Menu"* to update your basket!`
      );
      return;
    }

    if (liveProd) {
      const packs = getSortedPacks(liveProd);
      const matchedPack = packs.find((pk) => pk.size === it.packSize) || packs[0];
      const livePrice = Number(matchedPack?.price ?? liveProd.price ?? it.price ?? 0);
      cart.push({
        ...it,
        id: liveProd.id,
        name: liveProd.name,
        packSize: matchedPack?.size || it.packSize || liveProd.unit,
        price: livePrice,
        quantity: qty,
        lineTotal: livePrice * qty,
      });
    } else {
      cart.push(it);
    }
  }

  const subtotal = cart.reduce((sum: number, i: any) => sum + (Number(i.lineTotal) || (Number(i.price) * (Number(i.quantity) || 1))), 0);

  // Calculate delivery fee from store_settings using calculateDelivery
  const { data: settings } = await supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle();
  const { fee: deliveryFee, total } = calculateDelivery(subtotal, settings);

  const codFee = paymentMethod === 'cod' ? 10 : 0;
  const finalTotal = total + codFee;

  // Item 11: Collision-proof 6-digit Order ID (Timestamp 4-digit suffix + 2 random digits)
  const orderNumber = `OSF-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

  const savedAddress = getSavedAddressString(customer) || 'Kadugodi / Whitefield, Bangalore';
  const deliverySlot = session.selected_slot || 'Tomorrow Morning (7:00 AM – 10:00 AM)';
  const subToken = await generateAutoLoginToken(to).catch(() => '');
  const subLink = subToken ? `https://onlysuperfoods.in/subscription?auth=${subToken}` : 'https://onlysuperfoods.in/subscription';

  // 1. Create order in Supabase
  await supabase.from('orders').insert({
    order_number: orderNumber,
    channel: 'whatsapp',
    customer_phone: to,
    customer_name: customer?.name || 'WhatsApp Customer',
    items: cart,
    subtotal,
    delivery_fee: deliveryFee,
    total_amount: finalTotal,
    delivery_address: { address: savedAddress, zone: 'CORE' },
    delivery_slot: deliverySlot,
    payment_method: paymentMethod,
    payment_status: paymentMethod === 'cod' ? 'cod' : 'pending',
    order_status: 'placed',
    notes: paymentMethod === 'cod' ? 'Cash on Delivery (Includes ₹10 Doorstep Courier Handling)' : undefined,
  });

  // 2. Clear session cart immediately
  await supabase.from('wa_sessions').update({
    cart_items: [],
    state: 'idle',
    updated_at: new Date().toISOString()
  }).eq('phone', to);

  // 3. Dispatch WhatsApp Payment / Confirmation Message IMMEDIATELY (Near-Zero Latency)
  if (paymentMethod === 'upi') {
    const RAZORPAY_CONFIG_NAME = Deno.env.get('WHATSAPP_PAYMENT_CONFIG_NAME') || 'onlysuperfoods_pay';
    const orderItemsForMeta = cart.map((it: any, idx: number) => ({
      retailer_id: it.id || it.productId || `item_${idx + 1}`,
      name: `${it.name || 'Produce Item'}${it.packSize ? ` (${it.packSize})` : ''}`,
      amount: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1,
    }));

    const bodyText =
      `*Order #${orderNumber} Confirmed*\n\n` +
      `Delivering to: *${savedAddress}*\n` +
      `Slot: *${deliverySlot}*\n\n` +
      `Harvest Promise:\n` +
      `Our growers hand-harvest your produce at 5:30 AM in Kadugodi and dispatch directly to your doorstep during morning delivery.\n\n` +
      `Tap Review and Pay below to complete your payment via UPI:`;

    let chatPaymentSuccess = false;
    try {
      // Primary: Send native in-chat interactive order_details payment card
      await wa.sendOrderDetailsPayment(
        to,
        orderNumber,
        bodyText,
        orderItemsForMeta,
        subtotal,
        deliveryFee,
        total,
        RAZORPAY_CONFIG_NAME
      );
      chatPaymentSuccess = true;
      console.log(`[placeOrder] Native in-chat payment card successfully sent for #${orderNumber} to ${to}`);
    } catch (chatPayErr: any) {
      console.error('[placeOrder] In-chat payment card dispatch failed:', chatPayErr?.message || chatPayErr);
    }

    // Safety Net: If Meta API rejected the in-chat payment card, immediately send direct Razorpay payment link so chat never freezes
    if (!chatPaymentSuccess) {
      try {
        const razorpayLink = await createRazorpayLink(orderNumber, total, to, customer?.name);
        const payInstruction = razorpayLink
          ? `👉 *Tap to Pay Online (Instant UPI Auto-Confirm):*\n${razorpayLink}\n\n_(Supports Google Pay, PhonePe, Paytm, BHIM, CRED & Cards)_`
          : `👉 *Please pay ₹${total} online to confirm your morning harvest order.*`;

        await wa.sendText(
          to,
          `*Order #${orderNumber} Confirmed*\n\n` +
          `Total Payable: ₹${total}\n` +
          `Delivering to:\n${savedAddress}\n` +
          `Delivery Slot: ${deliverySlot}\n\n` +
          `${payInstruction}\n\n` +
          `Our growers harvest your produce fresh at 5:30 AM in Kadugodi for morning delivery (7:00 AM – 10:00 AM).\n\n` +
          `🌱 Manage weekly subscriptions: ${subLink}`
        );
      } catch (fallbackErr: any) {
        console.error('[placeOrder] Fallback payment link error:', fallbackErr);
      }
    }
  } else {
    await wa.sendText(
      to,
      `*Order #${orderNumber} Confirmed*\n\n` +
      `Total Payable at Doorstep: ₹${finalTotal}\n` +
      `(Subtotal: ₹${subtotal} + Delivery: ${deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`} + Courier Handling: ₹10)\n\n` +
      `Delivering to:\n${savedAddress}\n` +
      `Delivery Slot: ${deliverySlot}\n\n` +
      `Our growers harvest your produce fresh at 5:30 AM in Kadugodi for morning delivery (7:00 AM – 10:00 AM).\n` +
      `Please keep ₹${finalTotal} ready (cash or doorstep UPI) when our delivery van arrives.\n\n` +
      `🌱 Manage weekly subscriptions: ${subLink}`
    );
  }

  // 4. Post-Dispatch Operations (Inventory stock deduction & catalog sync)
  await supabase.rpc('deduct_inventory_stock', {
    p_items: cart.map((i: any) => ({ productId: i.id || i.productId, quantity: i.quantity || 1 })),
  }).catch((err: any) => console.warn('[finalizeOrder] Stock deduction warning:', err));

  const currentOrders = Number(customer?.total_orders) || 0;
  await supabase.from('customers').update({
    total_orders: currentOrders + 1,
    last_active_at: new Date().toISOString(),
  }).eq('phone', to).catch(() => { });

  const metaCatalogId = (Deno.env.get('META_CATALOG_ID') || '').trim();
  const metaToken = (Deno.env.get('META_ACCESS_TOKEN') || ACCESS_TOKEN || '').trim();
  if (metaCatalogId && metaToken) {
    const orderedIds = [...new Set(cart.map((i: any) => i.id || i.productId).filter(Boolean))];
    if (orderedIds.length > 0) {
      try {
        const [{ data: prods }, { data: invs }] = await Promise.all([
          supabase.from('products').select('id, unit, product_pack_sizes(size)').in('id', orderedIds),
          supabase.from('inventory').select('*').in('product_id', orderedIds),
        ]);
        const invMap: Record<string, any> = {};
        (invs || []).forEach((iv: any) => { invMap[iv.product_id] = iv; });
        const requests: any[] = [];
        for (const p of prods || []) {
          const iv = invMap[p.id];
          const availability = isInventoryUnavailable(iv, 1) ? 'out of stock' : 'in stock';
          const packs = (p.product_pack_sizes && p.product_pack_sizes.length > 0)
            ? p.product_pack_sizes
            : [{ size: p.unit || 'Standard' }];
          for (const pk of packs) {
            requests.push({
              method: 'UPDATE',
              data: {
                id: `${p.id}_${(pk.size || '').replace(/[^a-zA-Z0-9]/g, '-')}`.toLowerCase(),
                availability,
              },
            });
          }
        }
        if (requests.length > 0) {
          await fetch(`https://graph.facebook.com/v20.0/${metaCatalogId}/items_batch`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_type: 'PRODUCT_ITEM', allow_upsert: false, requests }),
          });
        }
      } catch (metaErr) {
        console.warn('[finalizeOrder] Meta stock push warning:', metaErr);
      }
    }
  }
}

// ─── Helpers: Natural Order, Tracking & Razorpay ──────────────────────────────

function parseNaturalOrder(text: string): Array<{ productId: string; packSize: string; quantity: number }> {
  // Guard against culinary questions, inquiries, and casual conversation being misinterpreted as orders
  if (
    /^(can|how|what|why|is|do|are|where|when|tell|explain)/i.test(text) ||
    text.includes('?') ||
    text.includes('raw') ||
    text.includes('salad') ||
    text.includes('storage') ||
    text.includes('shelf life') ||
    text.includes('last in') ||
    text.includes('how to') ||
    text.includes('can i') ||
    text.includes('wash') ||
    text.includes('clean') ||
    text.includes('benefit')
  ) {
    return [];
  }

  const items: Array<{ productId: string; packSize: string; quantity: number }> = [];

  // Helper to extract quantity for product keywords (e.g., "2 packs grey", "pink oyster 3", "2 eggs")
  const extractQuantity = (keywords: string[]): number => {
    for (const kw of keywords) {
      const beforeRegex = new RegExp(`(\\d+)\\s*(?:pack|packs|box|boxes|packet|packets|punnet|punnets|kg|tray|dozen|x)?\\s*(?:of\\s*)?${kw}`, 'i');
      const matchBefore = text.match(beforeRegex);
      if (matchBefore && Number(matchBefore[1]) > 0 && Number(matchBefore[1]) <= 20) {
        return Number(matchBefore[1]);
      }
      const afterRegex = new RegExp(`${kw}\\s*(?:oyster\\s*)?(?:mushroom\\s*)?(\\d+)\\s*(?:pack|packs|box|boxes|packet|packets|punnet|punnets|tray|dozen|x)?`, 'i');
      const matchAfter = text.match(afterRegex);
      if (matchAfter && Number(matchAfter[1]) > 0 && Number(matchAfter[1]) <= 20) {
        return Number(matchAfter[1]);
      }
    }
    const leadingMatch = text.match(/^\s*(\d+)\s+/);
    if (leadingMatch && Number(leadingMatch[1]) > 0 && Number(leadingMatch[1]) <= 20) {
      return Number(leadingMatch[1]);
    }
    return 1;
  };

  if (text.includes('grey') || (text.includes('mushroom') && !text.includes('pink') && !text.includes('mixed'))) {
    const size = text.includes('500') ? '500 g' : text.includes('1kg') || text.includes('1 kg') ? '1 kg' : '250 g';
    const qty = extractQuantity(['grey', 'mushroom']);
    items.push({ productId: 'grey-oyster', packSize: size, quantity: qty });
  }

  if (text.includes('pink')) {
    const size = text.includes('500') ? '500 g' : '250 g';
    const qty = extractQuantity(['pink']);
    items.push({ productId: 'pink-oyster', packSize: size, quantity: qty });
  }

  if (text.includes('egg')) {
    const size = text.includes('12') || text.includes('dozen') ? '12 pcs' : text.includes('30') || text.includes('tray') ? '30 pcs (Tray)' : '6 pcs';
    const qty = extractQuantity(['egg', 'eggs']);
    items.push({ productId: 'desi-eggs', packSize: size, quantity: qty });
  }

  if (text.includes('microgreen') || text.includes('sunflower')) {
    const qty = extractQuantity(['microgreen', 'microgreens', 'sunflower']);
    items.push({ productId: 'sunflower-microgreens', packSize: '50 g', quantity: qty });
  }

  if (text.includes('kombucha') || text.includes('tea')) {
    const qty = extractQuantity(['kombucha', 'tea']);
    items.push({ productId: 'kombucha-original', packSize: '250 ml', quantity: qty });
  }

  return items;
}

async function addItemsToCartAndConfirm(
  to: string,
  newItems: Array<{ productId: string; packSize: string; quantity: number }>,
  session: any,
  customer: any
): Promise<void> {
  const { products: catalog, inventoryMap } = await fetchLiveCatalog();

  // Preserve existing cart items if session is active (merges instead of overwriting)
  const isExistingCartActive = session.state === 'checkout_pending' || session.state === 'awaiting_address' || session.state === 'reorder_confirm';
  const mergedCart: any[] = isExistingCartActive ? [...(session.cart_items || [])] : [];

  for (const item of newItems) {
    const prod = catalog.find((p: any) => p.id === item.productId);
    if (!prod) continue;

    const inv = inventoryMap[prod.id];
    const packs = getSortedPacks(prod);
    const pack = packs.find((s: any) => s.size === item.packSize) || packs[0] || { price: prod.price, size: prod.unit };
    const price = Number(pack.price ?? prod.price);

    const existingIndex = mergedCart.findIndex(
      (c: any) => c.id === prod.id && c.packSize === pack.size
    );
    const totalRequestedQty = (existingIndex >= 0 ? Number(mergedCart[existingIndex].quantity) || 0 : 0) + item.quantity;

    if (isInventoryUnavailable(inv, totalRequestedQty)) {
      await wa.sendText(
        to,
        `*${prod.name}* is sold out (or fewer than ${totalRequestedQty} packs available) for today's harvest.\n\nOur growers harvest fresh flushes tomorrow at 5:30 AM. Text *"Menu"* to select another fresh superfood! 🙏`
      );
      return;
    }

    if (existingIndex >= 0) {
      mergedCart[existingIndex].quantity += item.quantity;
      mergedCart[existingIndex].price = price;
      mergedCart[existingIndex].lineTotal = mergedCart[existingIndex].quantity * price;
    } else {
      mergedCart.push({
        id: prod.id,
        name: prod.name,
        packSize: pack.size,
        price,
        quantity: item.quantity,
        lineTotal: price * item.quantity,
      });
    }
  }

  if (mergedCart.length === 0) {
    await wa.sendText(to, `We could not add those items to your basket. Text *"Menu"* to browse our current harvest.`);
    return;
  }

  const subtotal = mergedCart.reduce((sum: number, i: any) => sum + (i.lineTotal || i.price), 0);

  await supabase.from('wa_sessions').update({
    cart_items: mergedCart,
    state: 'checkout_pending',
  }).eq('phone', to);

  const receipt = mergedCart
    .map((i) => `• ${i.quantity}x ${i.name} (${i.packSize}) — ₹${i.lineTotal}`)
    .join('\n');

  const { data: settings } = await supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle();
  const { fee: deliveryFee, line: deliveryLine, total } = calculateDelivery(subtotal, settings);

  const savedAddress = getSavedAddressString(customer);

  if (savedAddress) {
    if (session.selected_slot) {
      await sendCheckoutConfirmation(to, savedAddress, mergedCart, customer, session.selected_slot);
    } else {
      await supabase.from('wa_sessions').update({
        state: 'awaiting_delivery_date',
      }).eq('phone', to);
      await wa.send7DayDatePicker(to);
    }
  } else {
    const summary =
      `*Your Fresh Basket:*\n\n${receipt}\n\n` +
      `Subtotal: ₹${subtotal}\n` +
      `Morning Delivery: ${deliveryLine}\n\n` +
      `*Morning Harvest (7:00 AM – 10:00 AM)*\n` +
      `Orders placed before 11:59 PM are fresh-harvested at 5:30 AM for next morning arrival.\n\n` +
      `*Where should we deliver your morning harvest?*\n` +
      `Tap below to share your delivery location:`;

    await wa.sendLocationRequest(to, summary);
  }
}

async function handleOrderTracking(to: string): Promise<void> {
  const { data: activeOrder } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_phone', to)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeOrder) {
    await wa.sendText(to, `You do not have any active orders right now. Text *"Menu"* to browse our fresh harvest.`);
    return;
  }

  const statusLabel = activeOrder.order_status === 'confirmed'
    ? 'Earmarked for 5:30 AM Harvest'
    : activeOrder.order_status === 'harvesting'
      ? 'Currently Harvesting in Grow Rooms'
      : activeOrder.order_status === 'out_for_delivery'
        ? 'Out for Morning Delivery (7:00 AM – 10:00 AM)'
        : activeOrder.order_status?.toUpperCase();

  const paymentLabel = activeOrder.payment_status === 'paid'
    ? 'Paid via UPI'
    : activeOrder.payment_status === 'cod'
      ? 'Pay on Delivery (Doorstep)'
      : 'Payment Pending';

  await wa.sendButtons(
    to,
    `*Order #${activeOrder.order_number} Status*\n\n` +
    `Status: *${statusLabel}*\n` +
    `Payment: *${paymentLabel}*\n` +
    `Slot: ${activeOrder.delivery_slot || 'Morning Drop (7:00 AM – 10:00 AM)'}\n` +
    `Address: ${activeOrder.delivery_address?.address || 'Kadugodi / Whitefield'}\n\n` +
    `Harvested fresh at our Kadugodi farm facility. Thank you for choosing Only SuperFoods! 🙏`,
    [
      { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
      { id: 'btn_founder', title: '💬 Connect with Team' },
    ],
    'Order Tracking'
  );
}

async function handleNativePaymentConfirmation(from: string, payment: any, customer: any, session: any): Promise<void> {
  console.log(`💳 [Meta Native Payment Event] from=${from} payment=`, JSON.stringify(payment));
  const referenceId = payment?.reference_id || payment?.order?.reference_id;
  let orderNumber = referenceId;

  if (!orderNumber) {
    const { data: latestOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_phone', from)
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    orderNumber = latestOrder?.order_number;
  }

  if (!orderNumber) {
    console.warn('[handleNativePaymentConfirmation] No order found for payment confirmation from', from);
    return;
  }

  const { data: updatedOrder } = await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      order_status: 'confirmed',
      notes: payment?.id ? `Paid via WhatsApp In-Chat UPI: ${payment.id}` : 'Paid via WhatsApp In-Chat UPI',
      updated_at: new Date().toISOString(),
    })
    .eq('order_number', orderNumber)
    .select()
    .maybeSingle();

  // 1. Mutate Meta Order Card to remove [ Pay now ] button
  try {
    await wa.sendOrderStatus(
      from,
      orderNumber,
      'processing',
      'Payment Confirmed • Morning Harvest',
      `*Payment Confirmed — Order #${orderNumber}*\n\nYour order is confirmed and scheduled for morning harvest in Kadugodi.`
    );
  } catch (err: any) {
    console.warn('[handleNativePaymentConfirmation] sendOrderStatus error:', err?.message || err);
  }

  // 2. Dispatch Rich Confirmation Receipt
  const items = updatedOrder?.items || [];
  const itemsSummary = items.length > 0
    ? items.map((it: any) => `${it.name || 'Produce Item'}${it.packSize ? ` (${it.packSize})` : ''} × ${it.quantity || 1}`).join(', ')
    : 'Fresh Harvest Produce';
  const deliveryAddress = updatedOrder?.delivery_address?.address || 'Kadugodi / Whitefield, Bangalore';
  const deliverySlot = updatedOrder?.delivery_slot || session?.selected_slot || 'Tomorrow Morning (7:00 AM – 10:00 AM)';
  const total = updatedOrder?.total_amount ? Math.round(Number(updatedOrder.total_amount)) : 0;

  await wa.sendOrderConfirmationReceipt(
    from,
    orderNumber,
    total,
    itemsSummary,
    deliveryAddress,
    deliverySlot
  );
}

async function createRazorpayLink(orderNumber: string, amount: number, contact: string, name?: string): Promise<string | null> {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) {
    console.warn('[createRazorpayLink] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in edge environment.');
    return null;
  }

  try {
    let cleanContact = contact.replace(/\D/g, '');
    if (cleanContact.length === 10) {
      cleanContact = '+91' + cleanContact;
    } else if (cleanContact.length === 12 && cleanContact.startsWith('91')) {
      cleanContact = '+' + cleanContact;
    }

    const authHeader = btoa(`${keyId}:${keySecret}`);
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'INR',
        accept_partial: false,
        description: `Only SuperFoods Order #${orderNumber}`,
        customer: {
          name: name || 'WhatsApp Customer',
          contact: cleanContact,
        },
        notify: { sms: false, whatsapp: false },
        reminder_enable: false,
        notes: { order_number: orderNumber },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[createRazorpayLink] Razorpay API rejected request:', res.status, data);
      return null;
    }

    return data.short_url || null;
  } catch (err) {
    console.error('[createRazorpayLink] API exception:', err);
    return null;
  }
}

async function handleGroqConversationalAI(to: string, userText: string, customer: any, session: any): Promise<void> {
  try {
    // 1. Inject live product pricing & stock directly from Supabase so AI never cites stale prices
    const { products: liveProducts, inventoryMap } = await fetchLiveCatalog();
    const liveCatalogSummary = (liveProducts || [])
      .filter((p: any) => inventoryMap[p.id]?.manual_status !== 'HIDDEN')
      .map((p: any) => {
        const inv = inventoryMap[p.id];
        const status = inv?.manual_status === 'COMING_SOON'
          ? 'COMING SOON'
          : isInventoryUnavailable(inv, 1)
            ? 'SOLD OUT TODAY'
            : `IN STOCK (${inv?.available_qty ?? 'available'} packs left)`;
        const packList = getSortedPacks(p)
          .map((pk) => `${pk.size} ₹${Number(pk.price ?? p.price)}`)
          .join(', ');
        return `${p.name} (${packList}) [${status}]`;
      })
      .join('; ');

    // 2. Multi-turn sliding dialogue history in session.conversation_history.dialogue (last 8 turns, 24h TTL)
    const historyObj = (session?.conversation_history && typeof session.conversation_history === 'object' && !Array.isArray(session.conversation_history))
      ? { ...session.conversation_history }
      : {};

    let dialogue: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }> = Array.isArray(historyObj.dialogue)
      ? [...historyObj.dialogue]
      : [];

    // Enforce 24-hour TTL: reset history if last message is > 24 hours old
    if (dialogue.length > 0) {
      const lastMsgTime = dialogue[dialogue.length - 1].timestamp
        ? new Date(dialogue[dialogue.length - 1].timestamp!).getTime()
        : session?.updated_at
          ? new Date(session.updated_at).getTime()
          : Date.now();
      const hoursSinceLast = (Date.now() - lastMsgTime) / (1000 * 60 * 60);
      if (hoursSinceLast > 24) {
        dialogue = [];
      }
    }

    // Keep sliding window of at most last 8 messages
    if (dialogue.length > 8) {
      dialogue = dialogue.slice(-8);
    }

    // 3. System prompt infused with Master Grower persona, culinary rules, Bengaluru warmth, and reduced emoji styling
    const systemPrompt =
      'You are the Master Grower & Culinary Concierge for Only SuperFoods in Kadugodi, Bangalore.\n\n' +
      'PERSONA & BRAND VOICE:\n' +
      '- Persona: The Master Grower & Culinary Ally. Passionate, deeply knowledgeable, warm, unpretentious, and culinary-forward. Never robotic or corporate.\n' +
      '- Bengaluru Grounding: Welcome customers with natural Bengaluru warmth ("Namaskara! 🙏"). Avoid slang like "macha" or "guru".\n' +
      '- Typography & Styling: Maintain 2–3 tasteful, relevant emojis per response (e.g., 🍄, 🌿). Zero emoji walls. Clean, premium formatting.\n' +
      '- Response Length: Keep answers concise and mobile-friendly (typically 2 to 4 sentences, under 70 words).\n\n' +
      `LIVE HARVEST CATALOG & STOCK RIGHT NOW: ${liveCatalogSummary || 'Chemical-free oyster mushrooms, living microgreens, raw kombucha & desi eggs'}.\n` +
      'Only quote prices and availability from LIVE HARVEST CATALOG RIGHT NOW. If an item is SOLD OUT TODAY or COMING SOON, inform politely and suggest an alternative.\n\n' +
      'HARVEST & MORNING DELIVERY:\n' +
      '- Daily harvest early morning at 5:30 AM in our Kadugodi climate-controlled facility.\n' +
      '- Morning Delivery (7:00 AM – 10:00 AM) across Kadugodi, Whitefield, and East Bengaluru. Strict morning drop so living produce arrives crisp. We do not do evening deliveries.\n' +
      '- Orders placed before 11:59 PM are harvested fresh for next morning delivery.\n\n' +
      'CULINARY SECRETS & HANDLING WISDOM:\n' +
      '- Gourmet Oyster Mushrooms: Never soak or wash in water (they are porous sponges; wipe dry with paper towel). Tear clusters by hand. High-heat pan sear with butter/ghee/olive oil for 3-4 mins without overcrowding. Crucial: Add salt only in the last 30 seconds for crispy golden edges and juicy texture. Store unwashed in breathable kraft paper punnet in vegetable crisper (4°C–7°C), never in sealed plastic (stays fresh 5-7 days).\n' +
      '- Living Microgreens: Eat 100% raw (never cook/heat; heat destroys sulforaphane & live enzymes). Snip live above root bed directly onto eggs, avocado toast, dal, or salads.\n' +
      '- Artisanal Raw Kombucha: Active live probiotics; keep cold (2°C–6°C) to pause fermentation; never shake before opening. Sip before/after meals.\n' +
      '- Free-Range Desi Eggs: Pasture-foraging country hens, deep golden yolks, store pointy-end down.\n\n' +
      'COMPLIANCE & CONTACT:\n' +
      '- FSSAI Compliance: Never make medical or disease claims (do not claim to cure, treat, or prevent cancer, diabetes, etc.). Highlight whole-food fiber, bioavailable protein, and living vitality.\n' +
      '- Farm Team Contact: For custom inquiries, bulk orders, or assistance, connect with our farm team on WhatsApp or phone: +91 77603 50360 or +91 70197 60360.\n' +
      '- Guide customers toward exploring the harvest, placing an order, or trying chef recipes.';

    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...dialogue.map((d) => ({
        role: d.role,
        content: d.content,
      })),
      { role: 'user', content: userText },
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        temperature: 0.6,
        max_tokens: 300,
      }),
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (reply) {
      await wa.sendText(to, reply);

      // Append to dialogue history (last 8 turns) and persist to Supabase
      const updatedDialogue = [
        ...dialogue,
        { role: 'user' as const, content: userText, timestamp: new Date().toISOString() },
        { role: 'assistant' as const, content: reply, timestamp: new Date().toISOString() },
      ].slice(-8);

      historyObj.dialogue = updatedDialogue;
      session.conversation_history = historyObj;

      await supabase
        .from('wa_sessions')
        .update({
          conversation_history: historyObj,
          updated_at: new Date().toISOString(),
        })
        .eq('phone', to);

      return;
    }
  } catch (e) {
    console.error('Groq AI error:', e);
  }

  // Graceful fallback with 2-3 tasteful emojis and calibrated 1-icon buttons (all <= 20 chars)
  await wa.sendButtons(
    to,
    `🌿 *Only SuperFoods Kadugodi*\n\nWould you like to browse our fresh harvest catalog, repeat a previous order, or connect with our farm team? 🍄`,
    [
      { id: 'btn_catalog', title: '🛍️ Browse Catalog' },
      { id: 'btn_repeat', title: '🔁 1-Tap Reorder' },
      { id: 'btn_founder', title: '💬 Connect with Team' },
    ],
    'Only SuperFoods Kadugodi'
  );
}

/**
 * place-web-order — Public Web Checkout Order Processor
 * Inserts confirmed web orders into Supabase, updates customer lifetime order count,
 * and atomically deducts live inventory stock via service_role RPC.
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
const META_CATALOG_ID = (Deno.env.get('META_CATALOG_ID') || '').trim();
const META_ACCESS_TOKEN = (Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '').trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function pushUpdatedAvailabilityToMeta(productIds: string[]) {
  if (!META_CATALOG_ID || !META_ACCESS_TOKEN || productIds.length === 0) return;
  try {
    const [{ data: prods }, { data: invs }] = await Promise.all([
      supabase.from('products').select('id, unit, price, product_pack_sizes(size, price)').in('id', productIds),
      supabase.from('inventory').select('*').in('product_id', productIds),
    ]);
    const invMap: Record<string, any> = {};
    (invs || []).forEach((i: any) => { invMap[i.product_id] = i; });

    const requests: any[] = [];
    for (const p of prods || []) {
      const inv = invMap[p.id];
      const status = inv?.manual_status || 'AUTO';
      let isSoldOut = inv ? Boolean(inv.is_sold_out || Number(inv.available_qty) <= 0) : false;
      if (status === 'IN_STOCK') isSoldOut = false;
      else if (status === 'OUT_OF_STOCK' || status === 'COMING_SOON' || status === 'HIDDEN') isSoldOut = true;

      const availability = isSoldOut ? 'out of stock' : 'in stock';
      const packs = (p.product_pack_sizes && p.product_pack_sizes.length > 0)
        ? p.product_pack_sizes
        : [{ size: p.unit || 'Standard', price: p.price }];

      for (const pk of packs) {
        const retailerId = `${p.id}_${(pk.size || '').replace(/[^a-zA-Z0-9]/g, '-')}`.toLowerCase();
        requests.push({
          method: 'UPDATE',
          data: { id: retailerId, availability },
        });
      }
    }

    if (requests.length > 0) {
      await fetch(`https://graph.facebook.com/v20.0/${META_CATALOG_ID}/items_batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${META_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item_type: 'PRODUCT_ITEM', allow_upsert: false, requests }),
      });
    }
  } catch (err) {
    console.warn('[place-web-order] Meta stock sync warning:', err);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
  }

  try {
    const order = await req.json();
    const items = Array.isArray(order?.items) ? order.items : [];
    if (items.length === 0) {
      return jsonResponse({ success: false, error: 'Cannot place an empty order.' }, 400);
    }

    const orderNumber = order.orderId || order.id || `OSF-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    const customerPhone = order.customer?.phone || 'Guest';
    const customerName = order.customer?.name || 'Guest Customer';

    // Validate live inventory, prices, and store settings from Supabase
    const productIds = [...new Set(items.map((i: any) => i.productId || i.id).filter(Boolean))];
    const [{ data: dbProducts }, { data: dbInventory }, { data: dbSettings }] = await Promise.all([
      supabase.from('products').select('id, name, price, unit, product_pack_sizes(*)').in('id', productIds),
      supabase.from('inventory').select('*').in('product_id', productIds),
      supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle(),
    ]);

    const prodMap: Record<string, any> = {};
    (dbProducts || []).forEach((p: any) => { prodMap[p.id] = p; });
    const invMap: Record<string, any> = {};
    (dbInventory || []).forEach((inv: any) => { invMap[inv.product_id] = inv; });

    const normalizedItems = items.map((item: any) => {
      const pid = item.productId || item.id;
      const qty = Math.max(1, Number(item.quantity) || 1);
      const dbProd = prodMap[pid];

      // Only override unit price if item is not a special recipe bundle garnish price
      let resolvedPrice = Number(item.price) || 0;
      if (dbProd && !item.isBundleDiscount) {
        const packs = dbProd.product_pack_sizes || [];
        const matchedPack = packs.find((pk: any) => pk.size === item.packSize);
        if (matchedPack) {
          resolvedPrice = Number(matchedPack.price);
        } else if (item.packSize === dbProd.unit || packs.length === 0) {
          resolvedPrice = Number(dbProd.price);
        }
      }

      return {
        ...item,
        productId: pid,
        price: resolvedPrice,
        quantity: qty,
        lineTotal: resolvedPrice * qty,
      };
    });

    // Check stock constraints unless payment was already captured via Razorpay
    const alreadyPaid = Boolean(order.paymentId || order.paymentStatus === 'paid');
    if (!alreadyPaid) {
      for (const it of normalizedItems) {
        const inv = invMap[it.productId];
        if (!inv) continue;
        const status = inv.manual_status || 'AUTO';
        if (status === 'OUT_OF_STOCK' || status === 'COMING_SOON' || status === 'HIDDEN') {
          return jsonResponse({ success: false, error: `${it.name || it.productId} is currently out of stock.` }, 409);
        }
        if (status === 'AUTO' && (inv.is_sold_out || Number(inv.available_qty) < it.quantity)) {
          return jsonResponse({
            success: false,
            error: `Only ${Math.max(0, Number(inv.available_qty) || 0)} packs left for ${it.name || it.productId}.`,
          }, 409);
        }
      }
    }

    // Authoritative server-side financial calculations
    const calculatedSubtotal = normalizedItems.reduce((s: number, i: any) => s + i.lineTotal, 0);

    const rawBaseFee = dbSettings?.base_delivery_fee;
    const baseFee = (rawBaseFee !== undefined && rawBaseFee !== null && rawBaseFee !== '' && !isNaN(Number(rawBaseFee)))
      ? Number(rawBaseFee)
      : 40;

    const rawThreshold = dbSettings?.free_delivery_threshold;
    const threshold = (rawThreshold !== undefined && rawThreshold !== null && rawThreshold !== '' && !isNaN(Number(rawThreshold)))
      ? Number(rawThreshold)
      : 350;

    const discountPct = Number(dbSettings?.delivery_discount_percent ?? 0);
    const isPromoActive = Boolean(dbSettings?.is_promotional_active);

    const clientPromo = String(order.appliedCoupon?.code || order.promoCode || '').trim().toUpperCase();
    const isDynamicPromoMatch = clientPromo && clientPromo === (dbSettings?.promo_code || 'SUPER70').toUpperCase();
    const hasDeliveryPromo = isPromoActive || isDynamicPromoMatch;

    let deliveryFee = baseFee;
    if (baseFee === 0 || threshold <= 0 || calculatedSubtotal >= threshold) {
      deliveryFee = 0;
    } else if (hasDeliveryPromo && discountPct > 0) {
      deliveryFee = Math.max(0, Math.round(baseFee * (1 - discountPct / 100)));
    }

    // Optional item-level coupon discount
    let itemDiscount = 0;
    if (order.appliedCoupon?.value) {
      const couponVal = Number(order.appliedCoupon.value) || 0;
      if (order.appliedCoupon.type === 'percent') {
        itemDiscount = Math.round((calculatedSubtotal * couponVal) / 100);
      } else {
        itemDiscount = Math.min(couponVal, calculatedSubtotal);
      }
    }

    const subtotal = Math.max(0, calculatedSubtotal - itemDiscount);
    const podFee = order.paymentMethod === 'pod' ? 10 : 0;
    const totalAmount = subtotal + deliveryFee + podFee;

    // Check if order already existed to make stock deduction strictly idempotent
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('order_number', orderNumber)
      .maybeSingle();

    const isNewOrder = !existingOrder;

    const { error: insErr } = await supabase.from('orders').upsert({
      order_number: orderNumber,
      channel: 'web',
      customer_phone: customerPhone,
      customer_name: customerName,
      items: normalizedItems,
      subtotal,
      delivery_fee: deliveryFee,
      total_amount: totalAmount,
      delivery_address: {
        address: order.customer?.address || '',
        coords: order.customer?.coords || null,
        zone: order.customer?.zoneStatus || 'CORE',
      },
      delivery_slot: order.deliverySlot || 'Morning Drop (7:00 AM – 10:00 AM)',
      payment_method: order.paymentMethod === 'razorpay' ? 'razorpay' : (order.paymentMethod || 'cod'),
      payment_status: order.paymentStatus || (alreadyPaid ? 'paid' : 'cod'),
      order_status: order.orderStatus || (alreadyPaid ? 'confirmed' : 'placed'),
      notes: order.paymentId ? `Razorpay Payment ID: ${order.paymentId}` : (order.notes || null),
    }, { onConflict: 'order_number' });

    if (insErr) throw insErr;

    // Atomically deduct stock only for new orders to prevent duplicate deductions on network retries
    if (isNewOrder) {
      const { error: stockErr } = await supabase.rpc('deduct_inventory_stock', {
        p_items: normalizedItems.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
      });
      if (stockErr) {
        console.warn('[place-web-order] Inventory deduction warning:', stockErr);
      } else {
        await pushUpdatedAvailabilityToMeta(productIds);
      }
    }

    // Update customer record
    if (customerPhone && customerPhone !== 'Guest') {
      const { data: cust } = await supabase
        .from('customers')
        .select('id, total_orders')
        .eq('phone', customerPhone)
        .maybeSingle();

      if (cust) {
        await supabase
          .from('customers')
          .update({
            total_orders: (Number(cust.total_orders) || 0) + 1,
            last_active_at: new Date().toISOString(),
          })
          .eq('id', cust.id);
      } else {
        await supabase.from('customers').insert({
          phone: customerPhone,
          name: customerName,
          total_orders: 1,
          delivery_addresses: order.customer?.address ? [{
            address: order.customer.address,
            coords: order.customer?.coords || null,
            zone: order.customer?.zoneStatus || 'CORE',
          }] : [],
          last_active_at: new Date().toISOString(),
        });
      }
    }

    return jsonResponse({ success: true, order_number: orderNumber, total_amount: totalAmount });
  } catch (err: any) {
    console.error('[place-web-order Error]:', err);
    return jsonResponse({ success: false, error: err?.message || 'Failed to place web order' }, 500);
  }
});


/**
 * admin-api — Secure Admin Operations Edge Function
 * Authenticates via x-admin-pin against ADMIN_PIN secret (fallback: 'farm560067')
 * and executes all catalog, pack size, inventory, settings, and recipe mutations
 * using SUPABASE_SERVICE_ROLE_KEY so public `anon` remains strictly read-only.
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
const ADMIN_PIN = Deno.env.get('ADMIN_PIN') || 'farm560067';
const META_CATALOG_ID = (Deno.env.get('META_CATALOG_ID') || '').trim();
const META_ACCESS_TOKEN = (Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '').trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-pin',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function timingSafeEquals(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) {
    diff |= ab[i] ^ bb[i];
  }
  return diff === 0;
}

function normalizeCategory(cat: string): string {
  const clean = (cat || 'Mushrooms').trim();
  const lower = clean.toLowerCase();
  const map: Record<string, string> = {
    mushrooms: 'Mushrooms',
    microgreens: 'Microgreens',
    kombucha: 'Kombucha',
    'desi eggs': 'Desi Eggs',
    elixirs: 'Elixirs',
    'fresh produce': 'Fresh Produce',
  };
  return map[lower] || clean;
}

function resolveInventoryAvailability(row: {
  daily_harvest_batch: number;
  reserved_subscribers: number;
  web_sold: number;
  manual_status: string;
}): { available_qty: number; is_sold_out: boolean; manual_status: string } {
  const batch = Math.max(0, Number(row.daily_harvest_batch) || 0);
  const reserved = Math.max(0, Number(row.reserved_subscribers) || 0);
  const sold = Math.max(0, Number(row.web_sold) || 0);
  const available_qty = Math.max(0, batch - reserved - sold);

  const validStatuses = ['AUTO', 'IN_STOCK', 'OUT_OF_STOCK', 'COMING_SOON', 'HIDDEN'];
  const manual_status = validStatuses.includes(row.manual_status) ? row.manual_status : 'AUTO';

  let is_sold_out = available_qty <= 0;
  if (manual_status === 'IN_STOCK') is_sold_out = false;
  else if (manual_status === 'OUT_OF_STOCK' || manual_status === 'COMING_SOON' || manual_status === 'HIDDEN') {
    is_sold_out = true;
  }

  return { available_qty, is_sold_out, manual_status };
}

async function syncMetaCatalog(deletedRetailerIds: string[] = []): Promise<{ synced: boolean; mode: string; detail?: string; handle?: string }> {
  if (!META_CATALOG_ID || !META_ACCESS_TOKEN) {
    return {
      synced: false,
      mode: 'scheduled_feed',
      detail: 'Live CSV feed updated immediately at /functions/v1/meta-catalog-feed (polled hourly by Meta). Set META_CATALOG_ID to enable instant push.',
    };
  }

  try {
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('*, product_pack_sizes(*)')
      .eq('is_active', true);

    if (prodErr) throw prodErr;

    const { data: inventory } = await supabase.from('inventory').select('*');
    const invMap: Record<string, any> = {};
    (inventory || []).forEach((i: any) => {
      invMap[i.product_id] = i;
    });

    const requests: any[] = [];

    for (const delId of deletedRetailerIds) {
      requests.push({
        method: 'DELETE',
        data: { id: delId },
      });
    }

    for (const prod of products || []) {
      const inv = invMap[prod.id];
      const status = inv?.manual_status || 'AUTO';
      let isSoldOut = inv ? Boolean(inv.is_sold_out || Number(inv.available_qty) <= 0) : false;
      if (status === 'IN_STOCK') isSoldOut = false;
      else if (status === 'OUT_OF_STOCK' || status === 'COMING_SOON' || status === 'HIDDEN') isSoldOut = true;

      const availability = isSoldOut ? 'out of stock' : 'in stock';
      const packs = (prod.product_pack_sizes || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      const primaryPacks = packs.length > 0 ? packs : [{ size: prod.unit || 'Standard', price: prod.price }];

      let imageLink = prod.image_url || '/images/prod-grey-oyster.jpg';
      if (imageLink.startsWith('/')) imageLink = `https://onlysuperfoods.in${imageLink}`;
      else if (!imageLink.startsWith('http')) imageLink = `https://onlysuperfoods.in/${imageLink}`;

      for (const pack of primaryPacks) {
        const retailerId = `${prod.id}_${(pack.size || '').replace(/[^a-zA-Z0-9]/g, '-')}`.toLowerCase();
        requests.push({
          method: 'UPDATE',
          data: {
            id: retailerId,
            title: `${prod.name} (${pack.size})`.trim(),
            description: prod.short_description || prod.long_description || 'Fresh chemical-free superfood harvested at dawn from Kadugodi farm.',
            availability,
            condition: 'new',
            price: `${Number(pack.price ?? prod.price).toFixed(2)} INR`,
            link: 'https://onlysuperfoods.in/',
            image_link: imageLink,
            brand: 'Only SuperFoods',
            item_group_id: prod.id,
          },
        });
      }
    }

    if (requests.length === 0) {
      return { synced: false, mode: 'scheduled_feed', detail: 'No catalog variants to push.' };
    }

    const res = await fetch(`https://graph.facebook.com/v20.0/${META_CATALOG_ID}/items_batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item_type: 'PRODUCT_ITEM',
        allow_upsert: true,
        requests,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message || JSON.stringify(data);
      return {
        synced: false,
        mode: 'scheduled_feed',
        detail: `Meta Graph API rejected instant push (${res.status}): ${errMsg}`,
      };
    }

    const handle = Array.isArray(data?.handles) ? data.handles[0] : undefined;
    return {
      synced: true,
      mode: 'instant_graph_api',
      handle,
      detail: `Instant Meta Catalog push accepted (${requests.length} item operations queued).`,
    };
  } catch (err: any) {
    return {
      synced: false,
      mode: 'scheduled_feed',
      detail: `Meta push warning: ${err?.message || 'Unknown error'}`,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
  }

  if (!SUPABASE_SERVICE_KEY) {
    return jsonResponse({ success: false, error: 'Server missing SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const providedPin = (req.headers.get('x-admin-pin') || '').trim();
  if (!providedPin || !timingSafeEquals(providedPin, ADMIN_PIN)) {
    return jsonResponse({ success: false, error: 'Invalid Admin PIN.' }, 401);
  }

  try {
    const body = await req.json();
    const action = body?.action;

    if (action === 'verify_pin') {
      return jsonResponse({ success: true, authenticated: true });
    }

    if (action === 'get_admin_state') {
      const [prodsRes, invRes, settingsRes, recipesRes] = await Promise.all([
        supabase.from('products').select('*, product_pack_sizes(*)').order('created_at', { ascending: true }).order('id', { ascending: true }),
        supabase.from('inventory').select('*').order('product_id', { ascending: true }),
        supabase.from('store_settings').select('*').eq('id', 'default').maybeSingle(),
        supabase.from('recipes').select('*').order('created_at', { ascending: true }),
      ]);

      if (prodsRes.error) throw prodsRes.error;
      if (invRes.error) throw invRes.error;

      return jsonResponse({
        success: true,
        products: prodsRes.data || [],
        inventory: invRes.data || [],
        settings: settingsRes.data || null,
        recipes: recipesRes.data || [],
        metaInstantPushConfigured: Boolean(META_CATALOG_ID && META_ACCESS_TOKEN),
      });
    }

    if (action === 'upsert_product') {
      const product = body?.product;
      if (!product || !product.id || !product.name) {
        return jsonResponse({ success: false, error: 'Missing required product fields (id, name).' }, 400);
      }

      const rawPacks = Array.isArray(product.packSizes) && product.packSizes.length > 0
        ? product.packSizes
        : [{ size: product.unit || '250 g', price: Number(product.price) || 100 }];

      const normalizedPacks = rawPacks
        .filter((ps: any) => (ps?.size || '').trim() && Number(ps?.price) > 0)
        .map((ps: any, idx: number) => ({
          product_id: product.id,
          size: String(ps.size).trim(),
          price: Number(ps.price),
          sort_order: idx + 1,
        }));

      if (normalizedPacks.length === 0) {
        return jsonResponse({ success: false, error: 'At least one valid pack size with positive price is required.' }, 400);
      }

      const primaryPack = normalizedPacks[0];
      const slug = (product.slug || product.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      const dbProduct = {
        id: product.id,
        name: String(product.name).trim(),
        slug: slug || product.id,
        category: normalizeCategory(product.category),
        badge: product.badge || 'Fresh Harvest',
        badge_type: product.badgeType || 'green',
        short_description: product.shortDescription || '',
        long_description: product.longDescription || product.shortDescription || '',
        price: primaryPack.price,
        unit: primaryPack.size,
        freshness_badge: product.freshnessBadge || 'Harvested at dawn (5:30 AM)',
        shelf_life: product.shelfLife || '5 to 7 days in refrigerator',
        storage_guide: product.storageGuide || 'Store in vegetable crisper drawer in breathable container.',
        culinary_tips: product.culinaryTips || 'Pan-sear on high heat for optimal flavor and texture.',
        recipe_pairings: product.recipePairings || [],
        min_order: Number(product.minOrder) || 1,
        image_url: product.image || '/images/prod-grey-oyster.jpg',
        nutrition_facts: product.nutritionFacts || [],
        whatsapp_message: product.whatsappMessage || `Hi Only Superfoods! I'd like to order ${product.name} ({{size}}).`,
        is_active: product.isActive !== false,
        updated_at: new Date().toISOString(),
      };

      // Execute atomic transaction RPC; fall back gracefully if migration 04 is pending deployment
      let rpcSucceeded = false;
      const { error: rpcErr } = await supabase.rpc('admin_upsert_product', {
        p_product: dbProduct,
        p_pack_sizes: normalizedPacks,
      });

      if (!rpcErr) {
        rpcSucceeded = true;
      } else {
        console.warn('[admin-api] admin_upsert_product RPC notice, using standard sequence:', rpcErr?.message || rpcErr);
        const { error: prodErr } = await supabase.from('products').upsert(dbProduct, { onConflict: 'id' });
        if (prodErr) throw prodErr;

        const { error: delErr } = await supabase.from('product_pack_sizes').delete().eq('product_id', product.id);
        if (delErr) throw delErr;

        const { error: insErr } = await supabase.from('product_pack_sizes').insert(normalizedPacks);
        if (insErr) throw insErr;

        await supabase
          .from('inventory')
          .upsert(
            {
              product_id: product.id,
              daily_harvest_batch: 40,
              reserved_subscribers: 10,
              web_sold: 0,
              available_qty: 30,
              manual_status: 'AUTO',
              is_sold_out: false,
              harvest_time: '5:30 AM',
            },
            { onConflict: 'product_id', ignoreDuplicates: true }
          );
      }

      const metaSync = await syncMetaCatalog();
      return jsonResponse({ success: true, product: dbProduct, packSizes: normalizedPacks, metaSync, atomic: rpcSucceeded });
    }

    if (action === 'delete_product') {
      const id = body?.id;
      if (!id) return jsonResponse({ success: false, error: 'Missing product id.' }, 400);

      const { data: oldPacks } = await supabase
        .from('product_pack_sizes')
        .select('size')
        .eq('product_id', id);

      const deletedRetailerIds = (oldPacks || []).map((pk: any) =>
        `${id}_${(pk.size || '').replace(/[^a-zA-Z0-9]/g, '-')}`.toLowerCase()
      );

      await supabase.from('product_pack_sizes').delete().eq('product_id', id);
      await supabase.from('inventory').delete().eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;

      const metaSync = await syncMetaCatalog(deletedRetailerIds);
      return jsonResponse({ success: true, deletedId: id, metaSync });
    }

    if (action === 'update_inventory') {
      const items = Array.isArray(body?.items) ? body.items : body?.item ? [body.item] : [];
      if (items.length === 0) {
        return jsonResponse({ success: false, error: 'No inventory items provided.' }, 400);
      }

      const rows = items.map((item: any) => {
        const batch = Math.max(0, Number(item.dailyYield ?? item.daily_harvest_batch) || 0);
        const reserved = Math.max(0, Number(item.reservedSubscribers ?? item.reserved_subscribers) || 0);
        const sold = Math.max(0, Number(item.webSold ?? item.web_sold) || 0);
        const rawStatus = item.manualStatus || item.manual_status || 'AUTO';
        const resolved = resolveInventoryAvailability({
          daily_harvest_batch: batch,
          reserved_subscribers: reserved,
          web_sold: sold,
          manual_status: rawStatus,
        });

        return {
          product_id: item.productId || item.product_id,
          daily_harvest_batch: batch,
          reserved_subscribers: reserved,
          web_sold: sold,
          available_qty: resolved.available_qty,
          manual_status: resolved.manual_status,
          is_sold_out: resolved.is_sold_out,
          harvest_time: item.lastHarvestTime || item.harvest_time || 'Today, 5:30 AM',
          updated_at: new Date().toISOString(),
        };
      });

      const { data: savedRows, error: invErr } = await supabase
        .from('inventory')
        .upsert(rows, { onConflict: 'product_id' })
        .select();
      if (invErr) throw invErr;

      const metaSync = await syncMetaCatalog();
      return jsonResponse({ success: true, inventory: savedRows, metaSync });
    }

    if (action === 'emergency_wipe') {
      const targetIds = Array.isArray(body?.productIds) ? body.productIds : null;
      let query = supabase.from('inventory').update({
        daily_harvest_batch: 0,
        available_qty: 0,
        manual_status: 'OUT_OF_STOCK',
        is_sold_out: true,
        updated_at: new Date().toISOString(),
      });

      if (targetIds && targetIds.length > 0) {
        query = query.in('product_id', targetIds);
      } else {
        query = query.neq('product_id', '');
      }

      const { data: wiped, error: wipeErr } = await query.select();
      if (wipeErr) throw wipeErr;

      const metaSync = await syncMetaCatalog();
      return jsonResponse({ success: true, inventory: wiped, metaSync });
    }

    if (action === 'update_settings') {
      const settings = body?.settings;
      if (!settings) {
        return jsonResponse({ success: false, error: 'Missing settings payload.' }, 400);
      }

      const row = {
        id: 'default',
        base_delivery_fee: Number(settings.base_delivery_fee ?? 40),
        free_delivery_threshold: Number(settings.free_delivery_threshold ?? 350),
        delivery_discount_percent: Number(settings.delivery_discount_percent ?? 0),
        promo_code: settings.promo_code || 'SUPER70',
        promotional_banner: settings.promotional_banner || 'Free Delivery on Orders Over ₹350!',
        is_promotional_active: Boolean(settings.is_promotional_active),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('store_settings')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;

      return jsonResponse({ success: true, settings: data });
    }

    if (action === 'upsert_recipe') {
      const recipe = body?.recipe;
      if (!recipe || !recipe.id || !recipe.title) {
        return jsonResponse({ success: false, error: 'Missing recipe id or title.' }, 400);
      }

      const dbRecipe = {
        id: recipe.id,
        slug: recipe.slug || recipe.id,
        title: recipe.title,
        category: recipe.category || 'Mushrooms',
        prep_time: recipe.prepTime || '10 min',
        cook_time: recipe.cookTime || '15 min',
        servings: String(recipe.servings || '2'),
        difficulty: recipe.difficulty || 'Easy',
        short_description: recipe.subtitle || '',
        image_url: recipe.thumbnail || '/images/recipe-garlic-butter-mushrooms.jpg',
        tags: recipe.tags || [],
        ingredients: recipe.ingredientsList || recipe.ingredients || [],
        instructions: recipe.steps || [],
        chef_tip: Array.isArray(recipe.chefNotes) ? recipe.chefNotes[0] || '' : recipe.chefTip || '',
        pairings: recipe.pairings || [],
      };

      const { error } = await supabase.from('recipes').upsert(dbRecipe, { onConflict: 'id' });
      if (error) throw error;

      return jsonResponse({ success: true, recipe: dbRecipe });
    }

    if (action === 'delete_recipe') {
      const slugOrId = body?.id;
      if (!slugOrId) return jsonResponse({ success: false, error: 'Missing recipe id.' }, 400);

      const { error } = await supabase
        .from('recipes')
        .delete()
        .or(`id.eq.${slugOrId},slug.eq.${slugOrId}`);
      if (error) throw error;

      return jsonResponse({ success: true, deletedId: slugOrId });
    }

    if (action === 'sync_meta_catalog') {
      let catalogInfo: { id?: string; name?: string; product_count?: number } | null = null;
      if (META_CATALOG_ID && META_ACCESS_TOKEN) {
        try {
          const checkRes = await fetch(
            `https://graph.facebook.com/v20.0/${META_CATALOG_ID}?fields=id,name,product_count`,
            { headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` } }
          );
          const checkData = await checkRes.json();
          if (!checkRes.ok) {
            return jsonResponse({
              success: true,
              metaInstantPushConfigured: true,
              metaSync: {
                synced: false,
                mode: 'scheduled_feed',
                detail: `Meta Catalog access check failed (${checkRes.status}): ${checkData?.error?.message || JSON.stringify(checkData)}`,
              },
            });
          }
          catalogInfo = checkData;
        } catch (checkErr: any) {
          return jsonResponse({
            success: true,
            metaInstantPushConfigured: true,
            metaSync: {
              synced: false,
              mode: 'scheduled_feed',
              detail: `Meta Catalog check error: ${checkErr?.message || 'Network error'}`,
            },
          });
        }
      }

      const metaSync = await syncMetaCatalog();
      let batchStatus: unknown = null;
      let liveMetaProducts: unknown = null;

      if (META_CATALOG_ID && META_ACCESS_TOKEN && metaSync.handle) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const [batchRes, prodsRes] = await Promise.all([
            fetch(
              `https://graph.facebook.com/v20.0/${META_CATALOG_ID}/check_batch_request_status?handle=${encodeURIComponent(metaSync.handle)}`,
              { headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` } }
            ),
            fetch(
              `https://graph.facebook.com/v20.0/${META_CATALOG_ID}/products?fields=retailer_id,name,price,availability&limit=25`,
              { headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` } }
            ),
          ]);
          batchStatus = await batchRes.json().catch(() => null);
          const prodsJson = await prodsRes.json().catch(() => null);
          liveMetaProducts = prodsJson?.data || prodsJson;
        } catch (verifyErr: any) {
          console.warn('[admin-api] Meta batch verify warning:', verifyErr?.message);
        }
      }

      if (catalogInfo?.name && metaSync.synced) {
        metaSync.detail = `Connected to "${catalogInfo.name}" — ${metaSync.detail}`;
      }
      return jsonResponse({
        success: true,
        metaInstantPushConfigured: Boolean(META_CATALOG_ID && META_ACCESS_TOKEN),
        catalogInfo,
        metaSync,
        batchStatus,
        liveMetaProducts,
      });
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error('[admin-api Error]:', err);
    return jsonResponse({ success: false, error: err?.message || 'Internal Server Error' }, 500);
  }
});


/**
 * meta-catalog-feed — Supabase Edge Function
 * Serves a dynamic, live CSV product feed for Meta Commerce Manager & WhatsApp Catalog.
 * Meta polls this URL automatically on schedule, ensuring zero manual uploads.
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const asJson = url.searchParams.get('format') === 'json';

    // 1. Fetch live active products and pack sizes
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('*, product_pack_sizes(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (prodErr) throw prodErr;

    // 2. Fetch inventory status
    const { data: inventory } = await supabase.from('inventory').select('*');
    const invMap: Record<string, any> = {};
    if (inventory) {
      inventory.forEach((i: any) => {
        invMap[i.product_id] = i;
      });
    }

    // 3. Build CSV rows & JSON preview
    const header = 'id,title,description,availability,condition,price,link,image_link,brand,item_group_id,google_product_category,fb_product_category\n';
    const rows: string[] = [];
    const jsonItems: any[] = [];

    for (const prod of products || []) {
      const inv = invMap[prod.id];
      const manualStatus = inv?.manual_status || 'AUTO';
      let isSoldOut = inv ? (inv.is_sold_out || Number(inv.available_qty) <= 0) : false;
      if (manualStatus === 'IN_STOCK') {
        isSoldOut = false;
      } else if (manualStatus === 'OUT_OF_STOCK' || manualStatus === 'COMING_SOON' || manualStatus === 'HIDDEN') {
        isSoldOut = true;
      }
      const availability = isSoldOut ? 'out of stock' : 'in stock';

      const packs = (prod.product_pack_sizes || []).sort(
        (a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
      );
      const primaryPacks = packs.length > 0 ? packs : [{ size: prod.unit || 'Standard', price: prod.price }];

      for (const pack of primaryPacks) {
        const id = `${prod.id}_${(pack.size || '').replace(/[^a-zA-Z0-9]/g, '-')}`.toLowerCase();
        const title = escapeCsv(`${prod.name} (${pack.size})`.trim());
        const description = escapeCsv(
          prod.short_description ||
          prod.long_description ||
          'Fresh chemical-free superfood harvested at dawn from Kadugodi farm.'
        );
        const unitPrice = Number(pack.price ?? prod.price) || 0;
        const price = `${unitPrice.toFixed(2)} INR`;
        const link = `https://onlysuperfoods.in/`;

        // Ensure absolute HTTPS image URL
        let imageLink = prod.image_url || '/images/prod-grey-oyster.jpg';
        if (imageLink.startsWith('/')) {
          imageLink = `https://onlysuperfoods.in${imageLink}`;
        } else if (!imageLink.startsWith('http')) {
          imageLink = `https://onlysuperfoods.in/${imageLink}`;
        }

        const brand = 'Only SuperFoods';
        const itemGroupId = prod.id;
        const catLower = (prod.category || '').toLowerCase();
        const category = catLower === 'mushrooms'
          ? 'Food, Beverages & Tobacco > Food Items > Fresh Produce > Fresh Vegetables'
          : 'Food, Beverages & Tobacco > Food Items > Food & Beverage';

        rows.push(`${id},${title},${description},${availability},new,${price},${link},${imageLink},${brand},${itemGroupId},"${category}","${category}"`);
        jsonItems.push({
          id,
          item_group_id: itemGroupId,
          title: `${prod.name} (${pack.size})`.trim(),
          availability,
          manual_status: manualStatus,
          available_qty: inv?.available_qty ?? null,
          price,
        });
      }
    }

    if (asJson) {
      return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), items: jsonItems }, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        status: 200,
      });
    }

    const csvContent = header + rows.join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Catalog-Generated-At': new Date().toISOString(),
      },
      status: 200,
    });
  } catch (err: any) {
    console.error('[Catalog Feed Error]:', err);
    return new Response(`Error generating feed: ${err.message}`, { status: 500 });
  }
});

function escapeCsv(val: string): string {
  if (!val) return '""';
  const clean = val.replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${clean}"`;
}

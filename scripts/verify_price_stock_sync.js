import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ufewlbjqtxpumwlwkunn.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZXdsYmpxdHhwdW13bHdrdW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MTAwNTMsImV4cCI6MjEwOTA4NjA1M30.cR4V7EUTL2yt_sVboHepd8shtx8bLodEdI9SN9Gr6k8';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZXdsYmpxdHhwdW13bHdrdW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzUxMDA1MywiZXhwIjoyMTA5MDg2MDUzfQ.7Uk6ii-TbRrmtWTkuHxdeN3t73JF9xQp7YnOssFSrEs';

const sbService = createClient(SUPABASE_URL, SERVICE_KEY);
const sbAnon = createClient(SUPABASE_URL, ANON_KEY);

const ADMIN_API_URL = `${SUPABASE_URL}/functions/v1/admin-api`;
const PLACE_ORDER_URL = `${SUPABASE_URL}/functions/v1/place-web-order`;
const META_FEED_URL = `${SUPABASE_URL}/functions/v1/meta-catalog-feed`;

const results = [];
function assertCheck(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅ [PASS]' : '❌ [FAIL]'} ${name}: ${detail}`);
}

async function callAdmin(action, payload = {}, pin = 'farm560067') {
  const res = await fetch(ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'x-admin-pin': pin,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('================================================================');
  console.log('🔍 LIVE E2E VERIFICATION: PRICE, STOCK & META CATALOG SYNC');
  console.log('================================================================\n');

  const testId = '__verify-sync-item__';
  const testOrderNum = `OSF-VER-${Date.now().toString().slice(-4)}`;
  const testPhone = '919999000888';

  try {
    // Clean any leftover test data
    await callAdmin('delete_product', { id: testId }).catch(() => {});
    await sbService.from('orders').delete().eq('customer_phone', testPhone);
    await sbService.from('customers').delete().eq('phone', testPhone);

    // 1. Check live sunflower-microgreens state across DB + Meta Feed
    const { data: sfProd } = await sbAnon
      .from('products')
      .select('id, price, unit, product_pack_sizes(*)')
      .eq('id', 'sunflower-microgreens')
      .single();

    const sfPack50 = sfProd?.product_pack_sizes?.find((p) => p.size === '50 g');
    assertCheck(
      'Sunflower Live DB Price Sync (products <-> product_pack_sizes)',
      Number(sfProd?.price) === 20 && Number(sfPack50?.price) === 20,
      `products.price=₹${sfProd?.price}, pack(50 g).price=₹${sfPack50?.price}`
    );

    const feedCsv = await (await fetch(META_FEED_URL)).text();
    const has20Inr = feedCsv.includes('sunflower-microgreens_50-g,"Sunflower Microgreens (50 g)"') &&
      feedCsv.includes('20.00 INR');
    assertCheck(
      'Live meta-catalog-feed CSV Sunflower Price',
      has20Inr,
      has20Inr ? 'sunflower-microgreens_50-g outputs 20.00 INR' : 'Still stale price in feed!'
    );

    // 2. Verify anon cannot mutate DB directly (RLS integrity)
    const { error: anonSettingErr } = await sbAnon
      .from('store_settings')
      .update({ base_delivery_fee: 999 })
      .eq('id', 'default');
    const { data: anonSettingSel } = await sbAnon
      .from('store_settings')
      .update({ base_delivery_fee: 999 })
      .eq('id', 'default')
      .select();

    assertCheck(
      'Public Anon Cannot Mutate store_settings / products',
      Boolean(anonSettingErr) || (Array.isArray(anonSettingSel) && anonSettingSel.length === 0),
      'Anon updates blocked by RLS as required'
    );

    // 3. Verify admin-api PIN security
    const badPinRes = await callAdmin('verify_pin', {}, 'wrongpin');
    assertCheck(
      'admin-api Rejects Invalid PIN (401)',
      badPinRes.status === 401 && !badPinRes.data?.success,
      `Returned HTTP ${badPinRes.status}`
    );

    // 4. Create test product with 2 pack sizes via admin-api
    const upsertRes = await callAdmin('upsert_product', {
      product: {
        id: testId,
        name: 'Test Blue Oyster',
        category: 'mushrooms', // intentionally lowercase to verify normalization
        price: 55,
        unit: '200 g',
        packSizes: [
          { size: '200 g', price: 55 },
          { size: '400 g', price: 100 },
        ],
        shortDescription: 'Verification item',
      },
    });
    assertCheck(
      'admin-api Creates Product & Normalizes Category',
      upsertRes.status === 200 && upsertRes.data?.product?.category === 'Mushrooms',
      `category=${upsertRes.data?.product?.category}, packs=${upsertRes.data?.packSizes?.length}`
    );

    // 5. Verify DB Trigger Sync: direct SQL update on products.price -> updates packSizes[0] automatically
    await sbService.from('products').update({ price: 33 }).eq('id', testId);
    const { data: afterDirectProdUpd } = await sbService
      .from('products')
      .select('price, product_pack_sizes(*)')
      .eq('id', testId)
      .single();
    const firstPackAfterDirect = afterDirectProdUpd?.product_pack_sizes?.sort((a, b) => a.sort_order - b.sort_order)?.[0];
    assertCheck(
      'DB Trigger: Direct products.price Edit Syncs Primary Pack Size',
      Number(firstPackAfterDirect?.price) === 33,
      `products.price=33 -> product_pack_sizes[0].price=${firstPackAfterDirect?.price}`
    );

    // 6. Verify Reverse Trigger: direct update on primary product_pack_sizes -> updates products.price
    await sbService.from('product_pack_sizes').update({ price: 44 }).eq('id', firstPackAfterDirect.id);
    const { data: afterDirectPackUpd } = await sbService
      .from('products')
      .select('price')
      .eq('id', testId)
      .single();
    assertCheck(
      'DB Trigger: Direct product_pack_sizes Edit Syncs products.price',
      Number(afterDirectPackUpd?.price) === 44,
      `pack.price=44 -> products.price=${afterDirectPackUpd?.price}`
    );

    // 7. Verify admin-api inventory update & Meta Catalog JSON output
    const invRes = await callAdmin('update_inventory', {
      item: {
        productId: testId,
        dailyYield: 25,
        reservedSubscribers: 5,
        webSold: 0,
        manualStatus: 'AUTO',
      },
    });
    const savedInv = invRes.data?.inventory?.[0];
    assertCheck(
      'admin-api Inventory Math & Persistence',
      invRes.status === 200 && savedInv?.available_qty === 20 && savedInv?.is_sold_out === false,
      `batch=25 - reserved=5 => available_qty=${savedInv?.available_qty}, is_sold_out=${savedInv?.is_sold_out}`
    );

    // Toggle OUT_OF_STOCK and verify live Meta Catalog Feed reflects it immediately
    await callAdmin('update_inventory', {
      item: {
        productId: testId,
        dailyYield: 25,
        reservedSubscribers: 5,
        webSold: 0,
        manualStatus: 'OUT_OF_STOCK',
      },
    });
    const feedJson = await (await fetch(`${META_FEED_URL}?format=json`)).json();
    const feedItem = feedJson.items?.find((i) => i.item_group_id === testId);
    assertCheck(
      'Meta Catalog Feed Reflects Live Price (44.00 INR) & Out-Of-Stock Immediately',
      feedItem?.price === '44.00 INR' && feedItem?.availability === 'out of stock',
      `price=${feedItem?.price}, availability=${feedItem?.availability}`
    );

    // Restore AUTO (20 in stock) then test place-web-order atomic stock deduction
    await callAdmin('update_inventory', {
      item: {
        productId: testId,
        dailyYield: 25,
        reservedSubscribers: 5,
        webSold: 0,
        manualStatus: 'AUTO',
      },
    });

    const placeRes = await fetch(PLACE_ORDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        orderId: testOrderNum,
        customer: { name: 'Verify Buyer', phone: testPhone, address: 'Kadugodi' },
        deliveryFee: 40,
        paymentMethod: 'cod',
        items: [{ productId: testId, name: 'Test Blue Oyster', packSize: '200 g', price: 44, quantity: 3 }],
      }),
    });
    const placeData = await placeRes.json();

    const { data: invAfterOrder } = await sbService.from('inventory').select('*').eq('product_id', testId).single();
    assertCheck(
      'place-web-order Atomic Stock Deduction',
      placeRes.status === 200 && placeData?.success && invAfterOrder?.available_qty === 17 && invAfterOrder?.web_sold === 3,
      `Ordered 3 from 20 -> available_qty=${invAfterOrder?.available_qty}, web_sold=${invAfterOrder?.web_sold}`
    );
  } finally {
    // Cleanup test records cleanly
    await sbService.from('orders').delete().eq('customer_phone', testPhone);
    await sbService.from('customers').delete().eq('phone', testPhone);
    await callAdmin('delete_product', { id: testId }).catch(() => {});
  }

  const passed = results.filter((r) => r.ok).length;
  console.log('\n================================================================');
  console.log(`📊 LIVE VERIFICATION SUMMARY: ${passed}/${results.length} CHECKS PASSED`);
  console.log('================================================================\n');

  if (passed !== results.length) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


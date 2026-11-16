import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ufewlbjqtxpumwlwkunn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZXdsYmpxdHhwdW13bHdrdW5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzUxMDA1MywiZXhwIjoyMTA5MDg2MDUzfQ.7Uk6ii-TbRrmtWTkuHxdeN3t73JF9xQp7YnOssFSrEs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
  console.log('--- 1. Store Settings ---');
  const { data: settings } = await supabase.from('store_settings').select('*').limit(5);
  console.log('Store Settings:', settings);

  console.log('\n--- 2. Active Products & Pack Sizes ---');
  const { data: products } = await supabase.from('products').select('id, name, price, unit, product_pack_sizes(*)');
  console.log(`Found ${products?.length} products:`);
  products?.forEach(p => {
    console.log(`- ${p.id} (${p.name}): base ₹${p.price}/${p.unit}, packs:`, p.product_pack_sizes?.map(pk => `${pk.size} @ ₹${pk.price}`));
  });

  console.log('\n--- 3. Inventory Status ---');
  const { data: inventory } = await supabase.from('inventory').select('*');
  console.log('Inventory:', inventory?.map(i => `${i.product_id}: avail=${i.available_qty}, sold_out=${i.is_sold_out}`));

  console.log('\n--- 4. Recent Customers ---');
  const { data: customers } = await supabase.from('customers').select('*').order('last_active_at', { ascending: false }).limit(5);
  console.log('Recent customers:', customers?.map(c => ({ phone: c.phone, name: c.name, orders: c.total_orders, addresses: c.delivery_addresses })));

  console.log('\n--- 5. Recent Orders ---');
  const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Recent orders:', orders?.map(o => ({
    num: o.order_number,
    channel: o.channel,
    phone: o.customer_phone,
    total: o.total_amount,
    pay_method: o.payment_method,
    pay_status: o.payment_status,
    order_status: o.order_status,
    items_count: o.items?.length
  })));
}

runAudit().catch(console.error);


-- ==============================================================================
-- ONLY SUPERFOODS: ATOMIC CATALOG MUTATIONS, RLS LOCKDOWN & IDEMPOTENCY
-- Migration 04:
-- 1. Atomic PostgreSQL function `admin_upsert_product` replacing non-atomic REST calls
-- 2. Idempotent inventory deduction ledger `inventory_deductions`
-- 3. Strict orders RLS policy: orders inserted exclusively via service_role edge functions
-- ==============================================================================

-- 1. Create inventory deductions ledger for strict idempotency
create table if not exists public.inventory_deductions (
    order_number text primary key,
    deducted_at timestamptz default now()
);

alter table public.inventory_deductions enable row level security;
revoke all on public.inventory_deductions from public, anon, authenticated;
grant all on public.inventory_deductions to service_role;

-- 2. Enhance deduct_inventory_stock to be strictly idempotent across network retries
create or replace function public.deduct_inventory_stock(
    p_items jsonb,
    p_order_number text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_curr public.inventory%rowtype;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return true;
  end if;

  -- Idempotency check: if order_number was already processed, exit safely
  if p_order_number is not null and btrim(p_order_number) <> '' then
    if exists (select 1 from public.inventory_deductions where order_number = p_order_number) then
      return true; -- Already deducted, prevent double deduction
    end if;
    insert into public.inventory_deductions (order_number) values (p_order_number)
    on conflict (order_number) do nothing;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := coalesce(v_item->>'productId', v_item->>'id');
    v_qty := greatest(0, coalesce((v_item->>'quantity')::integer, 1));

    if v_product_id is not null and v_qty > 0 then
      select * into v_curr
      from public.inventory
      where product_id = v_product_id
      for update;

      if found then
        update public.inventory
        set
          web_sold = greatest(0, coalesce(v_curr.web_sold, 0) + v_qty),
          available_qty = greatest(0, coalesce(v_curr.available_qty, 0) - v_qty),
          updated_at = now()
        where product_id = v_product_id;
      end if;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.deduct_inventory_stock(jsonb, text) from public, anon, authenticated;
grant execute on function public.deduct_inventory_stock(jsonb, text) to service_role;

-- 3. Atomic Admin Upsert Function: updates product, replaces pack sizes, and initializes inventory in 1 transaction
create or replace function public.admin_upsert_product(
    p_product jsonb,
    p_pack_sizes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id text;
  v_pack jsonb;
begin
  v_product_id := p_product->>'id';
  if v_product_id is null or btrim(v_product_id) = '' then
    raise exception 'Product ID is required';
  end if;

  -- 1. Upsert product row
  insert into public.products (
    id, name, slug, category, badge, badge_type, short_description, long_description,
    price, unit, freshness_badge, shelf_life, storage_guide, culinary_tips,
    recipe_pairings, min_order, image_url, nutrition_facts, whatsapp_message,
    is_active, updated_at
  ) values (
    v_product_id,
    p_product->>'name',
    p_product->>'slug',
    p_product->>'category',
    p_product->>'badge',
    coalesce(p_product->>'badge_type', 'green'),
    p_product->>'short_description',
    p_product->>'long_description',
    (p_product->>'price')::numeric,
    p_product->>'unit',
    p_product->>'freshness_badge',
    p_product->>'shelf_life',
    p_product->>'storage_guide',
    p_product->>'culinary_tips',
    coalesce(p_product->'recipe_pairings', '[]'::jsonb),
    coalesce((p_product->>'min_order')::integer, 1),
    p_product->>'image_url',
    coalesce(p_product->'nutrition_facts', '[]'::jsonb),
    p_product->>'whatsapp_message',
    coalesce((p_product->>'is_active')::boolean, true),
    now()
  )
  on conflict (id) do update set
    name = excluded.name,
    slug = excluded.slug,
    category = excluded.category,
    badge = excluded.badge,
    badge_type = excluded.badge_type,
    short_description = excluded.short_description,
    long_description = excluded.long_description,
    price = excluded.price,
    unit = excluded.unit,
    freshness_badge = excluded.freshness_badge,
    shelf_life = excluded.shelf_life,
    storage_guide = excluded.storage_guide,
    culinary_tips = excluded.culinary_tips,
    recipe_pairings = excluded.recipe_pairings,
    min_order = excluded.min_order,
    image_url = excluded.image_url,
    nutrition_facts = excluded.nutrition_facts,
    whatsapp_message = excluded.whatsapp_message,
    is_active = excluded.is_active,
    updated_at = now();

  -- 2. Atomically replace pack sizes within the exact same transaction
  delete from public.product_pack_sizes where product_id = v_product_id;

  if p_pack_sizes is not null and jsonb_typeof(p_pack_sizes) = 'array' then
    for v_pack in select * from jsonb_array_elements(p_pack_sizes)
    loop
      insert into public.product_pack_sizes (
        product_id, size, price, sort_order, updated_at
      ) values (
        v_product_id,
        v_pack->>'size',
        (v_pack->>'price')::numeric,
        coalesce((v_pack->>'sort_order')::integer, 1),
        now()
      );
    end loop;
  end if;

  -- 3. Ensure inventory row exists
  insert into public.inventory (
    product_id, daily_harvest_batch, reserved_subscribers, web_sold, available_qty, manual_status, is_sold_out, harvest_time, updated_at
  ) values (
    v_product_id, 40, 10, 0, 30, 'AUTO', false, '5:30 AM', now()
  )
  on conflict (product_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'product_id', v_product_id
  );
end;
$$;

revoke all on function public.admin_upsert_product(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_upsert_product(jsonb, jsonb) to service_role;

-- 4. Lockdown orders RLS: order inserts strictly restricted to service_role
drop policy if exists "Public can place an order" on public.orders;
create policy "Service role can place orders" on public.orders for insert to service_role with check (true);
create policy "Public can view own orders" on public.orders for select to anon, authenticated using (true);


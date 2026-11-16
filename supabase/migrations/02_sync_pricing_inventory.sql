-- ==============================================================================
-- ONLY SUPERFOODS: END-TO-END PRICE & STOCK SYNC MIGRATION
-- Fixes split-brain pricing, missing inventory status columns, FK index,
-- Realtime publication, atomic stock deduction, and strict admin write security.
-- ==============================================================================

-- 1. Index Foreign Key on product_pack_sizes for faster joins & cascades
create index if not exists product_pack_sizes_product_id_idx
  on public.product_pack_sizes (product_id);

-- 2. Add updated_at tracking on products & product_pack_sizes
alter table public.products
  add column if not exists updated_at timestamptz default now();

alter table public.product_pack_sizes
  add column if not exists updated_at timestamptz default now();

-- 3. Extend inventory table with subscriber reserve, web sold counter & manual status override
alter table public.inventory
  add column if not exists reserved_subscribers integer not null default 0,
  add column if not exists web_sold integer not null default 0,
  add column if not exists manual_status text not null default 'AUTO';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inventory_manual_status_check'
      and conrelid = 'public.inventory'::regclass
  ) then
    alter table public.inventory
      add constraint inventory_manual_status_check
      check (manual_status in ('AUTO', 'IN_STOCK', 'OUT_OF_STOCK', 'COMING_SOON', 'HIDDEN'));
  end if;
end $$;

-- 4. One-time backfill for inventory reserved_subscribers & manual_status matching existing available_qty
update public.inventory
set
  reserved_subscribers = greatest(0, coalesce(daily_harvest_batch, 0) - coalesce(available_qty, 0)),
  manual_status = case when coalesce(is_sold_out, false) then 'OUT_OF_STOCK' else 'AUTO' end
where reserved_subscribers = 0
  and web_sold = 0;

-- 5. Normalize existing product category casing consistently (Title Case)
update public.products
set category = case lower(category)
  when 'mushrooms' then 'Mushrooms'
  when 'microgreens' then 'Microgreens'
  when 'kombucha' then 'Kombucha'
  when 'desi eggs' then 'Desi Eggs'
  when 'elixirs' then 'Elixirs'
  else category
end
where lower(category) in ('mushrooms', 'microgreens', 'kombucha', 'desi eggs', 'elixirs')
  and category is distinct from case lower(category)
    when 'mushrooms' then 'Mushrooms'
    when 'microgreens' then 'Microgreens'
    when 'kombucha' then 'Kombucha'
    when 'desi eggs' then 'Desi Eggs'
    when 'elixirs' then 'Elixirs'
    else category
  end;

-- 6. Triggers to eliminate split-brain pricing between products and primary product_pack_sizes
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_products_touch_updated_at on public.products;
create trigger trg_products_touch_updated_at
  before insert or update on public.products
  for each row
  execute function public.fn_touch_updated_at();

create or replace function public.fn_sync_primary_pack_from_product()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_primary_pack_id uuid;
  v_clean_unit text;
begin
  select id into v_primary_pack_id
  from public.product_pack_sizes
  where product_id = new.id
  order by sort_order asc, created_at asc
  limit 1;

  v_clean_unit := nullif(btrim(new.unit), '');

  if v_primary_pack_id is not null then
    update public.product_pack_sizes
    set
      price = new.price,
      size = coalesce(v_clean_unit, size),
      updated_at = now()
    where id = v_primary_pack_id
      and (
        price is distinct from new.price
        or size is distinct from coalesce(v_clean_unit, size)
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_primary_pack_from_product on public.products;
create trigger trg_sync_primary_pack_from_product
  after update of price, unit on public.products
  for each row
  when (pg_trigger_depth() < 1)
  execute function public.fn_sync_primary_pack_from_product();

create or replace function public.fn_sync_product_from_primary_pack()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_first_pack_id uuid;
begin
  select id into v_first_pack_id
  from public.product_pack_sizes
  where product_id = new.product_id
  order by sort_order asc, created_at asc
  limit 1;

  if v_first_pack_id = new.id then
    update public.products
    set
      price = new.price,
      unit = new.size,
      updated_at = now()
    where id = new.product_id
      and (
        price is distinct from new.price
        or unit is distinct from new.size
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_product_from_primary_pack on public.product_pack_sizes;
create trigger trg_sync_product_from_primary_pack
  after insert or update of price, size, sort_order on public.product_pack_sizes
  for each row
  when (pg_trigger_depth() < 1)
  execute function public.fn_sync_product_from_primary_pack();

-- 7. Immediately synchronize any currently drifted primary pack prices from products.price (e.g., sunflower-microgreens 20 vs 80)
with first_packs as (
  select distinct on (product_id) id, product_id
  from public.product_pack_sizes
  order by product_id, sort_order asc, created_at asc
)
update public.product_pack_sizes ps
set
  price = p.price,
  size = coalesce(nullif(btrim(p.unit), ''), ps.size),
  updated_at = now()
from first_packs fp
join public.products p on p.id = fp.product_id
where ps.id = fp.id
  and (
    ps.price is distinct from p.price
    or ps.size is distinct from coalesce(nullif(btrim(p.unit), ''), ps.size)
  );

-- 8. Inventory trigger: keep available_qty, is_sold_out, and manual_status coherent on both direct SQL/Table Editor edits and Admin API updates
create or replace function public.fn_sync_inventory_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.reserved_subscribers := greatest(0, coalesce(new.reserved_subscribers, 0));
  new.web_sold := greatest(0, coalesce(new.web_sold, 0));
  new.daily_harvest_batch := greatest(0, coalesce(new.daily_harvest_batch, 0));

  if tg_op = 'INSERT' then
    if new.manual_status is null or btrim(new.manual_status) = '' then
      new.manual_status := case when coalesce(new.is_sold_out, false) then 'OUT_OF_STOCK' else 'AUTO' end;
    end if;
    if new.available_qty is null then
      new.available_qty := greatest(0, new.daily_harvest_batch - new.reserved_subscribers - new.web_sold);
    else
      new.available_qty := greatest(0, new.available_qty);
    end if;
  else
    -- On UPDATE:
    -- 1) If batch/reserved/web_sold changed while available_qty was NOT explicitly changed, recalculate available_qty.
    if (new.available_qty is not distinct from old.available_qty)
       and (
         new.daily_harvest_batch is distinct from old.daily_harvest_batch
         or new.reserved_subscribers is distinct from old.reserved_subscribers
         or new.web_sold is distinct from old.web_sold
       ) then
      new.available_qty := greatest(0, new.daily_harvest_batch - new.reserved_subscribers - new.web_sold);
    else
      new.available_qty := greatest(0, coalesce(new.available_qty, 0));
      -- If admin/user directly restocked available_qty from <=0 to >0 without changing manual_status, recover from OUT_OF_STOCK -> AUTO
      if old.available_qty <= 0 and new.available_qty > 0
         and old.manual_status = 'OUT_OF_STOCK'
         and (new.manual_status is not distinct from old.manual_status) then
        new.manual_status := 'AUTO';
      end if;
    end if;

    -- 2) If is_sold_out was toggled directly in Table Editor while manual_status was NOT explicitly changed
    if (new.is_sold_out is distinct from old.is_sold_out)
       and (new.manual_status is not distinct from old.manual_status) then
      if new.is_sold_out = true then
        if new.manual_status not in ('COMING_SOON', 'HIDDEN') then
          new.manual_status := 'OUT_OF_STOCK';
        end if;
      else
        if new.available_qty <= 0 then
          new.manual_status := 'IN_STOCK';
        else
          new.manual_status := 'AUTO';
        end if;
      end if;
    end if;
  end if;

  if new.manual_status is null or new.manual_status not in ('AUTO', 'IN_STOCK', 'OUT_OF_STOCK', 'COMING_SOON', 'HIDDEN') then
    new.manual_status := 'AUTO';
  end if;

  -- Final authoritative is_sold_out sync for external consumers (Meta feed, simple queries)
  if new.manual_status in ('OUT_OF_STOCK', 'COMING_SOON', 'HIDDEN') then
    new.is_sold_out := true;
  elsif new.manual_status = 'IN_STOCK' then
    new.is_sold_out := false;
  else
    new.is_sold_out := (new.available_qty <= 0);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_inventory_fields on public.inventory;
create trigger trg_sync_inventory_fields
  before insert or update on public.inventory
  for each row
  execute function public.fn_sync_inventory_fields();

-- 9. Atomic stock deduction helper (restricted to service_role only)
create or replace function public.deduct_inventory_stock(p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_curr public.inventory%rowtype;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return;
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
end;
$$;

revoke all on function public.deduct_inventory_stock(jsonb) from public, anon, authenticated;
grant execute on function public.deduct_inventory_stock(jsonb) to service_role;

-- 10. Tighten store_settings RLS: keep anon SELECT-only, route admin updates via authenticated Edge Function
drop policy if exists "Public can update store settings" on public.store_settings;

-- 11. Enable Realtime broadcasting on catalog, inventory & store settings
do $$
declare
  v_tbl text;
begin
  foreach v_tbl in array array['products', 'product_pack_sizes', 'inventory', 'store_settings', 'recipes']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_tbl);
    end if;
  end loop;
end $$;


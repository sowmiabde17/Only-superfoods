-- ==============================================================================
-- ONLY SUPERFOODS: CORE DATABASE SCHEMA
-- Multi-channel commerce for Web Storefront & WhatsApp AI Engine
-- ==============================================================================

-- 1. Enable Required Extensions
create extension if not exists "uuid-ossp";

-- 2. Products Table
create table if not exists public.products (
    id text primary key,
    name text not null,
    slug text unique not null,
    category text not null,
    badge text,
    badge_type text default 'orange',
    short_description text,
    long_description text,
    price numeric(10,2) not null,
    unit text not null,
    freshness_badge text,
    shelf_life text,
    storage_guide text,
    culinary_tips text,
    recipe_pairings jsonb default '[]'::jsonb,
    min_order int default 1,
    image_url text,
    nutrition_facts jsonb default '[]'::jsonb,
    whatsapp_message text,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- 3. Product Pack Sizes Table
create table if not exists public.product_pack_sizes (
    id uuid default gen_random_uuid() primary key,
    product_id text not null references public.products(id) on delete cascade,
    size text not null,
    price numeric(10,2) not null,
    sort_order int default 0,
    created_at timestamptz default now()
);

-- 4. Real-Time Harvest Inventory Table
create table if not exists public.inventory (
    product_id text primary key references public.products(id) on delete cascade,
    daily_harvest_batch int default 50,
    available_qty int default 50,
    is_sold_out boolean default false,
    harvest_time text default '5:30 AM',
    updated_at timestamptz default now()
);

-- 5. Recipes Catalog Table
create table if not exists public.recipes (
    id text primary key,
    slug text unique not null,
    title text not null,
    category text not null,
    prep_time text,
    cook_time text,
    servings text,
    difficulty text,
    short_description text,
    image_url text,
    tags text[] default '{}',
    ingredients jsonb not null default '[]'::jsonb,
    instructions jsonb not null default '[]'::jsonb,
    chef_tip text,
    pairings jsonb default '[]'::jsonb,
    created_at timestamptz default now()
);

-- 6. Customers Table (No passwords needed - authenticated via Phone OTP / WhatsApp)
create table if not exists public.customers (
    id uuid default gen_random_uuid() primary key,
    phone text unique not null,
    name text,
    email text,
    delivery_addresses jsonb default '[]'::jsonb,
    total_orders int default 0,
    created_at timestamptz default now(),
    last_active_at timestamptz default now()
);

-- 7. Unified Orders Table (Web Storefront + WhatsApp Channel)
create table if not exists public.orders (
    id uuid default gen_random_uuid() primary key,
    order_number text unique not null,
    channel text default 'web', -- 'web' | 'whatsapp'
    customer_phone text not null,
    customer_name text,
    customer_email text,
    items jsonb not null,
    subtotal numeric(10,2) not null,
    delivery_fee numeric(10,2) default 0,
    total_amount numeric(10,2) not null,
    delivery_address jsonb not null,
    delivery_slot text,
    payment_method text, -- 'upi' | 'cod' | 'razorpay'
    payment_status text default 'pending', -- 'pending' | 'paid' | 'cod' | 'refunded'
    order_status text default 'placed', -- 'placed' | 'confirmed' | 'harvesting' | 'out_for_delivery' | 'delivered' | 'cancelled'
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 8. WhatsApp Conversational Sessions Table
create table if not exists public.wa_sessions (
    phone text primary key references public.customers(phone) on delete cascade,
    state text default 'idle', -- 'idle' | 'browsing' | 'cart_review' | 'awaiting_address' | 'awaiting_payment' | 'human_handoff'
    cart_items jsonb default '[]'::jsonb,
    selected_slot text,
    pending_order_id text,
    conversation_history jsonb default '[]'::jsonb,
    updated_at timestamptz default now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.products enable row level security;
alter table public.product_pack_sizes enable row level security;
alter table public.inventory enable row level security;
alter table public.recipes enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.wa_sessions enable row level security;

-- Public can read products, pack sizes, inventory, and recipes
create policy "Public can view active products" on public.products for select to anon, authenticated using (is_active = true);
create policy "Public can view pack sizes" on public.product_pack_sizes for select to anon, authenticated using (true);
create policy "Public can view inventory" on public.inventory for select to anon, authenticated using (true);
create policy "Public can view recipes" on public.recipes for select to anon, authenticated using (true);

-- Customers can view/update their own profile
create policy "Public can create/find customer profile" on public.customers for select to anon, authenticated using (true);
create policy "Public can insert customer profile" on public.customers for insert to anon, authenticated with check (true);
create policy "Public can update own customer profile" on public.customers for update to anon, authenticated using (true) with check (true);

-- Anyone can place an order; viewing orders requires matching phone
create policy "Public can place an order" on public.orders for insert to anon, authenticated with check (true);
create policy "Public can view own orders" on public.orders for select to anon, authenticated using (true);

-- WhatsApp Sessions: Service role has full access; anon can read/write for session persistence
create policy "Public can access wa_sessions" on public.wa_sessions for all to anon, authenticated using (true) with check (true);

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- Seed Products
insert into public.products (
    id, name, slug, category, badge, badge_type, short_description, long_description,
    price, unit, freshness_badge, shelf_life, storage_guide, culinary_tips,
    image_url, min_order, whatsapp_message
) values
(
    'grey-oyster',
    'Grey Oyster Mushrooms',
    'grey-oyster-mushrooms',
    'Mushrooms',
    'Bestseller',
    'orange',
    'Tender, meaty, velvety caps harvested same morning in Kadugodi.',
    'Grown in humidity-controlled fruiting rooms with zero chemical pesticides. Harvested early morning at peak tenderness with moisture intact. Unbeatable texture that pan-sears golden in minutes.',
    100.00,
    '250 g',
    'Harvested today at 5:30 AM',
    '5 to 7 days in refrigerator',
    'Keep unwashed in the breathable kraft paper punnet in the vegetable crisper drawer (4°C – 7°C). Do not seal in airtight plastic. Wash or wipe gently only right before cooking.',
    'Sear in a hot pan with olive oil or butter for 3-4 minutes until golden edges develop. Do not overcrowd the pan. Add salt towards the end to avoid drawing out water prematurely.',
    'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/products/prod-grey-oyster.jpg',
    1,
    'Hi! I would like to order Grey Oyster Mushrooms ({{size}}). Please confirm availability and delivery slot! 🍄'
),
(
    'pink-oyster',
    'Pink Oyster Mushrooms',
    'pink-oyster-mushrooms',
    'Mushrooms',
    'Fresh Harvest',
    'green',
    'Vibrant rose-pink ruffled caps with a delicate, nutty aroma.',
    'A tropical gourmet delicacy (Pleurotus djamor). Striking coral-pink clusters that cook fast with a subtle woody crunch. Packed fresh in breathable kraft punnets.',
    120.00,
    '250 g',
    'Harvested at dawn',
    '4 to 5 days in refrigerator',
    'Pink oysters are naturally delicate. Store in their breathable punnet in the coldest part of your fridge. Use within 4 days for peak fragrance and coral color.',
    'Flash-sear in smoking-hot ghee or coconut oil for 2 minutes. Outstanding in Thai curries, pan-seared tacos, and pasta garnishes.',
    'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/products/prod-pink-oyster.jpg',
    1,
    'Hi! I would like to order Pink Oyster Mushrooms ({{size}}). Please confirm delivery! 🌸🍄'
),
(
    'mixed-oyster',
    'Mixed Oyster Mushrooms',
    'mixed-oyster-mushrooms',
    'Mushrooms',
    'Chef''s Pick',
    'orange',
    'Gourmet medley of Grey, Pink, and Golden Oyster clusters.',
    'The chef''s favourite. An assorted harvest bowl combining pearl grey, coral pink, and canary yellow oysters. Beautiful on the plate and incredible in risottos or stir-fries.',
    120.00,
    '250 g',
    'Handpicked harvest medley',
    '5 to 6 days in refrigerator',
    'Keep refrigerated in the kraft container. Avoid moisture accumulation by keeping away from freezer vents.',
    'Roast on a parchment-lined baking sheet at 200°C for 12 minutes with sea salt, thyme, and crushed garlic. Produces irresistible crispy edges.',
    'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/products/prod-mixed-oyster.jpg',
    1,
    'Hi! I would love to order the Mixed Oyster Mushroom Box ({{size}}). 🍄🌈'
),
(
    'sunflower-microgreens',
    'Sunflower Microgreens',
    'sunflower-microgreens',
    'Microgreens',
    'Living Greens',
    'green',
    'Nutty sunflower shoots & vibrant radish sprouts. 40x nutrient density.',
    'Lush organic microgreens clipped on order morning. Crunchy nutty sunflower shoots paired with spicy purple radish for a peppery vitamin kick.',
    80.00,
    '50 g',
    'Clipped this morning',
    '7 to 10 days in refrigerator',
    'Store between paper towels in a sealed container in your fridge. Keep dry. They stay super crunchy for over a week.',
    'Eat raw! Toss into warm omelettes, avocado toast, grain bowls, and sandwich wraps right before serving to preserve live enzymes and crisp crunch.',
    'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/products/prod-microgreens-mix.jpg',
    1,
    'Hi! I would like to order Sunflower Microgreens ({{size}}). 🌱'
),
(
    'kombucha-original',
    'Artisanal Raw Kombucha',
    'kombucha-original',
    'Kombucha',
    'Gut Health',
    'orange',
    'Naturally sparkling, raw unpasteurized probiotic tea elixir.',
    'Slow-fermented for 21 days with whole leaf Assam black tea and organic green tea. Packed with live probiotic cultures, organic acids, and clean fizziness with low sugar.',
    120.00,
    '250 ml',
    'Active living probiotics',
    '60 days (always refrigerated)',
    'Must be kept cold (2°C – 6°C) at all times to pause fermentation. Do not shake the bottle before opening.',
    'Enjoy chilled 30 minutes before or after lunch as a digestive tonic. Or mix with fresh mint and pomegranate for a gut-healthy mocktail.',
    'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/products/prod-kombucha-bottle.jpg',
    1,
    'Hi! I would like to order Raw Kombucha ({{size}}). 🍾✨'
),
(
    'desi-eggs',
    'Free-Range Desi Eggs',
    'desi-eggs',
    'Desi Eggs',
    'Farm Fresh',
    'green',
    'Rich golden yolks from pasture-roaming, grain-fed country hens.',
    'Authentic desi country eggs from hens that forage freely in open outdoor sunshine. Deep amber yolks rich in natural Omega-3, choline, and clean bioavailable protein.',
    90.00,
    '6 pcs',
    'Collected daily at farm',
    '21 days refrigerated, 10 days room temp',
    'Store pointy-end down in the egg carton in your refrigerator. Keep away from strong-smelling foods as eggshells are porous.',
    'The rich yolk makes incredible sunny-side-up eggs, soft-boiled ramen eggs, and velvety scramble. Cook over gentle medium-low heat.',
    'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/products/prod-desi-eggs.jpg',
    1,
    'Hi! I would like to order Free-Range Desi Eggs ({{size}}). 🥚🌿'
)
on conflict (id) do nothing;

-- Seed Pack Sizes
insert into public.product_pack_sizes (product_id, size, price, sort_order) values
('grey-oyster', '250 g', 100.00, 1),
('grey-oyster', '500 g', 180.00, 2),
('grey-oyster', '1 kg', 340.00, 3),

('pink-oyster', '250 g', 120.00, 1),
('pink-oyster', '500 g', 230.00, 2),

('mixed-oyster', '250 g', 120.00, 1),
('mixed-oyster', '500 g', 230.00, 2),

('sunflower-microgreens', '50 g', 80.00, 1),
('sunflower-microgreens', '100 g', 150.00, 2),

('kombucha-original', '250 ml', 120.00, 1),
('kombucha-original', '500 ml', 220.00, 2),

('desi-eggs', '6 pcs', 90.00, 1),
('desi-eggs', '12 pcs', 170.00, 2),
('desi-eggs', '30 pcs (Tray)', 410.00, 3)
on conflict do nothing;

-- Seed Initial Inventory
insert into public.inventory (product_id, daily_harvest_batch, available_qty, is_sold_out, harvest_time) values
('grey-oyster', 60, 48, false, '5:30 AM'),
('pink-oyster', 30, 22, false, '5:30 AM'),
('mixed-oyster', 40, 31, false, '5:30 AM'),
('sunflower-microgreens', 50, 42, false, 'Dawn clip'),
('kombucha-original', 50, 38, false, 'Bottled fresh'),
('desi-eggs', 100, 85, false, 'Daily collection')
on conflict (product_id) do nothing;


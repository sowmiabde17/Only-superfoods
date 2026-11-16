-- ==============================================================================
-- ONLY SUPERFOODS: CUSTOMER WHATSAPP OTP & 1-TAP INBOUND VERIFICATION SCHEMA
-- Stores 4-digit OTPs and 1-tap verification tokens with strict TTL and rate guards.
-- ==============================================================================

create table if not exists public.customer_otps (
    id uuid default gen_random_uuid() primary key,
    phone text not null,
    token text not null unique,
    otp_code text not null,
    type text not null default 'otp', -- 'otp' | 'inbound_tap'
    attempts int not null default 0,
    expires_at timestamptz not null,
    verified_at timestamptz,
    created_at timestamptz default now()
);

-- Fast lookup indexes
create index if not exists idx_customer_otps_phone on public.customer_otps(phone);
create index if not exists idx_customer_otps_token on public.customer_otps(token);

-- Row Level Security: Locked to service_role to protect OTPs from anonymous scraping
alter table public.customer_otps enable row level security;

-- Drop policy if exists to make script re-runnable
do $$
begin
  if exists (
    select 1 from pg_policies 
    where tablename = 'customer_otps' and policyname = 'Service role full access on customer_otps'
  ) then
    drop policy "Service role full access on customer_otps" on public.customer_otps;
  end if;
end $$;

create policy "Service role full access on customer_otps"
    on public.customer_otps for all
    to service_role
    using (true)
    with check (true);

-- Add to Realtime publication so web browser can instantly detect inbound 1-tap verification
alter publication supabase_realtime add table public.customer_otps;


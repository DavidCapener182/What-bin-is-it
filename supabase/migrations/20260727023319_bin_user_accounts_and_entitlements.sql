-- Lightweight What Bin accounts and server-authoritative plan entitlements.
--
-- Saved places and collection schedules remain on the resident's device.
-- This table stores only the Supabase user id and the minimum billing state
-- needed to make a purchase follow the same person across platforms.

create table if not exists public.bin_user_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id varchar(32) not null default 'free',
  source varchar(16) not null default 'free',
  status varchar(24) not null default 'active',
  product_id varchar(160),
  stripe_customer_id varchar(255) unique,
  stripe_subscription_id varchar(255) unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_user_entitlements_plan_check
    check (plan_id in ('free', 'plus-monthly', 'plus-yearly', 'plus-lifetime')),
  constraint bin_user_entitlements_source_check
    check (source in ('free', 'stripe', 'apple', 'google', 'admin')),
  constraint bin_user_entitlements_status_check
    check (status in ('active', 'trialing', 'past_due', 'cancelled', 'canceled', 'expired', 'free', 'payment_failed'))
);

create index if not exists bin_user_entitlements_status_idx
  on public.bin_user_entitlements (status, updated_at);

alter table public.bin_supporters
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists bin_supporters_user_idx
  on public.bin_supporters (user_id)
  where user_id is not null;

alter table public.bin_user_entitlements enable row level security;

revoke all on table public.bin_user_entitlements from anon, authenticated;
grant select, insert on table public.bin_user_entitlements to authenticated;

drop policy if exists "bin users read own entitlement" on public.bin_user_entitlements;
create policy "bin users read own entitlement"
  on public.bin_user_entitlements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "bin users initialise free entitlement" on public.bin_user_entitlements;
create policy "bin users initialise free entitlement"
  on public.bin_user_entitlements
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and plan_id = 'free'
    and source = 'free'
    and status in ('active', 'free')
    and product_id is null
    and stripe_customer_id is null
    and stripe_subscription_id is null
    and current_period_end is null
  );

comment on table public.bin_user_entitlements is
  'What Bin plan entitlement by Supabase auth user. No address, postcode, collection or card data.';
comment on column public.bin_user_entitlements.user_id is
  'Shared Supabase auth identifier; residents can read only their own row.';

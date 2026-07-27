-- Provider-specific purchase grants and a reconciled resident entitlement.
--
-- Stripe, Apple and Google may all report state for the same resident. Keeping
-- each provider grant separately prevents a cancellation from one provider
-- from overwriting valid access purchased through another. The server remains
-- the only writer; residents may read their own effective entitlement/grants.

create table if not exists public.bin_entitlement_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source varchar(16) not null,
  external_key varchar(255) not null,
  plan_id varchar(32) not null,
  status varchar(24) not null,
  product_id varchar(160),
  stripe_customer_id varchar(255),
  stripe_subscription_id varchar(255),
  current_period_end timestamptz,
  provider_event_at timestamptz not null,
  provider_event_id varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_entitlement_grants_source_check
    check (source in ('stripe', 'apple', 'google', 'admin')),
  constraint bin_entitlement_grants_plan_check
    check (plan_id in ('plus-monthly', 'plus-yearly', 'plus-lifetime')),
  constraint bin_entitlement_grants_status_check
    check (status in (
      'active',
      'trialing',
      'past_due',
      'grace',
      'cancelled',
      'canceled',
      'expired',
      'payment_failed',
      'refunded',
      'revoked'
    )),
  unique (source, external_key)
);

create index if not exists bin_entitlement_grants_user_idx
  on public.bin_entitlement_grants (user_id, provider_event_at desc);
create index if not exists bin_entitlement_grants_subscription_idx
  on public.bin_entitlement_grants (stripe_subscription_id)
  where stripe_subscription_id is not null;
create index if not exists bin_entitlement_grants_customer_idx
  on public.bin_entitlement_grants (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.bin_entitlement_grants enable row level security;
revoke all on table public.bin_entitlement_grants from anon, authenticated;
grant select on table public.bin_entitlement_grants to authenticated;

drop policy if exists "bin users read own entitlement grants" on public.bin_entitlement_grants;
create policy "bin users read own entitlement grants"
  on public.bin_entitlement_grants
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Preserve any paid entitlement that predates grant reconciliation. A later,
-- verified provider event will update the same provider key or supersede it.
insert into public.bin_entitlement_grants (
  user_id,
  source,
  external_key,
  plan_id,
  status,
  product_id,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_end,
  provider_event_at
)
select
  user_id,
  source,
  case
    when source = 'stripe' and stripe_subscription_id is not null
      then 'subscription:' || stripe_subscription_id
    when source = 'stripe' and stripe_customer_id is not null
      then 'legacy-customer:' || stripe_customer_id
    else 'legacy-user:' || user_id::text
  end,
  plan_id,
  case
    when status in ('active', 'trialing', 'past_due', 'cancelled', 'canceled', 'expired', 'payment_failed')
      then status
    else 'expired'
  end,
  product_id,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_end,
  updated_at
from public.bin_user_entitlements
where plan_id <> 'free'
  and source in ('stripe', 'apple', 'google', 'admin')
on conflict (source, external_key) do nothing;

alter table public.bin_user_entitlements
  drop constraint if exists bin_user_entitlements_status_check;
alter table public.bin_user_entitlements
  add constraint bin_user_entitlements_status_check
  check (status in (
    'active',
    'trialing',
    'past_due',
    'grace',
    'cancelled',
    'canceled',
    'expired',
    'free',
    'payment_failed',
    'refunded',
    'revoked'
  ));

comment on table public.bin_entitlement_grants is
  'Verified provider purchase states used to reconcile one effective What Bin plan. No address or card data.';
comment on column public.bin_entitlement_grants.provider_event_at is
  'Provider event time used to ignore webhook events that arrive out of order.';

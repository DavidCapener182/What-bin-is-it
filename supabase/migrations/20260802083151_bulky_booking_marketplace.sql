-- Tracked bulky-waste referrals and optional Stripe Connect checkout.
--
-- The ledger deliberately excludes resident names, email addresses, telephone
-- numbers, postcodes and collection addresses. Stripe or the selected service
-- provider collects fulfilment details only when the resident chooses that
-- provider. Official council handoffs are measured but never treated as
-- commissionable bookings.

begin;

alter table public.bin_council_partners
  add column if not exists booking_mode varchar(24) not null default 'external-referral',
  add column if not exists booking_price_pence integer,
  add column if not exists platform_fee_pence integer,
  add column if not exists stripe_account_id varchar(255);

alter table public.bin_council_partners
  add constraint bin_council_partners_booking_mode_check
    check (booking_mode in ('none', 'external-referral', 'stripe-connect')),
  add constraint bin_council_partners_booking_price_check
    check (booking_price_pence is null or booking_price_pence between 100 and 1000000),
  add constraint bin_council_partners_platform_fee_check
    check (
      platform_fee_pence is null
      or (
        platform_fee_pence between 0 and 100000
        and booking_price_pence is not null
        and platform_fee_pence <= booking_price_pence
      )
    ),
  add constraint bin_council_partners_stripe_account_check
    check (stripe_account_id is null or stripe_account_id ~ '^acct_[A-Za-z0-9]{8,}$'),
  add constraint bin_council_partners_connect_fields_check
    check (
      booking_mode <> 'stripe-connect'
      or (
        booking_price_pence is not null
        and platform_fee_pence is not null
        and stripe_account_id is not null
      )
    );

create table if not exists public.bin_bulky_bookings (
  id uuid primary key default gen_random_uuid(),
  public_reference varchar(24) not null unique,
  organisation_id uuid references public.bin_council_organisations (id) on delete set null,
  partner_id uuid references public.bin_council_partners (id) on delete set null,
  installation_id uuid not null,
  council_provider_id varchar(32) not null,
  booking_channel varchar(24) not null,
  item_key varchar(80) not null,
  quantity smallint not null default 1,
  amount_pence integer,
  platform_fee_pence integer,
  currency char(3) not null default 'gbp',
  status varchar(24) not null,
  stripe_checkout_session_id varchar(255) unique,
  stripe_payment_intent_id varchar(255),
  partner_reference varchar(160),
  started_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint bin_bulky_bookings_reference_check
    check (public_reference ~ '^WB-[A-Z0-9]{12}$'),
  constraint bin_bulky_bookings_council_check
    check (council_provider_id ~ '^lad-[ensw][0-9]{8}$'),
  constraint bin_bulky_bookings_channel_check
    check (booking_channel in ('official-council', 'external-referral', 'stripe-connect')),
  constraint bin_bulky_bookings_item_check
    check (item_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint bin_bulky_bookings_quantity_check
    check (quantity between 1 and 20),
  constraint bin_bulky_bookings_money_check
    check (
      (amount_pence is null or amount_pence between 0 and 20000000)
      and (platform_fee_pence is null or platform_fee_pence between 0 and 2000000)
      and (platform_fee_pence is null or amount_pence is not null)
      and (platform_fee_pence is null or platform_fee_pence <= amount_pence)
    ),
  constraint bin_bulky_bookings_currency_check check (currency = 'gbp'),
  constraint bin_bulky_bookings_status_check
    check (status in ('official-handoff', 'started', 'checkout-created', 'paid', 'confirmed', 'completed', 'cancelled', 'refunded', 'payment-failed')),
  constraint bin_bulky_bookings_partner_check
    check (
      (booking_channel = 'official-council' and partner_id is null)
      or (booking_channel <> 'official-council' and partner_id is not null)
    ),
  constraint bin_bulky_bookings_timestamps_check
    check (
      (confirmed_at is null or confirmed_at >= started_at)
      and (completed_at is null or completed_at >= started_at)
      and (cancelled_at is null or cancelled_at >= started_at)
    )
);

create index if not exists bin_bulky_bookings_council_idx
  on public.bin_bulky_bookings (council_provider_id, started_at desc);
create index if not exists bin_bulky_bookings_partner_idx
  on public.bin_bulky_bookings (partner_id, status, started_at desc)
  where partner_id is not null;
create index if not exists bin_bulky_bookings_installation_idx
  on public.bin_bulky_bookings (installation_id, started_at desc);

alter table public.bin_bulky_bookings enable row level security;
revoke all on table public.bin_bulky_bookings from anon, authenticated;

comment on table public.bin_bulky_bookings is
  'Pseudonymous bulky-waste booking and referral ledger. Contains no resident contact, postcode or address data; revenue is recognised only from confirmed provider or signed Stripe evidence.';
comment on column public.bin_council_partners.stripe_account_id is
  'Server-only Stripe Connect account identifier. Never published in the resident council profile.';

commit;

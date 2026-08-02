-- Controlled sponsored bulky-waste marketplace.
--
-- Residents pay What Bin through hosted Stripe Checkout. The collector does
-- not receive funds until a platform superadmin has recorded provider
-- acceptance, the collection has been completed and a separate Stripe Connect
-- transfer is released. The private ledger remains pseudonymous: fulfilment
-- contact and collection-address details stay in Stripe.

begin;

alter table public.bin_council_partners
  add column if not exists provider_acceptance_sla_hours smallint not null default 24,
  add column if not exists terms_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bin_council_partners_acceptance_sla_check'
      and conrelid = 'public.bin_council_partners'::regclass
  ) then
    alter table public.bin_council_partners
      add constraint bin_council_partners_acceptance_sla_check
      check (provider_acceptance_sla_hours between 1 and 168);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'bin_council_partners_terms_url_check'
      and conrelid = 'public.bin_council_partners'::regclass
  ) then
    alter table public.bin_council_partners
      add constraint bin_council_partners_terms_url_check
      check (terms_url is null or terms_url ~ '^https://');
  end if;
end $$;

alter table public.bin_bulky_bookings
  add column if not exists stripe_charge_id varchar(255),
  add column if not exists stripe_transfer_id varchar(255),
  add column if not exists stripe_refund_id varchar(255),
  add column if not exists transfer_group varchar(64),
  add column if not exists provider_accepted_at timestamptz,
  add column if not exists provider_declined_at timestamptz,
  add column if not exists scheduled_for timestamptz,
  add column if not exists payout_released_at timestamptz,
  add column if not exists refunded_at timestamptz;

alter table public.bin_partner_conversion_events
  drop constraint if exists bin_partner_conversion_event_check;
alter table public.bin_partner_conversion_events
  add constraint bin_partner_conversion_event_check
  check (event_name in (
    'listing-viewed', 'website-opened', 'phone-tapped', 'directions-requested',
    'booking-initiated', 'payment-received', 'booking-confirmed', 'booking-completed'
  ));

create unique index if not exists bin_bulky_bookings_stripe_transfer_idx
  on public.bin_bulky_bookings (stripe_transfer_id)
  where stripe_transfer_id is not null;
create unique index if not exists bin_bulky_bookings_stripe_refund_idx
  on public.bin_bulky_bookings (stripe_refund_id)
  where stripe_refund_id is not null;
create index if not exists bin_bulky_bookings_fulfilment_queue_idx
  on public.bin_bulky_bookings (status, started_at)
  where booking_channel = 'stripe-connect'
    and status in ('awaiting-provider', 'provider-accepted', 'scheduled');

alter table public.bin_bulky_bookings
  drop constraint if exists bin_bulky_bookings_status_check;
alter table public.bin_bulky_bookings
  add constraint bin_bulky_bookings_status_check
  check (status in (
    'official-handoff', 'started', 'checkout-created', 'payment-pending',
    'awaiting-provider', 'provider-accepted', 'scheduled', 'confirmed',
    'completed', 'payout-released', 'provider-declined', 'cancelled',
    'refunded', 'payment-failed'
  ));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bin_bulky_bookings_marketplace_timestamps_check'
      and conrelid = 'public.bin_bulky_bookings'::regclass
  ) then
    alter table public.bin_bulky_bookings
      add constraint bin_bulky_bookings_marketplace_timestamps_check
      check (
        (provider_accepted_at is null or provider_accepted_at >= started_at)
        and (provider_declined_at is null or provider_declined_at >= started_at)
        and (scheduled_for is null or scheduled_for >= started_at)
        and (payout_released_at is null or payout_released_at >= started_at)
        and (refunded_at is null or refunded_at >= started_at)
      );
  end if;
end $$;

create table if not exists public.bin_bulky_booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bin_bulky_bookings (id) on delete cascade,
  actor_type varchar(24) not null,
  event_name varchar(48) not null,
  from_status varchar(32),
  to_status varchar(32) not null,
  external_reference varchar(255),
  occurred_at timestamptz not null default now(),
  constraint bin_bulky_booking_events_actor_check
    check (actor_type in ('resident', 'stripe-webhook', 'platform-admin', 'system')),
  constraint bin_bulky_booking_events_name_check
    check (event_name ~ '^[a-z][a-z0-9-]{1,47}$'),
  constraint bin_bulky_booking_events_status_check
    check (
      (from_status is null or from_status ~ '^[a-z][a-z0-9-]{1,31}$')
      and to_status ~ '^[a-z][a-z0-9-]{1,31}$'
    )
);

create index if not exists bin_bulky_booking_events_booking_idx
  on public.bin_bulky_booking_events (booking_id, occurred_at);

alter table public.bin_bulky_booking_events enable row level security;
revoke all on table public.bin_bulky_booking_events from anon, authenticated;

comment on column public.bin_council_partners.provider_acceptance_sla_hours is
  'Resident-facing maximum provider response window for controlled marketplace bookings.';
comment on column public.bin_bulky_bookings.stripe_transfer_id is
  'Server-only Stripe Connect transfer released only after completed collection evidence.';
comment on table public.bin_bulky_booking_events is
  'Append-only, pseudonymous marketplace order timeline. Contains no resident contact, postcode or collection-address fields.';

commit;

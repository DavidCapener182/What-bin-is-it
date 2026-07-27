-- Idempotency and minimal audit record for verified RevenueCat webhooks.

create table if not exists public.bin_revenuecat_events (
  revenuecat_event_id varchar(255) primary key,
  event_type varchar(80) not null,
  user_id uuid,
  product_id varchar(160),
  store varchar(40),
  environment varchar(24),
  outcome varchar(24) not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists bin_revenuecat_events_user_idx
  on public.bin_revenuecat_events (user_id, occurred_at);
create index if not exists bin_revenuecat_events_received_idx
  on public.bin_revenuecat_events (received_at);

alter table public.bin_revenuecat_events enable row level security;
revoke all on table public.bin_revenuecat_events from anon, authenticated;

comment on table public.bin_revenuecat_events is
  'Idempotency and audit outcome for authenticated RevenueCat lifecycle webhooks; no resident address data.';

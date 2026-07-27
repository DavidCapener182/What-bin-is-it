-- What Bin Is It Tonight? resident-safety evidence and web billing records.
--
-- Privacy boundary:
--   * no address, postcode, coordinates, council property reference, search
--     text, report notes, email address, IP address, or user-agent is stored;
--   * all application access is server-to-server through BIN_DATABASE_URL;
--   * public Data API roles receive no privileges and RLS is enabled as
--     defence in depth.

create table if not exists public.bin_analytics_events (
  id uuid primary key,
  participant_id uuid not null,
  consent_version varchar(16) not null,
  event_name varchar(64) not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  council_id varchar(80),
  platform varchar(12) not null,
  app_version varchar(32) not null,
  outcome varchar(24),
  context varchar(32),
  reason_code varchar(32),
  duration_ms integer,
  metric_value integer,
  constraint bin_analytics_events_platform_check
    check (platform in ('ios', 'android', 'web')),
  constraint bin_analytics_events_duration_check
    check (duration_ms is null or duration_ms between 0 and 120000),
  constraint bin_analytics_events_metric_check
    check (metric_value is null or metric_value between 0 and 1000)
);

create index if not exists bin_analytics_events_received_idx
  on public.bin_analytics_events (received_at);
create index if not exists bin_analytics_events_council_idx
  on public.bin_analytics_events (council_id, occurred_at, event_name);
create index if not exists bin_analytics_events_participant_idx
  on public.bin_analytics_events (participant_id, received_at);

create table if not exists public.bin_gateway_checks (
  id uuid primary key,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  council_id varchar(80),
  resource varchar(24) not null,
  successful boolean not null,
  status_code smallint not null,
  duration_ms integer not null,
  reason_code varchar(24),
  constraint bin_gateway_checks_resource_check
    check (resource in ('addresses', 'collections', 'services', 'unknown')),
  constraint bin_gateway_checks_status_check
    check (status_code between 100 and 599),
  constraint bin_gateway_checks_duration_check
    check (duration_ms between 0 and 120000)
);

create index if not exists bin_gateway_checks_council_idx
  on public.bin_gateway_checks (council_id, occurred_at, resource);
create index if not exists bin_gateway_checks_received_idx
  on public.bin_gateway_checks (received_at);

create table if not exists public.bin_supporters (
  stripe_customer_id varchar(255) primary key,
  stripe_subscription_id varchar(255) unique,
  checkout_session_id varchar(255) unique,
  plan_id varchar(32) not null,
  billing_mode varchar(16) not null,
  status varchar(32) not null,
  currency char(3) not null default 'gbp',
  amount_pence integer not null,
  started_at timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint bin_supporters_plan_check
    check (plan_id in ('plus-monthly', 'plus-yearly', 'plus-lifetime')),
  constraint bin_supporters_mode_check
    check (billing_mode in ('subscription', 'payment')),
  constraint bin_supporters_amount_check
    check (amount_pence between 0 and 100000)
);

create index if not exists bin_supporters_subscription_idx
  on public.bin_supporters (stripe_subscription_id);
create index if not exists bin_supporters_status_idx
  on public.bin_supporters (status, updated_at);

create table if not exists public.bin_payment_events (
  stripe_event_id varchar(255) primary key,
  event_type varchar(120) not null,
  livemode boolean not null,
  stripe_customer_id varchar(255),
  stripe_subscription_id varchar(255),
  plan_id varchar(32),
  outcome varchar(32) not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists bin_payment_events_customer_idx
  on public.bin_payment_events (stripe_customer_id, occurred_at);
create index if not exists bin_payment_events_received_idx
  on public.bin_payment_events (received_at);

alter table public.bin_analytics_events enable row level security;
alter table public.bin_gateway_checks enable row level security;
alter table public.bin_supporters enable row level security;
alter table public.bin_payment_events enable row level security;

revoke all on table public.bin_analytics_events from anon, authenticated;
revoke all on table public.bin_gateway_checks from anon, authenticated;
revoke all on table public.bin_supporters from anon, authenticated;
revoke all on table public.bin_payment_events from anon, authenticated;

comment on table public.bin_analytics_events is
  'Opt-in, pseudonymous, allow-listed product events. Never store address or free text.';
comment on table public.bin_gateway_checks is
  'Council gateway reliability measurements without resident identifiers or request payloads.';
comment on table public.bin_supporters is
  'Minimal Stripe web-supporter state. Stripe retains payer identity and card data.';
comment on table public.bin_payment_events is
  'Idempotency and audit trail for verified Stripe webhook events; no payer contact details.';

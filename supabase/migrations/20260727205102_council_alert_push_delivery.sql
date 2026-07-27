-- Consent-based council service alerts for web and native installations.
--
-- A registration stores an opaque installation UUID, council provider ID and
-- the minimum provider credential needed to deliver a notification. It never
-- stores a postcode, address, UPRN, account ID, email address or message
-- narrative. Resident clients can only reach this data through the private
-- application server.

create table if not exists public.bin_council_push_registrations (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null,
  council_id varchar(80) not null,
  channel varchar(20) not null,
  token_hash char(64) not null,
  delivery_config jsonb not null,
  enabled boolean not null default true,
  first_registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  last_delivery_at timestamptz,
  last_error_code varchar(64),
  unique (installation_id, council_id, channel),
  constraint bin_council_push_registrations_council_check
    check (council_id ~ '^lad-[ensw][0-9]{8}$'),
  constraint bin_council_push_registrations_channel_check
    check (channel in ('web-push', 'expo-push')),
  constraint bin_council_push_registrations_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint bin_council_push_registrations_config_check
    check (
      jsonb_typeof(delivery_config) = 'object'
      and pg_column_size(delivery_config) <= 8192
    ),
  constraint bin_council_push_registrations_enabled_check
    check (
      (enabled and disabled_at is null)
      or (not enabled and disabled_at is not null)
    )
);

create index if not exists bin_council_push_registrations_target_idx
  on public.bin_council_push_registrations (council_id, channel, last_seen_at)
  where enabled;

create index if not exists bin_council_push_registrations_installation_idx
  on public.bin_council_push_registrations (installation_id, enabled);

create table if not exists public.bin_council_broadcast_receipts (
  id uuid primary key default gen_random_uuid(),
  broadcast_job_id uuid not null references public.bin_council_broadcast_jobs (id) on delete cascade,
  registration_id uuid not null references public.bin_council_push_registrations (id) on delete cascade,
  channel varchar(20) not null,
  status varchar(20) not null,
  provider_ticket_id varchar(160),
  error_code varchar(64),
  attempted_at timestamptz not null default now(),
  unique (broadcast_job_id, registration_id),
  constraint bin_council_broadcast_receipts_channel_check
    check (channel in ('web-push', 'expo-push')),
  constraint bin_council_broadcast_receipts_status_check
    check (status in ('accepted', 'failed', 'expired'))
);

create index if not exists bin_council_broadcast_receipts_job_idx
  on public.bin_council_broadcast_receipts (broadcast_job_id, status);

alter table public.bin_council_push_registrations enable row level security;
alter table public.bin_council_broadcast_receipts enable row level security;

revoke all on table public.bin_council_push_registrations from anon, authenticated;
revoke all on table public.bin_council_broadcast_receipts from anon, authenticated;

comment on table public.bin_council_push_registrations is
  'Private consented web/Expo push credentials, tenant-scoped by council ID. Contains no resident address or postcode.';

comment on column public.bin_council_push_registrations.delivery_config is
  'Minimum provider credential required for delivery. Private server access only; never returned to a council portal or resident client.';

comment on table public.bin_council_broadcast_receipts is
  'Per-registration provider acceptance result for an authorised council broadcast; contains no resident identity or message body.';

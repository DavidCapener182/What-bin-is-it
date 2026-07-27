-- Private council back-office platform for What Bin Is It Tonight?
--
-- Security and privacy boundaries:
--   * council staff authenticate with Supabase Auth, but every role and
--     organisation decision is made from these server-owned tables;
--   * no resident address, postcode, free-text report or push token is stored;
--   * council content is only exposed to residents after it is published;
--   * all public-schema tables have RLS enabled and no Data API grants;
--   * application mutations are tenant-scoped and append an immutable audit row.

create table if not exists public.bin_council_organisations (
  id uuid primary key default gen_random_uuid(),
  provider_id varchar(32) not null unique,
  slug varchar(80) not null unique,
  name varchar(160) not null,
  status varchar(24) not null default 'prospect',
  plan_tier varchar(24) not null default 'pilot',
  brand_name varchar(160),
  logo_url varchar(500),
  primary_colour char(7) not null default '#007AFF',
  secondary_colour char(7) not null default '#0F2A3A',
  sponsorship_label varchar(120),
  contract_starts_at date,
  contract_ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_council_organisations_provider_check
    check (provider_id ~ '^lad-[ensw][0-9]{8}$'),
  constraint bin_council_organisations_slug_check
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  constraint bin_council_organisations_name_check
    check (length(trim(name)) between 2 and 160),
  constraint bin_council_organisations_status_check
    check (status in ('prospect', 'pilot', 'active', 'suspended', 'ended')),
  constraint bin_council_organisations_plan_check
    check (plan_tier in ('pilot', 'core', 'professional', 'enterprise')),
  constraint bin_council_organisations_primary_colour_check
    check (primary_colour ~ '^#[0-9A-F]{6}$'),
  constraint bin_council_organisations_secondary_colour_check
    check (secondary_colour ~ '^#[0-9A-F]{6}$'),
  constraint bin_council_organisations_logo_check
    check (logo_url is null or logo_url ~ '^https://'),
  constraint bin_council_organisations_contract_check
    check (
      contract_starts_at is null
      or contract_ends_at is null
      or contract_ends_at >= contract_starts_at
    )
);

create table if not exists public.bin_council_staff (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role varchar(24) not null,
  status varchar(16) not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, user_id),
  constraint bin_council_staff_role_check
    check (role in ('owner', 'admin', 'editor', 'analyst', 'support')),
  constraint bin_council_staff_status_check
    check (status in ('active', 'suspended', 'ended'))
);

create index if not exists bin_council_staff_user_idx
  on public.bin_council_staff (user_id, status);
create index if not exists bin_council_staff_org_idx
  on public.bin_council_staff (organisation_id, status, role);

create table if not exists public.bin_council_announcements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  kind varchar(24) not null default 'service',
  severity varchar(16) not null default 'information',
  title varchar(120) not null,
  body varchar(600) not null,
  placements varchar(24)[] not null default array['home']::varchar[],
  status varchar(16) not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  source_url varchar(500),
  created_by uuid not null references auth.users (id) on delete restrict,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_council_announcements_kind_check
    check (kind in ('service', 'education', 'emergency', 'seasonal')),
  constraint bin_council_announcements_severity_check
    check (severity in ('information', 'advice', 'warning', 'critical')),
  constraint bin_council_announcements_title_check
    check (length(trim(title)) between 3 and 120),
  constraint bin_council_announcements_body_check
    check (length(trim(body)) between 3 and 600),
  constraint bin_council_announcements_placements_check
    check (
      cardinality(placements) between 1 and 5
      and placements <@ array['home', 'schedule', 'guide', 'widget', 'push']::varchar[]
    ),
  constraint bin_council_announcements_status_check
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  constraint bin_council_announcements_window_check
    check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint bin_council_announcements_source_check
    check (source_url is null or source_url ~ '^https://')
);

create index if not exists bin_council_announcements_live_idx
  on public.bin_council_announcements (organisation_id, status, starts_at, ends_at);

create table if not exists public.bin_council_disruptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  title varchar(120) not null,
  detail varchar(600) not null,
  collection_types varchar(20)[] not null default array['all']::varchar[],
  area_labels varchar(120)[] not null default array[]::varchar[],
  cause varchar(32) not null default 'operational',
  resident_instruction varchar(400) not null,
  status varchar(16) not null default 'draft',
  starts_at timestamptz not null,
  expected_resume_at timestamptz,
  ends_at timestamptz,
  source_url varchar(500),
  created_by uuid not null references auth.users (id) on delete restrict,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_council_disruptions_title_check
    check (length(trim(title)) between 3 and 120),
  constraint bin_council_disruptions_detail_check
    check (length(trim(detail)) between 3 and 600),
  constraint bin_council_disruptions_instruction_check
    check (length(trim(resident_instruction)) between 3 and 400),
  constraint bin_council_disruptions_types_check
    check (
      cardinality(collection_types) between 1 and 6
      and collection_types <@ array['all', 'general', 'recycling', 'garden', 'food', 'other']::varchar[]
    ),
  constraint bin_council_disruptions_areas_check
    check (cardinality(area_labels) <= 50),
  constraint bin_council_disruptions_cause_check
    check (cause in ('operational', 'weather', 'bank-holiday', 'industrial-action', 'vehicle', 'emergency', 'other')),
  constraint bin_council_disruptions_status_check
    check (status in ('draft', 'published', 'resolved', 'archived')),
  constraint bin_council_disruptions_window_check
    check (
      (expected_resume_at is null or expected_resume_at >= starts_at)
      and (ends_at is null or ends_at >= starts_at)
    ),
  constraint bin_council_disruptions_source_check
    check (source_url is null or source_url ~ '^https://')
);

create index if not exists bin_council_disruptions_live_idx
  on public.bin_council_disruptions (organisation_id, status, starts_at, ends_at);

create table if not exists public.bin_council_guidance_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  item_key varchar(80) not null,
  item_name varchar(120) not null,
  search_terms varchar(80)[] not null default array[]::varchar[],
  destination varchar(20) not null,
  heading varchar(160) not null,
  detail varchar(400) not null,
  service_url varchar(500),
  status varchar(16) not null default 'draft',
  created_by uuid not null references auth.users (id) on delete restrict,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, item_key),
  constraint bin_council_guidance_key_check
    check (item_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint bin_council_guidance_name_check
    check (length(trim(item_name)) between 2 and 120),
  constraint bin_council_guidance_search_check
    check (cardinality(search_terms) <= 30),
  constraint bin_council_guidance_destination_check
    check (destination in ('general', 'recycling', 'garden', 'food', 'other', 'service', 'check')),
  constraint bin_council_guidance_heading_check
    check (length(trim(heading)) between 3 and 160),
  constraint bin_council_guidance_detail_check
    check (length(trim(detail)) between 3 and 400),
  constraint bin_council_guidance_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint bin_council_guidance_service_check
    check (service_url is null or service_url ~ '^https://')
);

create index if not exists bin_council_guidance_status_idx
  on public.bin_council_guidance_items (organisation_id, status, item_name);

create table if not exists public.bin_council_reporting_rules (
  organisation_id uuid primary key references public.bin_council_organisations (id) on delete cascade,
  enabled boolean not null default true,
  mode varchar(24) not null default 'official-handoff',
  report_url varchar(500),
  eligibility_starts_hours integer not null default 18,
  reporting_deadline_hours integer not null default 48,
  require_delay_check boolean not null default true,
  resident_instruction varchar(500),
  integration_secret_ref varchar(120),
  updated_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_council_reporting_mode_check
    check (mode in ('official-handoff', 'direct-api', 'disabled')),
  constraint bin_council_reporting_url_check
    check (report_url is null or report_url ~ '^https://'),
  constraint bin_council_reporting_eligibility_check
    check (eligibility_starts_hours between 0 and 72),
  constraint bin_council_reporting_deadline_check
    check (reporting_deadline_hours between 1 and 720),
  constraint bin_council_reporting_secret_ref_check
    check (
      integration_secret_ref is null
      or integration_secret_ref ~ '^BIN_COUNCIL_[A-Z0-9_]{3,100}$'
    )
);

create table if not exists public.bin_council_partners (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  name varchar(160) not null,
  category varchar(40) not null,
  description varchar(400) not null,
  service_url varchar(500) not null,
  item_keys varchar(80)[] not null default array[]::varchar[],
  disclosure_label varchar(80) not null default 'Sponsored partner',
  referral_model varchar(24) not null default 'none',
  commission_pence integer,
  priority smallint not null default 100,
  licence_reference varchar(120),
  status varchar(16) not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_council_partners_name_check
    check (length(trim(name)) between 2 and 160),
  constraint bin_council_partners_category_check
    check (category in ('bulky-waste', 'reuse', 'electricals', 'batteries', 'paint', 'garden', 'bin-cleaning', 'replacement-bins', 'other')),
  constraint bin_council_partners_description_check
    check (length(trim(description)) between 3 and 400),
  constraint bin_council_partners_url_check
    check (service_url ~ '^https://'),
  constraint bin_council_partners_items_check
    check (cardinality(item_keys) between 1 and 40),
  constraint bin_council_partners_disclosure_check
    check (length(trim(disclosure_label)) between 3 and 80),
  constraint bin_council_partners_referral_check
    check (referral_model in ('none', 'flat-fee', 'commission', 'sponsored-placement')),
  constraint bin_council_partners_commission_check
    check (
      commission_pence is null
      or commission_pence between 0 and 100000
    ),
  constraint bin_council_partners_priority_check
    check (priority between 1 and 1000),
  constraint bin_council_partners_status_check
    check (status in ('draft', 'review', 'active', 'paused', 'ended')),
  constraint bin_council_partners_window_check
    check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists bin_council_partners_live_idx
  on public.bin_council_partners (organisation_id, status, priority, starts_at, ends_at);

create table if not exists public.bin_council_broadcast_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  announcement_id uuid references public.bin_council_announcements (id) on delete set null,
  disruption_id uuid references public.bin_council_disruptions (id) on delete set null,
  channels varchar(20)[] not null,
  status varchar(16) not null default 'queued',
  requested_by uuid not null references auth.users (id) on delete restrict,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  error_code varchar(64),
  constraint bin_council_broadcast_target_check
    check ((announcement_id is not null) <> (disruption_id is not null)),
  constraint bin_council_broadcast_channels_check
    check (
      cardinality(channels) between 1 and 3
      and channels <@ array['web-push', 'native-push', 'widget']::varchar[]
    ),
  constraint bin_council_broadcast_status_check
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  constraint bin_council_broadcast_counts_check
    check (delivered_count >= 0 and failed_count >= 0)
);

create index if not exists bin_council_broadcast_jobs_status_idx
  on public.bin_council_broadcast_jobs (organisation_id, status, requested_at desc);

create table if not exists public.bin_council_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  action varchar(80) not null,
  entity_type varchar(48) not null,
  entity_id uuid,
  summary jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint bin_council_audit_action_check
    check (action ~ '^[a-z][a-z0-9_.-]{2,79}$'),
  constraint bin_council_audit_entity_check
    check (entity_type ~ '^[a-z][a-z0-9_-]{1,47}$'),
  constraint bin_council_audit_summary_check
    check (
      jsonb_typeof(summary) = 'object'
      and pg_column_size(summary) <= 8192
    )
);

create index if not exists bin_council_audit_logs_org_idx
  on public.bin_council_audit_logs (organisation_id, occurred_at desc);
create index if not exists bin_council_audit_logs_actor_idx
  on public.bin_council_audit_logs (actor_user_id, occurred_at desc);

create or replace function public.bin_prevent_council_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Council audit rows are immutable';
end;
$$;

drop trigger if exists bin_council_audit_immutable
  on public.bin_council_audit_logs;
create trigger bin_council_audit_immutable
  before update or delete on public.bin_council_audit_logs
  for each row execute function public.bin_prevent_council_audit_mutation();

create table if not exists public.bin_council_auth_rate_limits (
  email_hash char(64) primary key,
  window_started_at timestamptz not null default now(),
  request_count smallint not null default 0,
  last_requested_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint bin_council_auth_hash_check
    check (email_hash ~ '^[0-9a-f]{64}$'),
  constraint bin_council_auth_count_check
    check (request_count between 0 and 20)
);

create index if not exists bin_council_auth_rate_limits_expiry_idx
  on public.bin_council_auth_rate_limits (expires_at);

alter table public.bin_council_organisations enable row level security;
alter table public.bin_council_staff enable row level security;
alter table public.bin_council_announcements enable row level security;
alter table public.bin_council_disruptions enable row level security;
alter table public.bin_council_guidance_items enable row level security;
alter table public.bin_council_reporting_rules enable row level security;
alter table public.bin_council_partners enable row level security;
alter table public.bin_council_broadcast_jobs enable row level security;
alter table public.bin_council_audit_logs enable row level security;
alter table public.bin_council_auth_rate_limits enable row level security;

revoke all on table public.bin_council_organisations from anon, authenticated;
revoke all on table public.bin_council_staff from anon, authenticated;
revoke all on table public.bin_council_announcements from anon, authenticated;
revoke all on table public.bin_council_disruptions from anon, authenticated;
revoke all on table public.bin_council_guidance_items from anon, authenticated;
revoke all on table public.bin_council_reporting_rules from anon, authenticated;
revoke all on table public.bin_council_partners from anon, authenticated;
revoke all on table public.bin_council_broadcast_jobs from anon, authenticated;
revoke all on table public.bin_council_audit_logs from anon, authenticated;
revoke all on table public.bin_council_auth_rate_limits from anon, authenticated;
revoke all on function public.bin_prevent_council_audit_mutation() from public, anon, authenticated;

comment on table public.bin_council_organisations is
  'Council tenants and contract state for the private council back office.';
comment on table public.bin_council_staff is
  'Server-authoritative council staff role membership. Never authorise from user metadata.';
comment on table public.bin_council_announcements is
  'Council-authored resident announcements; only published active rows reach resident surfaces.';
comment on table public.bin_council_disruptions is
  'Council service disruptions using area labels only; no resident address data.';
comment on table public.bin_council_guidance_items is
  'Council-localised item guidance published through the resident gateway.';
comment on table public.bin_council_reporting_rules is
  'Council missed-collection eligibility and official/direct handoff configuration.';
comment on table public.bin_council_partners is
  'Reviewed task-relevant partners; official council services must remain first in resident results.';
comment on table public.bin_council_broadcast_jobs is
  'Aggregate broadcast queue state. No resident device token is stored here.';
comment on table public.bin_council_audit_logs is
  'Append-only operational audit evidence without request IPs or resident personal data.';
comment on table public.bin_council_auth_rate_limits is
  'Hashed email throttle state for passwordless council-console sign-in requests.';

-- What Bin platform consolidation.
--
-- This migration adds the privacy-minimised control plane required for
-- targeted service messages, sponsored access, council onboarding, support
-- case management, partner campaigns and outcome evidence. Resident addresses,
-- postcodes, push credentials and support text remain inaccessible to the
-- public API. All operational writes continue through trusted server routes.

alter table public.bin_council_push_registrations
  add column if not exists collection_types varchar(20)[] not null default array[]::varchar[],
  add column if not exists collection_dates date[] not null default array[]::date[],
  add column if not exists audience_labels varchar(80)[] not null default array[]::varchar[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bin_council_push_registrations_audience_check'
      and conrelid = 'public.bin_council_push_registrations'::regclass
  ) then
    alter table public.bin_council_push_registrations
      add constraint bin_council_push_registrations_audience_check
      check (
        cardinality(collection_types) <= 6
        and collection_types <@ array['general', 'recycling', 'garden', 'food', 'other']::varchar[]
        and cardinality(collection_dates) <= 24
        and cardinality(audience_labels) <= 24
      );
  end if;
end $$;

create index if not exists bin_council_push_registrations_types_idx
  on public.bin_council_push_registrations using gin (collection_types)
  where enabled;
create index if not exists bin_council_push_registrations_dates_idx
  on public.bin_council_push_registrations using gin (collection_dates)
  where enabled;
create index if not exists bin_council_push_registrations_labels_idx
  on public.bin_council_push_registrations using gin (audience_labels)
  where enabled;

alter table public.bin_council_announcements
  add column if not exists audience_criteria jsonb not null default '{"scope":"council"}'::jsonb;
alter table public.bin_council_announcements
  drop constraint if exists bin_council_announcements_placements_check;
alter table public.bin_council_announcements
  add constraint bin_council_announcements_placements_check
  check (
    cardinality(placements) between 1 and 6
    and placements <@ array['home', 'schedule', 'guide', 'activity', 'widget', 'push']::varchar[]
  );
alter table public.bin_council_disruptions
  add column if not exists audience_criteria jsonb not null default '{"scope":"council"}'::jsonb;
alter table public.bin_council_broadcast_jobs
  add column if not exists audience_criteria jsonb not null default '{"scope":"council"}'::jsonb,
  add column if not exists estimated_recipient_count integer not null default 0,
  add column if not exists audience_confirmed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bin_council_broadcast_audience_check'
      and conrelid = 'public.bin_council_broadcast_jobs'::regclass
  ) then
    alter table public.bin_council_broadcast_jobs
      add constraint bin_council_broadcast_audience_check
      check (
        jsonb_typeof(audience_criteria) = 'object'
        and pg_column_size(audience_criteria) <= 4096
        and estimated_recipient_count >= 0
      );
  end if;
end $$;

comment on column public.bin_council_push_registrations.audience_labels is
  'Non-address operational labels supplied by an approved council feed, such as a round or ward token. Never a postcode, address or property reference.';
comment on column public.bin_council_broadcast_jobs.estimated_recipient_count is
  'Deduplicated opted-in installation estimate at queue time. This is not a delivery or resident population count.';

create table if not exists public.bin_council_feature_flags (
  organisation_id uuid primary key references public.bin_council_organisations (id) on delete cascade,
  collection_dates boolean not null default true,
  council_branding boolean not null default true,
  push_alerts boolean not null default false,
  missed_collection boolean not null default true,
  direct_reporting boolean not null default false,
  recycling_guide boolean not null default true,
  partner_services boolean not null default false,
  support_inbox boolean not null default false,
  sponsored_plus boolean not null default false,
  analytics_exports boolean not null default false,
  bulky_waste_booking boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.bin_council_onboarding_items (
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  item_key varchar(40) not null,
  status varchar(16) not null default 'not-started',
  evidence_note varchar(500),
  completed_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organisation_id, item_key),
  constraint bin_council_onboarding_item_check
    check (item_key in (
      'identity', 'staff-access', 'collection-source', 'address-lookup',
      'bin-names-colours', 'recycling-guidance', 'missed-bin-policy',
      'service-alerts', 'partner-approvals', 'pilot-baseline'
    )),
  constraint bin_council_onboarding_status_check
    check (status in ('not-started', 'in-progress', 'complete', 'blocked')),
  constraint bin_council_onboarding_completion_check
    check (
      (status = 'complete' and completed_at is not null)
      or (status <> 'complete')
    )
);

create index if not exists bin_council_onboarding_status_idx
  on public.bin_council_onboarding_items (organisation_id, status, item_key);

create table if not exists public.bin_sponsorship_programmes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  sponsor_type varchar(20) not null default 'council',
  status varchar(16) not null default 'draft',
  resident_label varchar(160) not null,
  features varchar(40)[] not null default array['plus']::varchar[],
  starts_at timestamptz not null,
  ends_at timestamptz,
  renewal_at date,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_sponsorship_type_check check (sponsor_type in ('council', 'housing')),
  constraint bin_sponsorship_status_check check (status in ('draft', 'active', 'paused', 'ended')),
  constraint bin_sponsorship_label_check check (length(trim(resident_label)) between 3 and 160),
  constraint bin_sponsorship_features_check check (cardinality(features) between 1 and 20),
  constraint bin_sponsorship_window_check check (ends_at is null or ends_at > starts_at)
);

create index if not exists bin_sponsorship_programmes_live_idx
  on public.bin_sponsorship_programmes (organisation_id, status, starts_at, ends_at);

alter table public.bin_entitlement_grants
  drop constraint if exists bin_entitlement_grants_source_check;
alter table public.bin_entitlement_grants
  add constraint bin_entitlement_grants_source_check
  check (source in ('stripe', 'apple', 'google', 'admin', 'council', 'housing'));
alter table public.bin_entitlement_grants
  drop constraint if exists bin_entitlement_grants_plan_check;
alter table public.bin_entitlement_grants
  add constraint bin_entitlement_grants_plan_check
  check (plan_id in ('plus-monthly', 'plus-yearly', 'plus-lifetime', 'plus-sponsored'));

alter table public.bin_user_entitlements
  drop constraint if exists bin_user_entitlements_source_check;
alter table public.bin_user_entitlements
  add constraint bin_user_entitlements_source_check
  check (source in ('free', 'stripe', 'apple', 'google', 'admin', 'council', 'housing'));
alter table public.bin_user_entitlements
  drop constraint if exists bin_user_entitlements_plan_check;
alter table public.bin_user_entitlements
  add constraint bin_user_entitlements_plan_check
  check (plan_id in ('free', 'plus-monthly', 'plus-yearly', 'plus-lifetime', 'plus-sponsored'));

alter table public.bin_resident_support_threads
  drop constraint if exists bin_resident_support_threads_status_check;
alter table public.bin_resident_support_threads
  drop constraint if exists bin_resident_support_threads_resolved_check;
alter table public.bin_resident_support_threads
  add column if not exists assigned_staff_id uuid references auth.users (id) on delete set null,
  add column if not exists priority varchar(12) not null default 'normal',
  add column if not exists sla_due_at timestamptz,
  add column if not exists escalation_status varchar(20) not null default 'none',
  add column if not exists topic_tags varchar(40)[] not null default array[]::varchar[],
  add column if not exists linked_report_tracking_id uuid,
  add column if not exists linked_announcement_id uuid references public.bin_council_announcements (id) on delete set null,
  add column if not exists reopened_count integer not null default 0,
  add column if not exists reopen_reason varchar(500),
  add column if not exists first_responded_at timestamptz,
  add column if not exists satisfaction_score smallint;

alter table public.bin_resident_support_threads
  alter column status set default 'new';

update public.bin_resident_support_threads
set status = case
  when status = 'waiting-support' then 'new'
  when status = 'closed' then 'closed'
  else status
end;

alter table public.bin_resident_support_threads
  add constraint bin_resident_support_threads_status_check
  check (status in ('new', 'in-progress', 'waiting-resident', 'waiting-operations', 'resolved', 'closed'));
alter table public.bin_resident_support_threads
  add constraint bin_resident_support_threads_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));
alter table public.bin_resident_support_threads
  add constraint bin_resident_support_threads_escalation_check
  check (escalation_status in ('none', 'operations', 'platform', 'safeguarding'));
alter table public.bin_resident_support_threads
  add constraint bin_resident_support_threads_case_check
  check (
    cardinality(topic_tags) <= 20
    and reopened_count >= 0
    and (satisfaction_score is null or satisfaction_score between 1 and 5)
    and (
      (status in ('resolved', 'closed') and resolved_at is not null)
      or (status not in ('resolved', 'closed') and resolved_at is null)
    )
  );

alter table public.bin_resident_support_messages
  drop constraint if exists bin_resident_support_messages_sender_check;
alter table public.bin_resident_support_messages
  drop constraint if exists bin_resident_support_messages_sender_user_check;
alter table public.bin_resident_support_messages
  add column if not exists visibility varchar(16) not null default 'resident';
alter table public.bin_resident_support_messages
  add constraint bin_resident_support_messages_sender_check
  check (sender_kind in ('resident', 'support', 'internal'));
alter table public.bin_resident_support_messages
  add constraint bin_resident_support_messages_visibility_check
  check (
    visibility in ('resident', 'internal')
    and (sender_kind <> 'internal' or visibility = 'internal')
    and sender_user_id is not null
  );

create index if not exists bin_resident_support_threads_sla_idx
  on public.bin_resident_support_threads (council_provider_id, sla_due_at)
  where status not in ('resolved', 'closed') and sla_due_at is not null;
create index if not exists bin_resident_support_threads_assignee_idx
  on public.bin_resident_support_threads (assigned_staff_id, status, last_message_at desc)
  where assigned_staff_id is not null;

create table if not exists public.bin_support_saved_responses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.bin_council_organisations (id) on delete cascade,
  title varchar(120) not null,
  body text not null,
  topic_tags varchar(40)[] not null default array[]::varchar[],
  status varchar(16) not null default 'active',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_support_saved_responses_title_check check (length(trim(title)) between 2 and 120),
  constraint bin_support_saved_responses_body_check check (length(trim(body)) between 2 and 5000),
  constraint bin_support_saved_responses_tags_check check (cardinality(topic_tags) <= 20),
  constraint bin_support_saved_responses_status_check check (status in ('active', 'archived'))
);

create index if not exists bin_support_saved_responses_scope_idx
  on public.bin_support_saved_responses (organisation_id, status, title);

create table if not exists public.bin_council_demand_requests (
  council_id varchar(120) not null,
  installation_id uuid not null,
  notify_requested boolean not null default false,
  first_requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key (council_id, installation_id),
  constraint bin_council_demand_council_check check (council_id ~ '^lad-[ensw][0-9]{8}$'),
  constraint bin_council_demand_count_check check (request_count between 1 and 1000)
);

create index if not exists bin_council_demand_requests_council_idx
  on public.bin_council_demand_requests (council_id, notify_requested, last_requested_at desc);

alter table public.bin_council_partners
  add column if not exists supported_area_labels varchar(80)[] not null default array[]::varchar[],
  add column if not exists complaint_contact varchar(160),
  add column if not exists evidence_url varchar(500),
  add column if not exists budget_pence integer,
  add column if not exists immediate_suspension_reason varchar(500),
  add column if not exists renewal_review_at date;

create table if not exists public.bin_partner_conversion_events (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.bin_council_partners (id) on delete cascade,
  organisation_id uuid not null references public.bin_council_organisations (id) on delete cascade,
  installation_id uuid not null,
  event_name varchar(32) not null,
  referral_token_hash char(64),
  occurred_at timestamptz not null default now(),
  constraint bin_partner_conversion_event_check
    check (event_name in ('listing-viewed', 'website-opened', 'phone-tapped', 'directions-requested', 'booking-initiated', 'booking-confirmed')),
  constraint bin_partner_conversion_hash_check
    check (referral_token_hash is null or referral_token_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists bin_partner_conversion_events_partner_idx
  on public.bin_partner_conversion_events (partner_id, event_name, occurred_at desc);

create table if not exists public.bin_council_pilot_baselines (
  organisation_id uuid primary key references public.bin_council_organisations (id) on delete cascade,
  period_starts_on date not null,
  period_ends_on date not null,
  agreed_contact_cost_pence integer,
  resident_contacts integer,
  missed_collection_contacts integer,
  notes varchar(1000),
  updated_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint bin_council_pilot_baseline_window_check check (period_ends_on >= period_starts_on),
  constraint bin_council_pilot_baseline_values_check check (
    (agreed_contact_cost_pence is null or agreed_contact_cost_pence between 0 and 100000)
    and (resident_contacts is null or resident_contacts >= 0)
    and (missed_collection_contacts is null or missed_collection_contacts >= 0)
  )
);

create table if not exists public.bin_platform_incidents (
  id uuid primary key default gen_random_uuid(),
  component varchar(40) not null,
  status varchar(16) not null,
  title varchar(160) not null,
  detail varchar(1000) not null,
  council_provider_ids varchar(120)[] not null default array[]::varchar[],
  starts_at timestamptz not null,
  resolved_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_platform_incidents_component_check
    check (component in ('resident-app', 'council-gateway', 'push', 'accounts', 'council-console', 'partner-feeds')),
  constraint bin_platform_incidents_status_check check (status in ('investigating', 'identified', 'monitoring', 'resolved')),
  constraint bin_platform_incidents_title_check check (length(trim(title)) between 3 and 160),
  constraint bin_platform_incidents_window_check check (resolved_at is null or resolved_at >= starts_at)
);

create index if not exists bin_platform_incidents_status_idx
  on public.bin_platform_incidents (status, starts_at desc);

alter table public.bin_council_feature_flags enable row level security;
alter table public.bin_council_onboarding_items enable row level security;
alter table public.bin_sponsorship_programmes enable row level security;
alter table public.bin_support_saved_responses enable row level security;
alter table public.bin_council_demand_requests enable row level security;
alter table public.bin_partner_conversion_events enable row level security;
alter table public.bin_council_pilot_baselines enable row level security;
alter table public.bin_platform_incidents enable row level security;

revoke all on table public.bin_council_feature_flags from anon, authenticated;
revoke all on table public.bin_council_onboarding_items from anon, authenticated;
revoke all on table public.bin_sponsorship_programmes from anon, authenticated;
revoke all on table public.bin_support_saved_responses from anon, authenticated;
revoke all on table public.bin_council_demand_requests from anon, authenticated;
revoke all on table public.bin_partner_conversion_events from anon, authenticated;
revoke all on table public.bin_council_pilot_baselines from anon, authenticated;
revoke all on table public.bin_platform_incidents from anon, authenticated;

comment on table public.bin_council_feature_flags is
  'Per-authority capability switches. Resident surfaces must not advertise disabled council services.';
comment on table public.bin_council_demand_requests is
  'Deduplicated anonymous requests for an unsupported council. Stores no postcode, address, account or email.';
comment on table public.bin_partner_conversion_events is
  'Pseudonymous, event-level partner conversion evidence. Confirmed bookings require a partner callback or referral proof.';
comment on table public.bin_platform_incidents is
  'Public-status incident source controlled by platform administrators.';

-- Platform-superadmin CRM for council, sponsor and partner outreach.
--
-- This is deliberately separate from resident operations:
--   * it stores professional business-contact details only;
--   * it never stores resident addresses, collection reports or device data;
--   * access is enforced by the server from bin_council_platform_admins;
--   * public Data API roles receive no privileges;
--   * every mutation appends an immutable CRM audit event.

create table if not exists public.bin_crm_accounts (
  id uuid primary key default gen_random_uuid(),
  account_type varchar(24) not null,
  name varchar(180) not null,
  council_organisation_id uuid unique
    references public.bin_council_organisations (id) on delete set null,
  website_url varchar(500),
  stage varchar(24) not null default 'lead',
  annual_value_pence integer,
  summary varchar(2000),
  owner_user_id uuid references auth.users (id) on delete set null,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_crm_accounts_type_check
    check (account_type in ('council', 'sponsor', 'partner', 'enterprise')),
  constraint bin_crm_accounts_name_check
    check (length(trim(name)) between 2 and 180),
  constraint bin_crm_accounts_website_check
    check (website_url is null or website_url ~ '^https://'),
  constraint bin_crm_accounts_stage_check
    check (stage in ('lead', 'contacted', 'discovery', 'proposal', 'pilot', 'won', 'lost', 'paused')),
  constraint bin_crm_accounts_value_check
    check (annual_value_pence is null or annual_value_pence between 0 and 1000000000)
);

create index if not exists bin_crm_accounts_pipeline_idx
  on public.bin_crm_accounts (stage, next_follow_up_at, updated_at desc);
create index if not exists bin_crm_accounts_owner_idx
  on public.bin_crm_accounts (owner_user_id, stage);

create table if not exists public.bin_crm_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bin_crm_accounts (id) on delete cascade,
  full_name varchar(160) not null,
  job_title varchar(160),
  professional_email varchar(254),
  professional_phone varchar(40),
  linkedin_url varchar(500),
  preferred_channel varchar(24) not null default 'email',
  lawful_basis varchar(32) not null default 'legitimate-interests',
  source varchar(200) not null,
  do_not_contact boolean not null default false,
  retention_review_at date not null default (current_date + interval '24 months'),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, id),
  constraint bin_crm_contacts_name_check
    check (length(trim(full_name)) between 2 and 160),
  constraint bin_crm_contacts_email_check
    check (
      professional_email is null
      or (
        length(professional_email) between 3 and 254
        and professional_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  constraint bin_crm_contacts_linkedin_check
    check (linkedin_url is null or linkedin_url ~ '^https://'),
  constraint bin_crm_contacts_channel_check
    check (preferred_channel in ('email', 'phone', 'linkedin', 'meeting', 'none')),
  constraint bin_crm_contacts_lawful_basis_check
    check (lawful_basis in ('legitimate-interests', 'consent', 'contract', 'public-task')),
  constraint bin_crm_contacts_source_check
    check (length(trim(source)) between 2 and 200)
);

create index if not exists bin_crm_contacts_account_idx
  on public.bin_crm_contacts (account_id, do_not_contact, full_name);
create index if not exists bin_crm_contacts_retention_idx
  on public.bin_crm_contacts (retention_review_at);

create table if not exists public.bin_crm_activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bin_crm_accounts (id) on delete cascade,
  contact_id uuid,
  kind varchar(24) not null,
  direction varchar(16) not null default 'internal',
  subject varchar(180) not null,
  summary varchar(3000) not null,
  occurred_at timestamptz not null default now(),
  next_step varchar(500),
  next_follow_up_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint bin_crm_activities_contact_fk
    foreign key (account_id, contact_id)
    references public.bin_crm_contacts (account_id, id)
    on delete set null (contact_id),
  constraint bin_crm_activities_kind_check
    check (kind in ('email', 'call', 'meeting', 'note', 'proposal', 'demo', 'task-update')),
  constraint bin_crm_activities_direction_check
    check (direction in ('inbound', 'outbound', 'internal')),
  constraint bin_crm_activities_subject_check
    check (length(trim(subject)) between 2 and 180),
  constraint bin_crm_activities_summary_check
    check (length(trim(summary)) between 2 and 3000)
);

create index if not exists bin_crm_activities_account_idx
  on public.bin_crm_activities (account_id, occurred_at desc);
create index if not exists bin_crm_activities_follow_up_idx
  on public.bin_crm_activities (next_follow_up_at)
  where next_follow_up_at is not null;

create table if not exists public.bin_crm_tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bin_crm_accounts (id) on delete cascade,
  contact_id uuid,
  title varchar(200) not null,
  due_at timestamptz,
  priority varchar(16) not null default 'normal',
  status varchar(20) not null default 'open',
  completed_at timestamptz,
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_crm_tasks_contact_fk
    foreign key (account_id, contact_id)
    references public.bin_crm_contacts (account_id, id)
    on delete set null (contact_id),
  constraint bin_crm_tasks_title_check
    check (length(trim(title)) between 2 and 200),
  constraint bin_crm_tasks_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint bin_crm_tasks_status_check
    check (status in ('open', 'in-progress', 'completed', 'cancelled')),
  constraint bin_crm_tasks_completion_check
    check (
      (status = 'completed' and completed_at is not null)
      or (status <> 'completed' and completed_at is null)
    )
);

create index if not exists bin_crm_tasks_due_idx
  on public.bin_crm_tasks (status, due_at, priority)
  where status in ('open', 'in-progress');
create index if not exists bin_crm_tasks_account_idx
  on public.bin_crm_tasks (account_id, status, due_at);

create table if not exists public.bin_crm_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  action varchar(80) not null,
  entity_type varchar(60) not null,
  entity_id uuid,
  summary jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint bin_crm_audit_action_check
    check (action ~ '^[a-z0-9][a-z0-9.-]{2,79}$'),
  constraint bin_crm_audit_entity_check
    check (entity_type ~ '^[a-z0-9][a-z0-9_-]{1,59}$'),
  constraint bin_crm_audit_summary_check
    check (jsonb_typeof(summary) = 'object')
);

create index if not exists bin_crm_audit_logs_time_idx
  on public.bin_crm_audit_logs (occurred_at desc);
create index if not exists bin_crm_audit_logs_actor_idx
  on public.bin_crm_audit_logs (actor_user_id, occurred_at desc);

drop trigger if exists bin_crm_audit_immutable
  on public.bin_crm_audit_logs;
create trigger bin_crm_audit_immutable
  before update or delete on public.bin_crm_audit_logs
  for each row execute function public.bin_prevent_council_audit_mutation();

alter table public.bin_crm_accounts enable row level security;
alter table public.bin_crm_contacts enable row level security;
alter table public.bin_crm_activities enable row level security;
alter table public.bin_crm_tasks enable row level security;
alter table public.bin_crm_audit_logs enable row level security;

revoke all on table public.bin_crm_accounts from anon, authenticated;
revoke all on table public.bin_crm_contacts from anon, authenticated;
revoke all on table public.bin_crm_activities from anon, authenticated;
revoke all on table public.bin_crm_tasks from anon, authenticated;
revoke all on table public.bin_crm_audit_logs from anon, authenticated;

comment on table public.bin_crm_accounts is
  'Platform-superadmin business accounts for council, sponsor, partner and enterprise outreach.';
comment on table public.bin_crm_contacts is
  'Professional CRM contacts with lawful basis, source, suppression and retention-review controls.';
comment on table public.bin_crm_activities is
  'Platform-superadmin conversation history. Resident service interactions never enter this table.';
comment on table public.bin_crm_tasks is
  'Platform-superadmin follow-ups and commercial relationship tasks.';
comment on table public.bin_crm_audit_logs is
  'Append-only audit evidence for CRM mutations; excludes conversation bodies and contact details.';

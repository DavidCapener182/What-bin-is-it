-- Provider-neutral CRM correspondence centre.
--
-- Exact business correspondence is stored separately from resident operations.
-- OAuth tokens are never stored in these tables; a future Gmail or Outlook
-- connector may reference an approved server secret and use external IDs for
-- idempotent synchronisation.

create table if not exists public.bin_crm_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bin_crm_accounts (id) on delete cascade,
  contact_id uuid,
  channel varchar(20) not null,
  subject varchar(300) not null,
  status varchar(20) not null default 'open',
  external_thread_id varchar(500),
  last_message_at timestamptz,
  last_direction varchar(16),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id),
  constraint bin_crm_threads_contact_fk
    foreign key (account_id, contact_id)
    references public.bin_crm_contacts (account_id, id)
    on delete set null (contact_id),
  constraint bin_crm_threads_channel_check
    check (channel in ('email', 'phone', 'sms', 'linkedin', 'meeting', 'note')),
  constraint bin_crm_threads_subject_check
    check (length(trim(subject)) between 1 and 300),
  constraint bin_crm_threads_status_check
    check (status in ('open', 'waiting', 'closed', 'archived')),
  constraint bin_crm_threads_direction_check
    check (last_direction is null or last_direction in ('sent', 'received', 'internal'))
);

create unique index if not exists bin_crm_threads_external_idx
  on public.bin_crm_threads (channel, external_thread_id)
  where external_thread_id is not null;
create index if not exists bin_crm_threads_account_idx
  on public.bin_crm_threads (account_id, last_message_at desc);
create index if not exists bin_crm_threads_status_idx
  on public.bin_crm_threads (status, last_message_at desc);

create table if not exists public.bin_crm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  account_id uuid not null references public.bin_crm_accounts (id) on delete cascade,
  contact_id uuid,
  direction varchar(16) not null,
  channel varchar(20) not null,
  sender_address varchar(320),
  recipient_addresses varchar(320)[] not null default array[]::varchar[],
  subject varchar(300) not null,
  body text not null,
  occurred_at timestamptz not null default now(),
  delivery_status varchar(20) not null,
  external_message_id varchar(500),
  in_reply_to_external_id varchar(500),
  attachment_names varchar(200)[] not null default array[]::varchar[],
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint bin_crm_messages_thread_fk
    foreign key (thread_id, account_id)
    references public.bin_crm_threads (id, account_id)
    on delete cascade,
  constraint bin_crm_messages_contact_fk
    foreign key (account_id, contact_id)
    references public.bin_crm_contacts (account_id, id)
    on delete set null (contact_id),
  constraint bin_crm_messages_direction_check
    check (direction in ('sent', 'received', 'internal')),
  constraint bin_crm_messages_channel_check
    check (channel in ('email', 'phone', 'sms', 'linkedin', 'meeting', 'note')),
  constraint bin_crm_messages_recipients_check
    check (cardinality(recipient_addresses) <= 25),
  constraint bin_crm_messages_subject_check
    check (length(trim(subject)) between 1 and 300),
  constraint bin_crm_messages_body_check
    check (length(trim(body)) between 1 and 20000),
  constraint bin_crm_messages_delivery_check
    check (delivery_status in ('draft', 'sent', 'delivered', 'received', 'read', 'failed')),
  constraint bin_crm_messages_attachments_check
    check (cardinality(attachment_names) <= 25)
);

create unique index if not exists bin_crm_messages_external_idx
  on public.bin_crm_messages (channel, external_message_id)
  where external_message_id is not null;
create index if not exists bin_crm_messages_thread_idx
  on public.bin_crm_messages (thread_id, occurred_at);
create index if not exists bin_crm_messages_account_idx
  on public.bin_crm_messages (account_id, occurred_at desc);
create index if not exists bin_crm_messages_direction_idx
  on public.bin_crm_messages (direction, occurred_at desc);

create table if not exists public.bin_crm_mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  provider varchar(20) not null,
  mailbox_email varchar(254) not null,
  status varchar(20) not null default 'disconnected',
  credential_secret_ref varchar(160),
  external_account_id varchar(500),
  sync_cursor text,
  last_synced_at timestamptz,
  last_error_code varchar(120),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, mailbox_email),
  constraint bin_crm_mailbox_provider_check
    check (provider in ('gmail', 'outlook')),
  constraint bin_crm_mailbox_email_check
    check (
      length(mailbox_email) between 3 and 254
      and mailbox_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint bin_crm_mailbox_status_check
    check (status in ('disconnected', 'pending', 'active', 'error', 'revoked')),
  constraint bin_crm_mailbox_secret_check
    check (
      credential_secret_ref is null
      or credential_secret_ref ~ '^BIN_CRM_[A-Z0-9_]{3,140}$'
    )
);

create index if not exists bin_crm_mailbox_status_idx
  on public.bin_crm_mailbox_connections (status, last_synced_at);

alter table public.bin_crm_threads enable row level security;
alter table public.bin_crm_messages enable row level security;
alter table public.bin_crm_mailbox_connections enable row level security;

revoke all on table public.bin_crm_threads from anon, authenticated;
revoke all on table public.bin_crm_messages from anon, authenticated;
revoke all on table public.bin_crm_mailbox_connections from anon, authenticated;

comment on table public.bin_crm_threads is
  'Platform-superadmin correspondence threads grouped by business relationship.';
comment on table public.bin_crm_messages is
  'Sent, received and internal business correspondence; never resident service records.';
comment on table public.bin_crm_mailbox_connections is
  'Mailbox sync state and server-secret references only. OAuth tokens must live in an approved secret store.';

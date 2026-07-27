-- Private, in-app resident support conversations.
--
-- These records deliberately contain no saved address, postcode or email
-- fields. The resident account id provides ownership, while an optional
-- council provider id lets the platform route and report support demand.
-- All access goes through the authenticated server and council back office.

create table if not exists public.bin_resident_support_threads (
  id uuid primary key default gen_random_uuid(),
  resident_user_id uuid not null references auth.users (id) on delete cascade,
  council_provider_id varchar(120),
  council_name varchar(160),
  topic varchar(32) not null,
  subject varchar(160) not null,
  status varchar(24) not null default 'waiting-support',
  last_sender varchar(16) not null default 'resident',
  last_message_at timestamptz not null default now(),
  client_request_id uuid not null,
  resolved_at timestamptz,
  retention_review_at timestamptz not null default (now() + interval '24 months'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_user_id, client_request_id),
  constraint bin_resident_support_threads_topic_check
    check (
      topic in (
        'app-help',
        'notifications',
        'address',
        'accessibility',
        'app-problem',
        'guide-item',
        'other'
      )
    ),
  constraint bin_resident_support_threads_subject_check
    check (length(trim(subject)) between 1 and 160),
  constraint bin_resident_support_threads_status_check
    check (status in ('waiting-support', 'waiting-resident', 'closed')),
  constraint bin_resident_support_threads_sender_check
    check (last_sender in ('resident', 'support')),
  constraint bin_resident_support_threads_council_check
    check (
      (council_provider_id is null and council_name is null)
      or (
        council_provider_id ~ '^lad-[ensw][0-9]{8}$'
        and length(trim(council_name)) between 1 and 160
      )
    ),
  constraint bin_resident_support_threads_resolved_check
    check (
      (status = 'closed' and resolved_at is not null)
      or (status <> 'closed' and resolved_at is null)
    )
);

create index if not exists bin_resident_support_threads_status_idx
  on public.bin_resident_support_threads (status, last_message_at desc);
create index if not exists bin_resident_support_threads_resident_idx
  on public.bin_resident_support_threads (resident_user_id, last_message_at desc);
create index if not exists bin_resident_support_threads_council_idx
  on public.bin_resident_support_threads (council_provider_id, last_message_at desc)
  where council_provider_id is not null;
create index if not exists bin_resident_support_threads_retention_idx
  on public.bin_resident_support_threads (retention_review_at);

create table if not exists public.bin_resident_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.bin_resident_support_threads (id) on delete cascade,
  sender_kind varchar(16) not null,
  sender_user_id uuid references auth.users (id) on delete set null,
  body text not null,
  client_message_id uuid,
  created_at timestamptz not null default now(),
  constraint bin_resident_support_messages_sender_check
    check (sender_kind in ('resident', 'support')),
  constraint bin_resident_support_messages_body_check
    check (length(trim(body)) between 1 and 5000),
  constraint bin_resident_support_messages_sender_user_check
    check (
      (sender_kind = 'resident' and sender_user_id is not null)
      or sender_kind = 'support'
    )
);

create unique index if not exists bin_resident_support_messages_client_idx
  on public.bin_resident_support_messages (thread_id, client_message_id)
  where client_message_id is not null;
create index if not exists bin_resident_support_messages_thread_idx
  on public.bin_resident_support_messages (thread_id, created_at, id);

alter table public.bin_resident_support_threads enable row level security;
alter table public.bin_resident_support_messages enable row level security;

revoke all on table public.bin_resident_support_threads from anon, authenticated;
revoke all on table public.bin_resident_support_messages from anon, authenticated;

comment on table public.bin_resident_support_threads is
  'Private in-app support threads owned by a resident account; no postcode, address or email is copied here.';
comment on table public.bin_resident_support_messages is
  'Messages exchanged inside What Bin between a resident and authorised support staff.';

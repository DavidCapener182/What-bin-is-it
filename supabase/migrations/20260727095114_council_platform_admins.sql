-- Explicit platform-level administrators for the private council console.
--
-- These records are server-authoritative and are never inferred from an email
-- domain, Supabase user metadata or a resident account plan.

create table if not exists public.bin_council_platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  status varchar(16) not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_council_platform_admins_status_check
    check (status in ('active', 'suspended', 'ended'))
);

create index if not exists bin_council_platform_admins_status_idx
  on public.bin_council_platform_admins (status, user_id);

alter table public.bin_council_platform_admins enable row level security;
revoke all on table public.bin_council_platform_admins from anon, authenticated;

alter table public.bin_council_organisations
  alter column secondary_colour set default '#636366';

comment on table public.bin_council_platform_admins is
  'Explicit server-authoritative platform superadmins who can enter every active council tenant.';

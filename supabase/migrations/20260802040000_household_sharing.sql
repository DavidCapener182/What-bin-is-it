-- Opt-in household coordination for What Bin Plus.
-- No address, postcode, council property reference or collection-round token is
-- stored. Members share only a household nickname, council provider and the
-- collection actions they explicitly record.

create table if not exists public.bin_households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  council_provider_id varchar(120) not null,
  display_name varchar(80) not null,
  status varchar(16) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bin_households_provider_check check (council_provider_id ~ '^lad-[ensw][0-9]{8}$'),
  constraint bin_households_name_check check (length(trim(display_name)) between 2 and 80),
  constraint bin_households_status_check check (status in ('active', 'archived')),
  unique (owner_user_id, council_provider_id)
);

create table if not exists public.bin_household_members (
  household_id uuid not null references public.bin_households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name varchar(60) not null,
  role varchar(16) not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  constraint bin_household_members_name_check check (length(trim(display_name)) between 1 and 60),
  constraint bin_household_members_role_check check (role in ('owner', 'member'))
);

create table if not exists public.bin_household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.bin_households (id) on delete cascade,
  token_hash char(64) not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  max_uses smallint not null default 10,
  uses smallint not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bin_household_invites_usage_check check (max_uses between 1 and 25 and uses between 0 and max_uses),
  constraint bin_household_invites_expiry_check check (expires_at > created_at)
);

create table if not exists public.bin_household_collection_actions (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.bin_households (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  responsible_user_id uuid references auth.users (id) on delete set null,
  collection_date date not null,
  waste_type varchar(20) not null,
  action varchar(20) not null,
  occurred_at timestamptz not null default now(),
  constraint bin_household_actions_waste_check check (waste_type in ('general', 'recycling', 'garden', 'food', 'other')),
  constraint bin_household_actions_action_check check (action in ('assigned', 'put-out', 'collected', 'missed', 'brought-in'))
);

create index if not exists bin_household_members_user_idx
  on public.bin_household_members (user_id, joined_at desc);
create index if not exists bin_household_actions_household_idx
  on public.bin_household_collection_actions (household_id, collection_date desc, occurred_at desc);
create index if not exists bin_household_invites_live_idx
  on public.bin_household_invites (household_id, expires_at)
  where revoked_at is null;

alter table public.bin_households enable row level security;
alter table public.bin_household_members enable row level security;
alter table public.bin_household_invites enable row level security;
alter table public.bin_household_collection_actions enable row level security;

revoke all on table public.bin_households from anon, authenticated;
revoke all on table public.bin_household_members from anon, authenticated;
revoke all on table public.bin_household_invites from anon, authenticated;
revoke all on table public.bin_household_collection_actions from anon, authenticated;

comment on table public.bin_households is
  'Opt-in household coordination. Stores a nickname and council only; never an address, postcode or property reference.';
comment on table public.bin_household_collection_actions is
  'Member-authored bin responsibility and outcome actions scoped to collection date and waste type.';

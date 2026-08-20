-- Product-scoped suppression for residents who remove their What Bin data.
--
-- The Supabase Auth identity is intentionally retained because it is shared
-- with other products. This minimal marker prevents delayed billing webhooks
-- from silently recreating What Bin grants after product-data removal.

create table if not exists public.bin_account_removal_suppressions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  removed_at timestamptz not null default now()
);

alter table public.bin_account_removal_suppressions enable row level security;
revoke all on table public.bin_account_removal_suppressions from anon, authenticated;

-- Keep each checkout intent independently so opening checkout B cannot make a
-- paid checkout A ineligible. Deleting the suppression marker atomically
-- consumes every pending intent after one verified purchase restores access.
create table if not exists public.bin_account_re_enrolment_intents (
  user_id uuid not null references public.bin_account_removal_suppressions (user_id) on delete cascade,
  source varchar(16) not null,
  intent_key char(64) not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  primary key (user_id, source, intent_key),
  constraint bin_account_re_enrolment_intents_source_check
    check (source in ('native', 'stripe')),
  constraint bin_account_re_enrolment_intents_expiry_check
    check (expires_at > requested_at and expires_at <= requested_at + interval '30 minutes')
);

create index if not exists bin_account_re_enrolment_intents_expiry_idx
  on public.bin_account_re_enrolment_intents (expires_at);

alter table public.bin_account_re_enrolment_intents enable row level security;
revoke all on table public.bin_account_re_enrolment_intents from anon, authenticated;

-- All resident writes now go through the server. Removing the historical
-- direct insert grant also ensures the invoker-rights guard never needs to
-- expose the suppression table to an authenticated browser role.
revoke insert on table public.bin_user_entitlements from authenticated;

comment on table public.bin_account_removal_suppressions is
  'Minimal What Bin-only removal marker. Blocks every resident user-reference write until a verified provider event completes explicit re-enrolment; it never triggers deletion of the shared Auth identity.';

comment on table public.bin_account_re_enrolment_intents is
  'Short-lived What Bin re-enrolment intents. An intent does not clear removal suppression; a matching verified successful provider event consumes it atomically.';

create or replace function public.bin_purge_expired_account_re_enrolment_intents()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  deleted_count bigint;
begin
  delete from public.bin_account_re_enrolment_intents
  where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function public.bin_purge_expired_account_re_enrolment_intents()
  from public, anon, authenticated;

comment on function public.bin_purge_expired_account_re_enrolment_intents() is
  'Private maintenance hook that removes expired hashed What Bin re-enrolment intents.';

create or replace function public.bin_guard_removed_account_references()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  column_name text;
  candidate_text text;
  candidate_user uuid;
  referenced_users uuid[] := array[]::uuid[];
begin
  foreach column_name in array tg_argv loop
    candidate_text := to_jsonb(new) ->> column_name;
    if candidate_text is not null and candidate_text <> '' then
      candidate_user := candidate_text::uuid;
      referenced_users := array_append(referenced_users, candidate_user);
    end if;
  end loop;

  for candidate_user in
    select distinct item
    from unnest(referenced_users) as refs(item)
    order by item
  loop
    perform pg_advisory_xact_lock(hashtext(candidate_user::text));
    if exists (
      select 1
      from public.bin_account_removal_suppressions
      where user_id = candidate_user
    ) then
      raise exception using
        errcode = '23514',
        message = 'What Bin account data has been removed; explicit verified re-enrolment is required.';
    end if;
  end loop;
  return new;
end;
$function$;

revoke all on function public.bin_guard_removed_account_references() from public, anon, authenticated;

drop trigger if exists bin_guard_removed_user_entitlements on public.bin_user_entitlements;
create trigger bin_guard_removed_user_entitlements
  before insert or update on public.bin_user_entitlements
  for each row execute function public.bin_guard_removed_account_references('user_id');

drop trigger if exists bin_guard_removed_entitlement_grants on public.bin_entitlement_grants;
create trigger bin_guard_removed_entitlement_grants
  before insert or update on public.bin_entitlement_grants
  for each row execute function public.bin_guard_removed_account_references('user_id');

drop trigger if exists bin_guard_removed_supporters on public.bin_supporters;
create trigger bin_guard_removed_supporters
  before insert or update on public.bin_supporters
  for each row execute function public.bin_guard_removed_account_references('user_id');

drop trigger if exists bin_guard_removed_revenuecat_events on public.bin_revenuecat_events;
create trigger bin_guard_removed_revenuecat_events
  before insert or update on public.bin_revenuecat_events
  for each row execute function public.bin_guard_removed_account_references('user_id');

drop trigger if exists bin_guard_removed_support_threads on public.bin_resident_support_threads;
create trigger bin_guard_removed_support_threads
  before insert or update on public.bin_resident_support_threads
  for each row execute function public.bin_guard_removed_account_references('resident_user_id');

drop trigger if exists bin_guard_removed_support_messages on public.bin_resident_support_messages;
create trigger bin_guard_removed_support_messages
  before insert or update on public.bin_resident_support_messages
  for each row execute function public.bin_guard_removed_account_references('sender_user_id');

drop trigger if exists bin_guard_removed_households on public.bin_households;
create trigger bin_guard_removed_households
  before insert or update on public.bin_households
  for each row execute function public.bin_guard_removed_account_references('owner_user_id');

drop trigger if exists bin_guard_removed_household_members on public.bin_household_members;
create trigger bin_guard_removed_household_members
  before insert or update on public.bin_household_members
  for each row execute function public.bin_guard_removed_account_references('user_id');

drop trigger if exists bin_guard_removed_household_invites on public.bin_household_invites;
create trigger bin_guard_removed_household_invites
  before insert or update on public.bin_household_invites
  for each row execute function public.bin_guard_removed_account_references('created_by');

drop trigger if exists bin_guard_removed_household_actions on public.bin_household_collection_actions;
create trigger bin_guard_removed_household_actions
  before insert or update on public.bin_household_collection_actions
  for each row execute function public.bin_guard_removed_account_references(
    'actor_user_id',
    'responsible_user_id'
  );

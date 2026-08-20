-- Release-security state and maintenance scheduling.
--
-- This migration is intentionally safe to re-run. It keeps all abuse-control
-- identities one-way hashed, gives them short retention, uses qualified cron
-- commands, and never exposes maintenance functions through the Data API.

alter table public.bin_entitlement_grants
  add column if not exists provider_event_order integer not null default 0;

alter table public.bin_entitlement_grants
  drop constraint if exists bin_entitlement_grants_provider_event_order_check;
alter table public.bin_entitlement_grants
  add constraint bin_entitlement_grants_provider_event_order_check
  check (provider_event_order between 0 and 10000);

comment on column public.bin_entitlement_grants.provider_event_order is
  'Provider-specific lifecycle or authoritative-snapshot priority used with provider_event_at for conservative equal-timestamp ordering; provider event IDs are identifiers, not clocks.';

-- Earlier builds quarantined TRANSFER events because the operation was not
-- atomic. Allow an authenticated provider replay to retry them after the
-- atomic two-sided transfer processor is deployed. No payload is retained.
update public.bin_revenuecat_events
set outcome = 'failed'
where event_type = 'TRANSFER'
  and outcome = 'transfer-blocked';

create table if not exists public.bin_api_rate_limits (
  scope varchar(80) not null,
  identity_hash char(64) not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (scope, identity_hash),
  constraint bin_api_rate_limits_scope_check
    check (scope ~ '^[a-z0-9][a-z0-9:_-]{0,79}$'),
  constraint bin_api_rate_limits_hash_check
    check (identity_hash ~ '^[0-9a-f]{64}$'),
  constraint bin_api_rate_limits_count_check
    check (request_count between 1 and 100000),
  constraint bin_api_rate_limits_expiry_check
    check (expires_at > window_started_at)
);

create index if not exists bin_api_rate_limits_expiry_idx
  on public.bin_api_rate_limits (expires_at);

alter table public.bin_api_rate_limits enable row level security;
revoke all on table public.bin_api_rate_limits from anon, authenticated;

comment on table public.bin_api_rate_limits is
  'Private short-lived fixed-window abuse counters. identity_hash is a server-keyed HMAC; no IP address, account identifier or client identifier is stored.';

create table if not exists public.bin_gateway_circuit_breakers (
  provider_key varchar(160) primary key,
  consecutive_failures integer not null default 0,
  open_until timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  updated_at timestamptz not null default now(),
  constraint bin_gateway_circuit_provider_check
    check (provider_key ~ '^[a-z0-9][a-z0-9:._-]{0,159}$'),
  constraint bin_gateway_circuit_failures_check
    check (consecutive_failures between 0 and 100000),
  constraint bin_gateway_circuit_expiry_check
    check (expires_at > updated_at)
);

create index if not exists bin_gateway_circuit_expiry_idx
  on public.bin_gateway_circuit_breakers (expires_at);

alter table public.bin_gateway_circuit_breakers enable row level security;
revoke all on table public.bin_gateway_circuit_breakers from anon, authenticated;

comment on table public.bin_gateway_circuit_breakers is
  'Private short-lived upstream health state used to stop repeated calls to a failing council provider.';

create or replace function public.bin_consume_api_rate_limit(
  p_scope text,
  p_identity_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_time timestamptz := clock_timestamp();
  current_row public.bin_api_rate_limits%rowtype;
begin
  if p_scope !~ '^[a-z0-9][a-z0-9:_-]{0,79}$'
     or p_identity_hash !~ '^[0-9a-f]{64}$'
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'Invalid API rate-limit parameters.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_identity_hash, 0));

  select * into current_row
  from public.bin_api_rate_limits
  where scope = p_scope and identity_hash = p_identity_hash
  for update;

  if current_row.scope is null or current_row.expires_at <= current_time then
    insert into public.bin_api_rate_limits (
      scope, identity_hash, window_started_at, request_count, expires_at, updated_at
    ) values (
      p_scope,
      p_identity_hash,
      current_time,
      1,
      current_time + make_interval(secs => p_window_seconds),
      current_time
    )
    on conflict (scope, identity_hash) do update set
      window_started_at = excluded.window_started_at,
      request_count = 1,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;
    return query select true, 0;
    return;
  end if;

  if current_row.request_count >= p_limit then
    return query select
      false,
      greatest(1, ceil(extract(epoch from current_row.expires_at - current_time))::integer);
    return;
  end if;

  update public.bin_api_rate_limits
  set request_count = request_count + 1, updated_at = current_time
  where scope = p_scope and identity_hash = p_identity_hash;
  return query select true, 0;
end;
$function$;

revoke all on function public.bin_consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;

create or replace function public.bin_gateway_circuit_open(p_provider_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_provider_key !~ '^[a-z0-9][a-z0-9:._-]{0,159}$' then
    raise exception using errcode = '22023', message = 'Invalid gateway provider key.';
  end if;
  return coalesce((
    select open_until > clock_timestamp()
    from public.bin_gateway_circuit_breakers
    where provider_key = p_provider_key
      and expires_at > clock_timestamp()
  ), false);
end;
$function$;

revoke all on function public.bin_gateway_circuit_open(text)
  from public, anon, authenticated;

create or replace function public.bin_record_gateway_upstream_result(
  p_provider_key text,
  p_succeeded boolean,
  p_failure_threshold integer default 5,
  p_open_seconds integer default 120
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_time timestamptz := clock_timestamp();
begin
  if p_provider_key !~ '^[a-z0-9][a-z0-9:._-]{0,159}$'
     or p_failure_threshold < 1 or p_failure_threshold > 100
     or p_open_seconds < 1 or p_open_seconds > 3600 then
    raise exception using errcode = '22023', message = 'Invalid gateway circuit parameters.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('gateway-circuit:' || p_provider_key, 0));

  if p_succeeded then
    insert into public.bin_gateway_circuit_breakers (
      provider_key, consecutive_failures, open_until, expires_at, updated_at
    ) values (p_provider_key, 0, null, current_time + interval '24 hours', current_time)
    on conflict (provider_key) do update set
      consecutive_failures = 0,
      open_until = null,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;
  else
    insert into public.bin_gateway_circuit_breakers (
      provider_key, consecutive_failures, open_until, expires_at, updated_at
    ) values (
      p_provider_key,
      1,
      case when p_failure_threshold = 1
        then current_time + make_interval(secs => p_open_seconds)
        else null end,
      current_time + interval '24 hours',
      current_time
    )
    on conflict (provider_key) do update set
      consecutive_failures = public.bin_gateway_circuit_breakers.consecutive_failures + 1,
      open_until = case
        when public.bin_gateway_circuit_breakers.consecutive_failures + 1 >= p_failure_threshold
          then current_time + make_interval(secs => p_open_seconds)
        else public.bin_gateway_circuit_breakers.open_until
      end,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;
  end if;
end;
$function$;

revoke all on function public.bin_record_gateway_upstream_result(text, boolean, integer, integer)
  from public, anon, authenticated;

create or replace function public.bin_purge_expired_api_security_state()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  deleted_count bigint := 0;
  affected_count bigint := 0;
begin
  delete from public.bin_api_rate_limits where expires_at <= now();
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;
  delete from public.bin_gateway_circuit_breakers where expires_at <= now();
  get diagnostics affected_count = row_count;
  return deleted_count + affected_count;
end;
$function$;

revoke all on function public.bin_purge_expired_api_security_state()
  from public, anon, authenticated;

-- Supabase's supported pg_cron API is cron.schedule/cron.unschedule. Named
-- schedules are upserted by cron.schedule; do not update cron.job directly.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'what-bin-purge-data-quality',
  '17 3 * * *',
  $cron$select public.bin_purge_expired_data_quality_reports();$cron$
);

select cron.schedule(
  'what-bin-purge-re-enrolment-intents',
  '7 * * * *',
  $cron$select public.bin_purge_expired_account_re_enrolment_intents();$cron$
);

select cron.schedule(
  'what-bin-purge-api-security-state',
  '47 3 * * *',
  $cron$select public.bin_purge_expired_api_security_state();$cron$
);

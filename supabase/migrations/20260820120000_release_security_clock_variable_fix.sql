-- PostgreSQL parses CURRENT_TIME as a SQL value even when a PL/pgSQL variable
-- has the same spelling. Use an unambiguous variable name in the two release
-- security functions that compare or persist timestamptz values.

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
  v_now timestamptz := clock_timestamp();
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

  if current_row.scope is null or current_row.expires_at <= v_now then
    insert into public.bin_api_rate_limits (
      scope, identity_hash, window_started_at, request_count, expires_at, updated_at
    ) values (
      p_scope,
      p_identity_hash,
      v_now,
      1,
      v_now + make_interval(secs => p_window_seconds),
      v_now
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
      greatest(1, ceil(extract(epoch from current_row.expires_at - v_now))::integer);
    return;
  end if;

  update public.bin_api_rate_limits
  set request_count = request_count + 1, updated_at = v_now
  where scope = p_scope and identity_hash = p_identity_hash;
  return query select true, 0;
end;
$function$;

revoke all on function public.bin_consume_api_rate_limit(text, text, integer, integer)
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
  v_now timestamptz := clock_timestamp();
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
    ) values (p_provider_key, 0, null, v_now + interval '24 hours', v_now)
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
        then v_now + make_interval(secs => p_open_seconds)
        else null end,
      v_now + interval '24 hours',
      v_now
    )
    on conflict (provider_key) do update set
      consecutive_failures = public.bin_gateway_circuit_breakers.consecutive_failures + 1,
      open_until = case
        when public.bin_gateway_circuit_breakers.consecutive_failures + 1 >= p_failure_threshold
          then v_now + make_interval(secs => p_open_seconds)
        else public.bin_gateway_circuit_breakers.open_until
      end,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;
  end if;
end;
$function$;

revoke all on function public.bin_record_gateway_upstream_result(text, boolean, integer, integer)
  from public, anon, authenticated;

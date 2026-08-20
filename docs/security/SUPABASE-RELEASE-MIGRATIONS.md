# Supabase release-security migration runbook

Apply these reviewed migrations to the configured production project in this exact order before deploying server code that reads the new tables or `provider_event_order` column:

1. `20260819090000_private_data_quality_queue.sql`
2. `20260819234500_what_bin_removal_suppression.sql`
3. `20260820103000_release_security_maintenance.sql`
4. `20260820120000_release_security_clock_variable_fix.sql`

The third migration installs `pg_cron` when needed, grants the migration owner access to the `cron` schema, and upserts three named schedules through `cron.schedule`. Do not edit `cron.job` directly. Applying SQL and changing live deployment flags are separate operations; keep the nationwide fallback and all payment flags false during this readback.

## Required live readback

Run each query through an authenticated administrative SQL connection immediately after applying all four migrations. Treat a missing row, `false` privilege assertion, inactive job or different command as a failed release gate.

```sql
select
  to_regclass('public.bin_data_quality_reports') is not null as data_quality_table,
  to_regclass('public.bin_account_removal_suppressions') is not null as suppression_table,
  to_regclass('public.bin_account_re_enrolment_intents') is not null as re_enrolment_table,
  to_regclass('public.bin_api_rate_limits') is not null as rate_limit_table,
  to_regclass('public.bin_gateway_circuit_breakers') is not null as circuit_table;
```

Expected: one row with all five values `true`.

```sql
select table_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'bin_entitlement_grants'
  and column_name = 'provider_event_order';
```

Expected: one row, `is_nullable = 'NO'`, with a default equivalent to `0`.

```sql
select c.relname, c.relrowsecurity,
  not (
    has_table_privilege('anon', c.oid, 'SELECT')
    or has_table_privilege('anon', c.oid, 'INSERT')
    or has_table_privilege('anon', c.oid, 'UPDATE')
    or has_table_privilege('anon', c.oid, 'DELETE')
  ) as anon_blocked,
  not (
    has_table_privilege('authenticated', c.oid, 'SELECT')
    or has_table_privilege('authenticated', c.oid, 'INSERT')
    or has_table_privilege('authenticated', c.oid, 'UPDATE')
    or has_table_privilege('authenticated', c.oid, 'DELETE')
  ) as authenticated_blocked
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'bin_data_quality_reports',
    'bin_account_removal_suppressions',
    'bin_account_re_enrolment_intents',
    'bin_api_rate_limits',
    'bin_gateway_circuit_breakers'
  )
order by c.relname;
```

Expected: five rows with `relrowsecurity`, `anon_blocked` and `authenticated_blocked` all `true`.

```sql
select p.proname, p.prosecdef,
  exists (
    select 1
    from unnest(coalesce(p.proconfig, array[]::text[])) setting
    where setting ~ '^search_path=(|"")$'
  ) as empty_search_path,
  not has_function_privilege('anon', p.oid, 'EXECUTE') as anon_blocked,
  not has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_blocked
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'bin_purge_expired_data_quality_reports',
    'bin_purge_expired_account_re_enrolment_intents',
    'bin_consume_api_rate_limit',
    'bin_gateway_circuit_open',
    'bin_record_gateway_upstream_result',
    'bin_purge_expired_api_security_state'
  )
order by p.proname;
```

Expected: six rows with every boolean `true`.

```sql
select extname, extversion
from pg_extension
where extname = 'pg_cron';

select jobname, schedule, command, active
from cron.job
where jobname in (
  'what-bin-purge-data-quality',
  'what-bin-purge-re-enrolment-intents',
  'what-bin-purge-api-security-state'
)
order by jobname;
```

Expected: one `pg_cron` row and these three active jobs exactly:

| jobname | schedule | command |
| --- | --- | --- |
| `what-bin-purge-api-security-state` | `47 3 * * *` | `select public.bin_purge_expired_api_security_state();` |
| `what-bin-purge-data-quality` | `17 3 * * *` | `select public.bin_purge_expired_data_quality_reports();` |
| `what-bin-purge-re-enrolment-intents` | `7 * * * *` | `select public.bin_purge_expired_account_re_enrolment_intents();` |

After the first scheduled execution, also read `cron.job_run_details` for these job IDs and require a recent `succeeded` result. Scheduling readback alone does not prove execution.

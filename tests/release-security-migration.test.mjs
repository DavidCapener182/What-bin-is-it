import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../supabase/migrations/20260820103000_release_security_maintenance.sql',
  import.meta.url,
);
const clockFixMigrationUrl = new URL(
  '../supabase/migrations/20260820120000_release_security_clock_variable_fix.sql',
  import.meta.url,
);

test('release-security migration is private, bounded and retry-safe', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /add column if not exists provider_event_order integer not null default 0/);
  assert.match(sql, /provider_event_order between 0 and 10000/);
  assert.match(sql, /where event_type = 'TRANSFER'\s+and outcome = 'transfer-blocked'/);
  assert.match(sql, /create table if not exists public\.bin_api_rate_limits/);
  assert.match(sql, /identity_hash char\(64\) not null/);
  assert.match(sql, /expires_at timestamptz not null/);
  assert.match(sql, /alter table public\.bin_api_rate_limits enable row level security/);
  assert.match(sql, /alter table public\.bin_gateway_circuit_breakers enable row level security/);
  for (const signature of [
    'bin_consume_api_rate_limit(text, text, integer, integer)',
    'bin_gateway_circuit_open(text)',
    'bin_record_gateway_upstream_result(text, boolean, integer, integer)',
    'bin_purge_expired_api_security_state()',
  ]) {
    assert.ok(sql.includes(`revoke all on function public.${signature}`));
  }
  assert.ok((sql.match(/security definer/g) ?? []).length >= 4);
  assert.ok((sql.match(/set search_path = ''/g) ?? []).length >= 4);
  assert.match(sql, /p_limit < 1 or p_limit > 10000/);
  assert.match(sql, /p_window_seconds < 1 or p_window_seconds > 86400/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended/);
});

test('maintenance schedules use the supported named pg_cron API and grants', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /create extension if not exists pg_cron with schema pg_catalog/);
  assert.match(sql, /grant usage on schema cron to postgres/);
  assert.match(sql, /grant all privileges on all tables in schema cron to postgres/);
  assert.doesNotMatch(sql, /^\s*update\s+cron\.job/im);
  assert.match(sql, /cron\.schedule\(\s*'what-bin-purge-data-quality',\s*'17 3 \* \* \*'/s);
  assert.match(sql, /cron\.schedule\(\s*'what-bin-purge-re-enrolment-intents',\s*'7 \* \* \* \*'/s);
  assert.match(sql, /cron\.schedule\(\s*'what-bin-purge-api-security-state',\s*'47 3 \* \* \*'/s);
  assert.match(sql, /select public\.bin_purge_expired_data_quality_reports\(\)/);
  assert.match(sql, /select public\.bin_purge_expired_account_re_enrolment_intents\(\)/);
  assert.match(sql, /select public\.bin_purge_expired_api_security_state\(\)/);
});

test('live security functions use an unambiguous timestamptz clock variable', async () => {
  const sql = await readFile(clockFixMigrationUrl, 'utf8');
  assert.match(sql, /v_now timestamptz := clock_timestamp\(\)/);
  assert.match(sql, /current_row\.expires_at <= v_now/);
  assert.match(sql, /current_row\.expires_at - v_now/);
  assert.match(sql, /then v_now \+ make_interval/);
  assert.doesNotMatch(sql, /\bcurrent_time timestamptz\b/);
  assert.ok((sql.match(/security definer/g) ?? []).length === 2);
  assert.ok((sql.match(/set search_path = ''/g) ?? []).length === 2);
});

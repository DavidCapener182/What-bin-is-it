import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { redactDataQualityText } from '../src/lib/data-quality-report.ts';
import { createDataQualityClientIdCoordinator } from '../src/lib/data-quality-client-coordinator.ts';
import {
  dataQualityPayloadDigest,
  dataQualityReplayMatches,
} from '../server/lib/data-quality-idempotency.ts';
import { dataQualityStorageFailureLog } from '../server/lib/data-quality-observability.ts';
import {
  DataQualityPayloadTooLargeError,
  parseDataQualityReport,
  readBoundedDataQualityJson,
} from '../server/lib/data-quality-validation.ts';

const validReport = {
  issue: 'wrong-date',
  detail: 'The app shows Tuesday but the verified source now says Wednesday.',
  expectedValue: 'Wednesday',
  councilProviderId: 'lad-e06000009',
  displayedCollectionDate: '2026-08-20',
  lastVerifiedAt: '2026-08-19T08:30:00.000Z',
  appVersion: '1.1.0',
  online: true,
  clientId: '123e4567-e89b-42d3-a456-426614174000',
  clientRequestId: '223e4567-e89b-42d3-a456-426614174001',
};

test('validates the private allow-listed payload and derives council name server-side', () => {
  const report = parseDataQualityReport(validReport);
  assert.equal(report.councilName, 'Blackpool');
  assert.equal(report.councilProviderId, 'lad-e06000009');
  assert.equal(report.detail, validReport.detail);
});

test('rejects automatic location fields and client-supplied council names', () => {
  for (const forbidden of ['postcode', 'address', 'propertyReference', 'placeLabel', 'councilName']) {
    assert.throws(
      () => parseDataQualityReport({ ...validReport, [forbidden]: 'not permitted' }),
      /invalid field/,
    );
  }
  assert.throws(
    () => parseDataQualityReport({ ...validReport, councilProviderId: 'lad-e99999999' }),
    /could not be verified/,
  );
});

test('redacts postcode-shaped text before preview and rejects it at the server boundary', () => {
  assert.equal(
    redactDataQualityText('The saved value was FY1 1AA.', 1_000),
    'The saved value was [postcode removed].',
  );
  assert.throws(
    () => parseDataQualityReport({ ...validReport, detail: 'The saved value was FY1 1AA.' }),
    /must not include a postcode/,
  );
  assert.throws(
    () => parseDataQualityReport({ ...validReport, detail: 'x'.repeat(1_001) }),
    /too long/,
  );
});

test('reads JSON through a hard streaming byte limit', async () => {
  const request = new Request('https://example.test/api/data-quality/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validReport),
  });
  assert.deepEqual(await readBoundedDataQualityJson(request), validReport);

  const oversized = new Request('https://example.test/api/data-quality/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ detail: 'x'.repeat(8_192) }),
  });
  await assert.rejects(
    readBoundedDataQualityJson(oversized),
    DataQualityPayloadTooLargeError,
  );
});

test('erasing the data-quality client ID cannot be overtaken by an in-flight write', async () => {
  let releaseRead;
  let signalReadStarted;
  const readStarted = new Promise((resolve) => { signalReadStarted = resolve; });
  const readReleased = new Promise((resolve) => { releaseRead = resolve; });
  const operations = [];
  let stored;
  const coordinator = createDataQualityClientIdCoordinator({
    createId: () => '123e4567-e89b-42d3-a456-426614174000',
    isValid: () => false,
    storage: {
      getItem: async () => {
        operations.push('get:start');
        signalReadStarted();
        await readReleased;
        operations.push('get:end');
        return stored;
      },
      removeItem: async () => {
        operations.push('remove');
        stored = undefined;
      },
      setItem: async (_key, value) => {
        operations.push('set');
        stored = value;
      },
    },
    storageKey: '@test/data-quality-client',
  });

  const inFlightGeneration = coordinator.get();
  await readStarted;
  const erase = coordinator.erase();
  releaseRead();
  assert.equal(await inFlightGeneration, '123e4567-e89b-42d3-a456-426614174000');
  await erase;

  assert.equal(stored, undefined);
  assert.deepEqual(operations, ['get:start', 'get:end', 'set', 'remove']);
});

test('idempotent replay identity changes when any canonical report field changes', () => {
  const parsed = parseDataQualityReport(validReport);
  const digest = dataQualityPayloadDigest(parsed);
  assert.equal(digest.length, 64);
  assert.equal(dataQualityPayloadDigest({ ...parsed }), digest);
  assert.equal(dataQualityReplayMatches(
    { clientIdHash: 'a'.repeat(64), payloadDigest: digest },
    { clientIdHash: 'a'.repeat(64), payloadDigest: digest },
  ), true);

  for (const changed of [
    { ...parsed, issue: 'wrong-bin' },
    { ...parsed, detail: `${parsed.detail} Changed.` },
    { ...parsed, expectedValue: 'Thursday' },
    { ...parsed, councilProviderId: undefined, councilName: undefined },
    { ...parsed, displayedCollectionDate: '2026-08-21' },
    { ...parsed, lastVerifiedAt: '2026-08-19T09:30:00.000Z' },
    { ...parsed, appVersion: '1.1.1' },
    { ...parsed, online: false },
  ]) {
    assert.notEqual(dataQualityPayloadDigest(changed), digest);
  }
  assert.equal(dataQualityReplayMatches(
    { clientIdHash: 'a'.repeat(64), payloadDigest: digest },
    { clientIdHash: 'a'.repeat(64), payloadDigest: dataQualityPayloadDigest({ ...parsed, detail: 'Different' }) },
  ), false);
});

test('unexpected data-quality errors produce correlation-only structured logs', () => {
  const error = Object.assign(new Error('Sensitive report content FY1 1AA'), {
    clientIdHash: 'secret-client-hash',
    code: '23505',
  });
  const entry = dataQualityStorageFailureLog(error, 'server-request-id');
  assert.deepEqual(entry, {
    requestId: 'server-request-id',
    route: '/api/data-quality/reports',
    errorName: 'Error',
    errorCode: '23505',
  });
  const encoded = JSON.stringify(entry);
  assert.doesNotMatch(encoded, /FY1|secret-client-hash|Sensitive report content/);
});

test('endpoint, storage and migration preserve privacy, idempotency and operational controls', async () => {
  const [route, storage, migration, screen, client, validation, privacy] = await Promise.all([
    readFile(new URL('../server/routes/api/data-quality/reports.post.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/lib/data-quality.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20260819090000_private_data_quality_queue.sql', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/report-incorrect.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/data-quality-client.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/lib/data-quality-validation.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/privacy.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(route, /DATA_QUALITY_RATE_LIMITED/);
  assert.match(route, /DATA_QUALITY_NETWORK_RATE_LIMITED/);
  assert.match(route, /scope: 'data-quality-network'/);
  assert.match(route, /consumeServerApiRateLimit\(event\.req/);
  assert.match(route, /'retry-after'/);
  assert.match(route, /apiJson\(requestId/);
  assert.match(route, /const requestId = apiRequestId\(event\.req\)/);
  assert.doesNotMatch(route, /requestId = input\.clientRequestId/);
  assert.match(route, /clientRequestId: input\.clientRequestId/);
  assert.match(route, /dataQualityStorageFailureLog\(error, requestId\)/);
  assert.match(route, /console\.error\(JSON\.stringify/);
  assert.match(storage, /`client:\$\{hash\}`/);
  assert.match(storage, /`request:\$\{input\.clientRequestId\}`/);
  assert.match(storage, /clientIdHash: existing\.client_id_hash/);
  assert.match(storage, /payloadDigest: existing\.payload_digest/);
  assert.match(storage, /dataQualityReplayMatches/);
  assert.match(storage, /payload_digest/);
  assert.match(storage, /short_count >= 5/);
  assert.match(storage, /daily_count >= 20/);
  assert.match(migration, /alter table public\.bin_data_quality_reports enable row level security/);
  assert.match(migration, /revoke all on table public\.bin_data_quality_reports from anon, authenticated/);
  assert.match(migration, /expires_at timestamptz not null default \(now\(\) \+ interval '24 months'\)/);
  assert.match(migration, /create or replace function public\.bin_purge_expired_data_quality_reports/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /payload_digest char\(64\) not null/);
  assert.match(migration, /bin_data_quality_reports_payload_digest_check/);
  assert.match(migration, /revoke all on function public\.bin_purge_expired_data_quality_reports/);
  assert.doesNotMatch(
    migration,
    /^\s*(?:postcode|street_address|property_reference|place_label|email|ip_address)\s+/im,
  );
  assert.doesNotMatch(screen, /github\.com|Linking\.openURL/);
  assert.doesNotMatch(screen, /activeAddress\?\.(?:postcode|line1|label|id)/);
  assert.doesNotMatch(screen, /residentInstallationId|resident-council-links/);
  assert.match(screen, /dataQualityClientId/);
  assert.match(client, /data-quality-client-v1/);
  assert.match(client, /Crypto\.randomUUID\(\)/);
  assert.doesNotMatch(client, /residentInstallationId|resident-council-links/);
  assert.doesNotMatch(validation, /AsyncStorage|data-quality-client/);
  assert.match(privacy, /pseudonymous data-quality-only client reference/);
  assert.match(privacy, /not reused for council resident counting, analytics, accounts or other features/);
  assert.match(screen, /Exact payload to be sent/);
  assert.match(screen, /addresses and place names typed into these boxes cannot always be detected/);
});

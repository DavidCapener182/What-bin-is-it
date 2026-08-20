import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ACCOUNT_EXPORT_PAGE_SIZE,
  collectAccountExportPages,
} from '../server/lib/account-export.ts';

test('account export uses the household UI authorization boundary', async () => {
  const [route, accountExport] = await Promise.all([
    readFile(new URL('../server/routes/api/account/export.get.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/lib/account-export.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(route, /exportResidentAccountRecords\(user\.id\)/);
  assert.doesNotMatch(route, /re_enrolment_key/);
  assert.match(accountExport, /access\.user_id = \$\{userId\}::uuid[\s\S]*household\.status = 'active'/);
  assert.match(accountExport, /invitation\.created_by = \$\{userId\}::uuid/);
  assert.match(accountExport, /membership\.user_id = \$\{userId\}::uuid/);
  assert.doesNotMatch(accountExport, /SELECT[\s\S]{0,300}token_hash/i);
  assert.match(accountExport, /FROM bin_account_removal_suppressions/);
  assert.match(accountExport, /FROM bin_account_re_enrolment_intents/);
  assert.match(accountExport, /pendingReEnrolments/);
  assert.match(accountExport, /intent_key: _secretKey/);
  assert.doesNotMatch(accountExport, /re_enrolment_requested_at|re_enrolment_source|re_enrolment_key/);
});

test('account export drains every cursor page instead of silently truncating records', async () => {
  const source = Array.from({ length: ACCOUNT_EXPORT_PAGE_SIZE * 2 + 7 }, (_, id) => ({ id }));
  let calls = 0;
  const rows = await collectAccountExportPages(
    async (cursor, pageSize) => {
      calls += 1;
      return source.filter((row) => cursor === undefined || row.id > cursor).slice(0, pageSize);
    },
    (row) => row.id,
  );
  assert.deepEqual(rows, source);
  assert.equal(calls, 3);

  const accountExport = await readFile(
    new URL('../server/lib/account-export.ts', import.meta.url),
    'utf8',
  );
  assert.match(accountExport, /while \(true\)/);
  assert.match(accountExport, /LIMIT \$\{pageSize\}/);
  assert.doesNotMatch(accountExport, /LIMIT (?:200|250|500|5000)\b/);
  assert.doesNotMatch(accountExport, /listResidentHouseholds/);
});

test('account export has stable status-specific errors and server request IDs', async () => {
  const route = await readFile(
    new URL('../server/routes/api/account/export.get.ts', import.meta.url),
    'utf8',
  );

  assert.match(route, /const requestId = randomUUID\(\)/);
  assert.match(route, /'x-request-id': requestId/);
  assert.doesNotMatch(route, /headers\.get\(['"]x-request-id/);
  assert.match(route, /error instanceof BinAccountAuthenticationError/);
  assert.match(route, /status: error\.status/);
  assert.match(route, /code: 'ACCOUNT_EXPORT_UNAVAILABLE'/);
  assert.match(route, /status: 503/);
  assert.doesNotMatch(route, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(route, /JSON\.stringify\(error\)|String\(error\)/);
});

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import {
  ACCOUNT_DATA_REMOVAL_CONFIRMATION,
  AccountDataRemovalError,
  accountDataRemovalFailure,
  accountDataRemovalPreflightError,
  recentInteractiveAuthenticationIsEligible,
  removeResidentAccountData,
} from '../server/lib/account-deletion.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-08-19T12:00:00.000Z');
const recentOtp = [{ method: 'otp', timestamp: Date.parse('2026-08-19T11:59:00.000Z') / 1000 }];
const clearPreflight = {
  privilegedStaffIdentity: false,
  activePaidBilling: false,
  sharedOwnedHousehold: false,
  otherHouseholdLink: false,
};

test('requires a recent interactive AMR entry from the requesting session', () => {
  assert.equal(recentInteractiveAuthenticationIsEligible(recentOtp, now), true);
  assert.equal(recentInteractiveAuthenticationIsEligible([
    { method: 'magiclink', timestamp: Date.parse('2026-08-19T11:46:00.000Z') / 1000 },
  ], now), true);
  assert.equal(recentInteractiveAuthenticationIsEligible([
    { method: 'otp', timestamp: Date.parse('2026-08-19T11:44:59.000Z') / 1000 },
  ], now), false);
  assert.equal(recentInteractiveAuthenticationIsEligible([
    { method: 'token_refresh', timestamp: Date.parse('2026-08-19T11:59:59.000Z') / 1000 },
  ], now), false);
});

test('blocks staff, paid billing and household states that affect another person', () => {
  const cases = [
    ['privilegedStaffIdentity', 'STAFF_ACCOUNT_ASSISTANCE_REQUIRED'],
    ['activePaidBilling', 'ACTIVE_BILLING_MUST_BE_RESOLVED'],
    ['sharedOwnedHousehold', 'HOUSEHOLD_TRANSFER_REQUIRED'],
    ['otherHouseholdLink', 'HOUSEHOLD_LEAVE_REQUIRED'],
  ];
  for (const [key, code] of cases) {
    const error = accountDataRemovalPreflightError({ ...clearPreflight, [key]: true });
    assert.equal(error?.code, code);
    assert.equal(error?.status, 409);
    assert.ok(error?.guidance);
  }
  assert.equal(accountDataRemovalPreflightError(clearPreflight), undefined);
});

test('never reflects an unknown database or upstream error', () => {
  const failure = accountDataRemovalFailure(
    new Error('postgres://admin:secret@example.test private failure'),
  );
  assert.equal(failure.status, 503);
  assert.equal(failure.body.code, 'ACCOUNT_DATA_REMOVAL_UNAVAILABLE');
  assert.equal(failure.body.identityRetained, true);
  assert.doesNotMatch(JSON.stringify(failure), /admin:secret|private failure/);
});

test('rejects a stale session AMR before running product cleanup', async () => {
  let removed = false;
  await assert.rejects(
    removeResidentAccountData({
      userId,
      sessionId,
      authenticationMethods: [{
        method: 'otp',
        timestamp: Date.parse('2026-08-19T11:00:00.000Z') / 1000,
      }],
      now,
    }, { removeProductData: async () => { removed = true; } }),
    (error) => error instanceof AccountDataRemovalError
      && error.code === 'RECENT_SESSION_AUTHENTICATION_REQUIRED'
      && error.status === 401,
  );
  assert.equal(removed, false);
});

test('a failed transactional cleanup can be retried without an Auth deletion step', async () => {
  let attempts = 0;
  let receivedSessionId;
  const dependencies = {
    removeProductData: async (_userId, activeSessionId) => {
      attempts += 1;
      receivedSessionId = activeSessionId;
      if (attempts === 1) throw new Error('simulated database outage');
    },
  };
  const input = { userId, sessionId, authenticationMethods: recentOtp, now };
  await assert.rejects(
    removeResidentAccountData(input, dependencies),
    (error) => error instanceof AccountDataRemovalError
      && error.code === 'ACCOUNT_DATA_REMOVAL_UNAVAILABLE'
      && error.status === 503,
  );
  const result = await removeResidentAccountData(input, dependencies);
  assert.equal(attempts, 2);
  assert.equal(receivedSessionId, sessionId);
  assert.deepEqual(result, {
    removed: true,
    identityRetained: true,
    retained: 'The shared Supabase sign-in identity, detached payment-provider records and a minimal What Bin removal-suppression marker are retained. The marker clears only after an explicit re-enrolment is verified by the payment provider. This device will be signed out locally.',
  });
});

test('route binds removal to verified session claims and stable request IDs', async () => {
  const [route, accountRemoval, binAuth, clientAccount, accountScreen] = await Promise.all([
    readFile(new URL('../server/routes/api/account/delete.post.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/lib/account-deletion.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/lib/bin-auth.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/use-account.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/account.tsx', import.meta.url), 'utf8'),
  ]);

  assert.equal(ACCOUNT_DATA_REMOVAL_CONFIRMATION, 'remove-what-bin-account');
  assert.match(route, /const requestId = randomUUID\(\)/);
  assert.match(route, /'x-request-id': requestId/);
  assert.doesNotMatch(route, /headers\.get\(['"]x-request-id/);
  assert.doesNotMatch(route, /error instanceof Error \? error\.message/);
  assert.match(route, /sessionId: user\.sessionId/);
  assert.match(route, /authenticationMethods: user\.authenticationMethods/);
  assert.match(route, /removed: false,[\s\S]*identityRetained: true/);
  assert.match(binAuth, /AbortSignal\.timeout\(BIN_ACCOUNT_AUTH_TIMEOUT_MS\)/);
  assert.match(binAuth, /session_id/);
  assert.match(binAuth, /claims\.subject !== payload\.id/);
  assert.match(binAuth, /claims\.amr/);
  assert.doesNotMatch(binAuth, /last_sign_in_at/);
  assert.match(accountRemoval, /FROM auth\.sessions/);
  assert.match(accountRemoval, /id = \$\{sessionId\}::uuid/);
  assert.match(accountRemoval, /user_id = \$\{userId\}::uuid/);
  assert.match(accountRemoval, /FOR KEY SHARE/);
  assert.match(accountRemoval, /sql\.begin\('isolation level serializable'/);
  assert.match(clientAccount, /signOut\(\{ scope: 'local' \}\)/);
  assert.match(accountScreen, /Remove What Bin account data/);
});

test('no client or server path can hard-delete the shared Supabase identity', async () => {
  const sourceRoots = [new URL('../server/', import.meta.url), new URL('../src/', import.meta.url)];
  const sources = [];
  for (const root of sourceRoots) {
    const names = await readdir(root, { recursive: true });
    for (const name of names) {
      if (!/\.(?:ts|tsx|mjs)$/.test(name)) continue;
      sources.push(await readFile(new URL(name, root), 'utf8'));
    }
  }
  const combined = sources.join('\n');
  assert.doesNotMatch(combined, /(?:auth\.admin\.)?deleteUser\s*\(/);
  assert.doesNotMatch(combined, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(combined, /auth\.admin\.signOut\s*\([^)]*['"]global['"]/);

  const migrationNames = await readdir(new URL('../supabase/migrations/', import.meta.url));
  assert.equal(migrationNames.some((name) => /account_deletion|deletion_job/i.test(name)), false);
});

test('privacy, security and store declarations require assisted identity deletion', async () => {
  const [privacy, security, storePrivacy, reviewNotes] = await Promise.all([
    readFile(new URL('../src/app/privacy.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../docs/security/AUTH-BILLING.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/store/PRIVACY-DECLARATIONS.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/store/APP-REVIEW-NOTES.md', import.meta.url), 'utf8'),
  ]);
  for (const source of [privacy, security, storePrivacy, reviewNotes]) {
    assert.match(source, /shared Supabase (?:authentication )?identity/i);
    assert.match(source, /assist(?:ed|ance)/i);
  }
  assert.doesNotMatch(privacy, /permanently deletes the Supabase Auth identity/i);
});

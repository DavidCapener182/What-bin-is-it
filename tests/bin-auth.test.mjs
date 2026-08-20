import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';

import {
  BinAccountAuthenticationError,
  requireBinAccount,
  serverEntitlementIsPlus,
} from '../server/lib/bin-auth.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';

function accessToken(claims = {}) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: userId,
    session_id: sessionId,
    amr: [{ method: 'otp', timestamp: 1787137140 }],
    ...claims,
  })}.signature-that-is-long-enough-for-the-bearer-parser`;
}

function requestFor(token = accessToken()) {
  return new Request('https://what-bin.example/api/account/export', {
    headers: { authorization: `Bearer ${token}` },
  });
}

test('server entitlement reads require periods except for valid lifetime grants', () => {
  assert.equal(serverEntitlementIsPlus({
    plan_id: 'plus-yearly',
    source: 'stripe',
    status: 'active',
    product_id: 'plus-yearly',
    current_period_end: null,
  }), false);
  assert.equal(serverEntitlementIsPlus({
    plan_id: 'plus-lifetime',
    source: 'stripe',
    status: 'active',
    product_id: 'plus-lifetime',
    current_period_end: null,
  }), true);
  assert.equal(serverEntitlementIsPlus({
    plan_id: 'plus-lifetime',
    source: 'stripe',
    status: 'refunded',
    product_id: 'plus-lifetime',
    current_period_end: null,
  }), false);
});

test('Supabase 401/403 are expired while other upstream statuses are unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  try {
    for (const status of [401, 403]) {
      globalThis.fetch = async () => new Response('{}', { status });
      await assert.rejects(
        requireBinAccount(requestFor()),
        (error) => error instanceof BinAccountAuthenticationError
          && error.code === 'AUTHENTICATION_EXPIRED'
          && error.status === 401,
      );
    }
    for (const status of [429, 500]) {
      globalThis.fetch = async () => new Response('{}', { status });
      await assert.rejects(
        requireBinAccount(requestFor()),
        (error) => error instanceof BinAccountAuthenticationError
          && error.code === 'AUTHENTICATION_UNAVAILABLE'
          && error.status === 503,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});

test('verified bearer claims are bound to the returned user and session', async () => {
  const originalFetch = globalThis.fetch;
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  globalThis.fetch = async () => Response.json({ id: userId, email: 'resident@example.test' });
  try {
    const user = await requireBinAccount(requestFor());
    assert.equal(user.id, userId);
    assert.equal(user.sessionId, sessionId);
    assert.deepEqual(user.authenticationMethods, [{ method: 'otp', timestamp: 1787137140 }]);

    await assert.rejects(
      requireBinAccount(requestFor(accessToken({ sub: '33333333-3333-4333-8333-333333333333' }))),
      (error) => error instanceof BinAccountAuthenticationError
        && error.code === 'AUTHENTICATION_EXPIRED'
        && error.status === 401,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});

import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const browserAccountFixtureStorageKey = 'what-bin:e2e-account-fixture-v1';

function onLoopbackHost() {
  if (Platform.OS !== 'web' || typeof globalThis.location?.hostname !== 'string') return false;
  return globalThis.location.hostname === '127.0.0.1' || globalThis.location.hostname === 'localhost';
}

export function readBrowserAccountFixture(): Session | undefined {
  if (!onLoopbackHost() || typeof globalThis.localStorage === 'undefined') return undefined;
  try {
    const parsed = JSON.parse(globalThis.localStorage.getItem(browserAccountFixtureStorageKey) ?? '') as {
      accessToken?: unknown;
      email?: unknown;
      userId?: unknown;
    };
    if (
      parsed.accessToken !== 'resident-browser-fixture-token'
      || typeof parsed.email !== 'string'
      || !/^[^@\s]{1,80}@example\.test$/.test(parsed.email)
      || typeof parsed.userId !== 'string'
      || !/^browser-[a-z0-9-]{1,40}$/.test(parsed.userId)
    ) return undefined;
    const user = {
      id: parsed.userId,
      email: parsed.email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-08-20T12:00:00.000Z',
    } satisfies User;
    return {
      access_token: parsed.accessToken,
      refresh_token: 'resident-browser-fixture-refresh-token',
      expires_in: 3600,
      expires_at: 1_800_000_000,
      token_type: 'bearer',
      user,
    };
  } catch {
    return undefined;
  }
}

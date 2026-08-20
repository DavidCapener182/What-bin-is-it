import assert from 'node:assert/strict';
import test from 'node:test';

import {
  nativeE2EFixtureAddress,
  nativeE2EFixtureCollections,
  nativeE2EFixtureMarker,
  nativeE2EFixturesEnabled,
  nativeE2ELoopbackApiBase,
} from '../src/lib/native-e2e-fixtures.ts';
import { networkStateIsOnline } from '../src/lib/network-state.ts';
import { planCollectionReminders } from '../src/lib/reminder-plan.ts';
import { buildCollectionLiveSurfaceSnapshot } from '../src/widgets/collection-live-surface-data.ts';
import { buildCollectionWidgetSnapshot } from '../src/widgets/widget-data.ts';

const environmentNames = [
  'EXPO_PUBLIC_COUNCIL_API_BASE',
  'EXPO_PUBLIC_ENABLE_NATIVE_PLUS_PURCHASES',
  'EXPO_PUBLIC_LAUNCH_PHASE',
  'EXPO_PUBLIC_NATIVE_E2E_FIXTURES',
  'EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
];

function withFixtureEnvironment(overrides, callback) {
  const previous = new Map(environmentNames.map((name) => [name, process.env[name]]));
  const environment = {
    EXPO_PUBLIC_COUNCIL_API_BASE: nativeE2ELoopbackApiBase,
    EXPO_PUBLIC_ENABLE_NATIVE_PLUS_PURCHASES: 'false',
    EXPO_PUBLIC_LAUNCH_PHASE: 'proof',
    EXPO_PUBLIC_NATIVE_E2E_FIXTURES: nativeE2EFixtureMarker,
    EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY: '',
    EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY: '',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    EXPO_PUBLIC_SUPABASE_URL: '',
    ...overrides,
  };
  try {
    for (const name of environmentNames) process.env[name] = environment[name];
    return callback();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('native fixtures require the complete loopback proof profile and no remote credentials', () => {
  assert.equal(withFixtureEnvironment({}, nativeE2EFixturesEnabled), true);

  const failClosedCases = {
    EXPO_PUBLIC_COUNCIL_API_BASE: 'https://what-bin-is-it-tonight.vercel.app/api',
    EXPO_PUBLIC_ENABLE_NATIVE_PLUS_PURCHASES: 'true',
    EXPO_PUBLIC_LAUNCH_PHASE: 'live',
    EXPO_PUBLIC_NATIVE_E2E_FIXTURES: 'different-marker',
    EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY: 'configured',
    EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY: 'configured',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'configured',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'configured',
    EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  };
  for (const [name, value] of Object.entries(failClosedCases)) {
    assert.equal(
      withFixtureEnvironment({ [name]: value }, nativeE2EFixturesEnabled),
      false,
      `${name} must disable native fixtures`,
    );
  }
});

test('native fixtures provide only synthetic future council dates', () => {
  const now = new Date(2026, 7, 20, 12, 0, 0);
  const collections = nativeE2EFixtureCollections(now);

  assert.equal(nativeE2EFixtureAddress.id, 'native-e2e-home');
  assert.equal(nativeE2EFixtureAddress.line1, 'Internal native test fixture');
  assert.deepEqual(collections.map((collection) => collection.date), ['2026-08-21', '2026-08-28']);
  assert.ok(collections.every((collection) => collection.source === 'council'));
  assert.ok(collections.every((collection) => collection.id.startsWith('native-e2e-')));

  const liveSurface = buildCollectionLiveSurfaceSnapshot(
    nativeE2EFixtureAddress,
    collections,
    [],
    now,
  );
  assert.equal(liveSurface?.countdown, 'TONIGHT');
  assert.equal(liveSurface?.placeLabel, 'E2E Home');

  const widget = buildCollectionWidgetSnapshot(nativeE2EFixtureAddress, collections, now);
  assert.equal(widget.countdown, 'TONIGHT');
  assert.equal(widget.addressLabel, 'E2E Home');
});

test('fixture schedule produces local reminders without requiring a provider call', () => {
  const now = new Date(2026, 7, 20, 12, 0, 0);
  const reminders = planCollectionReminders(
    nativeE2EFixtureCollections(now),
    {
      enabled: true,
      reminderHour: 19,
      reminderMinute: 0,
      reminderDayOffset: 1,
      collectionFollowUp: false,
      wasteTypes: { general: true, recycling: true, garden: true, food: true, other: true },
    },
    now,
  );

  assert.equal(reminders.length, 2);
  assert.ok(reminders.every((reminder) => reminder.triggerAt > now));
  assert.ok(reminders.every((reminder) => reminder.url === '/schedule'));
});

test('native connectivity turns offline on either confirmed failure signal', () => {
  assert.equal(networkStateIsOnline({}), true);
  assert.equal(networkStateIsOnline({ isConnected: true, isInternetReachable: true }), true);
  assert.equal(networkStateIsOnline({ isConnected: false, isInternetReachable: true }), false);
  assert.equal(networkStateIsOnline({ isConnected: true, isInternetReachable: false }), false);
});

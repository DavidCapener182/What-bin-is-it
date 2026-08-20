import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { councilPlatformProfile } from '../api/_gateway/council-platform-content.ts';
import { councilProfileFor } from '../api/_gateway/council-profile.ts';

test('keeps the verified static council profile when the private database is not configured', async () => {
  const base = councilProfileFor('lad-e08000011', {});
  const result = await councilPlatformProfile(base, {});
  assert.deepEqual(result, base);
  assert.equal(result.coverageStatus, 'live-direct');
});

test('resident surfaces consume published council messages through the gateway profile only', async () => {
  const [gateway, homeRoute, homeFeature, scheduleRoute, scheduleFeature, guide, activity] = await Promise.all([
    readFile(new URL('../api/_gateway/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/(tabs)/(today)/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/collections/today-screen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/(tabs)/schedule/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/collections/schedule-screen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/(tabs)/guide/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/(tabs)/activity/index.tsx', import.meta.url), 'utf8'),
  ]);
  const home = `${homeRoute}\n${homeFeature}`;
  const schedule = `${scheduleRoute}\n${scheduleFeature}`;
  assert.match(gateway, /councilPlatformProfile/);
  assert.match(home, /residentAlertsForProfile\(councilProfile\)/);
  assert.match(schedule, /CouncilNotices placement="schedule"/);
  assert.match(guide, /CouncilNotices placement="guide"/);
  assert.match(activity, /residentAlertsForProfile\(profile, collections\)/);
  for (const source of [home, schedule, guide, activity]) {
    assert.doesNotMatch(source, /bin_council_/);
    assert.doesNotMatch(source, /BIN_DATABASE_URL/);
  }
});

test('partner results are disclosed and follow official guidance', async () => {
  const [guide, detail] = await Promise.all([
    readFile(new URL('../src/app/(tabs)/guide/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/guide-detail.tsx', import.meta.url), 'utf8'),
  ]);
  const source = `${guide}\n${detail}`;
  assert.match(source, /Council and free options come first/);
  assert.match(source, /partner\.disclosureLabel/);
  assert.match(source, /itemKeys\.includes\(item\.id\)/);
});

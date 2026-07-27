import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  councilWorkspaceForResidentUse,
  parsePilotCouncilLinkSync,
} from '../server/lib/pilot-council-links.ts';
import {
  isAllowedPilotAnalyticsOrigin,
  pilotAnalyticsPreflight,
} from '../server/lib/pilot-analytics-http.ts';
import { councilIdsForResidentUse } from '../src/lib/resident-adoption.ts';

const participantId = '9f660fd6-b416-4b43-915b-8df48f23626b';

test('accepts only deduplicated council identifiers for an opted-in installation', () => {
  assert.deepEqual(parsePilotCouncilLinkSync({
    participantId,
    consentVersion: '2026-07-27',
    councilIds: ['lad-e08000011', 'lad-e08000014', 'lad-e08000011'],
  }), {
    participantId,
    consentVersion: '2026-07-27',
    councilIds: ['lad-e08000011', 'lad-e08000014'],
  });
});

test('turns a resident-linked council into a named prospect workspace', () => {
  assert.deepEqual(councilWorkspaceForResidentUse('lad-e08000014'), {
    providerId: 'lad-e08000014',
    slug: 'sefton-0014',
    name: 'Sefton',
  });
  assert.equal(councilWorkspaceForResidentUse('lad-e99999999'), undefined);
});

test('rejects postcode, address and arbitrary resident fields', () => {
  for (const residentField of ['postcode', 'address', 'uprn', 'email']) {
    assert.throws(() => parsePilotCouncilLinkSync({
      participantId,
      consentVersion: '2026-07-27',
      councilIds: ['lad-e08000011'],
      [residentField]: 'must-not-be-accepted',
    }), /invalid/);
  }
});

test('keeps historical council links while allowing current links to change', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/20260727174739_council_resident_adoption_metrics.sql', import.meta.url),
    'utf8',
  );
  const analytics = await readFile(
    new URL('../server/lib/pilot-analytics.ts', import.meta.url),
    'utf8',
  );
  assert.match(migration, /primary key \(participant_id, council_id\)/i);
  assert.match(migration, /currently_linked boolean not null default true/i);
  assert.match(analytics, /currently_linked = false/);
  assert.match(analytics, /INSERT INTO bin_council_organisations/);
  assert.match(analytics, /'prospect'/);
  assert.match(analytics, /ON CONFLICT \(participant_id, council_id\) DO UPDATE/);
  assert.doesNotMatch(migration, /\bpostcode\b\s+(?:varchar|text|char)/i);
  assert.doesNotMatch(migration, /\baddress\b\s+(?:varchar|text|char)/i);
});

test('platform superadmins can enter resident-discovered prospect councils', async () => {
  const auth = await readFile(
    new URL('../council-backoffice/lib/auth.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    auth,
    /WHERE organisation\.status IN \('prospect', 'pilot', 'active'\)/,
  );
});

test('council portal exposes active, current and all-time definitions', async () => {
  const dashboard = await readFile(
    new URL('../council-backoffice/lib/data.ts', import.meta.url),
    'utf8',
  );
  assert.match(dashboard, /label: "Active residents"/);
  assert.match(dashboard, /label: "Currently linked"/);
  assert.match(dashboard, /label: "All-time residents"/);
  assert.match(dashboard, /last_seen_at >= now\(\) - make_interval/);
});

test('allows only first-party and local-development analytics origins', () => {
  assert.equal(isAllowedPilotAnalyticsOrigin('https://what-bin-is-it-tonight.vercel.app'), true);
  assert.equal(
    isAllowedPilotAnalyticsOrigin('https://what-bin-is-it-tonight-git-main-example.vercel.app'),
    true,
  );
  assert.equal(isAllowedPilotAnalyticsOrigin('http://localhost:8081'), true);
  assert.equal(isAllowedPilotAnalyticsOrigin('https://unrelated.example'), false);

  const allowed = pilotAnalyticsPreflight(
    new Request('https://what-bin-is-it-tonight.vercel.app/api/analytics/council-links', {
      headers: { origin: 'http://localhost:8081' },
    }),
    'POST',
  );
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:8081');

  const blocked = pilotAnalyticsPreflight(
    new Request('https://what-bin-is-it-tonight.vercel.app/api/analytics/council-links', {
      headers: { origin: 'https://unrelated.example' },
    }),
    'POST',
  );
  assert.equal(blocked.status, 403);
});

test('a successful postcode resolution adds its council to the current anonymous links', () => {
  assert.deepEqual(councilIdsForResidentUse(
    ['lad-e08000011', 'lad-e08000014', 'lad-e08000011'],
    'lad-e08000015',
  ), [
    'lad-e08000011',
    'lad-e08000014',
    'lad-e08000015',
  ]);
  assert.deepEqual(councilIdsForResidentUse(
    ['unconnected', 'not a council'],
    'lad-e08000011',
  ), ['lad-e08000011']);
});

test('postcode and location success paths sync their resolved council immediately', async () => {
  const onboarding = await readFile(
    new URL('../src/app/onboarding.tsx', import.meta.url),
    'utf8',
  );
  const places = await readFile(
    new URL('../src/app/places.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    onboarding,
    /syncCouncilLinks\(\s*councilIdsForResidentUse\(\[\], resolved\.providerId\),?\s*\)/,
  );
  assert.match(
    places,
    /syncCouncilLinks\(councilIdsForResidentUse\(\s*addresses\.map/,
  );
});

test('returning to an installed app retries every saved council link', async () => {
  const appData = await readFile(
    new URL('../src/lib/use-app-data.tsx', import.meta.url),
    'utf8',
  );
  assert.match(appData, /AppState\.addEventListener\(\s*['"]change['"]/);
  assert.match(appData, /status === ['"]active['"]/);
  assert.match(
    appData,
    /state\.addresses\.map\(\(address\) => address\.providerId\)/,
  );
});

test('database array writes use Postgres JSON values rather than encoded strings', async () => {
  const analytics = await readFile(
    new URL('../server/lib/pilot-analytics.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(analytics, /JSON\.stringify\(rows\)/);
  assert.match(analytics, /sql\.json\(rows\)/);
  assert.match(analytics, /transaction\.json\(input\.councilIds\)/);
  assert.match(analytics, /transaction\.json\(rows\)/);
});

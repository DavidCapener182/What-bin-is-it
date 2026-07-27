import assert from 'node:assert/strict';
import test from 'node:test';

import {
  councilProfileFor,
  parseCouncilProfileRegistry,
} from '../api/_gateway/council-profile.ts';

test('publishes an honest full-lifecycle profile for the verified Knowsley adapter', () => {
  const profile = councilProfileFor('lad-e08000011', {});
  assert.equal(profile.coverageStatus, 'live-direct');
  assert.equal(profile.capabilities.addresses, 'verified-live');
  assert.equal(profile.capabilities.collections, 'verified-live');
  assert.equal(profile.capabilities.guidance, 'council-configured');
  assert.equal(profile.capabilities.missedReports, 'official-handoff');
  assert.equal(profile.guidance?.paper.destination, 'recycling');
  assert.equal(profile.guidance?.['shredded-paper'].destination, 'garden');
  assert.match(profile.guidanceSourceUrl, /^https:\/\/www\.knowsley\.gov\.uk\//);
});

test('labels nationwide routing as experimental rather than UK-wide live coverage', () => {
  const profile = councilProfileFor('lad-e08000014', {});
  assert.equal(profile.coverageStatus, 'experimental-adapter');
  assert.equal(profile.capabilities.collections, 'experimental');
  assert.equal(profile.capabilities.guidance, 'not-connected');
});

test('accepts server-side council guidance without requiring an app release', () => {
  const registry = JSON.stringify([{
    providerId: 'lad-e08000014',
    councilName: 'Sefton',
    coverageStatus: 'public-feed',
    summary: 'Verified public council feed.',
    reviewedAt: '2026-07-27',
    capabilities: {
      addresses: 'verified-live',
      collections: 'verified-live',
      guidance: 'council-configured',
      services: 'map-fallback',
      serviceAlerts: 'not-connected',
      missedReports: 'official-handoff',
    },
    guidanceSourceUrl: 'https://www.sefton.gov.uk/bins',
    guidance: {
      cardboard: {
        destination: 'recycling',
        heading: 'Use the recycling container',
        detail: 'Flatten clean cardboard.',
      },
    },
  }]);
  const parsed = parseCouncilProfileRegistry(registry);
  assert.equal(parsed[0].guidance.cardboard.destination, 'recycling');
  assert.equal(councilProfileFor('lad-e08000014', {
    COUNCIL_PROFILE_REGISTRY_JSON: registry,
  }).coverageStatus, 'public-feed');
});

test('rejects insecure council links and malformed guidance rules', () => {
  assert.throws(
    () => parseCouncilProfileRegistry(JSON.stringify([{
      providerId: 'lad-e08000014',
      coverageStatus: 'public-feed',
      summary: 'Invalid profile.',
      reviewedAt: '2026-07-27',
      capabilities: {
        addresses: 'verified-live',
        collections: 'verified-live',
        guidance: 'council-configured',
        services: 'map-fallback',
        serviceAlerts: 'not-connected',
        missedReports: 'official-handoff',
      },
      guidance: {
        cardboard: {
          destination: 'teleport',
          heading: 'Invalid',
          detail: 'Invalid',
        },
      },
    }])),
    /invalid council profile/,
  );
});

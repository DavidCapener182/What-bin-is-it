import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseNationwideAddresses,
  parseNationwideCollections,
} from '../api/_gateway/nationwide-bin-source.ts';

test('normalises a nationwide postcode lookup into exact council addresses', () => {
  assert.deepEqual(parseNationwideAddresses({
    postcode: 'L20 6GG',
    council: {
      ladCode: 'E08000014',
      name: 'Sefton',
      slug: 'sefton',
      supported: true,
      officialUrl: 'https://www.sefton.gov.uk/bin-day',
    },
    addresses: [
      { uprn: '41210166', display: '1 Librex Close Bootle L20 6GG', postcode: 'L20 6GG' },
      { uprn: '41210166', display: '1 Librex Close Bootle L20 6GG', postcode: 'L20 6GG' },
      { uprn: '41210167', display: '3 Librex Close Bootle L20 6GG', postcode: 'L20 6GG' },
    ],
  }, 'L20 6GG', 'lad-e08000014'), {
    councilName: 'Sefton',
    councilSlug: 'sefton',
    providerId: 'lad-e08000014',
    officialUrl: 'https://www.sefton.gov.uk/bin-day',
    addresses: [
      { id: '41210166', line1: '1 Librex Close Bootle', postcode: 'L20 6GG' },
      { id: '41210167', line1: '3 Librex Close Bootle', postcode: 'L20 6GG' },
    ],
  });
});

test('rejects a nationwide response for a different council', () => {
  assert.throws(() => parseNationwideAddresses({
    postcode: 'L20 6GG',
    council: { ladCode: 'E08000012', name: 'Liverpool', slug: 'liverpool', supported: true },
    addresses: [],
  }, 'L20 6GG', 'lad-e08000014'), /different council/i);
});

test('preserves exact council bin labels and safely classifies known waste streams', () => {
  assert.deepEqual(parseNationwideCollections({
    collections: [
      { date: '2026-07-27', type: 'green', label: 'Green', colour: '#15803d' },
      { date: '2026-07-29', type: 'recycling', label: 'Recycling', colour: '#2563eb' },
      { date: '2026-08-05', type: 'residual', label: 'Residual', colour: '#111827' },
      { date: '2026-08-06', type: 'food caddy', label: 'Food caddy', colour: 'not-a-colour' },
    ],
  }), [
    { date: '2026-07-27', wasteType: 'other', label: 'Green', colour: '#15803D' },
    { date: '2026-07-29', wasteType: 'recycling', label: 'Recycling', colour: '#2563EB' },
    { date: '2026-08-05', wasteType: 'general', label: 'Residual', colour: '#111827' },
    { date: '2026-08-06', wasteType: 'food', label: 'Food caddy' },
  ]);
});

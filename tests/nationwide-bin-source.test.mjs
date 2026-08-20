import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  nationwideMaximumOperationMs,
  parseNationwideAddresses,
  parseNationwideCollections,
} from '../api/_gateway/nationwide-bin-source.ts';
import { getAdapter, nationwideFallbackEnabled } from '../api/_gateway/adapter-registry.ts';

test('keeps the full nationwide retry budget below the function duration', () => {
  assert.ok(nationwideMaximumOperationMs < 25_000);
});

test('keeps selected-address nationwide fallback disabled unless explicitly released', () => {
  const previous = process.env.WHAT_BIN_ENABLE_NATIONWIDE_FALLBACK;
  try {
    delete process.env.WHAT_BIN_ENABLE_NATIONWIDE_FALLBACK;
    assert.equal(nationwideFallbackEnabled(), false);
    assert.equal(getAdapter('lad-e08000012'), undefined);
    process.env.WHAT_BIN_ENABLE_NATIONWIDE_FALLBACK = 'false';
    assert.equal(getAdapter('lad-e08000012'), undefined);
    process.env.WHAT_BIN_ENABLE_NATIONWIDE_FALLBACK = 'true';
    assert.equal(getAdapter('lad-e08000012')?.id, 'lad-e08000012');
  } finally {
    if (previous === undefined) delete process.env.WHAT_BIN_ENABLE_NATIONWIDE_FALLBACK;
    else process.env.WHAT_BIN_ENABLE_NATIONWIDE_FALLBACK = previous;
  }
});

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

test('discloses the selected-address data flow used by the experimental nationwide source', async () => {
  const [adapter, privacyScreen, storeDeclaration, reviewNotes, assurance] = await Promise.all([
    readFile(new URL('../api/_gateway/nationwide-bin-source.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/privacy.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../docs/store/PRIVACY-DECLARATIONS.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/store/APP-REVIEW-NOTES.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/councils/ASSURANCE.md', import.meta.url), 'utf8'),
  ]);

  assert.match(adapter, /searchParams\.set\('address'/);
  for (const disclosure of [privacyScreen, storeDeclaration, reviewNotes, assurance]) {
    assert.match(disclosure, /Bin Day/);
    assert.match(disclosure, /selected street address/);
  }
});

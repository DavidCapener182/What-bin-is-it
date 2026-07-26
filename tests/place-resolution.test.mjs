import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNearestPostcodeUrl,
  matchingAddressId,
  normalisePostcode,
} from '../src/lib/place-resolution.ts';

test('normalises postcode input before matching a saved place', () => {
  assert.equal(normalisePostcode(' sw1a1aa '), 'SW1A 1AA');
  assert.equal(matchingAddressId([
    { id: 'home', postcode: 'M1 1AE' },
    { id: 'work', postcode: 'SW1A 1AA' },
  ], 'sw1a1aa'), 'work');
});

test('builds a nearest-postcode request from device coordinates', () => {
  const url = new URL(buildNearestPostcodeUrl(51.501, -0.142));
  assert.equal(url.origin, 'https://api.postcodes.io');
  assert.equal(url.pathname, '/postcodes');
  assert.equal(url.searchParams.get('lat'), '51.501');
  assert.equal(url.searchParams.get('lon'), '-0.142');
  assert.equal(url.searchParams.get('limit'), '1');
});

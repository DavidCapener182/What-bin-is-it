import assert from 'node:assert/strict';
import test from 'node:test';
import { collectionDataStateFor, hasUpcomingCollections } from '../src/lib/collection-state.ts';

const now = new Date(2026, 8, 6, 15, 10);
const past = [{ date: '2026-09-04' }];
const upcoming = [{ date: '2026-09-06' }, { date: '2026-09-11' }];

test('expired saved dates do not count as a usable cached schedule', () => {
  assert.equal(hasUpcomingCollections(past, now), false);
  assert.equal(collectionDataStateFor({ collections: past, lastError: 'Unavailable' }, now), 'error');
  assert.equal(collectionDataStateFor({ collections: past }, now), 'empty');
});

test('today and future dates remain visible on a failed refresh', () => {
  assert.equal(hasUpcomingCollections(upcoming, now), true);
  assert.equal(collectionDataStateFor({ collections: upcoming, lastError: 'Unavailable' }, now), 'cached');
  assert.equal(collectionDataStateFor({ collections: upcoming }, now), 'ready');
});

test('an empty schedule reports the lookup error without claiming saved dates', () => {
  assert.equal(collectionDataStateFor({ collections: [], lastError: 'Unavailable' }, now), 'error');
  assert.equal(collectionDataStateFor({ collections: [] }, now), 'empty');
});

test('collection expiry follows the local calendar day at midnight', () => {
  const collection = [{ date: '2026-09-06' }];
  assert.equal(hasUpcomingCollections(collection, new Date(2026, 8, 6, 23, 59)), true);
  assert.equal(hasUpcomingCollections(collection, new Date(2026, 8, 7, 0, 0)), false);
});

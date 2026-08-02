import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCollectionLiveSurfaceSnapshot } from '../src/widgets/collection-live-surface-data.ts';

const address = {
  id: 'home',
  label: 'Home',
  line1: 'Saved locally',
  postcode: 'L36 7XA',
  councilName: 'Knowsley Council',
  providerId: 'lad-e08000011',
  isPrimary: true,
};

test('creates a bin-night surface only for today or tomorrow collections', () => {
  const tomorrow = [{ id: 'general-1', date: '2026-08-03', wasteType: 'general', label: 'Maroon general waste bin', colour: '#86243E', source: 'council', verified: true }];
  const snapshot = buildCollectionLiveSurfaceSnapshot(address, tomorrow, [], new Date('2026-08-02T18:00:00Z'));
  assert.equal(snapshot?.state, 'not-out');
  assert.equal(snapshot?.headline, 'Maroon general waste bin tonight');
  assert.equal(snapshot?.binColour, '#86243E');
  assert.equal(buildCollectionLiveSurfaceSnapshot(address, [{ ...tomorrow[0], date: '2026-08-06' }], [], new Date('2026-08-02T18:00:00Z')), undefined);
});

test('reflects collection outcomes in the live surface', () => {
  const collections = [{ id: 'r-1', date: '2026-08-03', wasteType: 'recycling', label: 'Grey recycling bin', colour: '#7C878E', source: 'council', verified: true }];
  const putOut = [{ id: 'home:r-1', addressId: 'home', collectionId: 'r-1', collectionDate: '2026-08-03', wasteType: 'recycling', status: 'put-out', updatedAt: '2026-08-02T19:00:00Z' }];
  const collected = [{ ...putOut[0], status: 'collected' }];
  assert.equal(buildCollectionLiveSurfaceSnapshot(address, collections, putOut, new Date('2026-08-02T19:30:00Z'))?.state, 'put-out');
  assert.equal(buildCollectionLiveSurfaceSnapshot(address, collections, collected, new Date('2026-08-03T09:00:00Z'))?.state, 'collected');
});

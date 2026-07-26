import assert from 'node:assert/strict';
import test from 'node:test';

import { verifiedCollectionsOnly } from '../src/lib/collection-safety.ts';

test('rejects sample and mock collection dates from persisted state', () => {
  const collections = verifiedCollectionsOnly([
    { id: 'old-sample', date: '2026-07-27', wasteType: 'recycling', source: 'sample' },
    { id: 'old-mock', date: '2026-08-03', wasteType: 'general', source: 'mock' },
    { id: 'verified', date: '2026-08-04', wasteType: 'food', source: 'council' },
  ]);

  assert.deepEqual(collections, [
    { id: 'verified', date: '2026-08-04', wasteType: 'food', source: 'council' },
  ]);
});

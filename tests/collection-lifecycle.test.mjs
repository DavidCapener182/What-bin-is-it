import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveCollectionLifecycle } from '../src/lib/collection-lifecycle.ts';

const collection = {
  id: 'general-2026-07-27',
  date: '2026-07-27',
  wasteType: 'general',
  source: 'council',
  label: 'General waste bin',
};

test('moves a collection through bin night, live round and outcome confirmation', () => {
  const before = deriveCollectionLifecycle(
    collection,
    undefined,
    [],
    new Date('2026-07-26T20:00:00+01:00'),
  );
  assert.equal(before.stage, 'before');
  assert.equal(before.canMarkPutOut, true);
  assert.equal(before.canReportMissed, false);

  const collecting = deriveCollectionLifecycle(
    collection,
    { id: 'home:general', addressId: 'home', collectionId: collection.id, collectionDate: collection.date, wasteType: 'general', status: 'put-out', updatedAt: '2026-07-26T20:00:00.000Z' },
    [],
    new Date('2026-07-27T12:00:00+01:00'),
  );
  assert.equal(collecting.stage, 'in-progress');
  assert.equal(collecting.canReportMissed, false);

  const awaiting = deriveCollectionLifecycle(
    collection,
    undefined,
    [],
    new Date('2026-07-27T17:30:00+01:00'),
    { eligibleAfter: new Date('2026-07-27T16:30:00+01:00'), reason: 'Council-specific window.' },
  );
  assert.equal(awaiting.stage, 'awaiting-confirmation');
  assert.equal(awaiting.canReportMissed, true);
});

test('uses the council reporting threshold and suppresses reports during a disruption', () => {
  const beforeCouncilCutoff = deriveCollectionLifecycle(
    collection,
    undefined,
    [],
    new Date('2026-07-27T17:30:00+01:00'),
    { eligibleAfter: new Date('2026-07-27T22:00:00+01:00'), reason: 'Crews collect until 10:00 pm.' },
  );
  assert.equal(beforeCouncilCutoff.canReportMissed, false);
  assert.match(beforeCouncilCutoff.blockedReason, /10:00 pm/);

  const disrupted = deriveCollectionLifecycle(
    collection,
    undefined,
    [{
      id: 'delay-1',
      addressId: 'home',
      title: 'Collection delayed',
      detail: 'Leave the bin outside while crews catch up.',
      sourceUrl: 'https://example.gov.uk/delay',
      startsAt: '2026-07-27T09:00:00+01:00',
      endsAt: '2026-07-28T12:00:00+01:00',
      verifiedAt: '2026-07-27T09:00:00+01:00',
    }],
    new Date('2026-07-27T22:30:00+01:00'),
  );
  assert.equal(disrupted.canReportMissed, false);
  assert.match(disrupted.blockedReason, /paused/);
});

test('stores a confirmed outcome as a completed lifecycle state', () => {
  const completed = deriveCollectionLifecycle(
    collection,
    { id: 'home:general', addressId: 'home', collectionId: collection.id, collectionDate: collection.date, wasteType: 'general', status: 'collected', updatedAt: '2026-07-27T18:00:00.000Z' },
  );
  assert.equal(completed.stage, 'collected');
  assert.equal(completed.canConfirmCollected, false);
  assert.equal(completed.canReportMissed, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCreateHousehold, parseHouseholdAction, parseJoinHousehold } from '../server/lib/resident-households.ts';

test('accepts a council-scoped household without an address or postcode', () => {
  assert.deepEqual(parseCreateHousehold({ councilProviderId: 'lad-e08000011', displayName: 'Home household', memberName: 'David' }), {
    councilProviderId: 'lad-e08000011', displayName: 'Home household', memberName: 'David',
  });
  assert.throws(() => parseCreateHousehold({ councilProviderId: 'unknown', displayName: 'Home household', memberName: 'David' }), /not recognised/);
});

test('validates invite and collection action boundaries', () => {
  const householdId = '11111111-1111-4111-8111-111111111111';
  const memberId = '22222222-2222-4222-8222-222222222222';
  assert.deepEqual(parseHouseholdAction({ householdId, collectionDate: '2026-08-03', wasteType: 'general', action: 'assigned', responsibleUserId: memberId }), {
    householdId, collectionDate: '2026-08-03', wasteType: 'general', action: 'assigned', responsibleUserId: memberId,
  });
  assert.throws(() => parseHouseholdAction({ householdId, collectionDate: '2026-08-03', wasteType: 'glass', action: 'assigned' }), /invalid/);
  assert.throws(() => parseJoinHousehold({ token: 'short', memberName: 'Sarah' }), /invalid/);
});

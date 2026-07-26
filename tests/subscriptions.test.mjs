import assert from 'node:assert/strict';
import test from 'node:test';

import {
  plusEntitlementIdentifier,
  unavailableSubscriptionSnapshot,
} from '../src/lib/subscriptions.ts';

test('uses one stable entitlement across Apple and Google', () => {
  assert.equal(plusEntitlementIdentifier, 'plus');
});

test('does not pretend that web purchases are available', () => {
  assert.deepEqual(unavailableSubscriptionSnapshot, {
    available: false,
    configured: false,
    isPlus: false,
    message: 'Subscriptions are available in the installed iPhone and Android apps.',
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { removeAddressFromState } from '../src/lib/address-state.ts';

test('removes an address, its schedule, and activates the next saved place', () => {
  assert.deepEqual(removeAddressFromState({
    addresses: [
      { id: 'home', isPrimary: true },
      { id: 'family', isPrimary: false },
    ],
    activeAddressId: 'home',
    schedulesByAddressId: {
      home: { collections: ['home'] },
      family: { collections: ['family'] },
    },
  }, 'home'), {
    addresses: [{ id: 'family', isPrimary: true }],
    activeAddressId: 'family',
    schedulesByAddressId: {
      family: { collections: ['family'] },
    },
  });
});

test('leaves state unchanged when the requested address is not present', () => {
  const state = {
    addresses: [{ id: 'home', isPrimary: true }],
    activeAddressId: 'home',
    schedulesByAddressId: { home: { collections: [] } },
  };
  assert.equal(removeAddressFromState(state, 'missing'), state);
});

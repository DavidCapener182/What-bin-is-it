import assert from 'node:assert/strict';
import test from 'node:test';

import {
  entitlementIsPlus,
  entitlementLabel,
  freeEntitlement,
  isEntitlementPlan,
} from '../src/lib/entitlements.ts';

test('new and signed-out residents remain on the free entitlement', () => {
  assert.deepEqual(freeEntitlement, {
    planId: 'free',
    source: 'free',
    status: 'free',
    isPlus: false,
  });
  assert.equal(entitlementIsPlus({ planId: 'free', status: 'active' }), false);
  assert.equal(entitlementLabel('free'), 'Free');
});

test('accepts only the supported resident plan identifiers', () => {
  assert.equal(isEntitlementPlan('plus-monthly'), true);
  assert.equal(isEntitlementPlan('plus-yearly'), true);
  assert.equal(isEntitlementPlan('plus-lifetime'), true);
  assert.equal(isEntitlementPlan('council-admin'), false);
});

test('recognises active access and rejects failed or expired access', () => {
  assert.equal(entitlementIsPlus({ planId: 'plus-yearly', status: 'active' }), false);
  assert.equal(entitlementIsPlus({ planId: 'plus-monthly', status: 'trialing' }), false);
  assert.equal(entitlementIsPlus({ planId: 'plus-lifetime', status: 'active' }), true);
  assert.equal(entitlementIsPlus({ planId: 'plus-lifetime', status: 'payment_failed' }), false);
  assert.equal(entitlementIsPlus({ planId: 'plus-yearly', status: 'expired' }), false);
});

test('keeps access through a valid billing grace period', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');
  assert.equal(entitlementIsPlus({
    planId: 'plus-monthly',
    status: 'grace',
    currentPeriodEnd: '2026-07-28T12:00:00.000Z',
    now,
  }), true);
  assert.equal(entitlementIsPlus({
    planId: 'plus-monthly',
    status: 'past_due',
    currentPeriodEnd: '2026-07-26T12:00:00.000Z',
    now,
  }), false);
});

test('keeps cancelled access only until its paid period ends', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');
  assert.equal(entitlementIsPlus({
    planId: 'plus-yearly',
    status: 'canceled',
    currentPeriodEnd: '2026-07-28T12:00:00.000Z',
    now,
  }), true);
  assert.equal(entitlementIsPlus({
    planId: 'plus-yearly',
    status: 'canceled',
    currentPeriodEnd: '2026-07-26T12:00:00.000Z',
    now,
  }), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseEffectiveGrant,
  providerGrantIsActive,
} from '../src/lib/entitlement-grants.ts';

const base = {
  user_id: '00000000-0000-0000-0000-000000000001',
  external_key: 'purchase',
  product_id: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  provider_event_at: '2026-07-27T12:00:00.000Z',
};

test('a cancellation keeps access only through its paid period', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');
  assert.equal(providerGrantIsActive({
    plan_id: 'plus-yearly',
    status: 'canceled',
    current_period_end: '2026-07-28T12:00:00.000Z',
  }, now), true);
  assert.equal(providerGrantIsActive({
    plan_id: 'plus-yearly',
    status: 'canceled',
    current_period_end: '2026-07-26T12:00:00.000Z',
  }, now), false);
});

test('an expired provider cannot remove another active provider grant', () => {
  const effective = chooseEffectiveGrant([
    {
      ...base,
      source: 'apple',
      plan_id: 'plus-monthly',
      status: 'expired',
      current_period_end: '2026-07-26T12:00:00.000Z',
    },
    {
      ...base,
      source: 'stripe',
      external_key: 'subscription:sub_live',
      plan_id: 'plus-yearly',
      status: 'active',
      current_period_end: '2027-07-27T12:00:00.000Z',
    },
  ], new Date('2026-07-27T12:00:00.000Z'));
  assert.equal(effective?.source, 'stripe');
  assert.equal(effective?.plan_id, 'plus-yearly');
});

test('lifetime access wins over renewable grants', () => {
  const effective = chooseEffectiveGrant([
    {
      ...base,
      source: 'stripe',
      plan_id: 'plus-yearly',
      status: 'active',
      current_period_end: '2027-07-27T12:00:00.000Z',
    },
    {
      ...base,
      source: 'google',
      external_key: 'GPA.123',
      plan_id: 'plus-lifetime',
      status: 'active',
      current_period_end: null,
    },
  ]);
  assert.equal(effective?.source, 'google');
  assert.equal(effective?.plan_id, 'plus-lifetime');
});

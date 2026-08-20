import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  commercialGuardrails,
  commercialLaunchPhase,
  councilPlans,
  permanentlyFreeFeatures,
  propertyPlans,
  residentPaymentsEnabled,
  residentPlans,
} from '../src/lib/commercial-offer.ts';

test('keeps the public-utility core permanently free', () => {
  assert.deepEqual(permanentlyFreeFeatures, [
    'one-address',
    'verified-schedule',
    'standard-reminder',
    'bank-holiday-changes',
    'recycling-guide',
    'local-services',
    'missed-bin-route',
    'service-alerts',
  ]);
  assert.ok(commercialGuardrails.some((guardrail) => guardrail.includes('Do not paywall')));
});

test('ships in proof mode without resident payment prompts', () => {
  assert.equal(commercialLaunchPhase, 'proof');
  assert.equal(residentPaymentsEnabled(), false);
});

test('the Plus route keeps web checkout hidden during the proof phase', async () => {
  const source = await readFile(new URL('../src/app/plus.tsx', import.meta.url), 'utf8');
  assert.match(source, /paymentsEnabled && Platform\.OS === 'web'/);
  assert.doesNotMatch(source, /subscription\.sponsoredBy \? null : Platform\.OS === 'web'/);
});

test('uses stable product identifiers and the agreed annual recommendation', () => {
  const annual = residentPlans.find((plan) => plan.id === 'plus-yearly');
  assert.equal(annual?.price, '£14.99');
  assert.equal(annual?.recommended, true);
  assert.equal(annual?.storeProductId, 'uk.whatbinistonight.plus.yearly');
  assert.equal(new Set(residentPlans.map((plan) => plan.storeProductId).filter(Boolean)).size, 3);
});

test('contains the council and property offer without claiming a live integration', () => {
  assert.deepEqual(councilPlans.map((plan) => plan.price), ['£7,500', '£15,000', '£25,000–£40,000']);
  assert.deepEqual(propertyPlans.map((plan) => plan.price), ['£49', '£99', '£249']);
  assert.ok(councilPlans.every((plan) => plan.audience === 'council'));
  assert.ok(propertyPlans.every((plan) => plan.audience === 'property'));
});

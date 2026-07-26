import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isTrustedPushEndpoint,
  parsePushReminders,
  parsePushSubscription,
  signRunId,
  verifyRunToken,
} from '../server/lib/push-reminders.ts';

const subscription = {
  endpoint: 'https://web.push.apple.com/QPUSH/v1/example',
  expirationTime: null,
  keys: {
    p256dh: 'B'.repeat(87),
    auth: 'C'.repeat(22),
  },
};

test('accepts recognised browser push services and rejects arbitrary HTTPS targets', () => {
  assert.equal(isTrustedPushEndpoint(subscription.endpoint), true);
  assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com/fcm/send/example'), true);
  assert.equal(isTrustedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true);
  assert.equal(isTrustedPushEndpoint('https://example.com/internal-webhook'), false);
  assert.equal(isTrustedPushEndpoint('http://web.push.apple.com/example'), false);
});

test('normalises a browser push subscription without accepting extra data', () => {
  assert.deepEqual(parsePushSubscription(subscription), subscription);
  assert.throws(() => parsePushSubscription({
    ...subscription,
    endpoint: 'https://example.com/internal-webhook',
  }), /recognised browser push service/);
});

test('keeps only bounded future bin reminders', () => {
  const reminders = parsePushReminders([
    {
      id: 'general-2026-07-31',
      collectionId: 'general-1',
      triggerAt: '2026-07-30T18:00:00.000Z',
      title: 'Bin reminder',
      body: 'General waste collection is tomorrow. Put it out before 7am.',
      url: '/schedule',
    },
  ], new Date('2026-07-26T12:00:00.000Z'));

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].tag, 'collection-general-1');
  assert.throws(() => parsePushReminders([{
    ...reminders[0],
    triggerAt: '2025-01-01T12:00:00.000Z',
  }], new Date('2026-07-26T12:00:00.000Z')), /future/);
});

test('signs cancellation tokens so one install cannot cancel a guessed run', () => {
  const token = signRunId('wrun_example', 'test-private-key');
  assert.equal(verifyRunToken('wrun_example', token, 'test-private-key'), true);
  assert.equal(verifyRunToken('wrun_other', token, 'test-private-key'), false);
  assert.equal(verifyRunToken('wrun_example', 'invalid', 'test-private-key'), false);
});

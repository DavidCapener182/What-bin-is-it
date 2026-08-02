import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCouncilAlertRegistration,
  parseCouncilBroadcastRequest,
  parseExpoPushToken,
} from '../server/lib/council-alert-push.ts';

const webSubscription = {
  endpoint: 'https://web.push.apple.com/QPUSH/v1/example',
  expirationTime: null,
  keys: {
    p256dh: 'B'.repeat(87),
    auth: 'C'.repeat(22),
  },
};

test('keeps a council alert registration anonymous and council bounded', () => {
  assert.deepEqual(parseCouncilAlertRegistration({
    installationId: '123e4567-e89b-42d3-a456-426614174000',
    subscriptions: [{
      councilId: 'lad-e08000011',
      collectionTypes: ['general', 'food', 'general'],
      collectionDates: ['2026-08-03', '2026-08-03'],
      audienceLabels: [],
    }],
    channel: 'web-push',
    delivery: webSubscription,
    enabled: true,
  }), {
    installationId: '123e4567-e89b-42d3-a456-426614174000',
    subscriptions: [{
      councilId: 'lad-e08000011',
      collectionTypes: ['general', 'food'],
      collectionDates: ['2026-08-03'],
      audienceLabels: [],
    }],
    channel: 'web-push',
    delivery: webSubscription,
    enabled: true,
  });

  assert.throws(() => parseCouncilAlertRegistration({
    installationId: '123e4567-e89b-42d3-a456-426614174000',
    subscriptions: [{
      councilId: 'lad-e08000011',
      collectionTypes: [],
      collectionDates: [],
      audienceLabels: [],
    }],
    channel: 'web-push',
    delivery: { ...webSubscription, postcode: 'L36 7XA' },
    enabled: true,
  }), /unexpected/);

  assert.throws(() => parseCouncilAlertRegistration({
    installationId: '123e4567-e89b-42d3-a456-426614174000',
    subscriptions: [{
      councilId: 'lad-e08000011',
      collectionTypes: [],
      collectionDates: [],
      audienceLabels: [],
      postcode: 'L36 7XA',
    }],
    channel: 'web-push',
    delivery: webSubscription,
    enabled: true,
  }), /unexpected/);
});

test('accepts current Expo push token formats only', () => {
  assert.equal(
    parseExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'),
    'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  );
  assert.equal(
    parseExpoPushToken('ExpoPushToken[yyyyyyyyyyyyyyyyyyyyyy]'),
    'ExpoPushToken[yyyyyyyyyyyyyyyyyyyyyy]',
  );
  assert.throws(() => parseExpoPushToken('https://example.com/push'), /Expo push token/);
});

test('requires an authorised bounded broadcast job request', () => {
  assert.deepEqual(parseCouncilBroadcastRequest({
    jobId: '123e4567-e89b-42d3-a456-426614174000',
  }), {
    jobId: '123e4567-e89b-42d3-a456-426614174000',
  });
  assert.throws(() => parseCouncilBroadcastRequest({ jobId: '../../all' }), /broadcast job/);
});

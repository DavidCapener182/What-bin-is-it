import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  parseNewResidentSupportThread,
  parseResidentSupportReply,
} from '../server/lib/resident-support-validation.ts';

const requestId = '9f660fd6-b416-4b43-915b-8df48f23626b';
const messageId = 'f0f23452-ecdf-42e7-89c2-d3f970d0527d';

test('accepts a bounded in-app support message with an optional verified council', () => {
  assert.deepEqual(parseNewResidentSupportThread({
    topic: 'notifications',
    detail: 'My reminder did not arrive.',
    councilProviderId: 'lad-e08000011',
    councilName: 'Knowsley Council',
    clientRequestId: requestId,
  }), {
    topic: 'notifications',
    detail: 'My reminder did not arrive.',
    councilProviderId: 'lad-e08000011',
    councilName: 'Knowsley',
    clientRequestId: requestId,
  });
});

test('routes a resident thread by the verified directory council, not a supplied label', () => {
  assert.equal(parseNewResidentSupportThread({
    topic: 'app-help',
    detail: 'Please help.',
    councilProviderId: 'lad-e08000014',
    councilName: 'A different council',
    clientRequestId: requestId,
  }).councilName, 'Sefton');
  assert.throws(() => parseNewResidentSupportThread({
    topic: 'app-help',
    detail: 'Please help.',
    councilProviderId: 'lad-e99999999',
    councilName: 'Invented council',
    clientRequestId: requestId,
  }), /verified/);
});

test('rejects copied identity, postcode and email fields from support payloads', () => {
  for (const forbidden of ['email', 'postcode', 'address', 'residentName']) {
    assert.throws(() => parseNewResidentSupportThread({
      topic: 'app-help',
      detail: 'Please help.',
      clientRequestId: requestId,
      [forbidden]: 'must-not-be-accepted',
    }), /invalid field/);
  }
});

test('requires idempotency references and rejects extra reply fields', () => {
  assert.deepEqual(parseResidentSupportReply({
    threadId: requestId,
    detail: 'Thanks, that fixed it.',
    clientMessageId: messageId,
  }), {
    threadId: requestId,
    detail: 'Thanks, that fixed it.',
    clientMessageId: messageId,
  });
  assert.throws(() => parseResidentSupportReply({
    threadId: requestId,
    detail: 'Reply',
    clientMessageId: messageId,
    email: 'resident@example.com',
  }), /invalid field/);
});

test('resident support routes require a verified account and remain inside the app', async () => {
  const [screen, listRoute, createRoute, replyRoute] = await Promise.all([
    readFile(new URL('../src/app/support.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/api/support/threads.get.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/api/support/threads.post.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/api/support/reply.post.ts', import.meta.url), 'utf8'),
  ]);

  for (const route of [listRoute, createRoute, replyRoute]) {
    assert.match(route, /requireBinAccount\(event\.req\)/);
    assert.match(route, /cache-control['"]?:? ['"]no-store/);
  }
  assert.match(screen, /Message sent\. Replies will appear here in the app\./);
  assert.match(screen, /Send reply/);
  assert.doesNotMatch(screen, /mailto:|github\.com\/.*issues/i);
});

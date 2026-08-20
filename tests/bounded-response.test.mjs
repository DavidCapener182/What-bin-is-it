import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BoundedResponseError,
  fetchBoundedResponseJson,
  readBoundedResponseJson,
} from '../src/lib/bounded-response.ts';

test('bounds streamed resident-side JSON responses', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(16).fill(65));
    },
    cancel() {
      cancelled = true;
    },
  }));
  await assert.rejects(
    readBoundedResponseJson(response, 24),
    (error) => error instanceof BoundedResponseError && error.code === 'too-large',
  );
  assert.equal(cancelled, true);
});

test('parses ordinary resident-side JSON within its byte budget', async () => {
  assert.deepEqual(
    await readBoundedResponseJson(Response.json({ ok: true }), 1_024),
    { ok: true },
  );
});

test('keeps the resident timeout active while the response body is stalled', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => new Response(new ReadableStream({
    start(controller) {
      init.signal.addEventListener('abort', () => {
        controller.error(new DOMException('Timed out', 'AbortError'));
      }, { once: true });
    },
  }));
  try {
    await assert.rejects(
      fetchBoundedResponseJson('https://example.test/stalled', {
        maximumBytes: 1_024,
        timeoutMs: 20,
      }),
      /too long to respond/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

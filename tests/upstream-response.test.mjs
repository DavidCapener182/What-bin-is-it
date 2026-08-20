import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  UpstreamResponseError,
  readBoundedUpstreamJson,
  readBoundedUpstreamText,
  upstreamResponseErrorCodes,
  withUpstreamTimeout,
} from '../api/_gateway/upstream-response.ts';

function assertStableSizeError(error) {
  assert.ok(error instanceof UpstreamResponseError);
  assert.equal(error.name, 'UpstreamResponseError');
  assert.equal(error.code, upstreamResponseErrorCodes.tooLarge);
  assert.equal(error.message, 'The upstream response exceeded the allowed size.');
  return true;
}

test('rejects a declared oversized upstream response before buffering it', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"ok":true}'));
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = new Response(body, { headers: { 'content-length': '4096' } });
  await assert.rejects(
    readBoundedUpstreamJson(response, 128),
    assertStableSizeError,
  );
  assert.equal(cancelled, true);
});

test('caps chunked upstream responses by bytes and cancels the stream', async () => {
  let pulls = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array(8).fill(65));
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = new Response(body);
  await assert.rejects(
    readBoundedUpstreamText(response, 15),
    assertStableSizeError,
  );
  assert.ok(pulls >= 2);
  assert.equal(cancelled, true);
});

test('parses ordinary bounded JSON and gives malformed JSON a stable error', async () => {
  assert.deepEqual(
    await readBoundedUpstreamJson(Response.json({ ok: true }), 1_024),
    { ok: true },
  );
  await assert.rejects(
    readBoundedUpstreamJson(new Response('{not-json}'), 1_024),
    (error) => {
      assert.ok(error instanceof UpstreamResponseError);
      assert.equal(error.code, upstreamResponseErrorCodes.invalidJson);
      assert.equal(error.message, 'The upstream response was not valid JSON.');
      return true;
    },
  );
});

test('preserves AbortError so existing adapter timeout handling remains intact', async () => {
  const response = new Response(new ReadableStream({
    pull(controller) {
      controller.error(new DOMException('Timed out', 'AbortError'));
    },
  }));
  await assert.rejects(
    readBoundedUpstreamText(response, 1_024),
    (error) => error instanceof Error && error.name === 'AbortError',
  );
});

test('keeps the timeout active while a bounded response body is stalled', async () => {
  const startedAt = Date.now();
  await assert.rejects(
    withUpstreamTimeout(20, async (signal) => {
      const response = new Response(new ReadableStream({
        start(controller) {
          signal.addEventListener('abort', () => {
            controller.error(new DOMException('Timed out', 'AbortError'));
          }, { once: true });
        },
      }));
      return readBoundedUpstreamText(response, 1_024);
    }),
    (error) => error instanceof Error && error.name === 'AbortError',
  );
  assert.ok(Date.now() - startedAt < 1_000);
});

test('normalises non-timeout stream failures without leaking upstream details', async () => {
  const response = new Response(new ReadableStream({
    pull(controller) {
      controller.error(new Error('socket included a private upstream hostname'));
    },
  }));
  await assert.rejects(
    readBoundedUpstreamText(response, 1_024),
    (error) => {
      assert.ok(error instanceof UpstreamResponseError);
      assert.equal(error.code, upstreamResponseErrorCodes.readFailed);
      assert.equal(error.message, 'The upstream response could not be read.');
      assert.doesNotMatch(error.message, /private upstream hostname/);
      return true;
    },
  );
});

test('all audited gateway adapters use the shared bounded reader', async () => {
  const sources = await Promise.all([
    '../api/_gateway/council-partner-adapter.ts',
    '../api/_gateway/nationwide-bin-source.ts',
    '../api/_gateway/openstreetmap-services.ts',
    '../api/_gateway/adapter-registry.ts',
    '../api/_gateway/knowsley-mendix.ts',
  ].map((relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8')));

  for (const source of sources) {
    assert.match(source, /readBoundedUpstream(?:Json|Text)/);
    assert.doesNotMatch(source, /\b(?:response|postcodeResponse)\.(?:json|text)\(\)/);
  }
  assert.match(sources[2], /withUpstreamTimeout/);
  assert.match(sources[3], /withUpstreamTimeout/);
  assert.match(sources[4], /maximumXasResponseBytes = 1_048_576/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ApiRequestBodyError,
  apiError,
  apiRequestId,
  readBoundedJson,
  readBoundedRequestBytes,
} from '../server/lib/api-http.ts';

test('API errors have one stable request-ID envelope and response header', () => {
  const requestId = apiRequestId(new Request('https://example.test/api', {
    headers: { 'x-request-id': 'caller-request-123' },
  }));
  const response = apiError(requestId, 400, 'INVALID_REQUEST', 'The request was invalid.');
  assert.notEqual(requestId, 'caller-request-123');
  assert.match(requestId, /^[0-9a-f-]{36}$/);
  assert.equal(response.headers.get('x-request-id'), requestId);
  return response.json().then((payload) => assert.deepEqual(payload, {
    error: 'The request was invalid.',
    code: 'INVALID_REQUEST',
    errorCode: 'INVALID_REQUEST',
    requestId,
  }));
});

test('API request IDs ignore all caller-supplied correlation IDs', () => {
  const first = apiRequestId(new Request('https://example.test/api', {
    headers: { 'x-request-id': 'caller-request-123' },
  }));
  const second = apiRequestId(new Request('https://example.test/api', {
    headers: { 'x-request-id': 'caller-request-123' },
  }));
  assert.notEqual(first, second);
});

test('bounded reader rejects a declared body before consuming it', async () => {
  const request = new Request('https://example.test/api', {
    method: 'POST',
    headers: { 'content-length': '999' },
    body: 'small',
  });
  await assert.rejects(
    readBoundedRequestBytes(request, 8),
    (error) => error instanceof ApiRequestBodyError
      && error.code === 'REQUEST_BODY_TOO_LARGE'
      && error.status === 413,
  );
});

test('bounded reader counts streamed bytes when content-length is absent', async () => {
  const request = new Request('https://example.test/api', {
    method: 'POST',
    duplex: 'half',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(5));
        controller.enqueue(new Uint8Array(5));
        controller.close();
      },
    }),
  });
  await assert.rejects(
    readBoundedRequestBytes(request, 8),
    (error) => error instanceof ApiRequestBodyError && error.code === 'REQUEST_BODY_TOO_LARGE',
  );
});

test('bounded JSON requires JSON content type and rejects malformed JSON', async () => {
  await assert.rejects(
    readBoundedJson(new Request('https://example.test/api', { method: 'POST', body: '{}' }), 8),
    (error) => error instanceof ApiRequestBodyError && error.status === 415,
  );
  await assert.rejects(
    readBoundedJson(new Request('https://example.test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }), 8),
    (error) => error instanceof ApiRequestBodyError && error.code === 'INVALID_JSON',
  );
});

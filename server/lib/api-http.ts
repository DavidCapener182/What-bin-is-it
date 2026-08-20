import { randomUUID } from 'node:crypto';

import { BinAccountAuthenticationError } from './bin-auth.ts';
import { createApiErrorEnvelope } from '../../shared/api-contracts.ts';

const jsonContentType = /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i;

export class ApiRequestBodyError extends Error {
  readonly code: 'INVALID_CONTENT_TYPE' | 'INVALID_JSON' | 'REQUEST_BODY_TOO_LARGE';
  readonly status: 400 | 413 | 415;

  constructor(
    code: ApiRequestBodyError['code'],
    message: string,
    status: ApiRequestBodyError['status'],
  ) {
    super(message);
    this.name = 'ApiRequestBodyError';
    this.code = code;
    this.status = status;
  }
}

export function apiRequestId(_request?: Request) {
  // Public caller headers are untrusted. Generate the ingress identifier here;
  // internal gateway propagation is handled explicitly by its proxy route.
  return randomUUID();
}

function apiHeaders(requestId: string, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-request-id', requestId);
  return headers;
}

export function apiJson(
  requestId: string,
  body: unknown,
  init: Omit<ResponseInit, 'headers'> & { headers?: HeadersInit } = {},
) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: apiHeaders(requestId, init.headers),
  });
}

export function apiError(
  requestId: string,
  status: number,
  code: string,
  message: string,
  extraHeaders?: HeadersInit,
) {
  return apiJson(
    requestId,
    createApiErrorEnvelope(code, message, requestId),
    { status, headers: extraHeaders },
  );
}

export function apiNoContent(
  requestId: string,
  status = 204,
  extraHeaders?: HeadersInit,
) {
  const headers = apiHeaders(requestId, extraHeaders);
  headers.delete('content-type');
  return new Response(null, { status, headers });
}

function declaredBodyLength(request: Request) {
  const value = request.headers.get('content-length');
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new ApiRequestBodyError('INVALID_JSON', 'The request body was invalid.', 400);
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export async function readBoundedRequestBytes(request: Request, maximumBytes: number) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new TypeError('maximumBytes must be a positive safe integer.');
  }
  const declaredLength = declaredBodyLength(request);
  if (declaredLength !== undefined && declaredLength > maximumBytes) {
    await request.body?.cancel().catch(() => undefined);
    throw new ApiRequestBodyError(
      'REQUEST_BODY_TOO_LARGE',
      `The request body must be no larger than ${maximumBytes} bytes.`,
      413,
    );
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ApiRequestBodyError(
          'REQUEST_BODY_TOO_LARGE',
          `The request body must be no larger than ${maximumBytes} bytes.`,
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readBoundedText(request: Request, maximumBytes: number) {
  const bytes = await readBoundedRequestBytes(request, maximumBytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ApiRequestBodyError('INVALID_JSON', 'The request body was invalid.', 400);
  }
}

export async function readBoundedJson<T = unknown>(request: Request, maximumBytes: number): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!jsonContentType.test(contentType)) {
    await request.body?.cancel().catch(() => undefined);
    throw new ApiRequestBodyError(
      'INVALID_CONTENT_TYPE',
      'Send the request body as application/json.',
      415,
    );
  }
  const text = await readBoundedText(request, maximumBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiRequestBodyError('INVALID_JSON', 'The request body was not valid JSON.', 400);
  }
}

export function apiRequestBodyErrorResponse(
  requestId: string,
  error: unknown,
  extraHeaders?: HeadersInit,
) {
  return error instanceof ApiRequestBodyError
    ? apiError(requestId, error.status, error.code, error.message, extraHeaders)
    : undefined;
}

export function apiAuthenticationErrorResponse(requestId: string, error: unknown) {
  return error instanceof BinAccountAuthenticationError
    ? apiError(requestId, error.status, error.code, error.message)
    : undefined;
}

export function apiUnexpectedErrorResponse(
  requestId: string,
  route: string,
  error: unknown,
  message: string,
  status: 500 | 502 | 503 = 500,
  extraHeaders?: HeadersInit,
) {
  logApiFailure(requestId, route, error);
  return apiError(requestId, status, 'REQUEST_FAILED', message, extraHeaders);
}

export function logApiFailure(requestId: string, route: string, error: unknown) {
  console.error(JSON.stringify({
    level: 'error',
    event: 'api_request_failed',
    requestId,
    route,
    errorName: error instanceof Error ? error.name : 'UnknownError',
  }));
}

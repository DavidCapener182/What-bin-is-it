export const upstreamResponseErrorCodes = {
  invalidJson: 'UPSTREAM_RESPONSE_INVALID_JSON',
  readFailed: 'UPSTREAM_RESPONSE_READ_FAILED',
  tooLarge: 'UPSTREAM_RESPONSE_TOO_LARGE',
} as const;

export type UpstreamResponseErrorCode = (
  typeof upstreamResponseErrorCodes[keyof typeof upstreamResponseErrorCodes]
);

const errorMessages: Record<UpstreamResponseErrorCode, string> = {
  UPSTREAM_RESPONSE_INVALID_JSON: 'The upstream response was not valid JSON.',
  UPSTREAM_RESPONSE_READ_FAILED: 'The upstream response could not be read.',
  UPSTREAM_RESPONSE_TOO_LARGE: 'The upstream response exceeded the allowed size.',
};

export class UpstreamResponseError extends Error {
  readonly code: UpstreamResponseErrorCode;

  constructor(code: UpstreamResponseErrorCode) {
    super(errorMessages[code]);
    this.name = 'UpstreamResponseError';
    this.code = code;
  }
}

function validMaximumBytes(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError('The upstream response byte limit must be a positive safe integer.');
  }
  return value;
}

async function readBoundedUpstreamBytes(response: Response, maximumBytes: number) {
  const limit = validMaximumBytes(maximumBytes);
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    try {
      await response.body?.cancel();
    } catch {
      // The stable size error remains authoritative if cancellation also fails.
    }
    throw new UpstreamResponseError(upstreamResponseErrorCodes.tooLarge);
  }
  if (!response.body) return new Uint8Array();

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = response.body.getReader();
  } catch {
    throw new UpstreamResponseError(upstreamResponseErrorCodes.readFailed);
  }
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > limit) {
        try {
          await reader.cancel();
        } catch {
          // The stable size error remains authoritative if cancellation also fails.
        }
        throw new UpstreamResponseError(upstreamResponseErrorCodes.tooLarge);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof UpstreamResponseError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new UpstreamResponseError(upstreamResponseErrorCodes.readFailed);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readBoundedUpstreamText(response: Response, maximumBytes: number) {
  const bytes = await readBoundedUpstreamBytes(response, maximumBytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new UpstreamResponseError(upstreamResponseErrorCodes.readFailed);
  }
}

export async function readBoundedUpstreamJson(response: Response, maximumBytes: number) {
  const text = await readBoundedUpstreamText(response, maximumBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new UpstreamResponseError(upstreamResponseErrorCodes.invalidJson);
  }
}

export function isUpstreamResponseError(
  error: unknown,
  code?: UpstreamResponseErrorCode,
): error is UpstreamResponseError {
  return error instanceof UpstreamResponseError && (!code || error.code === code);
}

export async function withUpstreamTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('The upstream timeout must be a positive safe integer.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

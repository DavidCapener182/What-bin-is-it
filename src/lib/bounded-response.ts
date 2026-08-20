export class BoundedResponseError extends Error {
  readonly code: 'invalid-json' | 'read-failed' | 'too-large';

  constructor(code: 'invalid-json' | 'read-failed' | 'too-large') {
    super(code === 'too-large'
      ? 'The service response was too large.'
      : code === 'invalid-json'
        ? 'The service response was not valid JSON.'
        : 'The service response could not be read.');
    this.name = 'BoundedResponseError';
    this.code = code;
  }
}

async function readBoundedBytes(response: Response, maximumBytes: number) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new TypeError('The response byte limit must be a positive safe integer.');
  }
  const declaredHeader = response.headers.get('content-length');
  if (declaredHeader && /^\d+$/.test(declaredHeader) && Number(declaredHeader) > maximumBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new BoundedResponseError('too-large');
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    try {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maximumBytes) throw new BoundedResponseError('too-large');
      return bytes;
    } catch (error) {
      if (error instanceof BoundedResponseError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new BoundedResponseError('read-failed');
    }
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BoundedResponseError('too-large');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof BoundedResponseError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new BoundedResponseError('read-failed');
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readBoundedResponseJson(response: Response, maximumBytes: number) {
  const bytes = await readBoundedBytes(response, maximumBytes);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new BoundedResponseError('read-failed');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BoundedResponseError('invalid-json');
  }
}

export async function fetchBoundedResponseJson(
  input: string,
  {
    init,
    maximumBytes,
    timeoutMs,
  }: {
    init?: RequestInit;
    maximumBytes: number;
    timeoutMs: number;
  },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    let payload: unknown;
    if (response.ok) {
      payload = await readBoundedResponseJson(response, maximumBytes);
    } else {
      try {
        payload = await readBoundedResponseJson(response, maximumBytes);
      } catch (error) {
        // Error pages are not guaranteed to be JSON. They are still consumed
        // through the same byte limit while the abort deadline remains active.
        if (!(error instanceof BoundedResponseError)) throw error;
      }
    }
    return { payload, response };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The service took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

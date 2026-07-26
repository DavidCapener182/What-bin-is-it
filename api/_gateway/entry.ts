import gateway from './index.ts';

export const config = { runtime: 'nodejs' };

type VercelNodeRequest = {
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
};

type VercelNodeResponse = {
  end(body?: string): void;
  setHeader(name: string, value: string): void;
  statusCode: number;
};

function requestHeaders(values: VercelNodeRequest['headers']) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(values)) {
    if (Array.isArray(value)) headers.set(name, value.join(', '));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

function requestBody(method: string, body: unknown) {
  if (method === 'GET' || method === 'HEAD' || body === undefined) return undefined;
  return typeof body === 'string' ? body : JSON.stringify(body);
}

export default async function handler(request: VercelNodeRequest, response: VercelNodeResponse) {
  const method = request.method?.toUpperCase() ?? 'GET';
  const url = new URL(request.url ?? '/', 'https://what-bin-is-it-tonight.local');
  const result = await gateway.fetch(new Request(url, {
    body: requestBody(method, request.body),
    headers: requestHeaders(request.headers),
    method,
  }));

  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(await result.text());
}

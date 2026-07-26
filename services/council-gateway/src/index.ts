import { getAdapter } from './adapter-registry';

type CollectionRequest = { postcode?: unknown; addressId?: unknown; providerId?: unknown };

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function isPostcode(value: unknown): value is string {
  return typeof value === 'string' && /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i.test(value.trim());
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'binday-uk-council-gateway' });
    if (request.method !== 'POST' || url.pathname !== '/v1/collections') return json({ error: 'Not found' }, 404);

    let body: CollectionRequest;
    try {
      body = await request.json() as CollectionRequest;
    } catch {
      return json({ error: 'Expected a JSON body.' }, 400);
    }

    if (!isPostcode(body.postcode)) return json({ error: 'A complete UK postcode is required.' }, 400);
    if (typeof body.providerId !== 'string' || !/^[a-z0-9-]+$/.test(body.providerId)) return json({ error: 'Unknown council provider.' }, 400);

    const adapter = getAdapter(body.providerId);
    if (!adapter) return json({ error: 'This council provider has not been connected yet.' }, 404);

    try {
      const result = await adapter.getCollections({ postcode: body.postcode.trim().toUpperCase(), addressId: typeof body.addressId === 'string' ? body.addressId : undefined });
      return json(result);
    } catch (error) {
      console.error('Council provider failed', body.providerId, error);
      return json({ error: 'The council source is temporarily unavailable.' }, 502);
    }
  },
};

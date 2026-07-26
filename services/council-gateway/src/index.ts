import { getAdapter } from './adapter-registry';

type CollectionRequest = { postcode?: unknown; addressId?: unknown; providerId?: unknown };
const wasteTypes = new Set(['general', 'recycling', 'garden', 'food']);
const serviceTypes = new Set(['recycling-centre', 'recycling-point', 'reuse', 'collection']);

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function isPostcode(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const postcode = normalisePostcode(value);
  return /^(GIR 0AA|(?:(?:[A-PR-UWYZ]\d[\dA-HJKSTUW]?|[A-PR-UWYZ][A-HK-Y]\d[\dABEHMNPRVWXY]?) \d[ABD-HJLNP-UW-Z]{2}))$/i.test(postcode);
}

function normalisePostcode(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

function validCoordinate(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function validCollectionResult(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const result = value as {
    councilName?: unknown;
    providerId?: unknown;
    verifiedAt?: unknown;
    collections?: unknown;
  };
  return (
    typeof result.councilName === 'string'
    && typeof result.providerId === 'string'
    && typeof result.verifiedAt === 'string'
    && !Number.isNaN(Date.parse(result.verifiedAt))
    && Array.isArray(result.collections)
    && result.collections.every((collection) => {
      if (!collection || typeof collection !== 'object') return false;
      const item = collection as { date?: unknown; wasteType?: unknown };
      return typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && wasteTypes.has(item.wasteType as string);
    })
  );
}

function validServiceResult(value: unknown) {
  return Array.isArray(value) && value.every((service) => {
    if (!service || typeof service !== 'object') return false;
    const item = service as {
      id?: unknown;
      name?: unknown;
      type?: unknown;
      latitude?: unknown;
      longitude?: unknown;
    };
    return (
      typeof item.id === 'string'
      && typeof item.name === 'string'
      && serviceTypes.has(item.type as string)
      && validCoordinate(item.latitude, -90, 90)
      && validCoordinate(item.longitude, -180, 180)
    );
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'what-bin-is-it-tonight-council-gateway' });
    if (request.method === 'GET' && url.pathname === '/v1/services') {
      const postcode = url.searchParams.get('postcode');
      const providerId = url.searchParams.get('providerId');
      if (!isPostcode(postcode)) return json({ error: 'A complete UK postcode is required.' }, 400);
      if (!providerId || !/^[a-z0-9-]+$/.test(providerId)) return json({ error: 'Unknown council provider.' }, 400);
      const adapter = getAdapter(providerId);
      if (!adapter?.getServices) return json({ error: 'This council provider has not connected local services yet.' }, 404);
      try {
        const services = await adapter.getServices({ postcode: normalisePostcode(postcode) });
        if (!validServiceResult(services)) return json({ error: 'The council service source returned an invalid response.' }, 502);
        return json({ services });
      } catch (error) {
        console.error('Council service provider failed', providerId, error);
        return json({ error: 'The council service source is temporarily unavailable.' }, 502);
      }
    }
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
      const result = await adapter.getCollections({ postcode: normalisePostcode(body.postcode), addressId: typeof body.addressId === 'string' ? body.addressId : undefined });
      if (!validCollectionResult(result) || result.providerId !== adapter.id) {
        return json({ error: 'The council source returned an invalid response.' }, 502);
      }
      return json(result);
    } catch (error) {
      console.error('Council provider failed', body.providerId, error);
      return json({ error: 'The council source is temporarily unavailable.' }, 502);
    }
  },
};

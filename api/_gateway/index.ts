import { getAdapter } from './adapter-registry.ts';
import { fetchOpenStreetMapServices } from './openstreetmap-services.ts';

type CollectionRequest = { postcode?: unknown; addressId?: unknown; providerId?: unknown };
const wasteTypes = new Set(['general', 'recycling', 'garden', 'food', 'other']);
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

function icsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function nextCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function calendarResponse(
  result: { councilName: string; providerId: string; collections: { date: string; wasteType: string; label?: string }[] },
  allowedWasteTypes: Set<string>,
) {
  const events = result.collections
    .filter((collection) => allowedWasteTypes.has(collection.wasteType))
    .map((collection, index) => {
      const date = collection.date.replace(/-/g, '');
      const label = collection.label || `${collection.wasteType[0].toUpperCase()}${collection.wasteType.slice(1)} waste`;
      return [
        'BEGIN:VEVENT',
        `UID:${icsText(`${result.providerId}-${collection.date}-${collection.wasteType}-${index}@what-bin-is-it-tonight`)}`,
        `DTSTART;VALUE=DATE:${date}`,
        `DTEND;VALUE=DATE:${nextCalendarDate(collection.date)}`,
        `SUMMARY:${icsText(`${label} collection`)}`,
        `DESCRIPTION:${icsText(`Live collection date supplied by ${result.councilName}. Refresh this subscription before relying on changed dates.`)}`,
        'END:VEVENT',
      ].join('\r\n');
    });
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//What Bin Is It Tonight//Live council dates//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Bin collections',
    'X-PUBLISHED-TTL:PT12H',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
  return new Response(body, {
    status: 200,
    headers: {
      ...headers,
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="bin-collections.ics"',
      'cache-control': 'public, max-age=1800, s-maxage=1800',
    },
  });
}

function publicError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.length > 0
    ? error.message.slice(0, 180)
    : fallback;
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
    alerts?: unknown;
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
      const details = collection as { label?: unknown; colour?: unknown };
      return (
        typeof item.date === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
        && wasteTypes.has(item.wasteType as string)
        && (details.label === undefined || (
          typeof details.label === 'string'
          && details.label.length > 0
          && details.label.length <= 80
        ))
        && (details.colour === undefined || (
          typeof details.colour === 'string'
          && /^#[0-9A-F]{6}$/.test(details.colour)
        ))
      );
    })
    && (
      result.alerts === undefined
      || (
        Array.isArray(result.alerts)
        && result.alerts.length <= 20
        && result.alerts.every((alert) => {
          if (!alert || typeof alert !== 'object') return false;
          const item = alert as Record<string, unknown>;
          return (
            typeof item.id === 'string'
            && item.id.length > 0
            && item.id.length <= 120
            && typeof item.title === 'string'
            && item.title.length > 0
            && item.title.length <= 120
            && typeof item.detail === 'string'
            && item.detail.length > 0
            && item.detail.length <= 500
            && typeof item.sourceUrl === 'string'
            && item.sourceUrl.startsWith('https://')
            && typeof item.startsAt === 'string'
            && !Number.isNaN(Date.parse(item.startsAt))
            && typeof item.verifiedAt === 'string'
            && !Number.isNaN(Date.parse(item.verifiedAt))
            && (item.endsAt === undefined || (
              typeof item.endsAt === 'string'
              && !Number.isNaN(Date.parse(item.endsAt))
            ))
            && (item.expectedRecollectionDate === undefined || (
              typeof item.expectedRecollectionDate === 'string'
              && /^\d{4}-\d{2}-\d{2}$/.test(item.expectedRecollectionDate)
            ))
          );
        })
      )
    )
  );
}

function validAddressResult(value: unknown) {
  return Array.isArray(value) && value.every((address) => {
    if (!address || typeof address !== 'object') return false;
    const item = address as { id?: unknown; line1?: unknown; postcode?: unknown };
    return (
      typeof item.id === 'string'
      && /^\d{1,20}$/.test(item.id)
      && typeof item.line1 === 'string'
      && item.line1.length > 0
      && item.line1.length <= 240
      && isPostcode(item.postcode)
    );
  });
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
      source?: unknown;
      materials?: unknown;
      openingHours?: unknown;
      isOpenNow?: unknown;
      operator?: unknown;
      councilOperated?: unknown;
      wheelchairAccessible?: unknown;
    };
    return (
      typeof item.id === 'string'
      && typeof item.name === 'string'
      && serviceTypes.has(item.type as string)
      && validCoordinate(item.latitude, -90, 90)
      && validCoordinate(item.longitude, -180, 180)
      && (item.source === 'council' || item.source === 'openstreetmap')
      && (item.openingHours === undefined || (typeof item.openingHours === 'string' && item.openingHours.length <= 240))
      && (item.isOpenNow === undefined || typeof item.isOpenNow === 'boolean')
      && (item.operator === undefined || (typeof item.operator === 'string' && item.operator.length <= 160))
      && (item.councilOperated === undefined || typeof item.councilOperated === 'boolean')
      && (item.wheelchairAccessible === undefined || typeof item.wheelchairAccessible === 'boolean')
      && (
        item.materials === undefined
        || (
          Array.isArray(item.materials)
          && item.materials.length <= 40
          && item.materials.every((material) => (
            typeof material === 'string'
            && material.length > 0
            && material.length <= 80
          ))
        )
      )
    );
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/api(?=\/)/, '');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method === 'GET' && pathname === '/health') return json({ ok: true, service: 'what-bin-is-it-tonight-council-gateway' });
    if (request.method === 'GET' && pathname === '/v1/addresses') {
      const postcode = url.searchParams.get('postcode');
      const providerId = url.searchParams.get('providerId');
      if (!isPostcode(postcode)) return json({ error: 'A complete UK postcode is required.' }, 400);
      if (!providerId || !/^[a-z0-9-]+$/.test(providerId)) return json({ error: 'Unknown council provider.' }, 400);
      const adapter = getAdapter(providerId);
      if (!adapter?.getAddresses) return json({ error: 'This council does not have a live address search connected yet.' }, 404);
      try {
        const addresses = await adapter.getAddresses(normalisePostcode(postcode));
        if (!validAddressResult(addresses)) return json({ error: 'The council address source returned an invalid response.' }, 502);
        return json({ addresses });
      } catch (error) {
        console.error('Council address provider failed', providerId, error);
        return json({ error: publicError(error, 'The council address search is temporarily unavailable.') }, 502);
      }
    }
    if (request.method === 'GET' && pathname === '/v1/services') {
      const postcode = url.searchParams.get('postcode');
      const providerId = url.searchParams.get('providerId');
      if (!isPostcode(postcode)) return json({ error: 'A complete UK postcode is required.' }, 400);
      if (!providerId || !/^[a-z0-9-]+$/.test(providerId)) return json({ error: 'Unknown council provider.' }, 400);
      const adapter = getAdapter(providerId);
      try {
        const services = adapter?.getServices
          ? (await adapter.getServices({ postcode: normalisePostcode(postcode) }))
            .map((service) => ({ ...service, source: 'council' as const }))
          : await fetchOpenStreetMapServices(normalisePostcode(postcode));
        if (!validServiceResult(services)) return json({ error: 'The council service source returned an invalid response.' }, 502);
        return json({ services });
      } catch (error) {
        console.error('Council service provider failed', providerId, error);
        return json({ error: publicError(error, 'The local service search is temporarily unavailable.') }, 502);
      }
    }
    if (request.method === 'GET' && pathname === '/v1/calendar') {
      const postcode = url.searchParams.get('postcode');
      const providerId = url.searchParams.get('providerId');
      const addressId = url.searchParams.get('addressId') ?? undefined;
      const requestedTypes = (url.searchParams.get('wasteTypes') ?? '')
        .split(',')
        .filter((value) => wasteTypes.has(value));
      const allowedWasteTypes = new Set(requestedTypes.length ? requestedTypes : [...wasteTypes]);
      if (!isPostcode(postcode)) return json({ error: 'A complete UK postcode is required.' }, 400);
      if (!providerId || !/^[a-z0-9-]+$/.test(providerId)) return json({ error: 'Unknown council provider.' }, 400);
      if (addressId && (addressId.length > 120 || /[\r\n]/.test(addressId))) {
        return json({ error: 'The property reference is invalid.' }, 400);
      }
      const adapter = getAdapter(providerId);
      if (!adapter) return json({ error: 'This council provider has not been connected yet.' }, 404);
      try {
        const result = await adapter.getCollections({
          postcode: normalisePostcode(postcode),
          addressId,
        });
        if (!validCollectionResult(result) || result.providerId !== adapter.id) {
          return json({ error: 'The council source returned an invalid response.' }, 502);
        }
        return calendarResponse(result, allowedWasteTypes);
      } catch (error) {
        console.error('Council calendar provider failed', providerId, error);
        return json({ error: publicError(error, 'The live calendar is temporarily unavailable.') }, 502);
      }
    }
    if (request.method !== 'POST' || pathname !== '/v1/collections') return json({ error: 'Not found' }, 404);

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
      return json({ error: publicError(error, 'The council source is temporarily unavailable.') }, 502);
    }
  },
};

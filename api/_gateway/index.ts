import { getAdapter, nationwideFallbackEnabled } from './adapter-registry.ts';
import { councilPartnerRegistryStatus } from './council-partner-adapter.ts';
import { councilProfileFor } from './council-profile.ts';
import { councilPlatformProfile } from './council-platform-content.ts';
import { fetchOpenStreetMapServices } from './openstreetmap-services.ts';
import {
  GatewayCircuitOpenError,
  GatewaySecurityUnavailableError,
  type GatewaySecurityControls,
  workerGatewaySecurityControls,
} from './security-controls.ts';
import { boundedDisplayText, normaliseExternalHttpsUrl } from '../../src/lib/safe-external-url.ts';
import {
  createApiErrorEnvelope,
  isCouncilAddressesResponse,
  isCouncilCollectionRequest,
  isCouncilCollectionResponse,
  type CouncilCollectionRequest,
} from '../../shared/api-contracts.ts';

const wasteTypes = new Set(['general', 'recycling', 'garden', 'food', 'other']);
const serviceTypes = new Set(['recycling-centre', 'recycling-point', 'reuse', 'collection']);
const providerIdPattern = /^lad-[ensw]\d{8}$/;
const maximumCollectionRequestBytes = 8_192;
const canonicalAppOrigin = 'https://what-bin-is-it-tonight.vercel.app';
const localDevelopmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}$/;

const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
};

class RequestBodyTooLargeError extends Error {}

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  return (
    origin === canonicalAppOrigin
    || localDevelopmentOrigin.test(origin)
  );
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !isAllowedOrigin(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-expose-headers': 'x-request-id',
    vary: 'Origin',
  };
}

function errorCodeFor(status: number) {
  if (status === 400) return 'invalid_request';
  if (status === 404) return 'not_found';
  if (status === 413) return 'request_too_large';
  if (status === 429) return 'rate_limited';
  if (status === 502) return 'upstream_unavailable';
  if (status === 503) return 'service_unavailable';
  return 'request_failed';
}

function json(
  body: unknown,
  status = 200,
  responseHeaders: Record<string, string> = {},
  requestId?: string,
) {
  const payload = (
    requestId
    && status >= 400
    && body
    && typeof body === 'object'
    && 'error' in body
  )
    ? {
        ...body,
        ...createApiErrorEnvelope(
          errorCodeFor(status),
          typeof Reflect.get(body, 'error') === 'string'
            ? Reflect.get(body, 'error') as string
            : 'The request failed.',
          requestId,
        ),
      }
    : body;
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...baseHeaders, ...responseHeaders },
  });
}

function createRequestId() {
  return globalThis.crypto.randomUUID();
}

function logGatewayFailure(requestId: string, area: string, providerId: string | undefined, error: unknown) {
  console.error('Council gateway request failed', {
    requestId,
    area,
    providerId,
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
}

async function readBoundedJson(request: Request, maximumBytes: number) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new RequestBodyTooLargeError();
  }

  if (!request.body) throw new SyntaxError('Missing request body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > maximumBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const payload = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)) as unknown;
}

function icsText(value: string) {
  return value
    .replace(/\r\n?|\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function nextCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function calendarResponse(
  result: { councilName: string; providerId: string; collections: { date: string; wasteType: string; label?: string }[] },
  allowedWasteTypes: Set<string>,
  responseHeaders: Record<string, string> = {},
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
      ...baseHeaders,
      ...responseHeaders,
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="bin-collections.ics"',
      'cache-control': 'public, max-age=1800, s-maxage=1800',
    },
  });
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

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validProviderId(value: unknown): value is string {
  return typeof value === 'string' && providerIdPattern.test(value);
}

function validCoordinate(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function validCollectionResult(value: unknown) {
  return isCouncilCollectionResponse(value);
}

function validAddressResult(value: unknown) {
  return isCouncilAddressesResponse({ addresses: value });
}

function isSafeAddressId(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= 120
    && !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isCollectionRequest(value: unknown): value is CouncilCollectionRequest {
  return isCouncilCollectionRequest(value);
}

export function validServiceResult(value: unknown) {
  return Array.isArray(value) && value.length <= 250 && value.every((service) => {
    if (!service || typeof service !== 'object') return false;
    const item = service as {
      address?: unknown;
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
      website?: unknown;
    };
    return (
      typeof item.id === 'string'
      && item.id.length > 0
      && item.id.length <= 120
      && !/[\u0000-\u001f\u007f]/.test(item.id)
      && typeof item.name === 'string'
      && item.name.length > 0
      && item.name.length <= 160
      && !/[\u0000-\u001f\u007f]/.test(item.name)
      && serviceTypes.has(item.type as string)
      && validCoordinate(item.latitude, -90, 90)
      && validCoordinate(item.longitude, -180, 180)
      && (item.source === 'council' || item.source === 'openstreetmap')
      && (item.address === undefined || (
        typeof item.address === 'string'
        && item.address.length > 0
        && item.address.length <= 240
        && !/[\u0000-\u001f\u007f]/.test(item.address)
      ))
      && (item.website === undefined || normaliseExternalHttpsUrl(item.website) !== undefined)
      && (item.openingHours === undefined || boundedDisplayText(item.openingHours, 240) !== undefined)
      && (item.isOpenNow === undefined || typeof item.isOpenNow === 'boolean')
      && (item.operator === undefined || boundedDisplayText(item.operator, 160) !== undefined)
      && (item.councilOperated === undefined || typeof item.councilOperated === 'boolean')
      && (item.wheelchairAccessible === undefined || typeof item.wheelchairAccessible === 'boolean')
      && (
        item.materials === undefined
        || (
          Array.isArray(item.materials)
          && item.materials.length <= 40
          && item.materials.every((material) => (
            boundedDisplayText(material, 80) !== undefined
          ))
        )
      )
    );
  });
}

export function createCouncilGateway(
  securityControls: GatewaySecurityControls = workerGatewaySecurityControls,
) {
  return {
  async fetch(request: Request): Promise<Response> {
    const requestId = createRequestId();
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/api(?=\/)/, '');
    let telemetryProviderId: string | undefined;
    const requestCorsHeaders = corsHeaders(request);
    const respond = (body: unknown, status = 200) => json(body, status, {
      ...requestCorsHeaders,
      'x-request-id': requestId,
      ...(telemetryProviderId ? { 'x-council-provider-id': telemetryProviderId } : {}),
    }, requestId);

    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('origin');
      if (!origin || !isAllowedOrigin(origin)) {
        return respond({ error: 'Origin not accepted.' }, 403);
      }
      return new Response(null, {
        status: 204,
        headers: {
          ...baseHeaders,
          ...requestCorsHeaders,
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '600',
          'x-request-id': requestId,
        },
      });
    }
    if (request.method === 'GET' && pathname === '/health') {
      const partners = councilPartnerRegistryStatus();
      const ready = partners.valid && securityControls.ready();
      return respond({
        ok: ready,
        service: 'what-bin-is-it-tonight-council-gateway',
        councilPartners: partners,
        gates: {
          publicGatewayEnabled: securityControls.enabled(),
          durableAbuseControlsReady: securityControls.ready(),
          nationwideFallbackEnabled: nationwideFallbackEnabled(),
        },
      }, ready ? 200 : 503);
    }
    let rateLimit;
    try {
      rateLimit = await securityControls.consume(request);
    } catch (error) {
      logGatewayFailure(requestId, 'security-controls', undefined, error);
      return respond({ error: 'The public council gateway is not ready.' }, 503);
    }
    if (!rateLimit.allowed) {
      return json(
        { error: 'Too many council lookup requests. Try again shortly.' },
        429,
        {
          ...requestCorsHeaders,
          'retry-after': String(rateLimit.retryAfterSeconds),
          'x-request-id': requestId,
        },
        requestId,
      );
    }
    if (request.method === 'GET' && pathname === '/v1/profile') {
      const providerId = url.searchParams.get('providerId');
      telemetryProviderId = validProviderId(providerId) ? providerId : undefined;
      if (!validProviderId(providerId)) {
        return respond({ error: 'Unknown council provider.' }, 400);
      }
      let verifiedProfile;
      try {
        verifiedProfile = councilProfileFor(providerId);
      } catch (error) {
        logGatewayFailure(requestId, 'profile-registry', providerId, error);
        return respond({ error: 'The council profile registry is invalid.' }, 503);
      }
      try {
        return respond({ profile: await councilPlatformProfile(verifiedProfile) });
      } catch (error) {
        // Council-authored content is an enhancement. Keep the verified static
        // collection profile available if the private platform database is down.
        logGatewayFailure(requestId, 'platform-profile-fallback', providerId, error);
        return respond({ profile: verifiedProfile });
      }
    }
    if (request.method === 'GET' && pathname === '/v1/addresses') {
      const postcode = url.searchParams.get('postcode');
      const providerId = url.searchParams.get('providerId');
      telemetryProviderId = validProviderId(providerId) ? providerId : undefined;
      if (!isPostcode(postcode)) return respond({ error: 'A complete UK postcode is required.' }, 400);
      if (!validProviderId(providerId)) return respond({ error: 'Unknown council provider.' }, 400);
      const adapter = getAdapter(providerId);
      if (!adapter?.getAddresses) return respond({ error: 'This council does not have a live address search connected yet.' }, 404);
      try {
        const addresses = await securityControls.withCircuit(providerId, async () => {
          const result = await adapter.getAddresses!(normalisePostcode(postcode));
          if (!validAddressResult(result)) throw new Error('Invalid council address response.');
          return result;
        });
        return respond({ addresses });
      } catch (error) {
        logGatewayFailure(requestId, 'addresses', providerId, error);
        if (error instanceof GatewayCircuitOpenError || error instanceof GatewaySecurityUnavailableError) {
          return respond({ error: 'The council address search is temporarily unavailable.' }, 503);
        }
        return respond({ error: 'The council address search is temporarily unavailable.' }, 502);
      }
    }
    if (request.method === 'GET' && pathname === '/v1/services') {
      const postcode = url.searchParams.get('postcode');
      const providerId = url.searchParams.get('providerId');
      telemetryProviderId = validProviderId(providerId) ? providerId : undefined;
      if (!isPostcode(postcode)) return respond({ error: 'A complete UK postcode is required.' }, 400);
      if (!validProviderId(providerId)) return respond({ error: 'Unknown council provider.' }, 400);
      const adapter = getAdapter(providerId);
      try {
        const circuitKey = adapter?.getServices ? providerId : 'openstreetmap-services';
        const services = await securityControls.withCircuit(circuitKey, async () => {
          const result = adapter?.getServices
            ? (await adapter.getServices({ postcode: normalisePostcode(postcode) }))
              .map((service) => ({ ...service, source: 'council' as const }))
            : await fetchOpenStreetMapServices(normalisePostcode(postcode));
          if (!validServiceResult(result)) throw new Error('Invalid council service response.');
          return result;
        });
        return respond({ services });
      } catch (error) {
        logGatewayFailure(requestId, 'services', providerId, error);
        if (error instanceof GatewayCircuitOpenError || error instanceof GatewaySecurityUnavailableError) {
          return respond({ error: 'The local service search is temporarily unavailable.' }, 503);
        }
        return respond({ error: 'The local service search is temporarily unavailable.' }, 502);
      }
    }
    if (request.method === 'GET' && pathname === '/v1/calendar') {
      const postcode = url.searchParams.get('postcode');
      const providerId = url.searchParams.get('providerId');
      telemetryProviderId = validProviderId(providerId) ? providerId : undefined;
      const addressId = url.searchParams.get('addressId') ?? undefined;
      const requestedTypes = (url.searchParams.get('wasteTypes') ?? '')
        .split(',')
        .filter((value) => wasteTypes.has(value));
      const allowedWasteTypes = new Set(requestedTypes.length ? requestedTypes : [...wasteTypes]);
      if (!isPostcode(postcode)) return respond({ error: 'A complete UK postcode is required.' }, 400);
      if (!validProviderId(providerId)) return respond({ error: 'Unknown council provider.' }, 400);
      if (addressId !== undefined && !isSafeAddressId(addressId)) {
        return respond({ error: 'The property reference is invalid.' }, 400);
      }
      const adapter = getAdapter(providerId);
      if (!adapter) return respond({ error: 'This council provider has not been connected yet.' }, 404);
      try {
        const result = await securityControls.withCircuit(providerId, async () => {
          const collectionResult = await adapter.getCollections({
            postcode: normalisePostcode(postcode),
            addressId,
          });
          if (!validCollectionResult(collectionResult) || collectionResult.providerId !== adapter.id) {
            throw new Error('Invalid council collection response.');
          }
          return collectionResult;
        });
        return calendarResponse(result, allowedWasteTypes, {
          ...requestCorsHeaders,
          'x-request-id': requestId,
          'x-council-provider-id': providerId,
        });
      } catch (error) {
        logGatewayFailure(requestId, 'calendar', providerId, error);
        if (error instanceof GatewayCircuitOpenError || error instanceof GatewaySecurityUnavailableError) {
          return respond({ error: 'The live calendar is temporarily unavailable.' }, 503);
        }
        return respond({ error: 'The live calendar is temporarily unavailable.' }, 502);
      }
    }
    if (request.method !== 'POST' || pathname !== '/v1/collections') return respond({ error: 'Not found' }, 404);

    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
      return respond({ error: 'Expected a JSON body.' }, 400);
    }

    let parsedBody: unknown;
    try {
      parsedBody = await readBoundedJson(request, maximumCollectionRequestBytes);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return respond({ error: 'The collection request is too large.' }, 413);
      }
      return respond({ error: 'Expected a JSON body.' }, 400);
    }
    if (!isCollectionRequest(parsedBody)) {
      return respond({ error: 'The collection request is invalid.' }, 400);
    }
    const body = parsedBody;

    telemetryProviderId = validProviderId(body.providerId) ? body.providerId : undefined;
    if (!isPostcode(body.postcode)) return respond({ error: 'A complete UK postcode is required.' }, 400);
    if (!validProviderId(body.providerId)) return respond({ error: 'Unknown council provider.' }, 400);
    if (body.addressId !== undefined && !isSafeAddressId(body.addressId)) {
      return respond({ error: 'The property reference is invalid.' }, 400);
    }
    const canonicalPostcode = normalisePostcode(body.postcode);

    const adapter = getAdapter(body.providerId);
    if (!adapter) return respond({ error: 'This council provider has not been connected yet.' }, 404);

    try {
      const result = await securityControls.withCircuit(body.providerId, async () => {
        const collectionResult = await adapter.getCollections({
          postcode: canonicalPostcode,
          addressId: typeof body.addressId === 'string' ? body.addressId : undefined,
        });
        if (!validCollectionResult(collectionResult) || collectionResult.providerId !== adapter.id) {
          throw new Error('Invalid council collection response.');
        }
        return collectionResult;
      });
      return respond(result);
    } catch (error) {
      logGatewayFailure(requestId, 'collections', body.providerId, error);
      if (error instanceof GatewayCircuitOpenError || error instanceof GatewaySecurityUnavailableError) {
        return respond({ error: 'The council source is temporarily unavailable.' }, 503);
      }
      return respond({ error: 'The council source is temporarily unavailable.' }, 502);
    }
  },
  };
}

export default createCouncilGateway();

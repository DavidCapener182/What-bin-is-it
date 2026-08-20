import {
  isUpstreamResponseError,
  readBoundedUpstreamJson,
  upstreamResponseErrorCodes,
} from './upstream-response.ts';
import { gatewayProviderBudgets } from './release-budget.ts';

export type NationwideWasteType = 'general' | 'recycling' | 'garden' | 'food' | 'other';

export type NationwideCollection = {
  date: string;
  wasteType: NationwideWasteType;
  label?: string;
  colour?: string;
};

export type NationwideAddress = {
  id: string;
  line1: string;
  postcode: string;
};

export type NationwideAddressLookup = {
  councilName: string;
  councilSlug: string;
  providerId: string;
  officialUrl?: string;
  addresses: NationwideAddress[];
};

type AddressPayload = {
  postcode?: unknown;
  council?: {
    ladCode?: unknown;
    name?: unknown;
    slug?: unknown;
    supported?: unknown;
    officialUrl?: unknown;
  };
  addresses?: {
    uprn?: unknown;
    display?: unknown;
    postcode?: unknown;
  }[];
};

type CollectionPayload = {
  estimated?: unknown;
  notice?: unknown;
  collections?: {
    date?: unknown;
    type?: unknown;
    label?: unknown;
    colour?: unknown;
  }[];
};

const maximumNationwideResponseBytes = 1024 * 1024;
export const nationwideFetchTimeoutMs = gatewayProviderBudgets.nationwideFetchMs;
export const nationwideCollectionAttemptLimit = 2;
export const nationwideRetryDelayMs = gatewayProviderBudgets.nationwideRetryDelayMs;
export const nationwideMaximumOperationMs = (
  nationwideFetchTimeoutMs * (1 + nationwideCollectionAttemptLimit)
  + nationwideRetryDelayMs * (nationwideCollectionAttemptLimit - 1)
);

function normalisePostcode(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function providerIdForLadCode(value: string) {
  return `lad-${value.toLowerCase()}`;
}

function stripPostcode(display: string, postcode: string) {
  const trimmed = display.trim();
  return trimmed.toUpperCase().endsWith(postcode)
    ? trimmed.slice(0, -postcode.length).replace(/,\s*$/, '').trim()
    : trimmed;
}

export function parseNationwideAddresses(
  value: unknown,
  requestedPostcode: string,
  expectedProviderId: string,
): NationwideAddressLookup {
  if (!value || typeof value !== 'object') {
    throw new Error('The nationwide address source returned an invalid response.');
  }
  const payload = value as AddressPayload;
  const postcode = normalisePostcode(requestedPostcode);
  if (
    normalisePostcode(typeof payload.postcode === 'string' ? payload.postcode : '') !== postcode
    || !payload.council
    || typeof payload.council.ladCode !== 'string'
    || typeof payload.council.name !== 'string'
    || typeof payload.council.slug !== 'string'
    || !/^[a-z0-9-]{1,100}$/.test(payload.council.slug)
  ) {
    throw new Error('The nationwide address source returned an invalid response.');
  }
  const providerId = providerIdForLadCode(payload.council.ladCode);
  if (providerId !== expectedProviderId.toLowerCase()) {
    throw new Error('The postcode source returned a different council than expected.');
  }
  if (payload.council.supported === false) {
    throw new Error(`${payload.council.name} does not expose a public live collection lookup.`);
  }
  if (!Array.isArray(payload.addresses)) {
    throw new Error('The nationwide address source returned an invalid response.');
  }

  const seen = new Set<string>();
  const addresses = payload.addresses.reduce<NationwideAddress[]>((result, address) => {
    if (
      !address
      || (typeof address.uprn !== 'string' && typeof address.uprn !== 'number')
      || typeof address.display !== 'string'
      || typeof address.postcode !== 'string'
    ) return result;
    const id = String(address.uprn).trim();
    const addressPostcode = normalisePostcode(address.postcode);
    const line1 = stripPostcode(address.display, addressPostcode);
    if (
      !/^\d{1,20}$/.test(id)
      || seen.has(id)
      || addressPostcode !== postcode
      || !line1
      || line1.length > 240
    ) return result;
    seen.add(id);
    result.push({ id, line1, postcode: addressPostcode });
    return result;
  }, []);

  return {
    councilName: payload.council.name.trim().slice(0, 160),
    councilSlug: payload.council.slug,
    providerId,
    officialUrl: safeHttpsUrl(payload.council.officialUrl),
    addresses,
  };
}

function classifyWasteType(value: string): NationwideWasteType {
  const normalised = value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(food|caddy|kitchen)\b/.test(normalised)) return 'food';
  if (/\b(garden waste|green waste|compost|organic waste)\b/.test(normalised)) return 'garden';
  if (/\b(recycl\w*|paper|cardboard|card|glass|plastic|carton|metal|cans?)\b/.test(normalised)) return 'recycling';
  if (/\b(general|residual|refuse|rubbish|landfill|non recyclable|domestic waste)\b/.test(normalised)) return 'general';
  return 'other';
}

export function parseNationwideCollections(value: unknown): NationwideCollection[] {
  if (!value || typeof value !== 'object') return [];
  const collections = (value as CollectionPayload).collections;
  if (!Array.isArray(collections)) return [];
  const seen = new Set<string>();
  return collections.reduce<NationwideCollection[]>((result, collection) => {
    if (!collection || !isIsoDate(collection.date)) return result;
    const rawType = typeof collection.type === 'string' ? collection.type.trim() : '';
    const rawLabel = typeof collection.label === 'string' ? collection.label.trim() : '';
    const label = (rawLabel || rawType).slice(0, 80);
    if (!label) return result;
    const key = `${collection.date}|${label.toLowerCase()}`;
    if (seen.has(key)) return result;
    seen.add(key);
    const colour = typeof collection.colour === 'string' && /^#[0-9a-f]{6}$/i.test(collection.colour)
      ? collection.colour.toUpperCase()
      : undefined;
    result.push({
      date: collection.date,
      wasteType: classifyWasteType(`${rawType} ${rawLabel}`),
      label,
      ...(colour ? { colour } : {}),
    });
    return result;
  }, []);
}

async function fetchJson(url: string, timeoutMs = nationwideFetchTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'What Bin Is It Tonight?/1.0',
      },
    });
    let payload: unknown;
    try {
      payload = await readBoundedUpstreamJson(response, maximumNationwideResponseBytes);
    } catch (error) {
      if (!isUpstreamResponseError(error, upstreamResponseErrorCodes.invalidJson)) throw error;
      payload = undefined;
    }
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchNationwideAddressLookup(
  postcode: string,
  expectedProviderId: string,
) {
  const canonicalPostcode = normalisePostcode(postcode);
  const { response, payload } = await fetchJson(
    `https://binday.org.uk/api/addresses?postcode=${encodeURIComponent(canonicalPostcode)}`,
  );
  if (!response.ok) {
    throw new Error('The nationwide exact-address lookup is temporarily unavailable.');
  }
  return parseNationwideAddresses(payload, canonicalPostcode, expectedProviderId);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchNationwideCollections(
  postcode: string,
  addressId: string | undefined,
  expectedProviderId: string,
) {
  if (!addressId || !/^\d{1,20}$/.test(addressId)) {
    throw new Error('Choose your exact property before checking its collection dates.');
  }
  const lookup = await fetchNationwideAddressLookup(postcode, expectedProviderId);
  const address = lookup.addresses.find((candidate) => candidate.id === addressId);
  if (!address) {
    throw new Error('The selected property was not returned for this postcode.');
  }

  const url = new URL('https://binday.org.uk/api/collections');
  url.searchParams.set('postcode', address.postcode);
  url.searchParams.set('uprn', address.id);
  // Bin Day currently requires the selected human-readable address as well as the UPRN.
  // Keep the resident privacy notice and store declarations aligned with this data flow.
  url.searchParams.set('address', `${address.line1} ${address.postcode}`);
  url.searchParams.set('council', lookup.councilSlug);

  let payload: unknown;
  for (let attempt = 0; attempt < nationwideCollectionAttemptLimit; attempt += 1) {
    const result = await fetchJson(url.toString());
    payload = result.payload;
    if (result.response.status === 202) {
      if (attempt === nationwideCollectionAttemptLimit - 1) {
        throw new Error('The council lookup is still processing. Please try again shortly.');
      }
      await wait(nationwideRetryDelayMs);
      continue;
    }
    if (!result.response.ok) {
      const message = payload && typeof payload === 'object' && 'error' in payload
        && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error.slice(0, 180)
        : 'The nationwide collection lookup is temporarily unavailable.';
      throw new Error(message);
    }
    break;
  }

  const typedPayload = payload as CollectionPayload | undefined;
  if (typedPayload?.estimated === true) {
    throw new Error('This source returned only estimated dates, so the app did not save them.');
  }
  const collections = parseNationwideCollections(payload);
  if (!collections.length) throw new Error('No dated collections were returned for this property.');
  return {
    councilName: lookup.councilName,
    providerId: lookup.providerId,
    verifiedAt: new Date().toISOString(),
    notice: `Live ${lookup.councilName} collection data via the Bin Day nationwide council lookup.`,
    collections,
  };
}

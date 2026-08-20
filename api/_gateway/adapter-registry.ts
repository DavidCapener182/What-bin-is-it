import { fetchKnowsleyMendixDates } from './knowsley-mendix.ts';
import {
  fetchNationwideAddressLookup,
  fetchNationwideCollections,
} from './nationwide-bin-source.ts';
import { councilPartnerAdapterFor } from './council-partner-adapter.ts';
import { gatewayProviderBudgets } from './release-budget.ts';
import { readBoundedUpstreamText, withUpstreamTimeout } from './upstream-response.ts';
import type {
  CouncilAddressContract,
  CouncilCollectionResponse,
  CouncilWasteType,
} from '../../shared/api-contracts.ts';

export type WasteType = CouncilWasteType;

export type CollectionInput = { postcode: string; addressId?: string };
export type CollectionOutput = CouncilCollectionResponse;
export type CouncilAddress = CouncilAddressContract;
export type CouncilService = {
  id: string;
  name: string;
  type: 'recycling-centre' | 'recycling-point' | 'reuse' | 'collection';
  address?: string;
  latitude: number;
  longitude: number;
  website?: string;
  materials?: string[];
  openingHours?: string;
  isOpenNow?: boolean;
  operator?: string;
  councilOperated?: boolean;
  wheelchairAccessible?: boolean;
};
export type CouncilAdapter = {
  id: string;
  getCollections(input: CollectionInput): Promise<CollectionOutput>;
  getAddresses?(postcode: string): Promise<CouncilAddress[]>;
  getServices?(input: CollectionInput): Promise<CouncilService[]>;
};

type KnowsleyAddressPayload = {
  FullAddress?: unknown;
  Postcode?: unknown;
  UPRN?: unknown;
};
type KnowsleyCollectionPayload = {
  NextBlue?: unknown;
  NextFood?: unknown;
  NextGrey?: unknown;
  NextMaroon?: unknown;
  Nextmaroon?: unknown;
  Nextgrey?: unknown;
  Nextblue?: unknown;
};

const maximumKnowsleyAddressResponseBytes = 1024 * 1024;

function normalisePostcode(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

function unwrapJson(value: unknown): unknown {
  let current = value;
  for (let attempt = 0; attempt < 2 && typeof current === 'string'; attempt += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      return undefined;
    }
  }
  return current;
}

function parseCouncilDate(value: unknown) {
  if (value && typeof value === 'object' && 'value' in value) {
    return parseCouncilDate((value as { value?: unknown }).value);
  }
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^(?:[A-Za-z]+\s+)?(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return undefined;
  return `${yearText}-${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}`;
}

export function parseKnowsleyAddresses(value: unknown): CouncilAddress[] {
  const payload = unwrapJson(value);
  if (!Array.isArray(payload)) return [];
  const seenIds = new Set<string>();
  const seenAddresses = new Set<string>();
  return payload.reduce<CouncilAddress[]>((addresses, item) => {
    if (!item || typeof item !== 'object') return addresses;
    const candidate = item as KnowsleyAddressPayload;
    if (
      typeof candidate.FullAddress !== 'string'
      || typeof candidate.Postcode !== 'string'
      || (typeof candidate.UPRN !== 'string' && typeof candidate.UPRN !== 'number')
    ) return addresses;
    const id = String(candidate.UPRN).trim();
    const postcode = normalisePostcode(candidate.Postcode);
    if (!/^\d{1,20}$/.test(id) || seenIds.has(id)) return addresses;
    const fullAddress = candidate.FullAddress.trim();
    const line1 = fullAddress.toUpperCase().endsWith(postcode)
      ? fullAddress.slice(0, -postcode.length).replace(/,\s*$/, '').trim()
      : fullAddress;
    if (!line1) return addresses;
    const displayKey = `${line1.toUpperCase()}|${postcode}`;
    if (seenAddresses.has(displayKey)) return addresses;
    seenIds.add(id);
    seenAddresses.add(displayKey);
    addresses.push({ id, line1, postcode });
    return addresses;
  }, []);
}

export function parseKnowsleyCollections(
  value: unknown,
): { date: string; wasteType: WasteType; label?: string; colour?: string }[] {
  const payload = unwrapJson(value);
  const first = Array.isArray(payload) ? payload[0] : payload;
  if (!first || typeof first !== 'object') return [];
  const record = first as KnowsleyCollectionPayload;
  const fields: {
    value: unknown;
    wasteType: WasteType;
    label: string;
    colour?: string;
  }[] = [
    {
      value: record.NextMaroon ?? record.Nextmaroon,
      wasteType: 'general',
      label: 'Maroon general waste bin',
      colour: '#7A263A',
    },
    {
      value: record.NextGrey ?? record.Nextgrey,
      wasteType: 'recycling',
      label: 'Grey recycling bin',
      colour: '#6F777D',
    },
    {
      value: record.NextBlue ?? record.Nextblue,
      wasteType: 'garden',
      label: 'Blue garden waste bin',
      colour: '#286A96',
    },
    {
      value: record.NextFood,
      wasteType: 'food',
      label: 'Food waste caddy',
    },
  ];
  return fields.flatMap(({ value: dateValue, wasteType, label, colour }) => {
    const date = parseCouncilDate(dateValue);
    return date ? [{ date, wasteType, label, ...(colour ? { colour } : {}) }] : [];
  });
}

async function fetchTextWithTimeout(url: string, timeoutMs = gatewayProviderBudgets.knowsleyAddressMs) {
  return withUpstreamTimeout(timeoutMs, async (signal) => {
    const response = await fetch(url, {
      signal,
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'user-agent': 'What Bin Is It Tonight?/1.0',
      },
    });
    return {
      response,
      text: response.ok
        ? await readBoundedUpstreamText(response, maximumKnowsleyAddressResponseBytes)
        : undefined,
    };
  });
}

const knowsleyAdapter: CouncilAdapter = {
  id: 'lad-e08000011',
  async getAddresses(postcode) {
    const search = `${normalisePostcode(postcode).split(' ').join('*')}*`;
    const result = await fetchTextWithTimeout(
      `https://address.knowsley.gov.uk/api/addressSearchstatutory?addresssearch=${encodeURIComponent(search)}`,
    );
    const response = result.response;
    if (!response.ok) throw new Error(`Knowsley address search returned ${response.status}.`);
    const addresses = parseKnowsleyAddresses(result.text);
    return addresses.filter((address) => address.postcode === normalisePostcode(postcode));
  },
  async getCollections(input) {
    if (!input.addressId || !/^\d{1,20}$/.test(input.addressId)) {
      throw new Error('An exact Knowsley property must be selected before checking collection dates.');
    }
    const dates = await fetchKnowsleyMendixDates(
      normalisePostcode(input.postcode),
      input.addressId,
    );
    const collections = parseKnowsleyCollections(dates);
    if (!collections.length) throw new Error('Knowsley returned no dated collections for this property.');
    return {
      councilName: 'Knowsley',
      providerId: 'lad-e08000011',
      verifiedAt: new Date().toISOString(),
      notice: 'Live collection dates from Knowsley Council.',
      collections,
    };
  },
};

/**
 * Add audited live adapters here. Never add demo or generated schedules.
 */
const adapters: Record<string, CouncilAdapter> = {
  [knowsleyAdapter.id]: knowsleyAdapter,
};

export function nationwideFallbackEnabled() {
  return process.env.WHAT_BIN_ENABLE_NATIONWIDE_FALLBACK === 'true';
}

export function getAdapter(providerId: string): CouncilAdapter | undefined {
  const directAdapter = adapters[providerId];
  if (directAdapter) return directAdapter;
  const partnerAdapter = councilPartnerAdapterFor(providerId);
  if (partnerAdapter) return partnerAdapter;
  if (!/^lad-[ensw]\d{8}$/.test(providerId)) return undefined;
  // This route forwards the resident-selected street address to Bin Day. It
  // remains unavailable until the provider contract, retention and store
  // disclosures have been approved and the server-only gate is enabled.
  if (!nationwideFallbackEnabled()) return undefined;
  return {
    id: providerId,
    async getAddresses(postcode) {
      return (await fetchNationwideAddressLookup(postcode, providerId)).addresses;
    },
    async getCollections(input) {
      return fetchNationwideCollections(input.postcode, input.addressId, providerId);
    },
  } satisfies CouncilAdapter;
}

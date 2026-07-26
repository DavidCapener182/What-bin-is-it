export type WasteType = 'general' | 'recycling' | 'garden' | 'food';

export type CollectionInput = { postcode: string; addressId?: string };
export type CollectionOutput = { councilName: string; providerId: string; verifiedAt: string; collections: { date: string; wasteType: WasteType }[]; notice?: string };
export type CouncilAddress = { id: string; line1: string; postcode: string };
export type CouncilService = { id: string; name: string; type: 'recycling-centre' | 'recycling-point' | 'reuse' | 'collection'; address?: string; latitude: number; longitude: number; website?: string };
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
  Nextmaroon?: unknown;
  Nextgrey?: unknown;
  Nextblue?: unknown;
};

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
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
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
  const seen = new Set<string>();
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
    if (!/^\d{1,20}$/.test(id) || seen.has(id)) return addresses;
    const fullAddress = candidate.FullAddress.trim();
    const line1 = fullAddress.toUpperCase().endsWith(postcode)
      ? fullAddress.slice(0, -postcode.length).replace(/,\s*$/, '').trim()
      : fullAddress;
    if (!line1) return addresses;
    seen.add(id);
    addresses.push({ id, line1, postcode });
    return addresses;
  }, []);
}

export function parseKnowsleyCollections(value: unknown): { date: string; wasteType: WasteType }[] {
  const payload = unwrapJson(value);
  const first = Array.isArray(payload) ? payload[0] : payload;
  if (!first || typeof first !== 'object') return [];
  const record = first as KnowsleyCollectionPayload;
  const fields: { value: unknown; wasteType: WasteType }[] = [
    { value: record.Nextmaroon, wasteType: 'general' },
    { value: record.Nextgrey, wasteType: 'recycling' },
    { value: record.Nextblue, wasteType: 'garden' },
  ];
  return fields.flatMap(({ value: dateValue, wasteType }) => {
    const date = parseCouncilDate(dateValue);
    return date ? [{ date, wasteType }] : [];
  });
}

async function fetchWithTimeout(url: string, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'user-agent': 'What Bin Is It Tonight?/1.0',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

const knowsleyAdapter: CouncilAdapter = {
  id: 'lad-e08000011',
  async getAddresses(postcode) {
    const search = `${normalisePostcode(postcode).split(' ').join('*')}*`;
    const response = await fetchWithTimeout(
      `https://address.knowsley.gov.uk/api/addressSearchstatutory?addresssearch=${encodeURIComponent(search)}`,
    );
    if (!response.ok) throw new Error(`Knowsley address search returned ${response.status}.`);
    const addresses = parseKnowsleyAddresses(await response.text());
    return addresses.filter((address) => address.postcode === normalisePostcode(postcode));
  },
  async getCollections(input) {
    if (!input.addressId || !/^\d{1,20}$/.test(input.addressId)) {
      throw new Error('An exact Knowsley property must be selected before checking collection dates.');
    }
    const response = await fetchWithTimeout(
      `https://secured.knowsley.gov.uk/gis/get_refuse?UPRN=${encodeURIComponent(input.addressId)}`,
      25_000,
    );
    if (!response.ok) throw new Error(`Knowsley refuse service returned ${response.status}.`);
    const collections = parseKnowsleyCollections(await response.text());
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

export function getAdapter(providerId: string) {
  return adapters[providerId];
}

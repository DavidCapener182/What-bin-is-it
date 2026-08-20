export type ApiErrorEnvelope = {
  error: string;
  code: string;
  errorCode: string;
  requestId: string;
};

export function createApiErrorEnvelope(
  code: string,
  error: string,
  requestId: string,
): ApiErrorEnvelope {
  return { error, code, errorCode: code, requestId };
}

export function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.error === 'string'
    && item.error.length > 0
    && item.error.length <= 500
    && typeof item.code === 'string'
    && item.code.length > 0
    && item.code.length <= 100
    && item.errorCode === item.code
    && typeof item.requestId === 'string'
    && /^[0-9a-f-]{36}$/i.test(item.requestId);
}

export type CouncilWasteType = 'general' | 'recycling' | 'garden' | 'food' | 'other';

export type CouncilCollectionRequest = {
  postcode: string;
  providerId: string;
  addressId?: string;
};

export type CouncilAddressContract = {
  id: string;
  line1: string;
  postcode: string;
};

export type CouncilCollectionContract = {
  date: string;
  wasteType: CouncilWasteType;
  label?: string;
  colour?: string;
};

export type CouncilDisruptionContract = {
  id: string;
  title: string;
  detail: string;
  sourceUrl: string;
  startsAt: string;
  endsAt?: string;
  expectedRecollectionDate?: string;
  verifiedAt: string;
};

export type CouncilCollectionResponse = {
  councilName: string;
  providerId: string;
  verifiedAt: string;
  collections: CouncilCollectionContract[];
  notice?: string;
  alerts?: CouncilDisruptionContract[];
};

export type CouncilAddressesResponse = { addresses: CouncilAddressContract[] };

const requestKeys = new Set(['postcode', 'providerId', 'addressId']);
const providerPattern = /^lad-[ensw]\d{8}$/;
const postcodePattern = /^(GIR 0AA|(?:(?:[A-PR-UWYZ]\d[\dA-HJKSTUW]?|[A-PR-UWYZ][A-HK-Y]\d[\dABEHMNPRVWXY]?) \d[ABD-HJLNP-UW-Z]{2}))$/i;
const wasteTypes = new Set<CouncilWasteType>(['general', 'recycling', 'garden', 'food', 'other']);

function normalisePostcode(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isTimestamp(value: unknown) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function isText(value: unknown, maximum: number) {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function isHttpsUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isCouncilCollectionRequest(value: unknown): value is CouncilCollectionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).every((key) => requestKeys.has(key))
    && typeof item.postcode === 'string'
    && item.postcode.length <= 12
    && typeof item.providerId === 'string'
    && item.providerId.length <= 32
    && (item.addressId === undefined || (
      typeof item.addressId === 'string'
      && item.addressId.length > 0
      && item.addressId.length <= 120
      && !/[\u0000-\u001f\u007f]/.test(item.addressId)
    ));
}

export function isCouncilAddressesResponse(value: unknown): value is CouncilAddressesResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const addresses = (value as { addresses?: unknown }).addresses;
  return Array.isArray(addresses)
    && addresses.length <= 5_000
    && addresses.every((address) => {
      if (!address || typeof address !== 'object' || Array.isArray(address)) return false;
      const item = address as Record<string, unknown>;
      return isText(item.id, 120)
        && isText(item.line1, 240)
        && typeof item.postcode === 'string'
        && postcodePattern.test(normalisePostcode(item.postcode));
    });
}

export function isCouncilCollectionResponse(value: unknown): value is CouncilCollectionResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (
    !isText(item.councilName, 160)
    || typeof item.providerId !== 'string'
    || !providerPattern.test(item.providerId)
    || !isTimestamp(item.verifiedAt)
    || !Array.isArray(item.collections)
    || item.collections.length > 366
    || (item.notice !== undefined && !isText(item.notice, 500))
  ) return false;
  const collectionsValid = item.collections.every((collection) => {
    if (!collection || typeof collection !== 'object' || Array.isArray(collection)) return false;
    const candidate = collection as Record<string, unknown>;
    return isIsoDate(candidate.date)
      && typeof candidate.wasteType === 'string'
      && wasteTypes.has(candidate.wasteType as CouncilWasteType)
      && (candidate.label === undefined || isText(candidate.label, 80))
      && (candidate.colour === undefined || (
        typeof candidate.colour === 'string' && /^#[0-9a-f]{6}$/i.test(candidate.colour)
      ));
  });
  if (!collectionsValid) return false;
  if (item.alerts === undefined) return true;
  return Array.isArray(item.alerts)
    && item.alerts.length <= 20
    && item.alerts.every((alert) => {
      if (!alert || typeof alert !== 'object' || Array.isArray(alert)) return false;
      const candidate = alert as Record<string, unknown>;
      return isText(candidate.id, 120)
        && isText(candidate.title, 120)
        && isText(candidate.detail, 500)
        && isHttpsUrl(candidate.sourceUrl)
        && isTimestamp(candidate.startsAt)
        && isTimestamp(candidate.verifiedAt)
        && (candidate.endsAt === undefined || isTimestamp(candidate.endsAt))
        && (candidate.expectedRecollectionDate === undefined || isIsoDate(candidate.expectedRecollectionDate));
    });
}

import { Collection, ProviderResult, SavedAddress, WasteType } from '@/lib/types';

type GatewayCollection = { date: string; wasteType: WasteType };
type GatewayResponse = { councilName: string; providerId: string; collections: GatewayCollection[]; verifiedAt: string; notice?: string };

const apiBase = process.env.EXPO_PUBLIC_COUNCIL_API_BASE?.replace(/\/$/, '');

export function normalisePostcode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function isUkPostcode(input: string) {
  return /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i.test(input.trim());
}

/**
 * The app never scrapes a council web page. The gateway owns council-specific adapters,
 * normalises their result, caches it, and returns this stable contract to mobile clients.
 */
export async function fetchCollectionsForAddress(address: SavedAddress): Promise<ProviderResult> {
  if (!apiBase) {
    throw new Error('The national council gateway is not configured for this build.');
  }

  const response = await fetch(`${apiBase}/v1/collections`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postcode: address.postcode, addressId: address.id, providerId: address.providerId }),
  });

  if (!response.ok) throw new Error('The council source could not be reached just now.');
  const payload = (await response.json()) as GatewayResponse;
  return {
    councilName: payload.councilName,
    providerId: payload.providerId,
    verifiedAt: payload.verifiedAt,
    notice: payload.notice,
    collections: payload.collections.map((collection, index): Collection => ({
      id: `${payload.providerId}-${collection.date}-${collection.wasteType}-${index}`,
      date: collection.date,
      wasteType: collection.wasteType,
      source: 'council',
    })),
  };
}

export async function lookupPostcode(postcodeInput: string): Promise<{ line1: string; councilName?: string }> {
  const postcode = normalisePostcode(postcodeInput);
  if (!isUkPostcode(postcode)) throw new Error('Enter a full UK postcode, for example M1 1AE.');

  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
  if (!response.ok) throw new Error('We could not find that postcode. Check the spacing and try again.');
  const payload = (await response.json()) as { result?: { admin_district?: string; parish?: string; region?: string } };
  return {
    line1: payload.result?.parish || payload.result?.admin_district || payload.result?.region || postcode,
    councilName: payload.result?.admin_district,
  };
}

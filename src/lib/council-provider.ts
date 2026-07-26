import { Collection, CouncilService, ProviderResult, SavedAddress, WasteType } from '@/lib/types';
import { findCouncilByName } from '@/lib/council-directory';

type GatewayCollection = { date: string; wasteType: WasteType };
type GatewayResponse = { councilName: string; providerId: string; collections: GatewayCollection[]; verifiedAt: string; notice?: string };
type GatewayServicesResponse = { services: Omit<CouncilService, 'source'>[] };

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

export async function lookupPostcode(postcodeInput: string): Promise<{ line1: string; councilName?: string; providerId?: string; councilCode?: string; latitude?: number; longitude?: number }> {
  const postcode = normalisePostcode(postcodeInput);
  if (!isUkPostcode(postcode)) throw new Error('Enter a full UK postcode, for example M1 1AE.');

  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
  if (!response.ok) throw new Error('We could not find that postcode. Check the spacing and try again.');
  const payload = (await response.json()) as { result?: { admin_district?: string; parish?: string; region?: string; latitude?: number; longitude?: number } };
  const matchedCouncil = findCouncilByName(payload.result?.admin_district);
  return {
    line1: payload.result?.parish || payload.result?.admin_district || payload.result?.region || postcode,
    councilName: matchedCouncil?.name ?? payload.result?.admin_district,
    providerId: matchedCouncil?.providerId,
    councilCode: matchedCouncil?.code,
    latitude: payload.result?.latitude,
    longitude: payload.result?.longitude,
  };
}

function distanceKm(from: SavedAddress, latitude: number, longitude: number) {
  if (from.latitude === undefined || from.longitude === undefined) return undefined;
  const radius = 6371;
  const radians = Math.PI / 180;
  const dLat = (latitude - from.latitude) * radians;
  const dLon = (longitude - from.longitude) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from.latitude * radians) * Math.cos(latitude * radians) * Math.sin(dLon / 2) ** 2;
  return Math.round(radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 10) / 10;
}

export async function fetchNearbyServices(address: SavedAddress): Promise<CouncilService[]> {
  if (apiBase) {
    const response = await fetch(`${apiBase}/v1/services?postcode=${encodeURIComponent(address.postcode)}&providerId=${encodeURIComponent(address.providerId)}`);
    if (response.ok) {
      const payload = (await response.json()) as GatewayServicesResponse;
      if (payload.services.length) return payload.services.map((service) => ({ ...service, source: 'council', distanceKm: distanceKm(address, service.latitude, service.longitude) }));
    }
  }

  if (address.latitude === undefined || address.longitude === undefined) {
    throw new Error('Add a place by postcode first so we can search around it.');
  }

  const query = `[out:json][timeout:20];(nwr["amenity"="recycling"](around:9000,${address.latitude},${address.longitude});nwr["amenity"="waste_transfer_station"](around:9000,${address.latitude},${address.longitude}););out center 20;`;
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Nearby service search is unavailable just now. Try again shortly.');
  const payload = (await response.json()) as { elements?: { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
  const services = (payload.elements ?? []).reduce<CouncilService[]>((found, element) => {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (latitude === undefined || longitude === undefined) return found;
    const tags = element.tags ?? {};
    const isCentre = tags.amenity === 'waste_transfer_station' || /centre|center|household waste|tip/i.test(`${tags.name ?? ''} ${tags.recycling_type ?? ''}`);
    found.push({
      id: `osm-${element.id}`,
      name: tags.name || (isCentre ? 'Household waste site' : 'Recycling point'),
      type: isCentre ? 'recycling-centre' : 'recycling-point',
      address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' ') || undefined,
      latitude,
      longitude,
      distanceKm: distanceKm(address, latitude, longitude),
      source: 'openstreetmap',
      website: tags.website,
    });
    return found;
  }, []);
  return services.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

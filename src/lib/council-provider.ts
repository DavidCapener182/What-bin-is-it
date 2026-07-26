import { Platform } from 'react-native';

import { Collection, CouncilAddressOption, CouncilService, ProviderResult, SavedAddress, WasteType } from '@/lib/types';
import { findCouncilByCode, findCouncilByName } from '@/lib/council-directory';
import {
  buildNearestPostcodeUrl,
  cleanPostcodeLocality,
  isUkPostcode,
  normalisePostcode,
} from '@/lib/place-resolution';

export { isUkPostcode, normalisePostcode } from '@/lib/place-resolution';

type GatewayCollection = { date: string; wasteType: WasteType };
type GatewayResponse = { councilName: string; providerId: string; collections: GatewayCollection[]; verifiedAt: string; notice?: string };
type GatewayAddressesResponse = { addresses: CouncilAddressOption[] };
type GatewayServicesResponse = { services: Omit<CouncilService, 'source'>[] };
type PostcodesIoResult = {
  postcode?: string;
  admin_district?: string;
  parish?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  codes?: { admin_district?: string };
};
export type ResolvedPlace = {
  postcode: string;
  line1: string;
  councilName?: string;
  providerId?: string;
  councilCode?: string;
  latitude?: number;
  longitude?: number;
};

const configuredApiBase = process.env.EXPO_PUBLIC_COUNCIL_API_BASE?.replace(/\/$/, '');
const apiBase = configuredApiBase
  || (Platform.OS === 'web' && typeof globalThis.location?.origin === 'string'
    ? `${globalThis.location.origin}/api`
    : 'https://what-bin-is-it-tonight.vercel.app/api');
export const councilGatewayConfigured = Boolean(apiBase);
const validWasteTypes = new Set<WasteType>(['general', 'recycling', 'garden', 'food']);
const validServiceTypes = new Set<CouncilService['type']>(['recycling-centre', 'recycling-point', 'reuse', 'collection']);

async function fetchWithTimeout(input: string, init?: RequestInit, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The service took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function isFiniteCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

async function gatewayError(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.length <= 180) return payload.error;
  } catch {
    // Some upstreams return an empty or non-JSON error response.
  }
  return fallback;
}

/**
 * The app never scrapes a council web page. The gateway owns council-specific adapters,
 * normalises their result, caches it, and returns this stable contract to mobile clients.
 */
export async function fetchCollectionsForAddress(address: SavedAddress): Promise<ProviderResult> {
  const response = await fetchWithTimeout(`${apiBase}/v1/collections`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      postcode: address.postcode,
      addressId: address.councilAddressId,
      providerId: address.providerId,
    }),
  });

  if (!response.ok) throw new Error(await gatewayError(response, 'The council source could not be reached just now.'));
  const payload = (await response.json()) as GatewayResponse;
  if (
    !payload
    || typeof payload.councilName !== 'string'
    || typeof payload.providerId !== 'string'
    || typeof payload.verifiedAt !== 'string'
    || Number.isNaN(Date.parse(payload.verifiedAt))
    || !Array.isArray(payload.collections)
    || (payload.notice !== undefined && typeof payload.notice !== 'string')
    || payload.collections.some((collection) => !isIsoDate(collection?.date) || !validWasteTypes.has(collection?.wasteType))
  ) {
    throw new Error('The council source returned collection data in an unexpected format.');
  }
  return {
    councilName: payload.councilName,
    providerId: payload.providerId,
    verifiedAt: payload.verifiedAt,
    notice: payload.notice?.slice(0, 240),
    collections: payload.collections.map((collection, index): Collection => ({
      id: `${payload.providerId}-${collection.date}-${collection.wasteType}-${index}`,
      date: collection.date,
      wasteType: collection.wasteType,
      source: 'council',
    })),
  };
}

export async function fetchCouncilAddresses(postcode: string, providerId: string): Promise<CouncilAddressOption[]> {
  const response = await fetchWithTimeout(
    `${apiBase}/v1/addresses?postcode=${encodeURIComponent(postcode)}&providerId=${encodeURIComponent(providerId)}`,
  );
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(await gatewayError(response, 'The council address search is unavailable just now.'));
  const payload = (await response.json()) as GatewayAddressesResponse;
  if (
    !payload
    || !Array.isArray(payload.addresses)
    || payload.addresses.some((address) => (
      !address
      || typeof address.id !== 'string'
      || typeof address.line1 !== 'string'
      || typeof address.postcode !== 'string'
      || !isUkPostcode(address.postcode)
    ))
  ) {
    throw new Error('The council returned its address list in an unexpected format.');
  }
  return payload.addresses.map((address) => ({
    id: address.id.slice(0, 120),
    line1: address.line1.slice(0, 240),
    postcode: normalisePostcode(address.postcode),
  }));
}

function resolvePostcodeResult(result: PostcodesIoResult, fallbackPostcode?: string): ResolvedPlace {
  const postcode = normalisePostcode(result.postcode ?? fallbackPostcode ?? '');
  if (!isUkPostcode(postcode)) throw new Error('We could not match a full postcode to that location.');
  const matchedCouncil = findCouncilByCode(result.codes?.admin_district)
    ?? findCouncilByName(result.admin_district);
  return {
    postcode,
    line1: cleanPostcodeLocality(result.parish, result.admin_district, result.region, postcode),
    councilName: matchedCouncil?.name ?? result.admin_district,
    providerId: matchedCouncil?.providerId,
    councilCode: matchedCouncil?.code,
    latitude: isFiniteCoordinate(result.latitude, -90, 90) ? result.latitude : undefined,
    longitude: isFiniteCoordinate(result.longitude, -180, 180) ? result.longitude : undefined,
  };
}

export async function lookupPostcode(postcodeInput: string): Promise<ResolvedPlace> {
  const postcode = normalisePostcode(postcodeInput);
  if (!isUkPostcode(postcode)) throw new Error('Enter a full UK postcode, for example M1 1AE.');

  const response = await fetchWithTimeout(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
  if (!response.ok) throw new Error('We could not find that postcode. Check the spacing and try again.');
  const payload = (await response.json()) as { result?: PostcodesIoResult };
  if (!payload.result) throw new Error('We could not find that postcode. Check the spacing and try again.');
  return resolvePostcodeResult(payload.result, postcode);
}

export async function lookupNearestPostcode(latitude: number, longitude: number): Promise<ResolvedPlace> {
  const response = await fetchWithTimeout(buildNearestPostcodeUrl(latitude, longitude));
  if (!response.ok) throw new Error('We could not match your location to a UK postcode. Enter it manually instead.');
  const payload = (await response.json()) as { result?: PostcodesIoResult[] };
  const nearest = payload.result?.[0];
  if (!nearest) throw new Error('We could not match your location to a UK postcode. Enter it manually instead.');
  return resolvePostcodeResult(nearest);
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
    const response = await fetchWithTimeout(`${apiBase}/v1/services?postcode=${encodeURIComponent(address.postcode)}&providerId=${encodeURIComponent(address.providerId)}`);
    if (response.ok) {
      const payload = (await response.json()) as GatewayServicesResponse;
      if (
        payload
        && Array.isArray(payload.services)
        && payload.services.every((service) => (
          service
          && typeof service.id === 'string'
          && typeof service.name === 'string'
          && validServiceTypes.has(service.type)
          && isFiniteCoordinate(service.latitude, -90, 90)
          && isFiniteCoordinate(service.longitude, -180, 180)
        ))
        && payload.services.length
      ) {
        return payload.services
          .map((service) => ({ ...service, source: 'council' as const, distanceKm: distanceKm(address, service.latitude, service.longitude) }))
          .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      }
    }
  }

  if (address.latitude === undefined || address.longitude === undefined) {
    throw new Error('Add a place by postcode first so we can search around it.');
  }

  const query = `[out:json][timeout:20];(nwr["amenity"="recycling"](around:9000,${address.latitude},${address.longitude});nwr["amenity"="waste_transfer_station"](around:9000,${address.latitude},${address.longitude}););out center 20;`;
  const response = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
  }, 25_000);
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

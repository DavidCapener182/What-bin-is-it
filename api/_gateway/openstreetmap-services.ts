import { parseRecyclingMaterials } from '../../src/lib/recycling-materials.ts';
import {
  boundedDisplayText,
  boundedStringRecord,
  normaliseExternalHttpsUrl,
} from '../../src/lib/safe-external-url.ts';
import { readBoundedUpstreamJson, withUpstreamTimeout } from './upstream-response.ts';
import { gatewayProviderBudgets } from './release-budget.ts';

export type OpenStreetMapService = {
  id: string;
  name: string;
  type: 'recycling-centre' | 'recycling-point';
  address?: string;
  latitude: number;
  longitude: number;
  source: 'openstreetmap';
  website?: string;
  materials: string[];
  openingHours?: string;
  isOpenNow?: boolean;
  operator?: string;
  councilOperated?: boolean;
  wheelchairAccessible?: boolean;
};

type OpenStreetMapPayload = {
  elements?: {
    id?: unknown;
    lat?: unknown;
    lon?: unknown;
    center?: { lat?: unknown; lon?: unknown };
    tags?: Record<string, string>;
  }[];
};

const maximumPostcodeResponseBytes = 64 * 1024;
const maximumOpenStreetMapResponseBytes = 1024 * 1024;

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function parseOpenStreetMapServices(payload: unknown): OpenStreetMapService[] {
  if (!payload || typeof payload !== 'object') return [];
  const elements = (payload as OpenStreetMapPayload).elements;
  if (!Array.isArray(elements)) return [];
  return elements.reduce<OpenStreetMapService[]>((services, element) => {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (
      !(
        (typeof element.id === 'number' && Number.isSafeInteger(element.id) && element.id > 0)
        || (typeof element.id === 'string' && /^\d{1,20}$/.test(element.id))
      )
      || !validCoordinate(latitude, -90, 90)
      || !validCoordinate(longitude, -180, 180)
    ) return services;
    const tags = boundedStringRecord(element.tags);
    const isCentre = tags.amenity === 'waste_transfer_station'
      || /centre|center|household waste|tip/i.test(`${tags.name ?? ''} ${tags.recycling_type ?? ''}`);
    const openingHours = boundedDisplayText(tags.opening_hours, 240);
    const operator = boundedDisplayText(tags.operator, 160);
    const address = boundedDisplayText(
      [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
        .map((part) => boundedDisplayText(part, 100))
        .filter(Boolean)
        .join(' '),
      240,
    );
    const wheelchairAccessible = tags.wheelchair === 'yes'
      ? true
      : tags.wheelchair === 'no'
        ? false
        : undefined;
    services.push({
      id: `osm-${element.id}`,
      name: boundedDisplayText(tags.name, 160)
        ?? (isCentre ? 'Household waste site' : 'Recycling point'),
      type: isCentre ? 'recycling-centre' : 'recycling-point',
      address,
      latitude,
      longitude,
      source: 'openstreetmap',
      website: normaliseExternalHttpsUrl(tags.website),
      materials: parseRecyclingMaterials(tags),
      ...(openingHours ? { openingHours } : {}),
      ...(openingHours === '24/7' ? { isOpenNow: true } : {}),
      ...(operator ? { operator } : {}),
      ...(/\bcouncil\b/i.test(operator ?? '') ? { councilOperated: true } : {}),
      ...(wheelchairAccessible !== undefined ? { wheelchairAccessible } : {}),
    });
    return services;
  }, []);
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
  maximumBytes: number,
) {
  return withUpstreamTimeout(timeoutMs, async (signal) => {
    const response = await fetch(url, {
      ...init,
      signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'What Bin Is It Tonight?/1.0',
        ...init?.headers,
      },
    });
    return {
      response,
      payload: response.ok
        ? await readBoundedUpstreamJson(response, maximumBytes)
        : undefined,
    };
  });
}

export async function fetchOpenStreetMapServices(postcode: string) {
  const postcodeResult = await fetchJsonWithTimeout(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
    undefined,
    gatewayProviderBudgets.postcodeLocationMs,
    maximumPostcodeResponseBytes,
  );
  const postcodeResponse = postcodeResult.response;
  if (!postcodeResponse.ok) throw new Error(`Postcode location lookup returned ${postcodeResponse.status}.`);
  const postcodePayload = postcodeResult.payload as {
    result?: { latitude?: unknown; longitude?: unknown };
  };
  const latitude = postcodePayload.result?.latitude;
  const longitude = postcodePayload.result?.longitude;
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
    throw new Error('The postcode source did not return usable coordinates.');
  }

  const query = `[out:json][timeout:10];(nwr["amenity"="recycling"](around:6000,${latitude},${longitude});nwr["amenity"="waste_transfer_station"](around:6000,${latitude},${longitude}););out center 30;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];
  let lastStatus: number | undefined;
  let receivedValidResponse = false;
  for (const endpoint of endpoints) {
    try {
      const result = await fetchJsonWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: `data=${encodeURIComponent(query)}`,
        },
        gatewayProviderBudgets.openStreetMapEndpointMs,
        maximumOpenStreetMapResponseBytes,
      );
      const response = result.response;
      if (!response.ok) {
        lastStatus = response.status;
        continue;
      }
      const services = parseOpenStreetMapServices(result.payload);
      receivedValidResponse = true;
      if (services.length) return services;
    } catch {
      // Try the next community Overpass endpoint within the function time budget.
    }
  }
  if (receivedValidResponse) return [];
  throw new Error(lastStatus
    ? `OpenStreetMap service search returned ${lastStatus}. Please try again.`
    : 'OpenStreetMap service search is temporarily unavailable. Please try again.');
}

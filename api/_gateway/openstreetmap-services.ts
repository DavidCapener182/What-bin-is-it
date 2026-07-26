export type OpenStreetMapService = {
  id: string;
  name: string;
  type: 'recycling-centre' | 'recycling-point';
  address?: string;
  latitude: number;
  longitude: number;
  source: 'openstreetmap';
  website?: string;
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
      (typeof element.id !== 'string' && typeof element.id !== 'number')
      || !validCoordinate(latitude, -90, 90)
      || !validCoordinate(longitude, -180, 180)
    ) return services;
    const tags = element.tags ?? {};
    const isCentre = tags.amenity === 'waste_transfer_station'
      || /centre|center|household waste|tip/i.test(`${tags.name ?? ''} ${tags.recycling_type ?? ''}`);
    services.push({
      id: `osm-${element.id}`,
      name: tags.name || (isCentre ? 'Household waste site' : 'Recycling point'),
      type: isCentre ? 'recycling-centre' : 'recycling-point',
      address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
        .filter(Boolean)
        .join(' ') || undefined,
      latitude,
      longitude,
      source: 'openstreetmap',
      website: tags.website,
    });
    return services;
  }, []);
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 25_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'What Bin Is It Tonight?/1.0',
        ...init?.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchOpenStreetMapServices(postcode: string) {
  const postcodeResponse = await fetchWithTimeout(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
    undefined,
    15_000,
  );
  if (!postcodeResponse.ok) throw new Error(`Postcode location lookup returned ${postcodeResponse.status}.`);
  const postcodePayload = await postcodeResponse.json() as {
    result?: { latitude?: unknown; longitude?: unknown };
  };
  const latitude = postcodePayload.result?.latitude;
  const longitude = postcodePayload.result?.longitude;
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
    throw new Error('The postcode source did not return usable coordinates.');
  }

  const query = `[out:json][timeout:20];(nwr["amenity"="recycling"](around:9000,${latitude},${longitude});nwr["amenity"="waste_transfer_station"](around:9000,${latitude},${longitude}););out center 20;`;
  const response = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`OpenStreetMap service search returned ${response.status}.`);
  return parseOpenStreetMapServices(await response.json());
}

import { Platform } from 'react-native';

import { Collection, CouncilAddressOption, CouncilService, DisruptionAlert, ProviderResult, SavedAddress, WasteType } from '@/lib/types';
import { findCouncilByCode, findCouncilByName } from '@/lib/council-directory';
import { parseRecyclingMaterials } from '@/lib/recycling-materials';
import {
  buildNearestPostcodeUrl,
  cleanPostcodeLocality,
  isUkPostcode,
  normalisePostcode,
} from '@/lib/place-resolution';

export { isUkPostcode, normalisePostcode } from '@/lib/place-resolution';

type GatewayCollection = { date: string; wasteType: WasteType; label?: string; colour?: string };
type GatewayResponse = {
  councilName: string;
  providerId: string;
  collections: GatewayCollection[];
  verifiedAt: string;
  notice?: string;
  alerts?: Omit<DisruptionAlert, 'addressId'>[];
};
type GatewayAddressesResponse = { addresses: CouncilAddressOption[] };
type GatewayServicesResponse = { services: CouncilService[] };
export type CouncilCoverageStatus =
  | 'live-direct'
  | 'partner-connected'
  | 'public-feed'
  | 'experimental-adapter'
  | 'council-link-only'
  | 'unsupported';
export type CouncilCapabilityStatus =
  | 'verified-live'
  | 'partner-feed'
  | 'council-configured'
  | 'official-handoff'
  | 'map-fallback'
  | 'experimental'
  | 'not-connected';
export type CouncilAudienceCriteria = {
  scope: 'council' | 'targeted';
  collectionTypes: WasteType[];
  collectionDates: string[];
  audienceLabels: string[];
};
export type CouncilProfile = {
  providerId: string;
  councilName?: string;
  coverageStatus: CouncilCoverageStatus;
  summary: string;
  reviewedAt: string;
  capabilities: {
    addresses: CouncilCapabilityStatus;
    collections: CouncilCapabilityStatus;
    guidance: CouncilCapabilityStatus;
    services: CouncilCapabilityStatus;
    serviceAlerts: CouncilCapabilityStatus;
    missedReports: CouncilCapabilityStatus;
  };
  guidanceSourceUrl?: string;
  guidance?: Record<string, {
    destination: 'general' | 'recycling' | 'garden' | 'food' | 'other' | 'service' | 'check';
    heading: string;
    detail: string;
    serviceUrl?: string;
  }>;
  branding?: {
    displayName: string;
    primaryColour: string;
    secondaryColour: string;
    sponsorshipLabel?: string;
  };
  sponsorship?: {
    id: string;
    sponsorType: 'council' | 'housing';
    residentLabel: string;
    features: string[];
    startsAt: string;
    endsAt?: string;
    renewalAt?: string;
  };
  featureFlags?: {
    collectionDates: boolean;
    councilBranding: boolean;
    pushAlerts: boolean;
    missedCollection: boolean;
    directReporting: boolean;
    recyclingGuide: boolean;
    partnerServices: boolean;
    supportInbox: boolean;
    sponsoredPlus: boolean;
    analyticsExports: boolean;
    bulkyWasteBooking: boolean;
  };
  announcements?: {
    id: string;
    kind: string;
    severity: string;
    title: string;
    body: string;
    placements: string[];
    startsAt?: string;
    endsAt?: string;
    sourceUrl?: string;
    audience?: CouncilAudienceCriteria;
  }[];
  disruptions?: {
    id: string;
    title: string;
    detail: string;
    collectionTypes: string[];
    areaLabels: string[];
    cause: string;
    residentInstruction: string;
    startsAt: string;
    expectedResumeAt?: string;
    endsAt?: string;
    sourceUrl?: string;
    audience?: CouncilAudienceCriteria;
  }[];
  partners?: {
    id: string;
    name: string;
    category: string;
    description: string;
    serviceUrl: string;
    itemKeys: string[];
    disclosureLabel: string;
    bookingMode?: 'external-referral' | 'stripe-connect';
    bookingPricePence?: number;
    providerAcceptanceSlaHours?: number;
    termsUrl?: string;
  }[];
  reporting?: {
    enabled: boolean;
    mode: 'official-handoff' | 'direct-api' | 'disabled';
    reportUrl?: string;
    eligibilityStartsHours: number;
    reportingDeadlineHours: number;
    requireDelayCheck: boolean;
    residentInstruction?: string;
  };
  links?: Record<string, string>;
};
type GatewayProfileResponse = { profile?: CouncilProfile };
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
const validWasteTypes = new Set<WasteType>(['general', 'recycling', 'garden', 'food', 'other']);
const validServiceTypes = new Set<CouncilService['type']>(['recycling-centre', 'recycling-point', 'reuse', 'collection']);
const coverageStatuses = new Set<CouncilCoverageStatus>([
  'live-direct',
  'partner-connected',
  'public-feed',
  'experimental-adapter',
  'council-link-only',
  'unsupported',
]);
const capabilityStatuses = new Set<CouncilCapabilityStatus>([
  'verified-live',
  'partner-feed',
  'council-configured',
  'official-handoff',
  'map-fallback',
  'experimental',
  'not-connected',
]);
const councilPlacements = new Set(['home', 'schedule', 'guide', 'activity', 'widget', 'push']);

function validAudience(value: unknown) {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const audience = value as Record<string, unknown>;
  return (
    (audience.scope === 'council' || audience.scope === 'targeted')
    && Array.isArray(audience.collectionTypes)
    && audience.collectionTypes.length <= 6
    && audience.collectionTypes.every((item) => typeof item === 'string' && validWasteTypes.has(item as WasteType))
    && Array.isArray(audience.collectionDates)
    && audience.collectionDates.length <= 24
    && audience.collectionDates.every(isIsoDate)
    && Array.isArray(audience.audienceLabels)
    && audience.audienceLabels.length <= 24
    && audience.audienceLabels.every((item) => typeof item === 'string' && item.length <= 80)
  );
}

function isSafeHttps(value: unknown) {
  return typeof value === 'string' && value.length <= 500 && value.startsWith('https://');
}

function validOptionalDateTime(value: unknown) {
  return value === undefined || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
}

function validPlatformContent(profile: CouncilProfile) {
  if (profile.branding && (
    typeof profile.branding.displayName !== 'string'
    || !/^#[0-9A-F]{6}$/i.test(profile.branding.primaryColour)
    || !/^#[0-9A-F]{6}$/i.test(profile.branding.secondaryColour)
  )) return false;
  if (profile.sponsorship && (
    typeof profile.sponsorship.id !== 'string'
    || !['council', 'housing'].includes(profile.sponsorship.sponsorType)
    || typeof profile.sponsorship.residentLabel !== 'string'
    || profile.sponsorship.residentLabel.length > 160
    || !Array.isArray(profile.sponsorship.features)
    || profile.sponsorship.features.length > 20
    || profile.sponsorship.features.some((feature) => typeof feature !== 'string' || feature.length > 40)
    || !validOptionalDateTime(profile.sponsorship.startsAt)
    || !validOptionalDateTime(profile.sponsorship.endsAt)
    || (profile.sponsorship.renewalAt !== undefined && !isIsoDate(profile.sponsorship.renewalAt))
  )) return false;
  if (profile.featureFlags && Object.values(profile.featureFlags).some((enabled) => typeof enabled !== 'boolean')) return false;
  if (profile.announcements?.some((item) => (
    typeof item.id !== 'string'
    || typeof item.title !== 'string' || item.title.length > 120
    || typeof item.body !== 'string' || item.body.length > 600
    || !Array.isArray(item.placements) || item.placements.some((placement) => !councilPlacements.has(placement))
    || !validAudience(item.audience)
    || !validOptionalDateTime(item.startsAt) || !validOptionalDateTime(item.endsAt)
    || (item.sourceUrl !== undefined && !isSafeHttps(item.sourceUrl))
  ))) return false;
  if (profile.disruptions?.some((item) => (
    typeof item.id !== 'string'
    || typeof item.title !== 'string' || item.title.length > 120
    || typeof item.detail !== 'string' || item.detail.length > 600
    || typeof item.residentInstruction !== 'string' || item.residentInstruction.length > 400
    || !Array.isArray(item.collectionTypes) || !Array.isArray(item.areaLabels)
    || !validAudience(item.audience)
    || !validOptionalDateTime(item.startsAt) || !validOptionalDateTime(item.endsAt)
    || (item.sourceUrl !== undefined && !isSafeHttps(item.sourceUrl))
  ))) return false;
  if (profile.partners?.some((item) => (
    typeof item.id !== 'string' || typeof item.name !== 'string'
    || typeof item.description !== 'string' || !isSafeHttps(item.serviceUrl)
    || !Array.isArray(item.itemKeys) || typeof item.disclosureLabel !== 'string'
    || (item.bookingMode !== undefined && !['external-referral', 'stripe-connect'].includes(item.bookingMode))
    || (item.bookingPricePence !== undefined && (!Number.isInteger(item.bookingPricePence) || item.bookingPricePence < 100 || item.bookingPricePence > 1000000))
    || (item.providerAcceptanceSlaHours !== undefined && (!Number.isInteger(item.providerAcceptanceSlaHours) || item.providerAcceptanceSlaHours < 1 || item.providerAcceptanceSlaHours > 168))
    || (item.termsUrl !== undefined && !isSafeHttps(item.termsUrl))
  ))) return false;
  if (profile.reporting && (
    typeof profile.reporting.enabled !== 'boolean'
    || !['official-handoff', 'direct-api', 'disabled'].includes(profile.reporting.mode)
    || (profile.reporting.reportUrl !== undefined && !isSafeHttps(profile.reporting.reportUrl))
    || !Number.isInteger(profile.reporting.eligibilityStartsHours)
    || !Number.isInteger(profile.reporting.reportingDeadlineHours)
  )) return false;
  return true;
}

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
    || (
      payload.alerts !== undefined
      && (
        !Array.isArray(payload.alerts)
        || payload.alerts.length > 20
        || payload.alerts.some((alert) => (
          !alert
          || typeof alert.id !== 'string'
          || typeof alert.title !== 'string'
          || typeof alert.detail !== 'string'
          || typeof alert.sourceUrl !== 'string'
          || !alert.sourceUrl.startsWith('https://')
          || typeof alert.startsAt !== 'string'
          || Number.isNaN(Date.parse(alert.startsAt))
          || typeof alert.verifiedAt !== 'string'
          || Number.isNaN(Date.parse(alert.verifiedAt))
          || (alert.endsAt !== undefined && Number.isNaN(Date.parse(alert.endsAt)))
          || (alert.expectedRecollectionDate !== undefined && !isIsoDate(alert.expectedRecollectionDate))
        ))
      )
    )
    || payload.collections.some((collection) => (
      !isIsoDate(collection?.date)
      || !validWasteTypes.has(collection?.wasteType)
      || (collection.label !== undefined && (
        typeof collection.label !== 'string'
        || collection.label.length === 0
        || collection.label.length > 80
      ))
      || (collection.colour !== undefined && (
        typeof collection.colour !== 'string'
        || !/^#[0-9A-F]{6}$/i.test(collection.colour)
      ))
    ))
  ) {
    throw new Error('The council source returned collection data in an unexpected format.');
  }
  return {
    councilName: payload.councilName,
    providerId: payload.providerId,
    verifiedAt: payload.verifiedAt,
    notice: payload.notice?.slice(0, 240),
    alerts: payload.alerts?.map((alert) => ({
      id: alert.id.slice(0, 120),
      title: alert.title.slice(0, 120),
      detail: alert.detail.slice(0, 500),
      sourceUrl: alert.sourceUrl,
      startsAt: alert.startsAt,
      endsAt: alert.endsAt,
      expectedRecollectionDate: alert.expectedRecollectionDate,
      verifiedAt: alert.verifiedAt,
    })),
    collections: payload.collections.map((collection, index): Collection => ({
      id: `${payload.providerId}-${collection.date}-${collection.wasteType}-${index}`,
      date: collection.date,
      wasteType: collection.wasteType,
      source: 'council',
      label: collection.label,
      colour: collection.colour?.toUpperCase(),
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

export async function fetchCouncilProfile(providerId: string): Promise<CouncilProfile> {
  const response = await fetchWithTimeout(
    `${apiBase}/v1/profile?providerId=${encodeURIComponent(providerId)}`,
  );
  if (!response.ok) throw new Error(await gatewayError(response, 'The council coverage profile is unavailable.'));
  const payload = await response.json() as GatewayProfileResponse;
  const profile = payload.profile;
  const capabilityKeys = [
    'addresses',
    'collections',
    'guidance',
    'services',
    'serviceAlerts',
    'missedReports',
  ] as const;
  if (
    !profile
    || profile.providerId !== providerId
    || !coverageStatuses.has(profile.coverageStatus)
    || typeof profile.summary !== 'string'
    || profile.summary.length > 240
    || !/^\d{4}-\d{2}-\d{2}$/.test(profile.reviewedAt)
    || !profile.capabilities
    || capabilityKeys.some((key) => !capabilityStatuses.has(profile.capabilities[key]))
    || (
      profile.guidanceSourceUrl !== undefined
      && (
        typeof profile.guidanceSourceUrl !== 'string'
        || !profile.guidanceSourceUrl.startsWith('https://')
      )
    )
    || (
      profile.guidance !== undefined
      && (
        typeof profile.guidance !== 'object'
        || Object.entries(profile.guidance).some(([id, rule]) => (
          !/^[a-z0-9-]{1,80}$/.test(id)
          || !rule
          || !validWasteTypes.has(rule.destination as WasteType)
            && rule.destination !== 'service'
            && rule.destination !== 'check'
          || typeof rule.heading !== 'string'
          || typeof rule.detail !== 'string'
          || (rule.serviceUrl !== undefined && !isSafeHttps(rule.serviceUrl))
        ))
      )
    )
    || !validPlatformContent(profile)
  ) {
    throw new Error('The council coverage profile returned an unexpected format.');
  }
  return profile;
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
          && (service.source === 'council' || service.source === 'openstreetmap')
          && (service.openingHours === undefined || (typeof service.openingHours === 'string' && service.openingHours.length <= 240))
          && (service.isOpenNow === undefined || typeof service.isOpenNow === 'boolean')
          && (service.operator === undefined || (typeof service.operator === 'string' && service.operator.length <= 160))
          && (service.councilOperated === undefined || typeof service.councilOperated === 'boolean')
          && (service.wheelchairAccessible === undefined || typeof service.wheelchairAccessible === 'boolean')
          && (
            service.materials === undefined
            || (
              Array.isArray(service.materials)
              && service.materials.length <= 40
              && service.materials.every((material) => (
                typeof material === 'string'
                && material.length > 0
                && material.length <= 80
              ))
            )
          )
        ))
      ) {
        return payload.services
          .map((service) => ({ ...service, distanceKm: distanceKm(address, service.latitude, service.longitude) }))
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
      materials: parseRecyclingMaterials(tags),
      openingHours: tags.opening_hours,
      isOpenNow: tags.opening_hours === '24/7' ? true : undefined,
      operator: tags.operator,
      councilOperated: /\bcouncil\b/i.test(tags.operator ?? '') || undefined,
      wheelchairAccessible: tags.wheelchair === 'yes'
        ? true
        : tags.wheelchair === 'no'
          ? false
          : undefined,
    });
    return found;
  }, []);
  return services.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

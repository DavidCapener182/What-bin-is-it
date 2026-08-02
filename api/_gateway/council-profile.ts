import { parseCouncilPartnerRegistry } from './council-partner-adapter.ts';

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

export type CouncilGuidanceDestination =
  | 'general'
  | 'recycling'
  | 'garden'
  | 'food'
  | 'other'
  | 'service'
  | 'check';

export type CouncilAudienceCriteria = {
  scope: 'council' | 'targeted';
  collectionTypes: string[];
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
    destination: CouncilGuidanceDestination;
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
  links?: {
    bins?: string;
    recycling?: string;
    services?: string;
    missedReports?: string;
    serviceAlerts?: string;
  };
};

type Environment = Record<string, string | undefined>;

const providerPattern = /^lad-[ensw]\d{8}$/;
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
const destinations = new Set<CouncilGuidanceDestination>([
  'general',
  'recycling',
  'garden',
  'food',
  'other',
  'service',
  'check',
]);

const knowsleyGuidanceSource =
  'https://www.knowsley.gov.uk/bins-waste-and-recycling/your-household-bins/what-put-your-bin';

const knowsleyProfile: CouncilProfile = {
  providerId: 'lad-e08000011',
  councilName: 'Knowsley',
  coverageStatus: 'live-direct',
  summary: 'Exact-property collection dates and bin colours are verified from Knowsley services.',
  reviewedAt: '2026-07-27',
  capabilities: {
    addresses: 'verified-live',
    collections: 'verified-live',
    guidance: 'council-configured',
    services: 'map-fallback',
    serviceAlerts: 'official-handoff',
    missedReports: 'official-handoff',
  },
  guidanceSourceUrl: knowsleyGuidanceSource,
  guidance: {
    paper: { destination: 'recycling', heading: 'Put it loose in the grey recycling bin', detail: 'Keep paper clean and dry. Do not bag recycling.' },
    cardboard: { destination: 'recycling', heading: 'Flatten it into the grey recycling bin', detail: 'Remove food and flatten cardboard before recycling.' },
    envelopes: { destination: 'recycling', heading: 'Put it in the grey recycling bin', detail: 'Keep envelopes loose with paper recycling.' },
    'shredded-paper': { destination: 'garden', heading: 'Put it in the blue garden-waste bin', detail: 'Knowsley lists shredded paper with accepted blue-bin garden waste.' },
    'drink-cartons': { destination: 'recycling', heading: 'Put it in the grey recycling bin', detail: 'Empty food and drink cartons such as milk, juice and soup cartons.' },
    'plastic-bottles': { destination: 'recycling', heading: 'Put it in the grey recycling bin', detail: 'Empty and rinse bottles; Knowsley advises keeping lids on.' },
    'plastic-tubs-trays': { destination: 'recycling', heading: 'Put clean pots, tubs and trays in the grey bin', detail: 'Empty and rinse plastic packaging first.' },
    'cans-tins': { destination: 'recycling', heading: 'Put it in the grey recycling bin', detail: 'Empty and rinse food tins and drinks cans.' },
    foil: { destination: 'recycling', heading: 'Put clean foil in the grey recycling bin', detail: 'Empty and rinse foil trays and tin foil.' },
    aerosols: { destination: 'recycling', heading: 'Put empty aerosols in the grey recycling bin', detail: 'Only place empty household aerosols in recycling.' },
    glass: { destination: 'recycling', heading: 'Put bottles and jars in the grey recycling bin', detail: 'Rinse glass bottles and jars and keep lids on.' },
    polystyrene: { destination: 'general', heading: 'Put it in the maroon general-waste bin', detail: 'Knowsley does not accept polystyrene in the grey recycling bin.' },
    nappies: { destination: 'general', heading: 'Put it in the maroon general-waste bin', detail: 'Bag nappies securely before placing them in general waste.' },
    'food-scraps': { destination: 'food', heading: 'Put it in the grey food caddy', detail: 'Remove all packaging and tie the caddy liner securely.' },
    'tea-coffee': { destination: 'food', heading: 'Put it in the grey food caddy', detail: 'Tea bags and coffee grounds are accepted without packaging.' },
    'meat-fish-bones': { destination: 'food', heading: 'Put it in the grey food caddy', detail: 'Raw or cooked meat, fish and bones are accepted.' },
    'fruit-vegetables': { destination: 'food', heading: 'Put it in the grey food caddy', detail: 'Raw or cooked fruit, vegetables and peelings are accepted.' },
    garden: { destination: 'garden', heading: 'Put it in the blue garden-waste bin', detail: 'Grass cuttings, flowers, prunings and leaves are accepted.' },
    branches: { destination: 'garden', heading: 'Put small branches in the blue garden-waste bin', detail: 'Twigs, prunings and tree clippings must fit inside the bin.' },
    'flowers-plants': { destination: 'garden', heading: 'Put it in the blue garden-waste bin', detail: 'Flowers, plants and weeds are accepted; leave soil out.' },
    'soil-turf': { destination: 'service', heading: 'Take soil to an appropriate recycling service', detail: 'Knowsley does not accept soil in the blue garden-waste bin.' },
  },
  links: {
    bins: knowsleyGuidanceSource,
    recycling: 'https://www.knowsley.gov.uk/recycling-knowsley',
    services: 'https://www.knowsley.gov.uk/recycling-knowsley/recycling-centres',
    missedReports: 'https://www.knowsley.gov.uk/bins-waste-and-recycling/your-household-bins/report-missed-bin-collection',
    serviceAlerts: 'https://www.knowsley.gov.uk/bins-waste-and-recycling/your-household-bins/report-missed-bin-collection',
  },
};

function safeUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseProfile(value: unknown): CouncilProfile | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const capabilities = item.capabilities as Record<string, unknown> | undefined;
  if (
    typeof item.providerId !== 'string'
    || !providerPattern.test(item.providerId)
    || !coverageStatuses.has(item.coverageStatus as CouncilCoverageStatus)
    || typeof item.summary !== 'string'
    || !item.summary.trim()
    || item.summary.length > 240
    || typeof item.reviewedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(item.reviewedAt)
    || !capabilities
  ) return undefined;
  const capabilityKeys = [
    'addresses',
    'collections',
    'guidance',
    'services',
    'serviceAlerts',
    'missedReports',
  ] as const;
  if (capabilityKeys.some((key) => !capabilityStatuses.has(capabilities[key] as CouncilCapabilityStatus))) {
    return undefined;
  }
  const guidanceEntries = item.guidance && typeof item.guidance === 'object'
    ? Object.entries(item.guidance as Record<string, unknown>)
    : [];
  const guidance: CouncilProfile['guidance'] = {};
  for (const [id, raw] of guidanceEntries) {
    if (!/^[a-z0-9-]{1,80}$/.test(id) || !raw || typeof raw !== 'object') return undefined;
    const rule = raw as Record<string, unknown>;
    if (
      !destinations.has(rule.destination as CouncilGuidanceDestination)
      || typeof rule.heading !== 'string'
      || !rule.heading.trim()
      || rule.heading.length > 160
      || typeof rule.detail !== 'string'
      || !rule.detail.trim()
      || rule.detail.length > 300
    ) return undefined;
    guidance[id] = {
      destination: rule.destination as CouncilGuidanceDestination,
      heading: rule.heading.trim(),
      detail: rule.detail.trim(),
    };
  }
  const links = item.links && typeof item.links === 'object'
    ? Object.fromEntries(
        Object.entries(item.links as Record<string, unknown>)
          .map(([key, url]) => [key, safeUrl(url)])
          .filter((entry): entry is [string, string] => Boolean(entry[1])),
      )
    : undefined;
  return {
    providerId: item.providerId,
    councilName: typeof item.councilName === 'string' ? item.councilName.slice(0, 160) : undefined,
    coverageStatus: item.coverageStatus as CouncilCoverageStatus,
    summary: item.summary.trim(),
    reviewedAt: item.reviewedAt,
    capabilities: Object.fromEntries(
      capabilityKeys.map((key) => [key, capabilities[key]]),
    ) as CouncilProfile['capabilities'],
    guidanceSourceUrl: safeUrl(item.guidanceSourceUrl),
    guidance: Object.keys(guidance).length ? guidance : undefined,
    links: links as CouncilProfile['links'],
  };
}

export function parseCouncilProfileRegistry(value: string | undefined) {
  if (!value?.trim()) return [];
  let payload: unknown;
  try {
    payload = JSON.parse(value);
  } catch {
    throw new Error('COUNCIL_PROFILE_REGISTRY_JSON is not valid JSON.');
  }
  if (!Array.isArray(payload) || payload.length > 361) {
    throw new Error('COUNCIL_PROFILE_REGISTRY_JSON must be an array of council profiles.');
  }
  const profiles = payload.map(parseProfile);
  if (profiles.some((profile) => !profile)) {
    throw new Error('COUNCIL_PROFILE_REGISTRY_JSON contains an invalid council profile.');
  }
  return profiles as CouncilProfile[];
}

export function councilProfileFor(
  providerId: string,
  environment: Environment = process.env,
): CouncilProfile {
  const configured = parseCouncilProfileRegistry(environment.COUNCIL_PROFILE_REGISTRY_JSON)
    .find((profile) => profile.providerId === providerId);
  if (configured) return configured;
  if (providerId === knowsleyProfile.providerId) return knowsleyProfile;
  const partner = parseCouncilPartnerRegistry(environment.COUNCIL_PARTNER_REGISTRY_JSON)
    .find((config) => config.providerId === providerId);
  if (partner) {
    return {
      providerId,
      councilName: partner.councilName,
      coverageStatus: 'partner-connected',
      summary: 'Collection dates are supplied through an approved council partner connector.',
      reviewedAt: new Date().toISOString().slice(0, 10),
      capabilities: {
        addresses: partner.capabilities.includes('addresses') ? 'partner-feed' : 'not-connected',
        collections: 'partner-feed',
        guidance: 'not-connected',
        services: partner.capabilities.includes('services') ? 'partner-feed' : 'map-fallback',
        serviceAlerts: 'not-connected',
        missedReports: 'official-handoff',
      },
    };
  }
  if (providerPattern.test(providerId)) {
    return {
      providerId,
      coverageStatus: 'experimental-adapter',
      summary: 'The authority is mapped, but live collection results depend on an unverified nationwide adapter.',
      reviewedAt: '2026-07-27',
      capabilities: {
        addresses: 'experimental',
        collections: 'experimental',
        guidance: 'not-connected',
        services: 'map-fallback',
        serviceAlerts: 'not-connected',
        missedReports: 'official-handoff',
      },
    };
  }
  return {
    providerId,
    coverageStatus: 'unsupported',
    summary: 'This provider is not connected.',
    reviewedAt: '2026-07-27',
    capabilities: {
      addresses: 'not-connected',
      collections: 'not-connected',
      guidance: 'not-connected',
      services: 'not-connected',
      serviceAlerts: 'not-connected',
      missedReports: 'not-connected',
    },
  };
}

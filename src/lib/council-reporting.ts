import type { Collection, MissedCollectionReport, SavedAddress } from '@/lib/types';

export const missedCollectionServiceUrl = 'https://www.gov.uk/missed-bin-collection';
export const bulkyWasteServiceUrl = 'https://www.gov.uk/collection-large-waste-items';

export type CouncilReportingCapability = {
  level: 1 | 2 | 3;
  method: MissedCollectionReport['submissionMethod'];
  serviceUrl: string;
  description: string;
};

export type MissedReportPolicy = {
  eligibleHour: number;
  eligibleMinute?: number;
  eligibleDayOffset?: number;
  reportWithinHours?: number;
  presentationTime?: string;
  expectedResponse?: string;
  sourceUrl?: string;
  requiresContentCheck?: boolean;
  requiresLidClosed?: boolean;
  requiresWeightCheck?: boolean;
  note: string;
};

const councilPolicies: Record<string, MissedReportPolicy> = {
  'lad-e08000011': {
    eligibleHour: 15,
    reportWithinHours: 48,
    presentationTime: '7:00 am',
    expectedResponse: 'Knowsley says known missed streets are normally revisited within 48 hours, although disruption can extend this.',
    sourceUrl: 'https://www.knowsley.gov.uk/bins-waste-and-recycling/your-household-bins/report-missed-bin-collection',
    note: 'Knowsley accepts reports after 3:00 pm and within 48 hours. Check its live missed-streets list first; listed streets do not need another report.',
  },
  'lad-e08000014': {
    eligibleHour: 12,
    eligibleDayOffset: 1,
    presentationTime: '6:30 am',
    requiresContentCheck: true,
    requiresLidClosed: true,
    requiresWeightCheck: true,
    sourceUrl: 'https://www.sefton.gov.uk/bins-recycling/bin-collections/missed-grey-bin-collection-household-waste/',
    note: 'Sefton asks residents to wait until midday on the day after the missed collection and to check the correct bin, contents and closed lid first.',
  },
  'lad-e06000009': {
    eligibleHour: 17,
    reportWithinHours: 48,
    presentationTime: 'the council collection cut-off',
    sourceUrl: 'https://www.blackpool.gov.uk/Residents/Waste-and-recycling/Bin-collections/Missed-bin-collection.aspx',
    note: 'Blackpool checks the live round status and accepts a report within 48 hours when the contractor records the round as completed.',
  },
  'lad-e07000067': {
    eligibleHour: 15,
    reportWithinHours: 21,
    presentationTime: '7:00 am',
    expectedResponse: 'The council says qualifying missed bins are normally collected within two working days.',
    sourceUrl: 'https://www.braintree.gov.uk/report-missed-bin',
    note: 'Braintree accepts reports after 3:00 pm on collection day, preferably before noon on the next working day.',
  },
  'lad-e07000148': {
    eligibleHour: 17,
    reportWithinHours: 48,
    presentationTime: 'the council collection cut-off',
    sourceUrl: 'https://www.norwich.gov.uk/bins-and-recycling/report-missed-bin-collection',
    note: 'Norwich requires missed collections to be reported within two working days.',
  },
  'lad-e07000178': {
    eligibleHour: 16,
    eligibleMinute: 30,
    reportWithinHours: 26,
    presentationTime: 'the council collection cut-off',
    sourceUrl: 'https://www.oxford.gov.uk/recycling-waste/report-missed-bin-collection',
    note: 'Oxford accepts reports after 4:30 pm and before 6:00 pm on the next working day.',
  },
  'lad-e07000225': {
    eligibleHour: 17,
    reportWithinHours: 24,
    presentationTime: '6:00 am',
    expectedResponse: 'The council says it investigates qualifying reports and may return within seven days.',
    sourceUrl: 'https://www.chichester.gov.uk/reportamissedbincollection',
    note: 'Chichester accepts reports only within 24 hours of the scheduled collection.',
  },
  'lad-e08000026': {
    eligibleHour: 17,
    presentationTime: '7:00 am',
    sourceUrl: 'https://www.coventry.gov.uk/missedbin',
    note: 'Coventry asks residents to wait until after 5:00 pm because crews may still return that day.',
  },
  'lad-e08000027': {
    eligibleHour: 16,
    reportWithinHours: 24,
    presentationTime: 'the council collection cut-off',
    sourceUrl: 'https://www.dudley.gov.uk/residents/my-bins/report-a-missed-bin-collection/',
    note: 'Dudley accepts ordinary missed reports from 4:00 pm until 4:00 pm on the next working day.',
  },
  'lad-e09000028': {
    eligibleHour: 16,
    presentationTime: 'the council collection cut-off',
    sourceUrl: 'https://www.southwark.gov.uk/waste-and-recycling/bin-collections/report-missed-bin-collection',
    note: 'Southwark asks residents to wait until after 4:00 pm on collection day.',
  },
  'lad-e09000031': {
    eligibleHour: 22,
    reportWithinHours: 72,
    presentationTime: '5:00 am',
    sourceUrl: 'https://www.walthamforest.gov.uk/rubbish-and-recycling/household-bin-collections/report-missed-bin-collection',
    note: 'Waltham Forest collections can run until 10:00 pm and reports are accepted for up to three days.',
  },
  'lad-e09000032': {
    eligibleHour: 16,
    eligibleMinute: 30,
    reportWithinHours: 48,
    presentationTime: '6:30 am',
    expectedResponse: 'The council says qualifying missed collections are normally revisited within two working days.',
    sourceUrl: 'https://www.wandsworth.gov.uk/missedcollections',
    note: 'Wandsworth says crews may collect until 4:30 pm and reports should be made within two working days.',
  },
};

const fallbackPolicy: MissedReportPolicy = {
  eligibleHour: 18,
  note: 'The app waits until the evening. The official council service will make the final live eligibility decision for this address.',
};

const councilTimeZone = 'Europe/London';
const councilClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: councilTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function councilOffsetMilliseconds(instant: Date) {
  const parts = Object.fromEntries(
    councilClock
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - instant.getTime();
}

function councilDateAtTime(
  collectionDate: string,
  dayOffset: number,
  hour: number,
  minute: number,
) {
  const date = new Date(`${collectionDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  const wallClockAsUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
    minute,
  );
  let instant = new Date(wallClockAsUtc);

  // Resolve the Europe/London offset twice so dates around a daylight-saving
  // boundary remain tied to the council's clock, not the device timezone.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    instant = new Date(wallClockAsUtc - councilOffsetMilliseconds(instant));
  }
  return instant;
}

export function missedReportPolicy(address: SavedAddress) {
  return councilPolicies[address.providerId] ?? fallbackPolicy;
}

export function evaluateMissedReportEligibility(
  address: SavedAddress,
  collection: Collection,
  now = new Date(),
) {
  const policy = missedReportPolicy(address);
  const eligibleAfter = councilDateAtTime(
    collection.date,
    policy.eligibleDayOffset ?? 0,
    policy.eligibleHour,
    policy.eligibleMinute ?? 0,
  );
  const expiresAt = policy.reportWithinHours
    ? new Date(eligibleAfter.getTime() + policy.reportWithinHours * 60 * 60 * 1_000)
    : undefined;
  const tooEarly = now < eligibleAfter;
  const expired = Boolean(expiresAt && now > expiresAt);
  return {
    eligible: !tooEarly && !expired,
    tooEarly,
    expired,
    eligibleAfter,
    expiresAt,
    reason: tooEarly
      ? `${policy.note} You can continue after ${eligibleAfter.toLocaleTimeString('en-GB', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: councilTimeZone,
      })}.`
      : expired
        ? `This app’s reporting window has passed. Open the official service because the council may offer another route. ${policy.note}`
        : policy.note,
    policy,
  };
}

export function reportingCapability(address: SavedAddress): CouncilReportingCapability {
  const policy = missedReportPolicy(address);
  return {
    level: 2,
    method: 'council-website',
    serviceUrl: policy.sourceUrl ?? missedCollectionServiceUrl,
    description: policy.sourceUrl
      ? 'The app opens this council’s official missed-collection service.'
      : 'The official GOV.UK service routes your postcode to the correct council reporting page.',
  };
}

export function createLocalTrackingId(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `WB-${date}-${suffix}`;
}

export function buildMissedReport(
  address: SavedAddress,
  collection: Collection,
  binLabel: string,
  details: MissedCollectionReport['details'],
  now = new Date(),
): MissedCollectionReport {
  const capability = reportingCapability(address);
  const eligibility = evaluateMissedReportEligibility(address, collection, now);
  const localTrackingId = createLocalTrackingId(now);
  return {
    id: `report-${now.getTime()}-${collection.id.replace(/[^a-z0-9]/gi, '').slice(-12)}`,
    localTrackingId,
    addressId: address.id,
    propertyAddress: address.line1,
    postcode: address.postcode,
    councilName: address.councilName,
    providerId: address.providerId,
    councilAddressId: address.councilAddressId,
    collectionId: collection.id,
    collectionDate: collection.date,
    wasteType: collection.wasteType,
    binLabel,
    reportType: 'missed_collection',
    status: eligibility.eligible ? 'ready' : 'not-yet-eligible',
    submissionMethod: capability.method,
    officialServiceUrl: capability.serviceUrl,
    eligibilityCheckedAt: now.toISOString(),
    eligibleAfter: eligibility.eligibleAfter.toISOString(),
    eligibilityResult: {
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      policySourceUrl: eligibility.policy.sourceUrl,
      expiresAt: eligibility.expiresAt?.toISOString(),
    },
    lastCheckedAt: now.toISOString(),
    expectedResponse: eligibility.policy.expectedResponse,
    details,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

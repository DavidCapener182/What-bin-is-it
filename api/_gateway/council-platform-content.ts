import postgres from 'postgres';

import type { CouncilAudienceCriteria, CouncilGuidanceDestination, CouncilProfile } from './council-profile.ts';

type Environment = Record<string, string | undefined>;

let database: ReturnType<typeof postgres> | undefined;
let databaseUrl: string | undefined;

function councilDatabase(environment: Environment) {
  const nextUrl = environment.BIN_DATABASE_URL?.trim();
  if (!nextUrl) return undefined;
  if (!database || databaseUrl !== nextUrl) {
    database = postgres(nextUrl, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 8,
      ssl: 'require',
      prepare: false,
    });
    databaseUrl = nextUrl;
  }
  return database;
}

function iso(value: Date | null) {
  return value?.toISOString();
}

export async function councilPlatformProfile(
  profile: CouncilProfile,
  environment: Environment = process.env,
): Promise<CouncilProfile> {
  const sql = councilDatabase(environment);
  if (!sql) return profile;
  const organisations = await sql<{
    id: string;
    name: string;
    brand_name: string | null;
    primary_colour: string;
    secondary_colour: string;
    sponsorship_label: string | null;
  }[]>`
    SELECT id, name, brand_name, primary_colour, secondary_colour, sponsorship_label
    FROM bin_council_organisations
    WHERE provider_id = ${profile.providerId}
      AND status IN ('pilot', 'active')
    LIMIT 1
  `;
  const organisation = organisations[0];
  if (!organisation) return profile;

  const [announcements, disruptions, guidance, partners, reporting, sponsorships, featureFlags] = await Promise.all([
    sql<{
      id: string; kind: string; severity: string; title: string; body: string;
      placements: string[]; starts_at: Date | null; ends_at: Date | null; source_url: string | null;
      audience_criteria: CouncilAudienceCriteria;
    }[]>`
      SELECT id, kind, severity, title, body, placements, starts_at, ends_at, source_url, audience_criteria
      FROM bin_council_announcements
      WHERE organisation_id = ${organisation.id}::uuid
        AND status = 'published'
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at > now())
      ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, updated_at DESC
      LIMIT 20
    `,
    sql<{
      id: string; title: string; detail: string; collection_types: string[]; area_labels: string[];
      cause: string; resident_instruction: string; starts_at: Date; expected_resume_at: Date | null;
      ends_at: Date | null; source_url: string | null;
      audience_criteria: CouncilAudienceCriteria;
    }[]>`
      SELECT id, title, detail, collection_types, area_labels, cause, resident_instruction,
        starts_at, expected_resume_at, ends_at, source_url, audience_criteria
      FROM bin_council_disruptions
      WHERE organisation_id = ${organisation.id}::uuid
        AND status = 'published'
        AND starts_at <= now()
        AND (ends_at IS NULL OR ends_at > now())
      ORDER BY starts_at DESC
      LIMIT 20
    `,
    sql<{
      item_key: string; destination: CouncilGuidanceDestination;
      heading: string; detail: string; service_url: string | null;
    }[]>`
      SELECT item_key, destination, heading, detail, service_url
      FROM bin_council_guidance_items
      WHERE organisation_id = ${organisation.id}::uuid AND status = 'published'
      ORDER BY item_name
      LIMIT 500
    `,
    sql<{
      id: string; name: string; category: string; description: string; service_url: string;
      item_keys: string[]; disclosure_label: string;
      booking_mode: 'none' | 'external-referral' | 'stripe-connect';
      booking_price_pence: number | null;
      provider_acceptance_sla_hours: number;
      terms_url: string | null;
    }[]>`
      SELECT id, name, category, description, service_url, item_keys, disclosure_label,
        booking_mode, booking_price_pence, provider_acceptance_sla_hours, terms_url
      FROM bin_council_partners
      WHERE organisation_id = ${organisation.id}::uuid
        AND status = 'active'
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at > now())
      ORDER BY priority, name
      LIMIT 100
    `,
    sql<{
      enabled: boolean; mode: 'official-handoff' | 'direct-api' | 'disabled'; report_url: string | null;
      eligibility_starts_hours: number; reporting_deadline_hours: number; require_delay_check: boolean;
      resident_instruction: string | null;
    }[]>`
      SELECT enabled, mode, report_url, eligibility_starts_hours, reporting_deadline_hours,
        require_delay_check, resident_instruction
      FROM bin_council_reporting_rules
      WHERE organisation_id = ${organisation.id}::uuid
      LIMIT 1
    `,
    sql<{
      id: string; sponsor_type: 'council' | 'housing'; resident_label: string; features: string[];
      starts_at: Date; ends_at: Date | null; renewal_at: Date | null;
    }[]>`
      SELECT id, sponsor_type, resident_label, features, starts_at, ends_at, renewal_at
      FROM bin_sponsorship_programmes
      WHERE organisation_id = ${organisation.id}::uuid
        AND status = 'active'
        AND starts_at <= now()
        AND (ends_at IS NULL OR ends_at > now())
      ORDER BY starts_at DESC
      LIMIT 1
    `,
    sql<{
      collection_dates: boolean; council_branding: boolean; push_alerts: boolean;
      missed_collection: boolean; direct_reporting: boolean; recycling_guide: boolean;
      partner_services: boolean; support_inbox: boolean; sponsored_plus: boolean;
      analytics_exports: boolean; bulky_waste_booking: boolean;
    }[]>`
      SELECT collection_dates, council_branding, push_alerts, missed_collection,
        direct_reporting, recycling_guide, partner_services, support_inbox,
        sponsored_plus, analytics_exports, bulky_waste_booking
      FROM bin_council_feature_flags
      WHERE organisation_id = ${organisation.id}::uuid
      LIMIT 1
    `,
  ]);

  const localGuidance = Object.fromEntries(guidance.map((item) => [
    item.item_key,
    {
      destination: item.destination,
      heading: item.heading,
      detail: item.detail,
      ...(item.service_url ? { serviceUrl: item.service_url } : {}),
    },
  ]));
  const rule = reporting[0];
  const sponsorship = sponsorships[0];
  const flags = featureFlags[0];
  return {
    ...profile,
    councilName: organisation.brand_name ?? organisation.name,
    reviewedAt: new Date().toISOString().slice(0, 10),
    capabilities: {
      ...profile.capabilities,
      guidance: guidance.length ? 'council-configured' : profile.capabilities.guidance,
      serviceAlerts: announcements.length || disruptions.length
        ? 'council-configured'
        : profile.capabilities.serviceAlerts,
      missedReports: rule?.enabled && rule.mode !== 'disabled'
        ? rule.mode === 'direct-api' ? 'council-configured' : 'official-handoff'
        : profile.capabilities.missedReports,
    },
    guidance: {
      ...profile.guidance,
      ...localGuidance,
    },
    branding: {
      displayName: organisation.brand_name ?? organisation.name,
      primaryColour: organisation.primary_colour,
      secondaryColour: organisation.secondary_colour,
      sponsorshipLabel: organisation.sponsorship_label ?? undefined,
    },
    sponsorship: sponsorship ? {
      id: sponsorship.id,
      sponsorType: sponsorship.sponsor_type,
      residentLabel: sponsorship.resident_label,
      features: sponsorship.features,
      startsAt: sponsorship.starts_at.toISOString(),
      endsAt: iso(sponsorship.ends_at),
      renewalAt: sponsorship.renewal_at?.toISOString().slice(0, 10),
    } : undefined,
    featureFlags: flags ? {
      collectionDates: flags.collection_dates,
      councilBranding: flags.council_branding,
      pushAlerts: flags.push_alerts,
      missedCollection: flags.missed_collection,
      directReporting: flags.direct_reporting,
      recyclingGuide: flags.recycling_guide,
      partnerServices: flags.partner_services,
      supportInbox: flags.support_inbox,
      sponsoredPlus: flags.sponsored_plus,
      analyticsExports: flags.analytics_exports,
      bulkyWasteBooking: flags.bulky_waste_booking,
    } : undefined,
    announcements: announcements.map((item) => ({
      id: item.id,
      kind: item.kind,
      severity: item.severity,
      title: item.title,
      body: item.body,
      placements: item.placements,
      startsAt: iso(item.starts_at),
      endsAt: iso(item.ends_at),
      sourceUrl: item.source_url ?? undefined,
      audience: item.audience_criteria,
    })),
    disruptions: disruptions.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      collectionTypes: item.collection_types,
      areaLabels: item.area_labels,
      cause: item.cause,
      residentInstruction: item.resident_instruction,
      startsAt: item.starts_at.toISOString(),
      expectedResumeAt: iso(item.expected_resume_at),
      endsAt: iso(item.ends_at),
      sourceUrl: item.source_url ?? undefined,
      audience: item.audience_criteria,
    })),
    partners: partners.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      serviceUrl: item.service_url,
      itemKeys: item.item_keys,
      disclosureLabel: item.disclosure_label,
      bookingMode: item.booking_mode === 'none' ? undefined : item.booking_mode,
      bookingPricePence: item.booking_price_pence ?? undefined,
      providerAcceptanceSlaHours: item.provider_acceptance_sla_hours,
      termsUrl: item.terms_url ?? undefined,
    })),
    reporting: rule ? {
      enabled: rule.enabled,
      mode: rule.mode,
      reportUrl: rule.report_url ?? undefined,
      eligibilityStartsHours: rule.eligibility_starts_hours,
      reportingDeadlineHours: rule.reporting_deadline_hours,
      requireDelayCheck: rule.require_delay_check,
      residentInstruction: rule.resident_instruction ?? undefined,
    } : undefined,
  };
}

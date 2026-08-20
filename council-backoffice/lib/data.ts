import { createHash } from "node:crypto";

import type postgres from "postgres";

import { councilDatabase } from "./database";
import { refundMarketplacePayment, releaseMarketplacePayout } from "./marketplace-payments";
import {
  clampOperationalQueueRequest,
  operationalQueueRequest,
  type OperationalQueueSearchParams,
  type OperationalQueueServerPage,
} from "./operational-queue";
import type {
  AuditEvent,
  CouncilAnnouncement,
  CouncilAudienceCriteria,
  CouncilBroadcastSummary,
  CouncilBulkyBooking,
  CouncilDisruption,
  CouncilFeatureFlags,
  CouncilGuidanceItem,
  CouncilOnboardingItem,
  CouncilOperationalQueueItem,
  CouncilPartner,
  CouncilOutcomeFunnels,
  CouncilPilotBaseline,
  CouncilSponsorshipProgramme,
  CouncilStaffSession,
  DashboardMetric,
  ReportingRule,
} from "./types";

type CountRow = { count: number };
type AnalyticsCountRow = {
  participants: number;
  reminders: number;
  guide_searches: number;
  guide_matches: number;
  missed_confirmations: number;
};
type ResidentAdoptionRow = {
  active_residents: number;
  currently_linked: number;
  all_time_residents: number;
};
type GatewayRow = {
  checks: number;
  successes: number;
  average_duration_ms: number | null;
};
type PushReachRow = {
  installations: number;
};

async function appendAudit(
  sql: postgres.TransactionSql,
  session: CouncilStaffSession,
  action: string,
  entityType: string,
  entityId: string | undefined,
  summary: Record<string, string | number | boolean | null>,
) {
  await sql`
    INSERT INTO bin_council_audit_logs (
      organisation_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      summary
    ) VALUES (
      ${session.organisation.id}::uuid,
      ${session.userId}::uuid,
      ${action},
      ${entityType},
      ${entityId ?? null}::uuid,
      ${sql.json(summary)}
    )
  `;
}

async function queueCouncilBroadcast(
  sql: postgres.TransactionSql,
  session: CouncilStaffSession,
  target: { announcementId: string } | { disruptionId: string },
) {
  const audienceRows = await sql<{ audience_criteria: CouncilAudienceCriteria }[]>`
    SELECT audience_criteria
    FROM (
      SELECT audience_criteria FROM bin_council_announcements
      WHERE id = ${"announcementId" in target ? target.announcementId : null}::uuid
        AND organisation_id = ${session.organisation.id}::uuid
      UNION ALL
      SELECT audience_criteria FROM bin_council_disruptions
      WHERE id = ${"disruptionId" in target ? target.disruptionId : null}::uuid
        AND organisation_id = ${session.organisation.id}::uuid
    ) AS content
    LIMIT 1
  `;
  const audience = audienceRows[0]?.audience_criteria ?? {
    scope: "council",
    collectionTypes: [],
    collectionDates: [],
    audienceLabels: [],
  };
  const estimatedRecipientCount = await estimateCouncilAudienceWithSql(sql, session, audience);
  const rows = await sql<{ id: string }[]>`
    INSERT INTO bin_council_broadcast_jobs (
      organisation_id,
      announcement_id,
      disruption_id,
      channels,
      requested_by,
      audience_criteria,
      estimated_recipient_count,
      audience_confirmed_at
    ) VALUES (
      ${session.organisation.id}::uuid,
      ${"announcementId" in target ? target.announcementId : null}::uuid,
      ${"disruptionId" in target ? target.disruptionId : null}::uuid,
      ${["web-push", "native-push"]},
      ${session.userId}::uuid,
      ${sql.json(audience)},
      ${estimatedRecipientCount},
      now()
    )
    RETURNING id
  `;
  const id = rows[0]?.id;
  if (!id) throw new Error("The resident push broadcast could not be queued.");
  return id;
}

async function estimateCouncilAudienceWithSql(
  sql: postgres.Sql | postgres.TransactionSql,
  session: CouncilStaffSession,
  audience: CouncilAudienceCriteria,
) {
  const reachRows = await sql<{ count: number }[]>`
    SELECT count(DISTINCT installation_id)::int AS count
    FROM bin_council_push_registrations
    WHERE council_id = ${session.organisation.providerId}
      AND enabled
      AND last_seen_at >= now() - interval '180 days'
      AND (
        ${audience.scope === "council"}
        OR (
          (${audience.collectionTypes.length === 0} OR collection_types && ${audience.collectionTypes}::varchar[])
          AND (${audience.collectionDates.length === 0} OR collection_dates && ${audience.collectionDates}::date[])
          AND (${audience.audienceLabels.length === 0} OR audience_labels && ${audience.audienceLabels}::varchar[])
        )
      )
  `;
  return reachRows[0]?.count ?? 0;
}

export async function estimateCouncilAudience(
  session: CouncilStaffSession,
  audience: CouncilAudienceCriteria,
) {
  return estimateCouncilAudienceWithSql(councilDatabase(), session, audience);
}

export async function listCouncilBroadcastsForContent(session: CouncilStaffSession, contentIds: string[]) {
  if (!contentIds.length) return [];
  const sql = councilDatabase();
  const rows = await sql<{
    id: string;
    content_id: string;
    status: string;
    delivered_count: number;
    failed_count: number;
    estimated_recipient_count: number;
    audience_criteria: CouncilAudienceCriteria;
    requested_at: Date;
    completed_at: Date | null;
  }[]>`
    SELECT DISTINCT ON (coalesce(announcement_id, disruption_id))
      id,
      coalesce(announcement_id, disruption_id) AS content_id,
      status,
      delivered_count,
      failed_count,
      estimated_recipient_count,
      audience_criteria,
      requested_at,
      completed_at
    FROM bin_council_broadcast_jobs
    WHERE organisation_id = ${session.organisation.id}::uuid
      AND coalesce(announcement_id, disruption_id) = ANY(${contentIds}::uuid[])
    ORDER BY coalesce(announcement_id, disruption_id), requested_at DESC
  `;
  return rows.map((row): CouncilBroadcastSummary => ({
    id: row.id,
    contentId: row.content_id,
    status: row.status,
    acceptedCount: row.delivered_count,
    failedCount: row.failed_count,
    estimatedRecipientCount: row.estimated_recipient_count,
    audience: row.audience_criteria,
    requestedAt: row.requested_at.toISOString(),
    completedAt: row.completed_at?.toISOString(),
  }));
}

export async function listSponsorshipProgrammesPage(
  session: CouncilStaffSession,
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<CouncilSponsorshipProgramme>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "starts",
    filterValues: ["council", "housing"],
    sortValues: ["created", "ends", "label", "renewal", "starts"],
    statusValues: ["draft", "active", "paused", "ended"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_sponsorship_programmes
      WHERE organisation_id = ${session.organisation.id}::uuid
        AND (${request.status} = '' OR status = ${request.status})
        AND (${request.filter} = '' OR sponsor_type = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', resident_label, sponsor_type, status, features::text) ILIKE ${pattern})
    `,
    sql<CountRow[]>`SELECT count(*)::int AS count FROM bin_sponsorship_programmes WHERE organisation_id = ${session.organisation.id}::uuid`,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<{
    id: string; sponsor_type: CouncilSponsorshipProgramme["sponsorType"];
    status: CouncilSponsorshipProgramme["status"]; resident_label: string; features: string[];
    starts_at: Date; ends_at: Date | null; renewal_at: Date | null; created_at: Date;
  }[]>`
    SELECT id, sponsor_type, status, resident_label, features, starts_at, ends_at, renewal_at, created_at
    FROM bin_sponsorship_programmes
    WHERE organisation_id = ${session.organisation.id}::uuid
      AND (${clampedRequest.status} = '' OR status = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR sponsor_type = ${clampedRequest.filter})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', resident_label, sponsor_type, status, features::text) ILIKE ${`%${clampedRequest.query}%`})
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'created' AND ${clampedRequest.direction} = 'asc' THEN created_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'created' AND ${clampedRequest.direction} = 'desc' THEN created_at END DESC,
      CASE WHEN ${clampedRequest.sort} = 'ends' AND ${clampedRequest.direction} = 'asc' THEN ends_at END ASC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'ends' AND ${clampedRequest.direction} = 'desc' THEN ends_at END DESC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'label' AND ${clampedRequest.direction} = 'asc' THEN resident_label END ASC,
      CASE WHEN ${clampedRequest.sort} = 'label' AND ${clampedRequest.direction} = 'desc' THEN resident_label END DESC,
      CASE WHEN ${clampedRequest.sort} = 'renewal' AND ${clampedRequest.direction} = 'asc' THEN renewal_at END ASC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'renewal' AND ${clampedRequest.direction} = 'desc' THEN renewal_at END DESC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'starts' AND ${clampedRequest.direction} = 'asc' THEN starts_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'starts' AND ${clampedRequest.direction} = 'desc' THEN starts_at END DESC,
      starts_at DESC,
      id DESC
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const items = rows.map((row): CouncilSponsorshipProgramme => ({
    id: row.id,
    sponsorType: row.sponsor_type,
    status: row.status,
    residentLabel: row.resident_label,
    features: row.features,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString(),
    renewalAt: row.renewal_at?.toISOString().slice(0, 10),
    createdAt: row.created_at.toISOString(),
  }));
  return { items, request: clampedRequest, total, unfilteredTotal: unfilteredRows[0]?.count ?? 0 };
}

export async function createSponsorshipProgramme(
  session: CouncilStaffSession,
  input: Omit<CouncilSponsorshipProgramme, "id" | "createdAt" | "status"> & { status: "draft" | "active" },
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    if (input.status === "active") {
      await transaction`
        UPDATE bin_sponsorship_programmes
        SET status = 'paused', updated_at = now()
        WHERE organisation_id = ${session.organisation.id}::uuid AND status = 'active'
      `;
    }
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_sponsorship_programmes (
        organisation_id, sponsor_type, status, resident_label, features,
        starts_at, ends_at, renewal_at, created_by
      ) VALUES (
        ${session.organisation.id}::uuid,
        ${input.sponsorType},
        ${input.status},
        ${input.residentLabel},
        ${input.features},
        ${input.startsAt}::timestamptz,
        ${input.endsAt ?? null}::timestamptz,
        ${input.renewalAt ?? null}::date,
        ${session.userId}::uuid
      )
      RETURNING id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("The sponsorship programme could not be saved.");
    await transaction`
      INSERT INTO bin_council_feature_flags (organisation_id, sponsored_plus, updated_by, updated_at)
      VALUES (${session.organisation.id}::uuid, ${input.status === "active"}, ${session.userId}::uuid, now())
      ON CONFLICT (organisation_id) DO UPDATE SET
        sponsored_plus = excluded.sponsored_plus,
        updated_by = excluded.updated_by,
        updated_at = now()
    `;
    await appendAudit(transaction, session, `sponsorship.${input.status}`, "sponsorship-programme", id, {
      sponsorType: input.sponsorType,
      featureCount: input.features.length,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
    });
    return id;
  });
}

export async function setSponsorshipProgrammeStatus(
  session: CouncilStaffSession,
  id: string,
  status: "active" | "paused" | "ended",
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    if (status === "active") {
      await transaction`
        UPDATE bin_sponsorship_programmes SET status = 'paused', updated_at = now()
        WHERE organisation_id = ${session.organisation.id}::uuid AND status = 'active' AND id <> ${id}::uuid
      `;
    }
    const rows = await transaction<{ resident_label: string }[]>`
      UPDATE bin_sponsorship_programmes
      SET status = ${status}, updated_at = now()
      WHERE id = ${id}::uuid AND organisation_id = ${session.organisation.id}::uuid
      RETURNING resident_label
    `;
    if (!rows[0]) throw new Error("The sponsorship programme was not found.");
    const activeRows = await transaction<{ count: number }[]>`
      SELECT count(*)::int AS count FROM bin_sponsorship_programmes
      WHERE organisation_id = ${session.organisation.id}::uuid
        AND status = 'active' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
    `;
    await transaction`
      INSERT INTO bin_council_feature_flags (organisation_id, sponsored_plus, updated_by, updated_at)
      VALUES (${session.organisation.id}::uuid, ${(activeRows[0]?.count ?? 0) > 0}, ${session.userId}::uuid, now())
      ON CONFLICT (organisation_id) DO UPDATE SET
        sponsored_plus = excluded.sponsored_plus,
        updated_by = excluded.updated_by,
        updated_at = now()
    `;
    await appendAudit(transaction, session, `sponsorship.${status}`, "sponsorship-programme", id, {
      label: rows[0].resident_label,
      status,
    });
  });
}

export async function getCouncilFeatureFlags(session: CouncilStaffSession): Promise<CouncilFeatureFlags> {
  const sql = councilDatabase();
  const rows = await sql<{
    collection_dates: boolean; council_branding: boolean; push_alerts: boolean;
    missed_collection: boolean; direct_reporting: boolean; recycling_guide: boolean;
    partner_services: boolean; support_inbox: boolean; sponsored_plus: boolean;
    analytics_exports: boolean; bulky_waste_booking: boolean;
  }[]>`
    SELECT collection_dates, council_branding, push_alerts, missed_collection,
      direct_reporting, recycling_guide, partner_services, support_inbox,
      sponsored_plus, analytics_exports, bulky_waste_booking
    FROM bin_council_feature_flags
    WHERE organisation_id = ${session.organisation.id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  return row ? {
    collectionDates: row.collection_dates,
    councilBranding: row.council_branding,
    pushAlerts: row.push_alerts,
    missedCollection: row.missed_collection,
    directReporting: row.direct_reporting,
    recyclingGuide: row.recycling_guide,
    partnerServices: row.partner_services,
    supportInbox: row.support_inbox,
    sponsoredPlus: row.sponsored_plus,
    analyticsExports: row.analytics_exports,
    bulkyWasteBooking: row.bulky_waste_booking,
  } : {
    collectionDates: true,
    councilBranding: true,
    pushAlerts: false,
    missedCollection: true,
    directReporting: false,
    recyclingGuide: true,
    partnerServices: false,
    supportInbox: false,
    sponsoredPlus: false,
    analyticsExports: false,
    bulkyWasteBooking: false,
  };
}

export async function saveCouncilFeatureFlags(
  session: CouncilStaffSession,
  flags: CouncilFeatureFlags,
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO bin_council_feature_flags (
        organisation_id, collection_dates, council_branding, push_alerts,
        missed_collection, direct_reporting, recycling_guide, partner_services,
        support_inbox, sponsored_plus, analytics_exports, bulky_waste_booking,
        updated_by, updated_at
      ) VALUES (
        ${session.organisation.id}::uuid, ${flags.collectionDates}, ${flags.councilBranding},
        ${flags.pushAlerts}, ${flags.missedCollection}, ${flags.directReporting},
        ${flags.recyclingGuide}, ${flags.partnerServices}, ${flags.supportInbox},
        ${flags.sponsoredPlus}, ${flags.analyticsExports}, ${flags.bulkyWasteBooking},
        ${session.userId}::uuid, now()
      )
      ON CONFLICT (organisation_id) DO UPDATE SET
        collection_dates = excluded.collection_dates,
        council_branding = excluded.council_branding,
        push_alerts = excluded.push_alerts,
        missed_collection = excluded.missed_collection,
        direct_reporting = excluded.direct_reporting,
        recycling_guide = excluded.recycling_guide,
        partner_services = excluded.partner_services,
        support_inbox = excluded.support_inbox,
        sponsored_plus = excluded.sponsored_plus,
        analytics_exports = excluded.analytics_exports,
        bulky_waste_booking = excluded.bulky_waste_booking,
        updated_by = excluded.updated_by,
        updated_at = now()
    `;
    await appendAudit(transaction, session, "features.updated", "organisation", session.organisation.id, {
      enabledCount: Object.values(flags).filter(Boolean).length,
    });
  });
}

const onboardingItemKeys = [
  "identity", "staff-access", "collection-source", "address-lookup", "bin-names-colours",
  "recycling-guidance", "missed-bin-policy", "service-alerts", "partner-approvals", "pilot-baseline",
] as const;

export async function listCouncilOnboardingItems(session: CouncilStaffSession): Promise<CouncilOnboardingItem[]> {
  const sql = councilDatabase();
  const rows = await sql<{
    item_key: string; status: CouncilOnboardingItem["status"]; evidence_note: string | null; completed_at: Date | null;
  }[]>`
    SELECT keys.item_key, coalesce(items.status, 'not-started') AS status,
      items.evidence_note, items.completed_at
    FROM unnest(${[...onboardingItemKeys]}::varchar[]) WITH ORDINALITY AS keys(item_key, sort_order)
    LEFT JOIN bin_council_onboarding_items AS items
      ON items.organisation_id = ${session.organisation.id}::uuid
      AND items.item_key = keys.item_key
    ORDER BY keys.sort_order
  `;
  return rows.map((row) => ({
    itemKey: row.item_key,
    status: row.status,
    evidenceNote: row.evidence_note ?? undefined,
    completedAt: row.completed_at?.toISOString(),
  }));
}

export async function saveCouncilOnboardingItem(
  session: CouncilStaffSession,
  input: Pick<CouncilOnboardingItem, "itemKey" | "status" | "evidenceNote">,
) {
  if (!(onboardingItemKeys as readonly string[]).includes(input.itemKey)) throw new Error("The setup item is invalid.");
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO bin_council_onboarding_items (
        organisation_id, item_key, status, evidence_note, completed_by, completed_at, updated_at
      ) VALUES (
        ${session.organisation.id}::uuid, ${input.itemKey}, ${input.status}, ${input.evidenceNote ?? null},
        ${input.status === "complete" ? session.userId : null}::uuid,
        ${input.status === "complete" ? new Date() : null}::timestamptz,
        now()
      )
      ON CONFLICT (organisation_id, item_key) DO UPDATE SET
        status = excluded.status,
        evidence_note = excluded.evidence_note,
        completed_by = excluded.completed_by,
        completed_at = excluded.completed_at,
        updated_at = now()
    `;
    await appendAudit(transaction, session, `onboarding.${input.status}`, "organisation", session.organisation.id, {
      itemKey: input.itemKey,
      status: input.status,
    });
  });
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : undefined;
}

export async function councilOperationalQueue(
  session: CouncilStaffSession,
): Promise<CouncilOperationalQueueItem[]> {
  const sql = councilDatabase();
  const organisationId = session.organisation.id;
  const providerId = session.organisation.providerId;
  const [
    disruptionRows,
    scheduledBroadcastRows,
    broadcastRows,
    gatewayRows,
    supportRows,
    bookingRows,
    missedReportRows,
    partnerRows,
  ] = await Promise.all([
    sql<{ active_count: number }[]>`
      SELECT count(*)::int AS active_count
      FROM bin_council_disruptions
      WHERE organisation_id = ${organisationId}::uuid
        AND status = 'published'
        AND starts_at <= now()
        AND (ends_at IS NULL OR ends_at > now())
    `,
    sql<{ scheduled_count: number }[]>`
      SELECT count(*)::int AS scheduled_count
      FROM bin_council_announcements
      WHERE organisation_id = ${organisationId}::uuid
        AND status IN ('published', 'scheduled')
        AND starts_at > now()
        AND starts_at < (
          date_trunc('day', now() AT TIME ZONE 'Europe/London') + interval '1 day'
        ) AT TIME ZONE 'Europe/London'
    `,
    sql<{ queued_count: number; failed_count: number }[]>`
      SELECT
        count(*) FILTER (WHERE status IN ('queued', 'processing'))::int AS queued_count,
        count(*) FILTER (WHERE status = 'failed' OR failed_count > 0)::int AS failed_count
      FROM bin_council_broadcast_jobs
      WHERE organisation_id = ${organisationId}::uuid
        AND (
          status IN ('queued', 'processing')
          OR ((status = 'failed' OR failed_count > 0) AND requested_at >= now() - interval '7 days')
        )
    `,
    sql<{ failed_count: number }[]>`
      SELECT count(*)::int AS failed_count
      FROM bin_gateway_checks
      WHERE council_id = ${providerId}
        AND NOT successful
        AND occurred_at >= now() - interval '24 hours'
    `,
    sql<{ waiting_count: number; overdue_count: number }[]>`
      SELECT
        count(*) FILTER (WHERE last_sender = 'resident')::int AS waiting_count,
        count(*) FILTER (WHERE sla_due_at IS NOT NULL AND sla_due_at < now())::int AS overdue_count
      FROM bin_resident_support_threads
      WHERE council_provider_id = ${providerId}
        AND status NOT IN ('resolved', 'closed')
    `,
    sql<{ waiting_count: number; approaching_count: number; overdue_count: number }[]>`
      SELECT
        count(*)::int AS waiting_count,
        count(*) FILTER (
          WHERE booking.started_at
              + partner.provider_acceptance_sla_hours * interval '1 hour' >= now()
            AND booking.started_at
              + partner.provider_acceptance_sla_hours * interval '1 hour' <= now() + interval '4 hours'
        )::int AS approaching_count,
        count(*) FILTER (
          WHERE booking.started_at
            + partner.provider_acceptance_sla_hours * interval '1 hour' < now()
        )::int AS overdue_count
      FROM bin_bulky_bookings AS booking
      INNER JOIN bin_council_partners AS partner ON partner.id = booking.partner_id
      WHERE booking.organisation_id = ${organisationId}::uuid
        AND booking.booking_channel = 'stripe-connect'
        AND booking.status = 'awaiting-provider'
    `,
    sql<{
      start_count: number;
      participant_count: number;
      leading_context: string | null;
      leading_count: number | null;
    }[]>`
      WITH recent AS (
        SELECT participant_id, context
        FROM bin_analytics_events
        WHERE council_id = ${providerId}
          AND event_name = 'missed_report_started'
          AND occurred_at >= now() - interval '24 hours'
      ), context_counts AS (
        SELECT context, count(*)::int AS context_count
        FROM recent
        WHERE context IS NOT NULL AND context <> ''
        GROUP BY context
        ORDER BY context_count DESC, context ASC
        LIMIT 1
      )
      SELECT
        count(*)::int AS start_count,
        count(DISTINCT participant_id)::int AS participant_count,
        (SELECT context FROM context_counts) AS leading_context,
        (SELECT context_count FROM context_counts) AS leading_count
      FROM recent
    `,
    sql<{ review_count: number; renewal_count: number }[]>`
      SELECT
        count(*) FILTER (WHERE status = 'review')::int AS review_count,
        count(*) FILTER (
          WHERE status = 'active'
            AND renewal_review_at IS NOT NULL
            AND renewal_review_at <= current_date + 30
        )::int AS renewal_count
      FROM bin_council_partners
      WHERE organisation_id = ${organisationId}::uuid
    `,
  ]);

  const items: CouncilOperationalQueueItem[] = [];
  const activeDisruptions = disruptionRows[0]?.active_count ?? 0;
  if (activeDisruptions > 0) {
    items.push({
      key: "active-disruptions",
      label: "Active collection disruptions",
      detail: `${activeDisruptions} published alert${activeDisruptions === 1 ? " is" : "s are"} live for this council`,
      count: activeDisruptions,
      href: "/disruptions",
      tone: "amber",
    });
  }

  const scheduledBroadcasts = scheduledBroadcastRows[0]?.scheduled_count ?? 0;
  if (scheduledBroadcasts > 0) {
    items.push({
      key: "scheduled-broadcasts",
      label: "Resident messages scheduled today",
      detail: `${scheduledBroadcasts} published resident message${scheduledBroadcasts === 1 ? " is" : "s are"} due to start later today`,
      count: scheduledBroadcasts,
      href: "/announcements",
      tone: "blue",
    });
  }

  const queuedBroadcasts = broadcastRows[0]?.queued_count ?? 0;
  const failedBroadcasts = broadcastRows[0]?.failed_count ?? 0;
  if (queuedBroadcasts + failedBroadcasts > 0) {
    items.push({
      key: "broadcast-delivery",
      label: "Broadcast delivery",
      detail: `${queuedBroadcasts} queued or processing · ${failedBroadcasts} failed or partially failed in 7 days`,
      count: queuedBroadcasts + failedBroadcasts,
      href: "/announcements",
      tone: failedBroadcasts > 0 ? "red" : "blue",
    });
  }

  const gatewayFailures = gatewayRows[0]?.failed_count ?? 0;
  if (gatewayFailures > 0) {
    items.push({
      key: "gateway-failures",
      label: "Collection-source failures",
      detail: `${gatewayFailures} unsuccessful verified check${gatewayFailures === 1 ? "" : "s"} in the last 24 hours`,
      count: gatewayFailures,
      href: "/analytics",
      tone: "red",
    });
  }

  const waitingSupport = supportRows[0]?.waiting_count ?? 0;
  const overdueSupport = supportRows[0]?.overdue_count ?? 0;
  if (waitingSupport + overdueSupport > 0) {
    items.push({
      key: "resident-support",
      label: "Resident conversations",
      detail: `${waitingSupport} awaiting a staff reply · ${overdueSupport} past the recorded SLA`,
      count: Math.max(waitingSupport, overdueSupport),
      href: "/crm/messages",
      tone: overdueSupport > 0 ? "red" : "amber",
    });
  }

  const waitingBookings = bookingRows[0]?.waiting_count ?? 0;
  const approachingBookings = bookingRows[0]?.approaching_count ?? 0;
  const overdueBookings = bookingRows[0]?.overdue_count ?? 0;
  const ordinaryWaitingBookings = Math.max(0, waitingBookings - approachingBookings - overdueBookings);
  if (overdueBookings > 0) {
    items.push({
      key: "paid-bookings-overdue",
      label: "Paid collections past provider deadline",
      detail: `${overdueBookings} paid booking${overdueBookings === 1 ? " has" : "s have"} passed the approved provider response SLA`,
      count: overdueBookings,
      href: "/partners#bulky-bookings",
      tone: "red",
    });
  }
  if (approachingBookings > 0) {
    items.push({
      key: "paid-bookings-approaching",
      label: "Provider response deadlines approaching",
      detail: `${approachingBookings} paid booking${approachingBookings === 1 ? " is" : "s are"} due for a provider response within 4 hours`,
      count: approachingBookings,
      href: "/partners#bulky-bookings",
      tone: "amber",
    });
  }
  if (ordinaryWaitingBookings > 0) {
    items.push({
      key: "paid-bookings",
      label: "Paid collections awaiting provider",
      detail: `${ordinaryWaitingBookings} paid booking${ordinaryWaitingBookings === 1 ? " is" : "s are"} awaiting acceptance within the approved response window`,
      count: ordinaryWaitingBookings,
      href: "/partners#bulky-bookings",
      tone: "blue",
    });
  }

  const missedReportStarts = missedReportRows[0]?.start_count ?? 0;
  if (missedReportStarts > 0) {
    const affectedParticipants = missedReportRows[0]?.participant_count ?? 0;
    const leadingContext = missedReportRows[0]?.leading_context;
    const leadingCount = missedReportRows[0]?.leading_count ?? 0;
    const leadingDetail = leadingContext
      ? ` · most frequent recorded type: ${leadingContext} (${leadingCount})`
      : "";
    items.push({
      key: "missed-report-patterns",
      label: "Missed-report activity",
      detail: `${missedReportStarts} opted-in report start${missedReportStarts === 1 ? "" : "s"} from ${affectedParticipants} installation${affectedParticipants === 1 ? "" : "s"} in 24 hours${leadingDetail}`,
      count: missedReportStarts,
      href: "/reports",
      tone: "amber",
    });
  }

  const partnerReviews = partnerRows[0]?.review_count ?? 0;
  const partnerRenewals = partnerRows[0]?.renewal_count ?? 0;
  if (partnerReviews + partnerRenewals > 0) {
    items.push({
      key: "partner-review",
      label: "Partner assurance",
      detail: `${partnerReviews} awaiting approval · ${partnerRenewals} renewal review${partnerRenewals === 1 ? "" : "s"} due within 30 days`,
      count: partnerReviews + partnerRenewals,
      href: "/partners",
      tone: "amber",
    });
  }

  return items;
}

export const analyticsPeriods = [7, 30, 90] as const;

export function normaliseAnalyticsPeriod(value?: string | number) {
  const period = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return analyticsPeriods.includes(period as (typeof analyticsPeriods)[number]) ? period : 30;
}

export async function dashboardMetrics(session: CouncilStaffSession, requestedPeriodDays: string | number = 30): Promise<{
  metrics: DashboardMetric[];
  outcomeFunnels: CouncilOutcomeFunnels;
  gatewayAvailability?: number;
  averageGatewayResponseMs?: number;
  dataPeriodDays: number;
}> {
  const sql = councilDatabase();
  const providerId = session.organisation.providerId;
  const periodDays = normaliseAnalyticsPeriod(requestedPeriodDays);
  const analyticsRows = await sql<AnalyticsCountRow[]>`
    SELECT
      count(DISTINCT participant_id)::int AS participants,
      count(DISTINCT participant_id) FILTER (
        WHERE event_name = 'reminders_enabled'
      )::int AS reminders,
      count(*) FILTER (
        WHERE event_name IN ('guide_search_matched', 'guide_search_no_match')
      )::int AS guide_searches,
      count(*) FILTER (
        WHERE event_name = 'guide_search_matched'
      )::int AS guide_matches,
      count(*) FILTER (
        WHERE event_name = 'council_submission_confirmed'
          AND occurred_at >= date_trunc('day', now())
      )::int AS missed_confirmations
    FROM bin_analytics_events
    WHERE council_id = ${providerId}
      AND occurred_at >= now() - make_interval(days => ${periodDays})
  `;
  const outcomeRows = await sql<{ event_name: string; event_count: number }[]>`
    SELECT event_name, count(*)::int AS event_count
    FROM bin_analytics_events
    WHERE council_id = ${providerId}
      AND occurred_at >= now() - make_interval(days => ${periodDays})
    GROUP BY event_name
  `;
  const residentAdoptionRows = await sql<ResidentAdoptionRow[]>`
    SELECT
      count(DISTINCT participant_id) FILTER (
        WHERE currently_linked
          AND last_seen_at >= now() - make_interval(days => ${periodDays})
      )::int AS active_residents,
      count(DISTINCT participant_id) FILTER (
        WHERE currently_linked
      )::int AS currently_linked,
      count(DISTINCT participant_id)::int AS all_time_residents
    FROM bin_council_resident_links
    WHERE council_id = ${providerId}
  `;
  const gatewayRows = await sql<GatewayRow[]>`
    SELECT
      count(*)::int AS checks,
      count(*) FILTER (WHERE successful)::int AS successes,
      round(avg(duration_ms))::int AS average_duration_ms
    FROM bin_gateway_checks
    WHERE council_id = ${providerId}
      AND occurred_at >= now() - make_interval(days => ${periodDays})
  `;
  const publishedRows = await sql<CountRow[]>`
    SELECT count(*)::int AS count
    FROM bin_council_announcements
    WHERE organisation_id = ${session.organisation.id}::uuid
      AND status = 'published'
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())
  `;
  const pushReachRows = await sql<PushReachRow[]>`
    SELECT count(DISTINCT installation_id)::int AS installations
    FROM bin_council_push_registrations
    WHERE council_id = ${providerId}
      AND enabled
      AND last_seen_at >= now() - interval '180 days'
  `;
  const analytics = analyticsRows[0] ?? {
    participants: 0,
    reminders: 0,
    guide_searches: 0,
    guide_matches: 0,
    missed_confirmations: 0,
  };
  const residentAdoption = residentAdoptionRows[0] ?? {
    active_residents: 0,
    currently_linked: 0,
    all_time_residents: 0,
  };
  const gateway = gatewayRows[0] ?? { checks: 0, successes: 0, average_duration_ms: null };
  const pushReach = pushReachRows[0]?.installations ?? 0;
  const reminderRate = percentage(analytics.reminders, analytics.participants);
  const guideSuccess = percentage(analytics.guide_matches, analytics.guide_searches);
  const gatewayAvailability = percentage(gateway.successes, gateway.checks);
  const outcomeCounts = new Map(outcomeRows.map((row) => [row.event_name, row.event_count]));
  const stage = (label: string, eventName: string, detail: string) => ({
    label,
    value: outcomeCounts.get(eventName) ?? 0,
    detail,
  });
  return {
    metrics: [
      {
        label: "Active residents",
        value: residentAdoption.active_residents.toLocaleString("en-GB"),
        detail: `Anonymous council-linked installations seen in the last ${periodDays} days`,
        state: "available",
        tone: "teal",
      },
      {
        label: "Currently linked",
        value: residentAdoption.currently_linked.toLocaleString("en-GB"),
        detail: "Latest saved-place state includes this council; uninstall cannot be detected",
        state: "available",
        tone: "blue",
      },
      {
        label: "All-time residents",
        value: residentAdoption.all_time_residents.toLocaleString("en-GB"),
        detail: "Ever linked to this council; removing or changing a saved place does not reduce it",
        state: "available",
        tone: "amber",
      },
      {
        label: "Reminder adoption",
        value: reminderRate === undefined ? "No data yet" : `${reminderRate}%`,
        detail: "Opted-in installations that enabled verified collection reminders",
        state: reminderRate === undefined ? "suppressed" : "available",
        tone: "blue",
      },
      {
        label: "Guide searches",
        value: analytics.guide_searches.toLocaleString("en-GB"),
        detail: guideSuccess === undefined
          ? "No council guide searches recorded yet"
          : `${guideSuccess}% returned a matching answer`,
        state: "available",
        tone: "amber",
      },
      {
        label: "Missed reports today",
        value: analytics.missed_confirmations.toLocaleString("en-GB"),
        detail: "Residents who confirmed an official council submission",
        state: "available",
        tone: "red",
      },
      {
        label: "Live resident notices",
        value: String(publishedRows[0]?.count ?? 0),
        detail: "Currently published Today, Schedule, Guide or Activity messages",
        state: "available",
        tone: "blue",
      },
      {
        label: "Push alert reach",
        value: pushReach.toLocaleString("en-GB"),
        detail: "Current notification-enabled installations linked to this council; no resident addresses are exposed",
        state: "available",
        tone: "teal",
      },
      {
        label: "Collections tomorrow",
        value: "Feed not connected",
        detail: "Requires a council round/property-count feed; no estimate is invented",
        state: "not-connected",
      },
    ],
    outcomeFunnels: {
      collection: [
        stage("Collections shown", "collection_answer_shown", "A verified Today answer was displayed"),
        stage("Reminder enabled", "reminders_enabled", "A resident enabled a verified reminder"),
        stage("Marked as out", "bin_marked_out", "A household recorded that its bin was put out"),
        stage("Outcome confirmed", "collection_outcome_confirmed", "Collected or missed was confirmed"),
        stage("Missed report started", "missed_report_started", "The official missed-bin journey was started"),
        stage("Official handoff opened", "missed_report_route_opened", "The council route or direct service was opened"),
        stage("Submission confirmed", "council_submission_confirmed", "The resident confirmed an official submission"),
      ],
      guide: [
        stage("Guide searches", "guide_search_matched", "Searches returning a structured result"),
        stage("No useful result", "guide_search_no_match", "Searches without a structured result"),
        stage("Answer selected", "guide_result_selected", "A resident opened a disposal answer"),
        stage("Partner listing viewed", "partner_listing_viewed", "A relevant labelled partner was shown"),
        stage("External service opened", "partner_external_opened", "A resident chose to leave for a service"),
      ],
      communications: [
        {
          label: "Active announcements",
          value: publishedRows[0]?.count ?? 0,
          detail: "Currently published council messages",
        },
        stage("In-app reach", "council_alert_shown", "Alert cards displayed in Activity"),
        stage("Alert opened", "council_alert_opened", "Residents opening council detail"),
        stage("Muted", "council_alert_muted", "Residents muting a council notice type"),
      ],
    },
    gatewayAvailability,
    averageGatewayResponseMs: gateway.average_duration_ms ?? undefined,
    dataPeriodDays: periodDays,
  };
}

export async function getCouncilPilotBaseline(session: CouncilStaffSession): Promise<CouncilPilotBaseline | undefined> {
  const sql = councilDatabase();
  const rows = await sql<{
    period_starts_on: string; period_ends_on: string; agreed_contact_cost_pence: number | null;
    resident_contacts: number | null; missed_collection_contacts: number | null;
    notes: string | null; updated_at: Date;
  }[]>`
    SELECT period_starts_on::text, period_ends_on::text, agreed_contact_cost_pence,
      resident_contacts, missed_collection_contacts, notes, updated_at
    FROM bin_council_pilot_baselines
    WHERE organisation_id = ${session.organisation.id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  return row ? {
    periodStartsOn: row.period_starts_on,
    periodEndsOn: row.period_ends_on,
    agreedContactCostPence: row.agreed_contact_cost_pence ?? undefined,
    residentContacts: row.resident_contacts ?? undefined,
    missedCollectionContacts: row.missed_collection_contacts ?? undefined,
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at.toISOString(),
  } : undefined;
}

export async function saveCouncilPilotBaseline(
  session: CouncilStaffSession,
  input: Omit<CouncilPilotBaseline, "updatedAt">,
) {
  const sql = councilDatabase();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO bin_council_pilot_baselines (
        organisation_id, period_starts_on, period_ends_on, agreed_contact_cost_pence,
        resident_contacts, missed_collection_contacts, notes, updated_by, updated_at
      ) VALUES (
        ${session.organisation.id}::uuid, ${input.periodStartsOn}::date, ${input.periodEndsOn}::date,
        ${input.agreedContactCostPence ?? null}, ${input.residentContacts ?? null},
        ${input.missedCollectionContacts ?? null}, ${input.notes ?? null}, ${session.userId}::uuid, now()
      )
      ON CONFLICT (organisation_id) DO UPDATE SET
        period_starts_on = excluded.period_starts_on,
        period_ends_on = excluded.period_ends_on,
        agreed_contact_cost_pence = excluded.agreed_contact_cost_pence,
        resident_contacts = excluded.resident_contacts,
        missed_collection_contacts = excluded.missed_collection_contacts,
        notes = excluded.notes,
        updated_by = excluded.updated_by,
        updated_at = now()
    `;
    await appendAudit(transaction, session, "pilot-baseline.updated", "organisation", session.organisation.id, {
      periodStartsOn: input.periodStartsOn,
      periodEndsOn: input.periodEndsOn,
      contactCostConfigured: input.agreedContactCostPence !== undefined,
    });
  });
}

export async function listAnnouncementTitles(session: CouncilStaffSession) {
  const sql = councilDatabase();
  const rows = await sql<{ title: string }[]>`
    SELECT title
    FROM bin_council_announcements
    WHERE organisation_id = ${session.organisation.id}::uuid
    ORDER BY title
  `;
  return rows.map((row) => row.title);
}

export async function listAnnouncementsPage(
  session: CouncilStaffSession,
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<CouncilAnnouncement>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "updated",
    filterValues: ["service", "education", "emergency", "seasonal"],
    sortValues: ["status", "title", "updated"],
    statusValues: ["published", "scheduled", "draft", "archived"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_council_announcements
      WHERE organisation_id = ${session.organisation.id}::uuid
        AND (${request.status} = '' OR status = ${request.status})
        AND (${request.filter} = '' OR kind = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', title, body, kind, severity, placements::text) ILIKE ${pattern})
    `,
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_council_announcements
      WHERE organisation_id = ${session.organisation.id}::uuid
    `,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<{
    id: string;
    kind: string;
    severity: string;
    title: string;
    body: string;
    placements: string[];
    status: string;
    starts_at: Date | null;
    ends_at: Date | null;
    source_url: string | null;
    audience_criteria: CouncilAudienceCriteria;
    updated_at: Date;
  }[]>`
    SELECT
      id,
      kind,
      severity,
      title,
      body,
      placements,
      status,
      starts_at,
      ends_at,
      source_url,
      audience_criteria,
      updated_at
    FROM bin_council_announcements
    WHERE organisation_id = ${session.organisation.id}::uuid
      AND (${clampedRequest.status} = '' OR status = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR kind = ${clampedRequest.filter})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', title, body, kind, severity, placements::text) ILIKE ${`%${clampedRequest.query}%`})
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'asc' THEN status END ASC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'desc' THEN status END DESC,
      CASE WHEN ${clampedRequest.sort} = 'title' AND ${clampedRequest.direction} = 'asc' THEN title END ASC,
      CASE WHEN ${clampedRequest.sort} = 'title' AND ${clampedRequest.direction} = 'desc' THEN title END DESC,
      CASE WHEN ${clampedRequest.sort} = 'updated' AND ${clampedRequest.direction} = 'asc' THEN updated_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'updated' AND ${clampedRequest.direction} = 'desc' THEN updated_at END DESC,
      updated_at DESC,
      id DESC
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const items = rows.map((row): CouncilAnnouncement => ({
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    body: row.body,
    placements: row.placements,
    status: row.status,
    startsAt: row.starts_at?.toISOString(),
    endsAt: row.ends_at?.toISOString(),
    sourceUrl: row.source_url ?? undefined,
    audience: row.audience_criteria,
    updatedAt: row.updated_at.toISOString(),
  }));
  return {
    items,
    request: clampedRequest,
    total,
    unfilteredTotal: unfilteredRows[0]?.count ?? 0,
  };
}

export async function createAnnouncement(
  session: CouncilStaffSession,
  input: Omit<CouncilAnnouncement, "id" | "status" | "updatedAt"> & {
    status: "draft" | "published";
    sendPush: boolean;
  },
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_council_announcements (
        organisation_id,
        kind,
        severity,
        title,
        body,
        placements,
        status,
        starts_at,
        ends_at,
        source_url,
        audience_criteria,
        created_by,
        published_by,
        published_at
      ) VALUES (
        ${session.organisation.id}::uuid,
        ${input.kind},
        ${input.severity},
        ${input.title},
        ${input.body},
        ${input.placements},
        ${input.status},
        ${input.startsAt ?? null}::timestamptz,
        ${input.endsAt ?? null}::timestamptz,
        ${input.sourceUrl ?? null},
        ${transaction.json(input.audience)},
        ${session.userId}::uuid,
        ${input.status === "published" ? session.userId : null}::uuid,
        ${input.status === "published" ? new Date().toISOString() : null}::timestamptz
      )
      RETURNING id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("The announcement could not be created.");
    await appendAudit(transaction, session, `announcement.${input.status}`, "announcement", id, {
      title: input.title,
      severity: input.severity,
      placements: input.placements.join(","),
      pushRequested: input.sendPush,
      audienceScope: input.audience.scope,
    });
    const broadcastJobId = input.status === "published" && input.sendPush
      ? await queueCouncilBroadcast(transaction, session, { announcementId: id })
      : undefined;
    return { id, broadcastJobId };
  });
}

export async function setAnnouncementStatus(
  session: CouncilStaffSession,
  id: string,
  status: "published" | "archived",
  sendPush = false,
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ title: string; starts_at: Date | null; audience_criteria: CouncilAudienceCriteria }[]>`
      UPDATE bin_council_announcements
      SET
        status = ${status},
        published_by = CASE WHEN ${status} = 'published' THEN ${session.userId}::uuid ELSE published_by END,
        published_at = CASE WHEN ${status} = 'published' THEN now() ELSE published_at END,
        updated_at = now()
      WHERE id = ${id}::uuid
        AND organisation_id = ${session.organisation.id}::uuid
      RETURNING title, starts_at, audience_criteria
    `;
    if (!rows[0]) throw new Error("The announcement was not found.");
    if (status === "published" && sendPush && rows[0].starts_at && rows[0].starts_at > new Date()) {
      throw new Error("A push alert must start now. Remove its future start time or publish without push.");
    }
    await appendAudit(transaction, session, `announcement.${status}`, "announcement", id, {
      title: rows[0].title,
      status,
      pushRequested: sendPush,
    });
    return status === "published" && sendPush
      ? await queueCouncilBroadcast(transaction, session, { announcementId: id })
      : undefined;
  });
}

export async function listActiveDisruptionContexts(
  session: CouncilStaffSession,
): Promise<Array<Pick<CouncilDisruption, "id" | "title" | "startsAt" | "endsAt">>> {
  const rows = await councilDatabase()<{ id: string; title: string; starts_at: Date; ends_at: Date | null }[]>`
    SELECT id, title, starts_at, ends_at
    FROM bin_council_disruptions
    WHERE organisation_id = ${session.organisation.id}::uuid
      AND status = 'published'
      AND (ends_at IS NULL OR ends_at > now())
    ORDER BY starts_at DESC, id DESC
  `;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString(),
  }));
}

export async function listDisruptionTitles(session: CouncilStaffSession) {
  const rows = await councilDatabase()<{ title: string }[]>`
    SELECT title
    FROM bin_council_disruptions
    WHERE organisation_id = ${session.organisation.id}::uuid
    ORDER BY title
  `;
  return rows.map((row) => row.title);
}

export async function listDisruptionsPage(
  session: CouncilStaffSession,
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<CouncilDisruption>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "starts",
    filterValues: ["operational", "weather", "bank-holiday", "industrial-action", "vehicle", "emergency", "other"],
    sortValues: ["starts", "status", "title"],
    statusValues: ["published", "draft", "resolved", "archived"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_council_disruptions
      WHERE organisation_id = ${session.organisation.id}::uuid
        AND (${request.status} = '' OR status = ${request.status})
        AND (${request.filter} = '' OR cause = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', title, detail, resident_instruction, collection_types::text, area_labels::text, cause) ILIKE ${pattern})
    `,
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_council_disruptions
      WHERE organisation_id = ${session.organisation.id}::uuid
    `,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<{
    id: string;
    title: string;
    detail: string;
    collection_types: string[];
    area_labels: string[];
    cause: string;
    resident_instruction: string;
    status: string;
    starts_at: Date;
    expected_resume_at: Date | null;
    ends_at: Date | null;
    source_url: string | null;
    audience_criteria: CouncilAudienceCriteria;
    updated_at: Date;
  }[]>`
    SELECT
      id,
      title,
      detail,
      collection_types,
      area_labels,
      cause,
      resident_instruction,
      status,
      starts_at,
      expected_resume_at,
      ends_at,
      source_url,
      audience_criteria,
      updated_at
    FROM bin_council_disruptions
    WHERE organisation_id = ${session.organisation.id}::uuid
      AND (${clampedRequest.status} = '' OR status = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR cause = ${clampedRequest.filter})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', title, detail, resident_instruction, collection_types::text, area_labels::text, cause) ILIKE ${`%${clampedRequest.query}%`})
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'starts' AND ${clampedRequest.direction} = 'asc' THEN starts_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'starts' AND ${clampedRequest.direction} = 'desc' THEN starts_at END DESC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'asc' THEN status END ASC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'desc' THEN status END DESC,
      CASE WHEN ${clampedRequest.sort} = 'title' AND ${clampedRequest.direction} = 'asc' THEN title END ASC,
      CASE WHEN ${clampedRequest.sort} = 'title' AND ${clampedRequest.direction} = 'desc' THEN title END DESC,
      starts_at DESC,
      id DESC
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const items = rows.map((row): CouncilDisruption => ({
    id: row.id,
    title: row.title,
    detail: row.detail,
    collectionTypes: row.collection_types,
    areaLabels: row.area_labels,
    cause: row.cause,
    residentInstruction: row.resident_instruction,
    status: row.status,
    startsAt: row.starts_at.toISOString(),
    expectedResumeAt: row.expected_resume_at?.toISOString(),
    endsAt: row.ends_at?.toISOString(),
    sourceUrl: row.source_url ?? undefined,
    audience: row.audience_criteria,
    updatedAt: row.updated_at.toISOString(),
  }));
  return {
    items,
    request: clampedRequest,
    total,
    unfilteredTotal: unfilteredRows[0]?.count ?? 0,
  };
}

export async function createDisruption(
  session: CouncilStaffSession,
  input: Omit<CouncilDisruption, "id" | "status" | "updatedAt"> & {
    status: "draft" | "published";
    sendPush: boolean;
  },
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_council_disruptions (
        organisation_id,
        title,
        detail,
        collection_types,
        area_labels,
        cause,
        resident_instruction,
        status,
        starts_at,
        expected_resume_at,
        ends_at,
        source_url,
        audience_criteria,
        created_by,
        published_by,
        published_at
      ) VALUES (
        ${session.organisation.id}::uuid,
        ${input.title},
        ${input.detail},
        ${input.collectionTypes},
        ${input.areaLabels},
        ${input.cause},
        ${input.residentInstruction},
        ${input.status},
        ${input.startsAt}::timestamptz,
        ${input.expectedResumeAt ?? null}::timestamptz,
        ${input.endsAt ?? null}::timestamptz,
        ${input.sourceUrl ?? null},
        ${transaction.json(input.audience)},
        ${session.userId}::uuid,
        ${input.status === "published" ? session.userId : null}::uuid,
        ${input.status === "published" ? new Date().toISOString() : null}::timestamptz
      )
      RETURNING id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("The disruption could not be created.");
    await appendAudit(transaction, session, `disruption.${input.status}`, "disruption", id, {
      title: input.title,
      cause: input.cause,
      collectionTypes: input.collectionTypes.join(","),
      affectedAreaCount: input.areaLabels.length,
      pushRequested: input.sendPush,
      audienceScope: input.audience.scope,
    });
    const broadcastJobId = input.status === "published" && input.sendPush
      ? await queueCouncilBroadcast(transaction, session, { disruptionId: id })
      : undefined;
    return { id, broadcastJobId };
  });
}

export async function setDisruptionStatus(
  session: CouncilStaffSession,
  id: string,
  status: "published" | "resolved" | "archived",
  sendPush = false,
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ title: string; starts_at: Date; audience_criteria: CouncilAudienceCriteria }[]>`
      UPDATE bin_council_disruptions
      SET
        status = ${status},
        published_by = CASE WHEN ${status} = 'published' THEN ${session.userId}::uuid ELSE published_by END,
        published_at = CASE WHEN ${status} = 'published' THEN now() ELSE published_at END,
        ends_at = CASE WHEN ${status} = 'resolved' THEN coalesce(ends_at, now()) ELSE ends_at END,
        updated_at = now()
      WHERE id = ${id}::uuid
        AND organisation_id = ${session.organisation.id}::uuid
      RETURNING title, starts_at, audience_criteria
    `;
    if (!rows[0]) throw new Error("The disruption was not found.");
    if (status === "published" && sendPush && rows[0].starts_at > new Date()) {
      throw new Error("A push alert must start now. Change its start time or publish without push.");
    }
    await appendAudit(transaction, session, `disruption.${status}`, "disruption", id, {
      title: rows[0].title,
      status,
      pushRequested: sendPush,
    });
    return status === "published" && sendPush
      ? await queueCouncilBroadcast(transaction, session, { disruptionId: id })
      : undefined;
  });
}

export async function listGuidancePage(
  session: CouncilStaffSession,
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<CouncilGuidanceItem>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultSort: "name",
    filterValues: ["general", "recycling", "garden", "food", "other", "service", "check"],
    sortValues: ["name", "status", "updated"],
    statusValues: ["published", "draft", "archived"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_council_guidance_items
      WHERE organisation_id = ${session.organisation.id}::uuid
        AND (${request.status} = '' OR status = ${request.status})
        AND (${request.filter} = '' OR destination = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', item_name, item_key, heading, detail, search_terms::text) ILIKE ${pattern})
    `,
    sql<CountRow[]>`SELECT count(*)::int AS count FROM bin_council_guidance_items WHERE organisation_id = ${session.organisation.id}::uuid`,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<{
    id: string;
    item_key: string;
    item_name: string;
    search_terms: string[];
    destination: string;
    heading: string;
    detail: string;
    service_url: string | null;
    status: string;
    updated_at: Date;
  }[]>`
    SELECT
      id,
      item_key,
      item_name,
      search_terms,
      destination,
      heading,
      detail,
      service_url,
      status,
      updated_at
    FROM bin_council_guidance_items
    WHERE organisation_id = ${session.organisation.id}::uuid
      AND (${clampedRequest.status} = '' OR status = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR destination = ${clampedRequest.filter})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', item_name, item_key, heading, detail, search_terms::text) ILIKE ${`%${clampedRequest.query}%`})
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'asc' THEN item_name END ASC,
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'desc' THEN item_name END DESC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'asc' THEN status END ASC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'desc' THEN status END DESC,
      CASE WHEN ${clampedRequest.sort} = 'updated' AND ${clampedRequest.direction} = 'asc' THEN updated_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'updated' AND ${clampedRequest.direction} = 'desc' THEN updated_at END DESC,
      item_name,
      id
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const items = rows.map((row): CouncilGuidanceItem => ({
    id: row.id,
    itemKey: row.item_key,
    itemName: row.item_name,
    searchTerms: row.search_terms,
    destination: row.destination,
    heading: row.heading,
    detail: row.detail,
    serviceUrl: row.service_url ?? undefined,
    status: row.status,
    updatedAt: row.updated_at.toISOString(),
  }));
  return { items, request: clampedRequest, total, unfilteredTotal: unfilteredRows[0]?.count ?? 0 };
}

export async function upsertGuidance(
  session: CouncilStaffSession,
  input: Omit<CouncilGuidanceItem, "id" | "updatedAt">,
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_council_guidance_items (
        organisation_id,
        item_key,
        item_name,
        search_terms,
        destination,
        heading,
        detail,
        service_url,
        status,
        created_by,
        published_by,
        published_at
      ) VALUES (
        ${session.organisation.id}::uuid,
        ${input.itemKey},
        ${input.itemName},
        ${input.searchTerms},
        ${input.destination},
        ${input.heading},
        ${input.detail},
        ${input.serviceUrl ?? null},
        ${input.status},
        ${session.userId}::uuid,
        ${input.status === "published" ? session.userId : null}::uuid,
        ${input.status === "published" ? new Date().toISOString() : null}::timestamptz
      )
      ON CONFLICT (organisation_id, item_key) DO UPDATE SET
        item_name = EXCLUDED.item_name,
        search_terms = EXCLUDED.search_terms,
        destination = EXCLUDED.destination,
        heading = EXCLUDED.heading,
        detail = EXCLUDED.detail,
        service_url = EXCLUDED.service_url,
        status = EXCLUDED.status,
        published_by = CASE
          WHEN EXCLUDED.status = 'published' THEN ${session.userId}::uuid
          ELSE bin_council_guidance_items.published_by
        END,
        published_at = CASE
          WHEN EXCLUDED.status = 'published' THEN now()
          ELSE bin_council_guidance_items.published_at
        END,
        updated_at = now()
      RETURNING id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("The guidance item could not be saved.");
    await appendAudit(transaction, session, `guidance.${input.status}`, "guidance", id, {
      itemKey: input.itemKey,
      itemName: input.itemName,
      destination: input.destination,
    });
    return id;
  });
}

export async function listPartnersPage(
  session: CouncilStaffSession,
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<CouncilPartner> & { categories: string[] }> {
  const sql = councilDatabase();
  const categoryRows = await sql<{ category: string }[]>`
    SELECT DISTINCT category
    FROM bin_council_partners
    WHERE organisation_id = ${session.organisation.id}::uuid
    ORDER BY category
  `;
  const categories = categoryRows.map((row) => row.category);
  const request = operationalQueueRequest(searchParams, {
    defaultSort: "name",
    filterValues: categories,
    sortValues: ["bookings", "name", "priority", "review"],
    statusValues: ["draft", "review", "active", "paused", "ended"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_council_partners AS partner
      WHERE partner.organisation_id = ${session.organisation.id}::uuid
        AND (${request.status} = '' OR partner.status = ${request.status})
        AND (${request.filter} = '' OR partner.category = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', partner.name, partner.category, partner.description, partner.licence_reference, partner.supported_area_labels::text) ILIKE ${pattern})
    `,
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_council_partners
      WHERE organisation_id = ${session.organisation.id}::uuid
    `,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<{
    id: string;
    name: string;
    category: string;
    description: string;
    service_url: string;
    item_keys: string[];
    disclosure_label: string;
    referral_model: string;
    commission_pence: number | null;
    booking_mode: "none" | "external-referral" | "stripe-connect";
    booking_price_pence: number | null;
    platform_fee_pence: number | null;
    stripe_account_id: string | null;
    provider_acceptance_sla_hours: number;
    terms_url: string | null;
    priority: number;
    licence_reference: string | null;
    supported_area_labels: string[];
    complaint_contact: string | null;
    evidence_url: string | null;
    budget_pence: number | null;
    immediate_suspension_reason: string | null;
    renewal_review_at: string | null;
    status: string;
    starts_at: Date | null;
    ends_at: Date | null;
    updated_at: Date;
    confirmed_booking_count: number;
  }[]>`
    SELECT
      partner.id,
      partner.name,
      partner.category,
      partner.description,
      partner.service_url,
      partner.item_keys,
      partner.disclosure_label,
      partner.referral_model,
      partner.commission_pence,
      partner.booking_mode,
      partner.booking_price_pence,
      partner.platform_fee_pence,
      partner.stripe_account_id,
      partner.provider_acceptance_sla_hours,
      partner.terms_url,
      partner.priority,
      partner.licence_reference,
      partner.supported_area_labels,
      partner.complaint_contact,
      partner.evidence_url,
      partner.budget_pence,
      partner.immediate_suspension_reason,
      partner.renewal_review_at::text,
      partner.status,
      partner.starts_at,
      partner.ends_at,
      partner.updated_at,
      coalesce(booking_sort.confirmed_booking_count, 0)::int AS confirmed_booking_count
    FROM bin_council_partners AS partner
    LEFT JOIN (
      SELECT partner_id, count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_booking_count
      FROM bin_bulky_bookings
      WHERE organisation_id = ${session.organisation.id}::uuid
      GROUP BY partner_id
    ) AS booking_sort ON booking_sort.partner_id = partner.id
    WHERE partner.organisation_id = ${session.organisation.id}::uuid
      AND (${clampedRequest.status} = '' OR partner.status = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR partner.category = ${clampedRequest.filter})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', partner.name, partner.category, partner.description, partner.licence_reference, partner.supported_area_labels::text) ILIKE ${`%${clampedRequest.query}%`})
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'bookings' AND ${clampedRequest.direction} = 'asc' THEN coalesce(booking_sort.confirmed_booking_count, 0) END ASC,
      CASE WHEN ${clampedRequest.sort} = 'bookings' AND ${clampedRequest.direction} = 'desc' THEN coalesce(booking_sort.confirmed_booking_count, 0) END DESC,
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'asc' THEN partner.name END ASC,
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'desc' THEN partner.name END DESC,
      CASE WHEN ${clampedRequest.sort} = 'priority' AND ${clampedRequest.direction} = 'asc' THEN partner.priority END ASC,
      CASE WHEN ${clampedRequest.sort} = 'priority' AND ${clampedRequest.direction} = 'desc' THEN partner.priority END DESC,
      CASE WHEN ${clampedRequest.sort} = 'review' AND ${clampedRequest.direction} = 'asc' THEN partner.renewal_review_at END ASC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'review' AND ${clampedRequest.direction} = 'desc' THEN partner.renewal_review_at END DESC NULLS LAST,
      partner.name,
      partner.id
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const partnerIds = rows.map((row) => row.id);
  const conversionRows = await sql<{ partner_id: string; event_name: string; event_count: number }[]>`
    SELECT partner_id, event_name, count(*)::int AS event_count
    FROM bin_partner_conversion_events
    WHERE organisation_id = ${session.organisation.id}::uuid
      AND partner_id = ANY(${partnerIds}::uuid[])
    GROUP BY partner_id, event_name
  `;
  const conversions = conversionRows.reduce<Record<string, Record<string, number>>>((result, row) => {
    result[row.partner_id] = { ...(result[row.partner_id] ?? {}), [row.event_name]: row.event_count };
    return result;
  }, {});
  const bookingRows = await sql<{
    partner_id: string;
    status: string;
    booking_count: number;
    confirmed_value_pence: number;
    confirmed_fee_pence: number;
  }[]>`
    SELECT partner_id, status, count(*)::int AS booking_count,
      coalesce(sum(amount_pence) FILTER (WHERE status IN (
        'awaiting-provider', 'provider-accepted', 'scheduled', 'confirmed', 'completed', 'payout-released'
      )), 0)::int AS confirmed_value_pence,
      coalesce(sum(platform_fee_pence) FILTER (WHERE status IN (
        'confirmed', 'completed', 'payout-released'
      )), 0)::int AS confirmed_fee_pence
    FROM bin_bulky_bookings
    WHERE organisation_id = ${session.organisation.id}::uuid
      AND partner_id = ANY(${partnerIds}::uuid[])
    GROUP BY partner_id, status
  `;
  const bookingEvidence = bookingRows.reduce<Record<string, {
    counts: Record<string, number>;
    valuePence: number;
    feePence: number;
  }>>((result, row) => {
    const current = result[row.partner_id] ?? { counts: {}, valuePence: 0, feePence: 0 };
    current.counts[row.status] = row.booking_count;
    current.valuePence += row.confirmed_value_pence;
    current.feePence += row.confirmed_fee_pence;
    result[row.partner_id] = current;
    return result;
  }, {});
  const items = rows.map((row): CouncilPartner => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    serviceUrl: row.service_url,
    itemKeys: row.item_keys,
    disclosureLabel: row.disclosure_label,
    referralModel: row.referral_model,
    commissionPence: row.commission_pence ?? undefined,
    bookingMode: row.booking_mode,
    bookingPricePence: row.booking_price_pence ?? undefined,
    platformFeePence: row.platform_fee_pence ?? undefined,
    stripeAccountId: row.stripe_account_id ?? undefined,
    providerAcceptanceSlaHours: row.provider_acceptance_sla_hours,
    termsUrl: row.terms_url ?? undefined,
    priority: row.priority,
    licenceReference: row.licence_reference ?? undefined,
    supportedAreaLabels: row.supported_area_labels,
    complaintContact: row.complaint_contact ?? undefined,
    evidenceUrl: row.evidence_url ?? undefined,
    budgetPence: row.budget_pence ?? undefined,
    suspensionReason: row.immediate_suspension_reason ?? undefined,
    renewalReviewAt: row.renewal_review_at ?? undefined,
    conversionCounts: conversions[row.id] ?? {},
    bookingCounts: bookingEvidence[row.id]?.counts ?? {},
    confirmedBookingValuePence: bookingEvidence[row.id]?.valuePence ?? 0,
    confirmedPlatformFeePence: bookingEvidence[row.id]?.feePence ?? 0,
    status: row.status,
    startsAt: row.starts_at?.toISOString(),
    endsAt: row.ends_at?.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
  return {
    categories,
    items,
    request: clampedRequest,
    total,
    unfilteredTotal: unfilteredRows[0]?.count ?? 0,
  };
}

export async function createPartner(
  session: CouncilStaffSession,
  input: Omit<
    CouncilPartner,
    "id" | "status" | "updatedAt" | "conversionCounts" | "bookingCounts" | "confirmedBookingValuePence" | "confirmedPlatformFeePence"
  > & { status: "draft" | "review" },
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_council_partners (
        organisation_id,
        name,
        category,
        description,
        service_url,
        item_keys,
        disclosure_label,
        referral_model,
        commission_pence,
        booking_mode,
        booking_price_pence,
        platform_fee_pence,
        stripe_account_id,
        provider_acceptance_sla_hours,
        terms_url,
        priority,
        licence_reference,
        supported_area_labels,
        complaint_contact,
        evidence_url,
        budget_pence,
        immediate_suspension_reason,
        renewal_review_at,
        status,
        starts_at,
        ends_at,
        created_by
      ) VALUES (
        ${session.organisation.id}::uuid,
        ${input.name},
        ${input.category},
        ${input.description},
        ${input.serviceUrl},
        ${input.itemKeys},
        ${input.disclosureLabel},
        ${input.referralModel},
        ${input.commissionPence ?? null},
        ${input.bookingMode},
        ${input.bookingPricePence ?? null},
        ${input.platformFeePence ?? null},
        ${input.stripeAccountId ?? null},
        ${input.providerAcceptanceSlaHours},
        ${input.termsUrl ?? null},
        ${input.priority},
        ${input.licenceReference ?? null},
        ${input.supportedAreaLabels},
        ${input.complaintContact ?? null},
        ${input.evidenceUrl ?? null},
        ${input.budgetPence ?? null},
        ${input.suspensionReason ?? null},
        ${input.renewalReviewAt ?? null}::date,
        ${input.status},
        ${input.startsAt ?? null}::timestamptz,
        ${input.endsAt ?? null}::timestamptz,
        ${session.userId}::uuid
      )
      RETURNING id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("The partner could not be saved.");
    await appendAudit(transaction, session, `partner.${input.status}`, "partner", id, {
      name: input.name,
      category: input.category,
      referralModel: input.referralModel,
      itemCount: input.itemKeys.length,
    });
    return id;
  });
}

export async function listBulkyBookingsPage(
  session: CouncilStaffSession,
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<CouncilBulkyBooking>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "started",
    filterValues: ["official-council", "external-referral", "stripe-connect"],
    sortValues: ["amount", "partner", "started", "status"],
    statusValues: [
      "official-handoff", "started", "checkout-created", "payment-pending", "awaiting-provider",
      "provider-accepted", "scheduled", "confirmed", "completed", "payout-released",
      "provider-declined", "cancelled", "refunded", "payment-failed",
    ],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_bulky_bookings AS booking
      LEFT JOIN bin_council_partners AS partner ON partner.id = booking.partner_id
      WHERE booking.organisation_id = ${session.organisation.id}::uuid
        AND (${request.status} = '' OR booking.status = ${request.status})
        AND (${request.filter} = '' OR booking.booking_channel = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', booking.public_reference, partner.name, booking.partner_reference, booking.item_key, booking.booking_channel) ILIKE ${pattern})
    `,
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_bulky_bookings
      WHERE organisation_id = ${session.organisation.id}::uuid
    `,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<{
    public_reference: string;
    partner_id: string | null;
    partner_name: string | null;
    booking_channel: CouncilBulkyBooking["channel"];
    item_key: string;
    quantity: number;
    amount_pence: number | null;
    platform_fee_pence: number | null;
    status: string;
    partner_reference: string | null;
    stripe_payment_intent_id: string | null;
    started_at: Date;
    confirmed_at: Date | null;
    provider_accepted_at: Date | null;
    provider_declined_at: Date | null;
    scheduled_for: Date | null;
    completed_at: Date | null;
    payout_released_at: Date | null;
    refunded_at: Date | null;
    stripe_transfer_id: string | null;
    stripe_refund_id: string | null;
  }[]>`
    SELECT booking.public_reference, booking.partner_id, partner.name AS partner_name,
      booking.booking_channel, booking.item_key, booking.quantity, booking.amount_pence,
      booking.platform_fee_pence, booking.status, booking.partner_reference,
      booking.stripe_payment_intent_id, booking.started_at, booking.confirmed_at,
      booking.provider_accepted_at, booking.provider_declined_at,
      booking.scheduled_for, booking.completed_at, booking.payout_released_at,
      booking.refunded_at, booking.stripe_transfer_id, booking.stripe_refund_id
    FROM bin_bulky_bookings booking
    LEFT JOIN bin_council_partners partner ON partner.id = booking.partner_id
    WHERE booking.organisation_id = ${session.organisation.id}::uuid
      AND (${clampedRequest.status} = '' OR booking.status = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR booking.booking_channel = ${clampedRequest.filter})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', booking.public_reference, partner.name, booking.partner_reference, booking.item_key, booking.booking_channel) ILIKE ${`%${clampedRequest.query}%`})
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'amount' AND ${clampedRequest.direction} = 'asc' THEN booking.amount_pence END ASC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'amount' AND ${clampedRequest.direction} = 'desc' THEN booking.amount_pence END DESC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'partner' AND ${clampedRequest.direction} = 'asc' THEN coalesce(partner.name, 'Official council route') END ASC,
      CASE WHEN ${clampedRequest.sort} = 'partner' AND ${clampedRequest.direction} = 'desc' THEN coalesce(partner.name, 'Official council route') END DESC,
      CASE WHEN ${clampedRequest.sort} = 'started' AND ${clampedRequest.direction} = 'asc' THEN booking.started_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'started' AND ${clampedRequest.direction} = 'desc' THEN booking.started_at END DESC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'asc' THEN booking.status END ASC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'desc' THEN booking.status END DESC,
      booking.started_at DESC,
      booking.id DESC
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const items = rows.map((row): CouncilBulkyBooking => ({
    reference: row.public_reference,
    partnerId: row.partner_id ?? undefined,
    partnerName: row.partner_name ?? undefined,
    channel: row.booking_channel,
    itemKey: row.item_key,
    quantity: row.quantity,
    amountPence: row.amount_pence ?? undefined,
    platformFeePence: row.platform_fee_pence ?? undefined,
    status: row.status,
    providerReference: row.partner_reference ?? undefined,
    paymentIntentId: session.platformAdmin ? row.stripe_payment_intent_id ?? undefined : undefined,
    startedAt: row.started_at.toISOString(),
    confirmedAt: row.confirmed_at?.toISOString(),
    providerAcceptedAt: row.provider_accepted_at?.toISOString(),
    providerDeclinedAt: row.provider_declined_at?.toISOString(),
    scheduledFor: row.scheduled_for?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    payoutReleasedAt: row.payout_released_at?.toISOString(),
    refundedAt: row.refunded_at?.toISOString(),
    payoutReleased: Boolean(row.stripe_transfer_id),
    refunded: Boolean(row.stripe_refund_id),
  }));
  return {
    items,
    request: clampedRequest,
    total,
    unfilteredTotal: unfilteredRows[0]?.count ?? 0,
  };
}

function assertMarketplaceSuperadmin(session: CouncilStaffSession) {
  if (!session.platformAdmin) throw new Error("Platform superadmin access is required for paid booking fulfilment.");
}

export async function acceptMarketplaceBulkyBooking(
  session: CouncilStaffSession,
  reference: string,
  providerReference: string,
  scheduledFor: string,
) {
  assertMarketplaceSuperadmin(session);
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{
      id: string;
      previous_status: string;
      partner_id: string;
      installation_id: string;
    }[]>`
      WITH current_booking AS (
        SELECT id, status AS previous_status
        FROM bin_bulky_bookings
        WHERE public_reference = ${reference}
          AND organisation_id = ${session.organisation.id}::uuid
          AND booking_channel = 'stripe-connect'
          AND status = 'awaiting-provider'
        FOR UPDATE
      )
      UPDATE bin_bulky_bookings booking SET
        status = 'scheduled',
        partner_reference = ${providerReference},
        provider_accepted_at = coalesce(provider_accepted_at, now()),
        scheduled_for = ${scheduledFor}::timestamptz,
        updated_at = now()
      FROM current_booking
      WHERE booking.id = current_booking.id
      RETURNING booking.id, current_booking.previous_status,
        booking.partner_id, booking.installation_id
    `;
    const booking = rows[0];
    if (!booking) throw new Error("This paid booking is not awaiting provider acceptance.");
    await transaction`
      INSERT INTO bin_bulky_booking_events (
        booking_id, actor_type, event_name, from_status, to_status, external_reference
      ) VALUES (
        ${booking.id}::uuid, 'platform-admin', 'provider-accepted',
        ${booking.previous_status}, 'scheduled', ${providerReference}
      )
    `;
    const referralTokenHash = createHash("sha256").update(reference, "utf8").digest("hex");
    await transaction`
      INSERT INTO bin_partner_conversion_events (
        partner_id, organisation_id, installation_id, event_name, referral_token_hash
      ) SELECT
        ${booking.partner_id}::uuid, ${session.organisation.id}::uuid,
        ${booking.installation_id}::uuid, 'booking-confirmed', ${referralTokenHash}
      WHERE NOT EXISTS (
        SELECT 1 FROM bin_partner_conversion_events
        WHERE partner_id = ${booking.partner_id}::uuid
          AND event_name = 'booking-confirmed'
          AND referral_token_hash = ${referralTokenHash}
      )
    `;
    await appendAudit(transaction, session, "bulky-booking.provider-accepted", "bulky-booking", booking.id, {
      reference,
      providerReference,
      scheduledFor,
    });
  });
}

export async function declineAndRefundMarketplaceBulkyBooking(
  session: CouncilStaffSession,
  reference: string,
) {
  assertMarketplaceSuperadmin(session);
  const sql = councilDatabase();
  const rows = await sql<{
    id: string;
    status: string;
    stripe_payment_intent_id: string;
  }[]>`
    SELECT id, status, stripe_payment_intent_id
    FROM bin_bulky_bookings
    WHERE public_reference = ${reference}
      AND organisation_id = ${session.organisation.id}::uuid
      AND booking_channel = 'stripe-connect'
      AND status IN ('awaiting-provider', 'provider-accepted', 'scheduled')
      AND stripe_payment_intent_id IS NOT NULL
    LIMIT 1
  `;
  const booking = rows[0];
  if (!booking) throw new Error("This booking cannot be declined or does not have a captured payment.");
  const refund = await refundMarketplacePayment({
    paymentIntentId: booking.stripe_payment_intent_id,
    reference,
  });
  await sql.begin(async (transaction) => {
    const updated = await transaction<{ id: string }[]>`
      UPDATE bin_bulky_bookings SET
        status = 'refunded',
        provider_declined_at = coalesce(provider_declined_at, now()),
        cancelled_at = coalesce(cancelled_at, now()),
        refunded_at = coalesce(refunded_at, now()),
        stripe_refund_id = ${refund.id},
        updated_at = now()
      WHERE id = ${booking.id}::uuid
        AND status = ${booking.status}
      RETURNING id
    `;
    if (!updated[0]) throw new Error("The booking changed while the refund was being issued. Check Stripe before retrying.");
    await transaction`
      INSERT INTO bin_bulky_booking_events (
        booking_id, actor_type, event_name, from_status, to_status, external_reference
      ) VALUES (
        ${booking.id}::uuid, 'platform-admin', 'provider-declined-refunded',
        ${booking.status}, 'refunded', ${refund.id}
      )
    `;
    await appendAudit(transaction, session, "bulky-booking.refunded", "bulky-booking", booking.id, {
      reference,
      refundId: refund.id,
      reason: "provider-declined",
    });
  });
}

export async function completeMarketplaceBulkyBooking(
  session: CouncilStaffSession,
  reference: string,
) {
  assertMarketplaceSuperadmin(session);
  const sql = councilDatabase();
  const rows = await sql<{
    id: string;
    partner_id: string;
    installation_id: string;
    amount_pence: number;
    platform_fee_pence: number;
    stripe_charge_id: string;
    stripe_account_id: string;
  }[]>`
    SELECT booking.id, booking.partner_id, booking.installation_id,
      booking.amount_pence, booking.platform_fee_pence,
      booking.stripe_charge_id, partner.stripe_account_id
    FROM bin_bulky_bookings booking
    JOIN bin_council_partners partner ON partner.id = booking.partner_id
    WHERE booking.public_reference = ${reference}
      AND booking.organisation_id = ${session.organisation.id}::uuid
      AND booking.booking_channel = 'stripe-connect'
      AND booking.status = 'scheduled'
      AND booking.stripe_transfer_id IS NULL
      AND booking.amount_pence IS NOT NULL
      AND booking.platform_fee_pence IS NOT NULL
      AND booking.stripe_charge_id IS NOT NULL
      AND partner.stripe_account_id IS NOT NULL
    LIMIT 1
  `;
  const booking = rows[0];
  if (!booking) throw new Error("This booking is not ready for completed-collection payout.");
  const providerAmount = booking.amount_pence - booking.platform_fee_pence;
  if (providerAmount <= 0) throw new Error("The provider payout must be greater than zero.");
  const transfer = await releaseMarketplacePayout({
    amountPence: providerAmount,
    chargeId: booking.stripe_charge_id,
    destinationAccountId: booking.stripe_account_id,
    reference,
  });
  await sql.begin(async (transaction) => {
    const updated = await transaction<{ id: string }[]>`
      UPDATE bin_bulky_bookings SET
        status = 'payout-released',
        completed_at = coalesce(completed_at, now()),
        payout_released_at = coalesce(payout_released_at, now()),
        stripe_transfer_id = ${transfer.id},
        updated_at = now()
      WHERE id = ${booking.id}::uuid
        AND status = 'scheduled'
        AND stripe_transfer_id IS NULL
      RETURNING id
    `;
    if (!updated[0]) throw new Error("The booking changed while the payout was being released. Check Stripe before retrying.");
    await transaction`
      INSERT INTO bin_bulky_booking_events (
        booking_id, actor_type, event_name, from_status, to_status, external_reference
      ) VALUES (
        ${booking.id}::uuid, 'platform-admin', 'collection-completed-payout-released',
        'scheduled', 'payout-released', ${transfer.id}
      )
    `;
    const referralTokenHash = createHash("sha256").update(reference, "utf8").digest("hex");
    await transaction`
      INSERT INTO bin_partner_conversion_events (
        partner_id, organisation_id, installation_id, event_name, referral_token_hash
      ) SELECT
        ${booking.partner_id}::uuid, ${session.organisation.id}::uuid,
        ${booking.installation_id}::uuid, 'booking-completed', ${referralTokenHash}
      WHERE NOT EXISTS (
        SELECT 1 FROM bin_partner_conversion_events
        WHERE partner_id = ${booking.partner_id}::uuid
          AND event_name = 'booking-completed'
          AND referral_token_hash = ${referralTokenHash}
      )
    `;
    await appendAudit(transaction, session, "bulky-booking.payout-released", "bulky-booking", booking.id, {
      reference,
      transferId: transfer.id,
      providerAmountPence: providerAmount,
      platformFeePence: booking.platform_fee_pence,
    });
  });
}

export async function confirmExternalBulkyBooking(
  session: CouncilStaffSession,
  reference: string,
  providerReference: string,
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{
      id: string;
      partner_id: string;
      installation_id: string;
    }[]>`
      UPDATE bin_bulky_bookings SET
        status = 'confirmed',
        partner_reference = ${providerReference},
        confirmed_at = coalesce(confirmed_at, now()),
        updated_at = now()
      WHERE public_reference = ${reference}
        AND organisation_id = ${session.organisation.id}::uuid
        AND booking_channel = 'external-referral'
        AND status = 'started'
      RETURNING id, partner_id, installation_id
    `;
    const booking = rows[0];
    if (!booking) throw new Error("The external booking is not awaiting provider confirmation.");
    const referralTokenHash = createHash("sha256").update(reference, "utf8").digest("hex");
    await transaction`
      INSERT INTO bin_partner_conversion_events (
        partner_id, organisation_id, installation_id, event_name, referral_token_hash
      ) SELECT
        ${booking.partner_id}::uuid, ${session.organisation.id}::uuid,
        ${booking.installation_id}::uuid, 'booking-confirmed', ${referralTokenHash}
      WHERE NOT EXISTS (
        SELECT 1 FROM bin_partner_conversion_events
        WHERE partner_id = ${booking.partner_id}::uuid
          AND event_name = 'booking-confirmed'
          AND referral_token_hash = ${referralTokenHash}
      )
    `;
    await appendAudit(transaction, session, "bulky-booking.confirmed", "bulky-booking", booking.id, {
      reference,
      providerReference,
      evidence: "provider-confirmed",
    });
  });
}

export async function setPartnerStatus(
  session: CouncilStaffSession,
  id: string,
  status: "active" | "paused" | "ended",
  suspensionReason?: string,
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const currentRows = await transaction<{
      name: string; complaint_contact: string | null; evidence_url: string | null; renewal_review_at: string | null;
      licence_reference: string | null; terms_url: string | null;
      booking_mode: string; booking_price_pence: number | null; platform_fee_pence: number | null; stripe_account_id: string | null;
    }[]>`
      SELECT name, complaint_contact, evidence_url, renewal_review_at::text,
        licence_reference, terms_url, booking_mode, booking_price_pence,
        platform_fee_pence, stripe_account_id
      FROM bin_council_partners
      WHERE id = ${id}::uuid AND organisation_id = ${session.organisation.id}::uuid
      LIMIT 1
    `;
    const current = currentRows[0];
    if (!current) throw new Error("The partner was not found.");
    if (status === "active" && (!current.complaint_contact || !current.evidence_url || !current.renewal_review_at)) {
      throw new Error("Add an evidence link, complaint contact and renewal review date before activation.");
    }
    if (status === "active" && current.booking_mode === "stripe-connect" && (
      !current.booking_price_pence || current.platform_fee_pence === null || !current.stripe_account_id
      || !current.licence_reference || !current.terms_url
    )) {
      throw new Error("Add the fixed price, platform fee, Stripe account, waste-carrier licence and terms link before activation.");
    }
    if (status === "active" && current.booking_mode === "stripe-connect" && !session.platformAdmin) {
      throw new Error("A platform superadmin must approve a paid in-app collection service.");
    }
    if (status === "paused" && !suspensionReason) {
      throw new Error("Record why the listing is being suspended.");
    }
    const rows = await transaction<{ name: string }[]>`
      UPDATE bin_council_partners
      SET
        status = ${status},
        approved_by = CASE WHEN ${status} = 'active' THEN ${session.userId}::uuid ELSE approved_by END,
        immediate_suspension_reason = CASE WHEN ${status} = 'paused' THEN ${suspensionReason ?? null} ELSE NULL END,
        updated_at = now()
      WHERE id = ${id}::uuid
        AND organisation_id = ${session.organisation.id}::uuid
      RETURNING name
    `;
    if (!rows[0]) throw new Error("The partner was not found.");
    await appendAudit(transaction, session, `partner.${status}`, "partner", id, {
      name: rows[0].name,
      status,
      suspensionReason: suspensionReason ?? null,
    });
  });
}

export async function getReportingRule(session: CouncilStaffSession): Promise<ReportingRule> {
  const sql = councilDatabase();
  const rows = await sql<{
    enabled: boolean;
    mode: ReportingRule["mode"];
    report_url: string | null;
    eligibility_starts_hours: number;
    reporting_deadline_hours: number;
    require_delay_check: boolean;
    resident_instruction: string | null;
    integration_secret_ref: string | null;
    updated_at: Date;
  }[]>`
    SELECT
      enabled,
      mode,
      report_url,
      eligibility_starts_hours,
      reporting_deadline_hours,
      require_delay_check,
      resident_instruction,
      integration_secret_ref,
      updated_at
    FROM bin_council_reporting_rules
    WHERE organisation_id = ${session.organisation.id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return {
      enabled: true,
      mode: "official-handoff",
      eligibilityStartsHours: 18,
      reportingDeadlineHours: 48,
      requireDelayCheck: true,
    };
  }
  return {
    enabled: row.enabled,
    mode: row.mode,
    reportUrl: row.report_url ?? undefined,
    eligibilityStartsHours: row.eligibility_starts_hours,
    reportingDeadlineHours: row.reporting_deadline_hours,
    requireDelayCheck: row.require_delay_check,
    residentInstruction: row.resident_instruction ?? undefined,
    integrationSecretRef: row.integration_secret_ref ?? undefined,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function saveReportingRule(
  session: CouncilStaffSession,
  input: Omit<ReportingRule, "updatedAt">,
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO bin_council_reporting_rules (
        organisation_id,
        enabled,
        mode,
        report_url,
        eligibility_starts_hours,
        reporting_deadline_hours,
        require_delay_check,
        resident_instruction,
        integration_secret_ref,
        updated_by
      ) VALUES (
        ${session.organisation.id}::uuid,
        ${input.enabled},
        ${input.mode},
        ${input.reportUrl ?? null},
        ${input.eligibilityStartsHours},
        ${input.reportingDeadlineHours},
        ${input.requireDelayCheck},
        ${input.residentInstruction ?? null},
        ${input.integrationSecretRef ?? null},
        ${session.userId}::uuid
      )
      ON CONFLICT (organisation_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        mode = EXCLUDED.mode,
        report_url = EXCLUDED.report_url,
        eligibility_starts_hours = EXCLUDED.eligibility_starts_hours,
        reporting_deadline_hours = EXCLUDED.reporting_deadline_hours,
        require_delay_check = EXCLUDED.require_delay_check,
        resident_instruction = EXCLUDED.resident_instruction,
        integration_secret_ref = EXCLUDED.integration_secret_ref,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
    `;
    await appendAudit(transaction, session, "reporting_rule.updated", "reporting_rule", undefined, {
      enabled: input.enabled,
      mode: input.mode,
      eligibilityStartsHours: input.eligibilityStartsHours,
      reportingDeadlineHours: input.reportingDeadlineHours,
      requireDelayCheck: input.requireDelayCheck,
    });
  });
}

export async function listAuditEventsPage(
  session: CouncilStaffSession,
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<AuditEvent> & { entityTypes: string[] }> {
  const sql = councilDatabase();
  const entityRows = await sql<{ entity_type: string }[]>`
    SELECT DISTINCT entity_type
    FROM bin_council_audit_logs
    WHERE organisation_id = ${session.organisation.id}::uuid
    ORDER BY entity_type
  `;
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "occurred",
    filterValues: entityRows.map((row) => row.entity_type),
    sortValues: ["action", "actor", "entity", "occurred"],
  });
  const queryPattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_council_audit_logs AS audit_log
      LEFT JOIN auth.users AS user_account ON user_account.id = audit_log.actor_user_id
      WHERE audit_log.organisation_id = ${session.organisation.id}::uuid
        AND (${request.filter} = '' OR audit_log.entity_type = ${request.filter})
        AND (
          ${request.query} = ''
          OR concat_ws(' ', audit_log.action, audit_log.entity_type, audit_log.entity_id::text, user_account.email, audit_log.summary::text)
            ILIKE ${queryPattern}
        )
    `,
    sql<CountRow[]>`
      SELECT count(*)::int AS count
      FROM bin_council_audit_logs
      WHERE organisation_id = ${session.organisation.id}::uuid
    `,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<{
    id: string;
    actor_label: string | null;
    actor_user_id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    summary: Record<string, unknown>;
    occurred_at: Date;
  }[]>`
    SELECT
      audit_log.id,
      user_account.email AS actor_label,
      audit_log.actor_user_id,
      audit_log.action,
      audit_log.entity_type,
      audit_log.entity_id,
      audit_log.summary,
      audit_log.occurred_at
    FROM bin_council_audit_logs AS audit_log
    LEFT JOIN auth.users AS user_account ON user_account.id = audit_log.actor_user_id
    WHERE audit_log.organisation_id = ${session.organisation.id}::uuid
      AND (${clampedRequest.filter} = '' OR audit_log.entity_type = ${clampedRequest.filter})
      AND (
        ${clampedRequest.query} = ''
        OR concat_ws(' ', audit_log.action, audit_log.entity_type, audit_log.entity_id::text, user_account.email, audit_log.summary::text)
          ILIKE ${`%${clampedRequest.query}%`}
      )
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'action' AND ${clampedRequest.direction} = 'asc' THEN audit_log.action END ASC,
      CASE WHEN ${clampedRequest.sort} = 'action' AND ${clampedRequest.direction} = 'desc' THEN audit_log.action END DESC,
      CASE WHEN ${clampedRequest.sort} = 'actor' AND ${clampedRequest.direction} = 'asc' THEN coalesce(user_account.email, audit_log.actor_user_id::text) END ASC,
      CASE WHEN ${clampedRequest.sort} = 'actor' AND ${clampedRequest.direction} = 'desc' THEN coalesce(user_account.email, audit_log.actor_user_id::text) END DESC,
      CASE WHEN ${clampedRequest.sort} = 'entity' AND ${clampedRequest.direction} = 'asc' THEN audit_log.entity_type END ASC,
      CASE WHEN ${clampedRequest.sort} = 'entity' AND ${clampedRequest.direction} = 'desc' THEN audit_log.entity_type END DESC,
      CASE WHEN ${clampedRequest.sort} = 'occurred' AND ${clampedRequest.direction} = 'asc' THEN audit_log.occurred_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'occurred' AND ${clampedRequest.direction} = 'desc' THEN audit_log.occurred_at END DESC,
      audit_log.occurred_at DESC,
      audit_log.id DESC
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const items = rows.map((row): AuditEvent => ({
    id: row.id,
    actorLabel: row.actor_label ?? undefined,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    summary: row.summary,
    occurredAt: row.occurred_at.toISOString(),
  }));
  return {
    entityTypes: entityRows.map((row) => row.entity_type),
    items,
    request: clampedRequest,
    total,
    unfilteredTotal: unfilteredRows[0]?.count ?? 0,
  };
}

export async function updateOrganisationBrand(
  session: CouncilStaffSession,
  input: {
    brandName?: string;
    primaryColour: string;
    secondaryColour: string;
    sponsorshipLabel?: string;
  },
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      UPDATE bin_council_organisations
      SET
        brand_name = ${input.brandName ?? null},
        primary_colour = ${input.primaryColour},
        secondary_colour = ${input.secondaryColour},
        sponsorship_label = ${input.sponsorshipLabel ?? null},
        updated_at = now()
      WHERE id = ${session.organisation.id}::uuid
      RETURNING id
    `;
    if (!rows[0]) throw new Error("The council organisation was not found.");
    await appendAudit(transaction, session, "organisation.brand_updated", "organisation", session.organisation.id, {
      brandName: input.brandName ?? null,
      primaryColour: input.primaryColour,
      secondaryColour: input.secondaryColour,
      sponsorshipLabel: input.sponsorshipLabel ?? null,
    });
  });
}

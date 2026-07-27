import type postgres from "postgres";

import { councilDatabase } from "./database";
import type {
  AuditEvent,
  CouncilAnnouncement,
  CouncilDisruption,
  CouncilGuidanceItem,
  CouncilPartner,
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
type GatewayRow = {
  checks: number;
  successes: number;
  average_duration_ms: number | null;
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

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : undefined;
}

export async function dashboardMetrics(session: CouncilStaffSession): Promise<{
  metrics: DashboardMetric[];
  gatewayAvailability?: number;
  averageGatewayResponseMs?: number;
  dataPeriodDays: number;
}> {
  const sql = councilDatabase();
  const providerId = session.organisation.providerId;
  const periodDays = 30;
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
  const analytics = analyticsRows[0] ?? {
    participants: 0,
    reminders: 0,
    guide_searches: 0,
    guide_matches: 0,
    missed_confirmations: 0,
  };
  const gateway = gatewayRows[0] ?? { checks: 0, successes: 0, average_duration_ms: null };
  const reminderRate = percentage(analytics.reminders, analytics.participants);
  const guideSuccess = percentage(analytics.guide_matches, analytics.guide_searches);
  const gatewayAvailability = percentage(gateway.successes, gateway.checks);
  return {
    metrics: [
      {
        label: "Consenting installations",
        value: analytics.participants.toLocaleString("en-GB"),
        detail: `Unique opted-in installations in the last ${periodDays} days`,
        state: "available",
        tone: "teal",
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
        detail: "Currently published home, schedule or guide messages",
        state: "available",
        tone: "blue",
      },
      {
        label: "Collections tomorrow",
        value: "Feed not connected",
        detail: "Requires a council round/property-count feed; no estimate is invented",
        state: "not-connected",
      },
    ],
    gatewayAvailability,
    averageGatewayResponseMs: gateway.average_duration_ms ?? undefined,
    dataPeriodDays: periodDays,
  };
}

export async function listAnnouncements(session: CouncilStaffSession) {
  const sql = councilDatabase();
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
      updated_at
    FROM bin_council_announcements
    WHERE organisation_id = ${session.organisation.id}::uuid
    ORDER BY
      CASE status WHEN 'published' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
      updated_at DESC
    LIMIT 100
  `;
  return rows.map((row): CouncilAnnouncement => ({
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
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function createAnnouncement(
  session: CouncilStaffSession,
  input: Omit<CouncilAnnouncement, "id" | "status" | "updatedAt"> & { status: "draft" | "published" },
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
    });
    return id;
  });
}

export async function setAnnouncementStatus(
  session: CouncilStaffSession,
  id: string,
  status: "published" | "archived",
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ title: string }[]>`
      UPDATE bin_council_announcements
      SET
        status = ${status},
        published_by = CASE WHEN ${status} = 'published' THEN ${session.userId}::uuid ELSE published_by END,
        published_at = CASE WHEN ${status} = 'published' THEN now() ELSE published_at END,
        updated_at = now()
      WHERE id = ${id}::uuid
        AND organisation_id = ${session.organisation.id}::uuid
      RETURNING title
    `;
    if (!rows[0]) throw new Error("The announcement was not found.");
    await appendAudit(transaction, session, `announcement.${status}`, "announcement", id, {
      title: rows[0].title,
      status,
    });
  });
}

export async function listDisruptions(session: CouncilStaffSession) {
  const sql = councilDatabase();
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
      updated_at
    FROM bin_council_disruptions
    WHERE organisation_id = ${session.organisation.id}::uuid
    ORDER BY
      CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
      starts_at DESC
    LIMIT 100
  `;
  return rows.map((row): CouncilDisruption => ({
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
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function createDisruption(
  session: CouncilStaffSession,
  input: Omit<CouncilDisruption, "id" | "status" | "updatedAt"> & { status: "draft" | "published" },
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
    });
    return id;
  });
}

export async function setDisruptionStatus(
  session: CouncilStaffSession,
  id: string,
  status: "published" | "resolved" | "archived",
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ title: string }[]>`
      UPDATE bin_council_disruptions
      SET
        status = ${status},
        published_by = CASE WHEN ${status} = 'published' THEN ${session.userId}::uuid ELSE published_by END,
        published_at = CASE WHEN ${status} = 'published' THEN now() ELSE published_at END,
        ends_at = CASE WHEN ${status} = 'resolved' THEN coalesce(ends_at, now()) ELSE ends_at END,
        updated_at = now()
      WHERE id = ${id}::uuid
        AND organisation_id = ${session.organisation.id}::uuid
      RETURNING title
    `;
    if (!rows[0]) throw new Error("The disruption was not found.");
    await appendAudit(transaction, session, `disruption.${status}`, "disruption", id, {
      title: rows[0].title,
      status,
    });
  });
}

export async function listGuidance(session: CouncilStaffSession) {
  const sql = councilDatabase();
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
    ORDER BY item_name
    LIMIT 500
  `;
  return rows.map((row): CouncilGuidanceItem => ({
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

export async function listPartners(session: CouncilStaffSession) {
  const sql = councilDatabase();
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
    priority: number;
    licence_reference: string | null;
    status: string;
    starts_at: Date | null;
    ends_at: Date | null;
    updated_at: Date;
  }[]>`
    SELECT
      id,
      name,
      category,
      description,
      service_url,
      item_keys,
      disclosure_label,
      referral_model,
      commission_pence,
      priority,
      licence_reference,
      status,
      starts_at,
      ends_at,
      updated_at
    FROM bin_council_partners
    WHERE organisation_id = ${session.organisation.id}::uuid
    ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'review' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
      priority,
      name
    LIMIT 200
  `;
  return rows.map((row): CouncilPartner => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    serviceUrl: row.service_url,
    itemKeys: row.item_keys,
    disclosureLabel: row.disclosure_label,
    referralModel: row.referral_model,
    commissionPence: row.commission_pence ?? undefined,
    priority: row.priority,
    licenceReference: row.licence_reference ?? undefined,
    status: row.status,
    startsAt: row.starts_at?.toISOString(),
    endsAt: row.ends_at?.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function createPartner(
  session: CouncilStaffSession,
  input: Omit<CouncilPartner, "id" | "status" | "updatedAt"> & { status: "draft" | "review" },
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
        priority,
        licence_reference,
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
        ${input.priority},
        ${input.licenceReference ?? null},
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

export async function setPartnerStatus(
  session: CouncilStaffSession,
  id: string,
  status: "active" | "paused" | "ended",
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ name: string }[]>`
      UPDATE bin_council_partners
      SET
        status = ${status},
        approved_by = CASE WHEN ${status} = 'active' THEN ${session.userId}::uuid ELSE approved_by END,
        updated_at = now()
      WHERE id = ${id}::uuid
        AND organisation_id = ${session.organisation.id}::uuid
      RETURNING name
    `;
    if (!rows[0]) throw new Error("The partner was not found.");
    await appendAudit(transaction, session, `partner.${status}`, "partner", id, {
      name: rows[0].name,
      status,
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

export async function listAuditEvents(session: CouncilStaffSession) {
  const sql = councilDatabase();
  const rows = await sql<{
    id: string;
    actor_user_id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    summary: Record<string, unknown>;
    occurred_at: Date;
  }[]>`
    SELECT
      id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      summary,
      occurred_at
    FROM bin_council_audit_logs
    WHERE organisation_id = ${session.organisation.id}::uuid
    ORDER BY occurred_at DESC
    LIMIT 200
  `;
  return rows.map((row): AuditEvent => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    summary: row.summary,
    occurredAt: row.occurred_at.toISOString(),
  }));
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

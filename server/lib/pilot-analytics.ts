import { timingSafeEqual } from 'node:crypto';

import { binDatabase, binDatabaseConfigured } from './bin-database';
import {
  councilIdPattern,
  councilWorkspaceForResidentUse,
  isPilotParticipantId,
  type PilotCouncilLinkSync,
  type ResidentCouncilLinkSync,
} from './pilot-council-links';

export {
  isPilotParticipantId,
  parsePilotCouncilLinkSync,
  parsePilotCouncilWorkspaceSync,
  parseResidentCouncilLinkSync,
} from './pilot-council-links';

export const pilotAnalyticsEventNames = [
  'analytics_consent_granted',
  'postcode_lookup_started',
  'postcode_lookup_succeeded',
  'postcode_lookup_failed',
  'address_options_loaded',
  'exact_address_selected',
  'collection_lookup_started',
  'collection_lookup_succeeded',
  'collection_lookup_failed',
  'verified_dates_shown',
  'reminders_enabled',
  'reminders_disabled',
  'guide_search_matched',
  'guide_search_no_match',
  'guide_result_selected',
  'local_services_succeeded',
  'local_services_failed',
  'missed_report_eligible',
  'missed_report_route_opened',
  'council_submission_confirmed',
] as const;

export type PilotAnalyticsEventName = typeof pilotAnalyticsEventNames[number];

const eventNameSet = new Set<string>(pilotAnalyticsEventNames);
const platformSet = new Set(['ios', 'android', 'web']);
const outcomeSet = new Set([
  'success',
  'failure',
  'enabled',
  'disabled',
  'eligible',
  'opened',
  'confirmed',
  'matched',
  'no-match',
]);
const contextSet = new Set([
  'manual',
  'location',
  'exact-address',
  'postcode-only',
  'address-add',
  'refresh',
  'automatic',
  'general',
  'recycling',
  'garden',
  'food',
  'other',
  'service',
  'check',
  'council-website',
  'phone-or-email',
  'direct-api',
]);
const reasonSet = new Set([
  'timeout',
  'unavailable',
  'unsupported',
  'invalid-response',
  'not-found',
  'invalid-postcode',
  'permission-denied',
  'unknown',
]);
const appVersionPattern = /^[0-9A-Za-z.+-]{1,32}$/;

export type PilotAnalyticsEvent = {
  id: string;
  name: PilotAnalyticsEventName;
  occurredAt: string;
  councilId?: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
  outcome?: string;
  context?: string;
  reasonCode?: string;
  durationMs?: number;
  metricValue?: number;
};

export type PilotAnalyticsBatch = {
  participantId: string;
  consentVersion: '2026-07-27';
  events: PilotAnalyticsEvent[];
};

type EventCountRow = {
  council_id: string;
  event_name: PilotAnalyticsEventName;
  event_count: string;
  participant_count: string;
};

type CouncilCountRow = {
  council_id: string;
  participant_count: string;
};

type OperationalCountRow = {
  council_id: string;
  check_count: string;
  successful_count: string;
  average_duration_ms: string | null;
};

export type PilotRate = {
  numerator: number | null;
  denominator: number | null;
  percentage: number | null;
};

export type PilotCouncilReport = {
  councilId: string;
  participants: number | null;
  suppressed: boolean;
  eventParticipants: Partial<Record<PilotAnalyticsEventName, number | null>>;
  measures: {
    exactAddressLookupCompletion: PilotRate;
    verifiedDateAvailability: PilotRate;
    failedCollectionLookupRate: PilotRate;
    reminderOptIn: PilotRate;
    guideAnswerSuccess: PilotRate;
    missedBinRouteCompletion: PilotRate;
    gatewayAvailability: PilotRate;
    averageGatewayResponseMs: number | null;
  };
};

export type PilotAnalyticsReport = {
  generatedAt: string;
  periodDays: number;
  rawEventRetentionDays: number;
  minimumPublicCohort: number;
  privileged: boolean;
  councils: PilotCouncilReport[];
};

function database() {
  return binDatabase();
}

function retentionDays() {
  const configured = Number(process.env.ANALYTICS_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= 30 && configured <= 180
    ? configured
    : 90;
}

function minimumPublicCohort() {
  const configured = Number(process.env.ANALYTICS_MIN_COHORT);
  return Number.isInteger(configured) && configured >= 5 && configured <= 50
    ? configured
    : 10;
}

export function pilotAnalyticsConfigured() {
  return binDatabaseConfigured();
}

function boundedInteger(value: unknown, maximum: number) {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= maximum;
}

function optionalAllowedValue(value: unknown, allowed: Set<string>) {
  return value === undefined || (typeof value === 'string' && allowed.has(value));
}

function parseEvent(value: unknown, now: Date): PilotAnalyticsEvent {
  if (!value || typeof value !== 'object') throw new Error('An analytics event is invalid.');
  const raw = value as Record<string, unknown>;
  const occurredAt = typeof raw.occurredAt === 'string' ? new Date(raw.occurredAt) : new Date(Number.NaN);
  const earliest = now.getTime() - (30 * 24 * 60 * 60 * 1_000);
  const latest = now.getTime() + (5 * 60 * 1_000);
  if (
    !isPilotParticipantId(raw.id)
    || typeof raw.name !== 'string'
    || !eventNameSet.has(raw.name)
    || Number.isNaN(occurredAt.getTime())
    || occurredAt.getTime() < earliest
    || occurredAt.getTime() > latest
    || typeof raw.platform !== 'string'
    || !platformSet.has(raw.platform)
    || typeof raw.appVersion !== 'string'
    || !appVersionPattern.test(raw.appVersion)
    || (raw.councilId !== undefined && (
      typeof raw.councilId !== 'string'
      || !councilIdPattern.test(raw.councilId)
    ))
    || !optionalAllowedValue(raw.outcome, outcomeSet)
    || !optionalAllowedValue(raw.context, contextSet)
    || !optionalAllowedValue(raw.reasonCode, reasonSet)
    || (raw.durationMs !== undefined && !boundedInteger(raw.durationMs, 120_000))
    || (raw.metricValue !== undefined && !boundedInteger(raw.metricValue, 1_000))
  ) {
    throw new Error('An analytics event contains an unsupported value.');
  }
  return {
    id: raw.id,
    name: raw.name as PilotAnalyticsEventName,
    occurredAt: occurredAt.toISOString(),
    councilId: raw.councilId as string | undefined,
    platform: raw.platform as PilotAnalyticsEvent['platform'],
    appVersion: raw.appVersion,
    outcome: raw.outcome as string | undefined,
    context: raw.context as string | undefined,
    reasonCode: raw.reasonCode as string | undefined,
    durationMs: raw.durationMs as number | undefined,
    metricValue: raw.metricValue as number | undefined,
  };
}

export function parsePilotAnalyticsBatch(value: unknown, now = new Date()): PilotAnalyticsBatch {
  if (!value || typeof value !== 'object') throw new Error('An analytics batch is required.');
  const raw = value as Record<string, unknown>;
  if (
    !isPilotParticipantId(raw.participantId)
    || raw.consentVersion !== '2026-07-27'
    || !Array.isArray(raw.events)
    || raw.events.length === 0
    || raw.events.length > 25
  ) {
    throw new Error('The analytics batch is invalid.');
  }
  return {
    participantId: raw.participantId,
    consentVersion: '2026-07-27',
    events: raw.events.map((event) => parseEvent(event, now)),
  };
}

async function applyRetention() {
  const sql = database();
  const days = retentionDays();
  await sql`
    DELETE FROM bin_analytics_events
    WHERE received_at < now() - make_interval(days => ${days})
  `;
  await sql`
    DELETE FROM bin_gateway_checks
    WHERE received_at < now() - make_interval(days => ${days})
  `;
}

export async function savePilotAnalyticsBatch(batch: PilotAnalyticsBatch) {
  const sql = database();
  const recent = await sql`
    SELECT count(*)::int AS count
    FROM bin_analytics_events
    WHERE participant_id = ${batch.participantId}::uuid
      AND received_at >= now() - interval '24 hours'
  ` as { count: number }[];
  if ((recent[0]?.count ?? 0) + batch.events.length > 500) {
    throw new Error('The analytics event limit has been reached. Try again tomorrow.');
  }
  const rows = batch.events.map((event) => ({
    id: event.id,
    participant_id: batch.participantId,
    consent_version: batch.consentVersion,
    event_name: event.name,
    occurred_at: event.occurredAt,
    council_id: event.councilId ?? null,
    platform: event.platform,
    app_version: event.appVersion,
    outcome: event.outcome ?? null,
    context: event.context ?? null,
    reason_code: event.reasonCode ?? null,
    duration_ms: event.durationMs ?? null,
    metric_value: event.metricValue ?? null,
  }));
  const result = await sql`
    INSERT INTO bin_analytics_events (
      id,
      participant_id,
      consent_version,
      event_name,
      occurred_at,
      council_id,
      platform,
      app_version,
      outcome,
      context,
      reason_code,
      duration_ms,
      metric_value
    )
    SELECT
      item.id::uuid,
      item.participant_id::uuid,
      item.consent_version,
      item.event_name,
      item.occurred_at::timestamptz,
      item.council_id,
      item.platform,
      item.app_version,
      item.outcome,
      item.context,
      item.reason_code,
      item.duration_ms,
      item.metric_value
    FROM jsonb_to_recordset(${sql.json(rows)}::jsonb) AS item(
      id text,
      participant_id text,
      consent_version text,
      event_name text,
      occurred_at text,
      council_id text,
      platform text,
      app_version text,
      outcome text,
      context text,
      reason_code text,
      duration_ms integer,
      metric_value integer
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  await applyRetention();
  return result.length;
}

export async function ensurePilotCouncilWorkspaces(councilIds: string[]) {
  const sql = database();
  const workspaces = councilIds.map((councilId) => (
    councilWorkspaceForResidentUse(councilId)
  )).filter((workspace): workspace is NonNullable<typeof workspace> => Boolean(workspace));
  if (!workspaces.length) return { workspaceCount: 0 };
  await sql`
    INSERT INTO bin_council_organisations (
      provider_id,
      slug,
      name,
      status,
      plan_tier
    )
    SELECT
      item.provider_id,
      item.slug,
      item.name,
      'prospect',
      'pilot'
    FROM jsonb_to_recordset(${sql.json(workspaces.map((workspace) => ({
      provider_id: workspace.providerId,
      slug: workspace.slug,
      name: workspace.name,
    })))}::jsonb) AS item(
      provider_id text,
      slug text,
      name text
    )
    ON CONFLICT (provider_id) DO NOTHING
  `;
  return { workspaceCount: workspaces.length };
}

export async function syncResidentCouncilLinks(input: ResidentCouncilLinkSync) {
  await ensurePilotCouncilWorkspaces(input.councilIds);
  const sql = database();
  const now = new Date().toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      UPDATE bin_council_resident_links
      SET
        currently_linked = false,
        unlinked_at = ${now}::timestamptz
      WHERE participant_id = ${input.installationId}::uuid
        AND currently_linked
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(${transaction.json(input.councilIds)}::jsonb) AS desired(council_id)
          WHERE desired.council_id = bin_council_resident_links.council_id
        )
    `;
    if (input.councilIds.length === 0) return;
    const rows = input.councilIds.map((councilId) => ({
      participant_id: input.installationId,
      council_id: councilId,
      linked_at: now,
    }));
    await transaction`
      INSERT INTO bin_council_resident_links (
        participant_id,
        council_id,
        first_linked_at,
        last_linked_at,
        last_seen_at,
        currently_linked,
        unlinked_at
      )
      SELECT
        item.participant_id::uuid,
        item.council_id,
        item.linked_at::timestamptz,
        item.linked_at::timestamptz,
        item.linked_at::timestamptz,
        true,
        null
      FROM jsonb_to_recordset(${transaction.json(rows)}::jsonb) AS item(
        participant_id text,
        council_id text,
        linked_at text
      )
      ON CONFLICT (participant_id, council_id) DO UPDATE
      SET
        last_linked_at = CASE
          WHEN bin_council_resident_links.currently_linked
            THEN bin_council_resident_links.last_linked_at
          ELSE EXCLUDED.last_linked_at
        END,
        last_seen_at = EXCLUDED.last_seen_at,
        currently_linked = true,
        unlinked_at = null
    `;
  });
  return {
    currentCouncilCount: input.councilIds.length,
    syncedAt: now,
  };
}

export async function syncPilotCouncilLinks(input: PilotCouncilLinkSync) {
  return syncResidentCouncilLinks({
    installationId: input.participantId,
    councilIds: input.councilIds,
  });
}

export async function deletePilotParticipant(participantId: string) {
  if (!isPilotParticipantId(participantId)) throw new Error('The analytics participant ID is invalid.');
  const sql = database();
  const events = await sql`
    DELETE FROM bin_analytics_events
    WHERE participant_id = ${participantId}::uuid
    RETURNING id
  `;
  return events.length;
}

export async function deleteResidentCouncilInstallation(installationId: string) {
  if (!isPilotParticipantId(installationId)) {
    throw new Error('The resident installation ID is invalid.');
  }
  const sql = database();
  const deleted = await sql`
    DELETE FROM bin_council_resident_links
    WHERE participant_id = ${installationId}::uuid
    RETURNING council_id
  `;
  return deleted.length;
}

export async function recordPilotGatewayCheck(input: {
  id: string;
  occurredAt: string;
  councilId?: string;
  resource: 'addresses' | 'collections' | 'services' | 'unknown';
  successful: boolean;
  statusCode: number;
  durationMs: number;
  reasonCode?: 'client-error' | 'source-error' | 'unknown';
}) {
  if (
    !isPilotParticipantId(input.id)
    || Number.isNaN(Date.parse(input.occurredAt))
    || (input.councilId !== undefined && !councilIdPattern.test(input.councilId))
    || !boundedInteger(input.statusCode, 599)
    || input.statusCode < 100
    || !boundedInteger(input.durationMs, 120_000)
  ) return false;
  const sql = database();
  await sql`
    INSERT INTO bin_gateway_checks (
      id,
      occurred_at,
      council_id,
      resource,
      successful,
      status_code,
      duration_ms,
      reason_code
    ) VALUES (
      ${input.id}::uuid,
      ${input.occurredAt}::timestamptz,
      ${input.councilId ?? null},
      ${input.resource},
      ${input.successful},
      ${input.statusCode},
      ${input.durationMs},
      ${input.reasonCode ?? null}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  return true;
}

function safeCount(value: string | number | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function rate(numerator: number | null, denominator: number | null): PilotRate {
  if (numerator === null || denominator === null || denominator <= 0) {
    return { numerator, denominator, percentage: null };
  }
  return {
    numerator,
    denominator,
    percentage: Math.round((numerator / denominator) * 1_000) / 10,
  };
}

function addCounts(left: number | null, right: number | null) {
  return left === null || right === null ? null : left + right;
}

export async function buildPilotAnalyticsReport(options: {
  councilId?: string;
  periodDays?: number;
  privileged?: boolean;
} = {}): Promise<PilotAnalyticsReport> {
  if (options.councilId && !councilIdPattern.test(options.councilId)) {
    throw new Error('The council report filter is invalid.');
  }
  const periodDays = Number.isInteger(options.periodDays)
    ? Math.min(90, Math.max(7, options.periodDays as number))
    : 84;
  const privileged = options.privileged === true;
  const threshold = privileged ? 1 : minimumPublicCohort();
  const sql = database();
  const councilFilter = options.councilId ?? null;
  const eventRows = await sql`
    SELECT
      coalesce(council_id, 'uk-wide') AS council_id,
      event_name,
      count(*)::text AS event_count,
      count(DISTINCT participant_id)::text AS participant_count
    FROM bin_analytics_events
    WHERE occurred_at >= now() - make_interval(days => ${periodDays})
      AND (${councilFilter}::text IS NULL OR council_id = ${councilFilter})
    GROUP BY coalesce(council_id, 'uk-wide'), event_name
    ORDER BY council_id, event_name
  ` as EventCountRow[];
  const councilRows = await sql`
    SELECT
      coalesce(council_id, 'uk-wide') AS council_id,
      count(DISTINCT participant_id)::text AS participant_count
    FROM bin_analytics_events
    WHERE occurred_at >= now() - make_interval(days => ${periodDays})
      AND (${councilFilter}::text IS NULL OR council_id = ${councilFilter})
    GROUP BY coalesce(council_id, 'uk-wide')
    ORDER BY council_id
  ` as CouncilCountRow[];
  const operationalRows = await sql`
    SELECT
      coalesce(council_id, 'uk-wide') AS council_id,
      count(*)::text AS check_count,
      count(*) FILTER (WHERE successful)::text AS successful_count,
      round(avg(duration_ms))::text AS average_duration_ms
    FROM bin_gateway_checks
    WHERE occurred_at >= now() - make_interval(days => ${periodDays})
      AND (${councilFilter}::text IS NULL OR council_id = ${councilFilter})
    GROUP BY coalesce(council_id, 'uk-wide')
    ORDER BY council_id
  ` as OperationalCountRow[];
  const operationalByCouncil = new Map(operationalRows.map((row) => [row.council_id, row]));

  const councils = councilRows.map((council): PilotCouncilReport => {
    const participants = safeCount(council.participant_count);
    const suppressed = participants < threshold;
    const rawEventParticipants = eventRows
      .filter((row) => row.council_id === council.council_id)
      .reduce<Partial<Record<PilotAnalyticsEventName, number>>>((counts, row) => ({
        ...counts,
        [row.event_name]: safeCount(row.participant_count),
      }), {});
    const visibleEventParticipants = Object.fromEntries(
      Object.entries(rawEventParticipants).map(([name, count]) => [
        name,
        !privileged && (count ?? 0) < threshold ? null : count,
      ]),
    ) as Partial<Record<PilotAnalyticsEventName, number | null>>;
    const count = (name: PilotAnalyticsEventName) => (
      suppressed ? null : visibleEventParticipants[name] ?? 0
    );
    const operational = operationalByCouncil.get(council.council_id);
    const operationalChecks = operational ? safeCount(operational.check_count) : 0;
    const operationalSuccesses = operational ? safeCount(operational.successful_count) : 0;
    const gatewayVisible = privileged || operationalChecks >= threshold;
    const guideMatches = count('guide_search_matched');
    const guideNoMatches = count('guide_search_no_match');
    return {
      councilId: council.council_id,
      participants: suppressed ? null : participants,
      suppressed,
      eventParticipants: suppressed ? {} : visibleEventParticipants,
      measures: {
        exactAddressLookupCompletion: rate(
          count('exact_address_selected'),
          count('address_options_loaded'),
        ),
        verifiedDateAvailability: rate(
          count('verified_dates_shown'),
          count('collection_lookup_started'),
        ),
        failedCollectionLookupRate: rate(
          count('collection_lookup_failed'),
          count('collection_lookup_started'),
        ),
        reminderOptIn: rate(
          count('reminders_enabled'),
          count('verified_dates_shown'),
        ),
        guideAnswerSuccess: rate(
          guideMatches,
          addCounts(guideMatches, guideNoMatches),
        ),
        missedBinRouteCompletion: rate(
          count('missed_report_route_opened'),
          count('missed_report_eligible'),
        ),
        gatewayAvailability: gatewayVisible
          ? rate(operationalSuccesses, operationalChecks)
          : rate(null, null),
        averageGatewayResponseMs: gatewayVisible
          ? safeCount(operational?.average_duration_ms ?? undefined)
          : null,
      },
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    rawEventRetentionDays: retentionDays(),
    minimumPublicCohort: minimumPublicCohort(),
    privileged,
    councils,
  };
}

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function pilotAnalyticsReportCsv(report: PilotAnalyticsReport) {
  const headings = [
    'council_id',
    'participants',
    'suppressed',
    'exact_address_completion_percent',
    'verified_date_availability_percent',
    'failed_lookup_percent',
    'reminder_opt_in_percent',
    'guide_answer_success_percent',
    'missed_route_completion_percent',
    'gateway_availability_percent',
    'average_gateway_response_ms',
  ];
  const rows = report.councils.map((council) => [
    council.councilId,
    council.participants,
    council.suppressed,
    council.measures.exactAddressLookupCompletion.percentage,
    council.measures.verifiedDateAvailability.percentage,
    council.measures.failedCollectionLookupRate.percentage,
    council.measures.reminderOptIn.percentage,
    council.measures.guideAnswerSuccess.percentage,
    council.measures.missedBinRouteCompletion.percentage,
    council.measures.gatewayAvailability.percentage,
    council.measures.averageGatewayResponseMs,
  ]);
  return [
    headings.map(csvValue).join(','),
    ...rows.map((row) => row.map(csvValue).join(',')),
  ].join('\n');
}

export function isPilotReportAuthorised(authorization: string | null) {
  const secret = process.env.PILOT_REPORT_TOKEN?.trim();
  if (!secret || !authorization?.startsWith('Bearer ')) return false;
  const supplied = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

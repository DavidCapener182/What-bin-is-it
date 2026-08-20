import { councilDatabase } from "./database";
import {
  clampOperationalQueueRequest,
  operationalQueueRequest,
  type OperationalQueueSearchParams,
  type OperationalQueueServerPage,
} from "./operational-queue";

export type CouncilDemandSummary = {
  organisationId: string;
  providerId: string;
  councilName: string;
  councilStatus: string;
  crmStage?: string;
  activeResidents: number;
  currentlyLinked: number;
  allTimeResidents: number;
  notificationRequests: number;
  weeklyNewResidents: number;
  previousWeeklyNewResidents: number;
  weeklyGrowthPercent?: number;
  supportCases: number;
};

type DemandRow = {
  organisation_id: string;
  provider_id: string;
  council_name: string;
  council_status: string;
  crm_stage: string | null;
  active_residents: number;
  currently_linked: number;
  all_time_residents: number;
  notification_requests: number;
  weekly_new_residents: number;
  previous_weekly_new_residents: number;
  support_cases: number;
};

function demandSummary(row: DemandRow): CouncilDemandSummary {
  return {
    organisationId: row.organisation_id,
    providerId: row.provider_id,
    councilName: row.council_name,
    councilStatus: row.council_status,
    crmStage: row.crm_stage ?? undefined,
    activeResidents: row.active_residents,
    currentlyLinked: row.currently_linked,
    allTimeResidents: row.all_time_residents,
    notificationRequests: row.notification_requests,
    weeklyNewResidents: row.weekly_new_residents,
    previousWeeklyNewResidents: row.previous_weekly_new_residents,
    weeklyGrowthPercent: row.previous_weekly_new_residents > 0
      ? Math.round(((row.weekly_new_residents - row.previous_weekly_new_residents) / row.previous_weekly_new_residents) * 100)
      : undefined,
    supportCases: row.support_cases,
  };
}

export async function listPlatformCouncilDemandPage(
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<CouncilDemandSummary> & {
  metrics: { authoritiesWithDemand: number; totalAllTime: number; totalLinked: number; totalRequests: number };
  statusValues: string[];
}> {
  const sql = councilDatabase();
  const statusRows = await sql<{ status: string }[]>`
    SELECT DISTINCT coalesce(crm.stage, organisation.status) AS status
    FROM bin_council_organisations AS organisation
    LEFT JOIN LATERAL (
      SELECT account.stage
      FROM bin_crm_accounts AS account
      WHERE account.council_organisation_id = organisation.id
      ORDER BY account.updated_at DESC
      LIMIT 1
    ) AS crm ON true
    ORDER BY status
  `;
  const statusValues = statusRows.map((row) => row.status);
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "residents",
    filterValues: ["with-demand", "without-demand"],
    sortValues: ["growth", "name", "requests", "residents", "support"],
    statusValues,
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows, metricRows] = await Promise.all([
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bin_council_organisations AS organisation
      LEFT JOIN LATERAL (
        SELECT account.stage
        FROM bin_crm_accounts AS account
        WHERE account.council_organisation_id = organisation.id
        ORDER BY account.updated_at DESC
        LIMIT 1
      ) AS crm ON true
      WHERE (${request.status} = '' OR coalesce(crm.stage, organisation.status) = ${request.status})
        AND (${request.query} = '' OR concat_ws(' ', organisation.name, organisation.provider_id, crm.stage, organisation.status) ILIKE ${pattern})
        AND (
          ${request.filter} = ''
          OR (${request.filter} = 'with-demand' AND (
            EXISTS (SELECT 1 FROM bin_council_resident_links resident WHERE resident.council_id = organisation.provider_id)
            OR EXISTS (SELECT 1 FROM bin_council_demand_requests demand WHERE demand.council_id = organisation.provider_id AND demand.notify_requested)
          ))
          OR (${request.filter} = 'without-demand' AND NOT (
            EXISTS (SELECT 1 FROM bin_council_resident_links resident WHERE resident.council_id = organisation.provider_id)
            OR EXISTS (SELECT 1 FROM bin_council_demand_requests demand WHERE demand.council_id = organisation.provider_id AND demand.notify_requested)
          ))
        )
    `,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM bin_council_organisations`,
    sql<{ authorities_with_demand: number; total_all_time: number; total_linked: number; total_requests: number }[]>`
      SELECT
        (SELECT count(DISTINCT council_id)::int FROM bin_council_resident_links)::int AS authorities_with_demand,
        (SELECT count(DISTINCT (council_id, participant_id))::int FROM bin_council_resident_links)::int AS total_all_time,
        (SELECT count(DISTINCT (council_id, participant_id))::int FROM bin_council_resident_links WHERE currently_linked)::int AS total_linked,
        (SELECT count(DISTINCT (council_id, installation_id))::int FROM bin_council_demand_requests WHERE notify_requested)::int AS total_requests
    `,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<DemandRow[]>`
    SELECT
      organisation.id AS organisation_id,
      organisation.provider_id,
      organisation.name AS council_name,
      organisation.status AS council_status,
      crm.stage AS crm_stage,
      coalesce(resident.active_residents, 0)::int AS active_residents,
      coalesce(resident.currently_linked, 0)::int AS currently_linked,
      coalesce(resident.all_time_residents, 0)::int AS all_time_residents,
      coalesce(demand.notification_requests, 0)::int AS notification_requests,
      coalesce(resident.weekly_new_residents, 0)::int AS weekly_new_residents,
      coalesce(resident.previous_weekly_new_residents, 0)::int AS previous_weekly_new_residents,
      coalesce(support.support_cases, 0)::int AS support_cases
    FROM bin_council_organisations AS organisation
    LEFT JOIN LATERAL (
      SELECT
        count(DISTINCT participant_id) FILTER (WHERE currently_linked AND last_seen_at >= now() - interval '30 days')::int AS active_residents,
        count(DISTINCT participant_id) FILTER (WHERE currently_linked)::int AS currently_linked,
        count(DISTINCT participant_id)::int AS all_time_residents,
        count(DISTINCT participant_id) FILTER (WHERE first_linked_at >= now() - interval '7 days')::int AS weekly_new_residents,
        count(DISTINCT participant_id) FILTER (WHERE first_linked_at >= now() - interval '14 days' AND first_linked_at < now() - interval '7 days')::int AS previous_weekly_new_residents
      FROM bin_council_resident_links
      WHERE council_id = organisation.provider_id
    ) AS resident ON true
    LEFT JOIN LATERAL (
      SELECT count(DISTINCT installation_id) FILTER (WHERE notify_requested)::int AS notification_requests
      FROM bin_council_demand_requests
      WHERE council_id = organisation.provider_id
    ) AS demand ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS support_cases
      FROM bin_resident_support_threads
      WHERE council_provider_id = organisation.provider_id
    ) AS support ON true
    LEFT JOIN LATERAL (
      SELECT account.stage
      FROM bin_crm_accounts AS account
      WHERE account.council_organisation_id = organisation.id
      ORDER BY account.updated_at DESC
      LIMIT 1
    ) AS crm ON true
    WHERE (${clampedRequest.status} = '' OR coalesce(crm.stage, organisation.status) = ${clampedRequest.status})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', organisation.name, organisation.provider_id, crm.stage, organisation.status) ILIKE ${`%${clampedRequest.query}%`})
      AND (
        ${clampedRequest.filter} = ''
        OR (${clampedRequest.filter} = 'with-demand' AND (coalesce(resident.all_time_residents, 0) > 0 OR coalesce(demand.notification_requests, 0) > 0))
        OR (${clampedRequest.filter} = 'without-demand' AND coalesce(resident.all_time_residents, 0) = 0 AND coalesce(demand.notification_requests, 0) = 0)
      )
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'growth' AND ${clampedRequest.direction} = 'asc' THEN coalesce(resident.weekly_new_residents, 0) END ASC,
      CASE WHEN ${clampedRequest.sort} = 'growth' AND ${clampedRequest.direction} = 'desc' THEN coalesce(resident.weekly_new_residents, 0) END DESC,
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'asc' THEN organisation.name END ASC,
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'desc' THEN organisation.name END DESC,
      CASE WHEN ${clampedRequest.sort} = 'requests' AND ${clampedRequest.direction} = 'asc' THEN coalesce(demand.notification_requests, 0) END ASC,
      CASE WHEN ${clampedRequest.sort} = 'requests' AND ${clampedRequest.direction} = 'desc' THEN coalesce(demand.notification_requests, 0) END DESC,
      CASE WHEN ${clampedRequest.sort} = 'residents' AND ${clampedRequest.direction} = 'asc' THEN coalesce(resident.currently_linked, 0) END ASC,
      CASE WHEN ${clampedRequest.sort} = 'residents' AND ${clampedRequest.direction} = 'desc' THEN coalesce(resident.currently_linked, 0) END DESC,
      CASE WHEN ${clampedRequest.sort} = 'support' AND ${clampedRequest.direction} = 'asc' THEN coalesce(support.support_cases, 0) END ASC,
      CASE WHEN ${clampedRequest.sort} = 'support' AND ${clampedRequest.direction} = 'desc' THEN coalesce(support.support_cases, 0) END DESC,
      organisation.name,
      organisation.id
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const metrics = metricRows[0];
  return {
    items: rows.map(demandSummary),
    metrics: {
      authoritiesWithDemand: metrics?.authorities_with_demand ?? 0,
      totalAllTime: metrics?.total_all_time ?? 0,
      totalLinked: metrics?.total_linked ?? 0,
      totalRequests: metrics?.total_requests ?? 0,
    },
    request: clampedRequest,
    statusValues,
    total,
    unfilteredTotal: unfilteredRows[0]?.count ?? 0,
  };
}

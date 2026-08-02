import { councilDatabase } from "./database";

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

export async function listPlatformCouncilDemand(): Promise<CouncilDemandSummary[]> {
  const sql = councilDatabase();
  const rows = await sql<{
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
  }[]>`
    SELECT
      organisation.id AS organisation_id,
      organisation.provider_id,
      organisation.name AS council_name,
      organisation.status AS council_status,
      crm.stage AS crm_stage,
      count(DISTINCT resident.participant_id) FILTER (
        WHERE resident.currently_linked AND resident.last_seen_at >= now() - interval '30 days'
      )::int AS active_residents,
      count(DISTINCT resident.participant_id) FILTER (WHERE resident.currently_linked)::int AS currently_linked,
      count(DISTINCT resident.participant_id)::int AS all_time_residents,
      count(DISTINCT demand.installation_id) FILTER (WHERE demand.notify_requested)::int AS notification_requests,
      count(DISTINCT resident.participant_id) FILTER (
        WHERE resident.first_linked_at >= now() - interval '7 days'
      )::int AS weekly_new_residents,
      count(DISTINCT resident.participant_id) FILTER (
        WHERE resident.first_linked_at >= now() - interval '14 days'
          AND resident.first_linked_at < now() - interval '7 days'
      )::int AS previous_weekly_new_residents,
      count(DISTINCT support.id)::int AS support_cases
    FROM bin_council_organisations AS organisation
    LEFT JOIN bin_council_resident_links AS resident
      ON resident.council_id = organisation.provider_id
    LEFT JOIN bin_council_demand_requests AS demand
      ON demand.council_id = organisation.provider_id
    LEFT JOIN bin_resident_support_threads AS support
      ON support.council_provider_id = organisation.provider_id
    LEFT JOIN LATERAL (
      SELECT account.stage
      FROM bin_crm_accounts AS account
      WHERE account.council_organisation_id = organisation.id
      ORDER BY account.updated_at DESC
      LIMIT 1
    ) AS crm ON true
    GROUP BY organisation.id, organisation.provider_id, organisation.name, organisation.status, crm.stage
    ORDER BY
      count(DISTINCT resident.participant_id)::int DESC,
      count(DISTINCT demand.installation_id) FILTER (WHERE demand.notify_requested)::int DESC,
      organisation.name
    LIMIT 500
  `;
  return rows.map((row) => ({
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
  }));
}

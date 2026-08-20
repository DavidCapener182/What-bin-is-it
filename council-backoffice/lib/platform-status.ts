import type postgres from "postgres";

import { councilDatabase } from "./database";
import {
  clampOperationalQueueRequest,
  operationalQueueRequest,
  type OperationalQueueSearchParams,
  type OperationalQueueServerPage,
} from "./operational-queue";
import type { CouncilStaffSession } from "./types";

export type PlatformIncident = {
  id: string;
  component: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  title: string;
  detail: string;
  councilProviderIds: string[];
  startsAt: string;
  resolvedAt?: string;
  updatedAt: string;
};

async function audit(sql: postgres.TransactionSql, session: CouncilStaffSession, action: string, id: string, title: string) {
  await sql`
    INSERT INTO bin_council_audit_logs (organisation_id, actor_user_id, action, entity_type, entity_id, summary)
    VALUES (${session.organisation.id}::uuid, ${session.userId}::uuid, ${action}, 'platform-incident', ${id}::uuid, ${sql.json({ title })})
  `;
}

export async function listPlatformIncidentsPage(
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<PlatformIncident>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "started",
    filterValues: ["resident-app", "council-gateway", "push", "accounts", "council-console", "partner-feeds"],
    sortValues: ["component", "started", "status", "updated"],
    statusValues: ["investigating", "identified", "monitoring", "resolved"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bin_platform_incidents
      WHERE (${request.status} = '' OR status = ${request.status})
        AND (${request.filter} = '' OR component = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', title, detail, component, status, council_provider_ids::text) ILIKE ${pattern})
    `,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM bin_platform_incidents`,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<{
    id: string; component: string; status: PlatformIncident["status"]; title: string; detail: string;
    council_provider_ids: string[]; starts_at: Date; resolved_at: Date | null; updated_at: Date;
  }[]>`
    SELECT id, component, status, title, detail, council_provider_ids, starts_at, resolved_at, updated_at
    FROM bin_platform_incidents
    WHERE (${clampedRequest.status} = '' OR status = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR component = ${clampedRequest.filter})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', title, detail, component, status, council_provider_ids::text) ILIKE ${`%${clampedRequest.query}%`})
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'component' AND ${clampedRequest.direction} = 'asc' THEN component END ASC,
      CASE WHEN ${clampedRequest.sort} = 'component' AND ${clampedRequest.direction} = 'desc' THEN component END DESC,
      CASE WHEN ${clampedRequest.sort} = 'started' AND ${clampedRequest.direction} = 'asc' THEN starts_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'started' AND ${clampedRequest.direction} = 'desc' THEN starts_at END DESC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'asc' THEN status END ASC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'desc' THEN status END DESC,
      CASE WHEN ${clampedRequest.sort} = 'updated' AND ${clampedRequest.direction} = 'asc' THEN updated_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'updated' AND ${clampedRequest.direction} = 'desc' THEN updated_at END DESC,
      starts_at DESC,
      id DESC
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const items = rows.map((row): PlatformIncident => ({
    id: row.id,
    component: row.component,
    status: row.status,
    title: row.title,
    detail: row.detail,
    councilProviderIds: row.council_provider_ids,
    startsAt: row.starts_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
  return { items, request: clampedRequest, total, unfilteredTotal: unfilteredRows[0]?.count ?? 0 };
}

export async function createPlatformIncident(session: CouncilStaffSession, input: Omit<PlatformIncident, "id" | "resolvedAt" | "updatedAt">) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_platform_incidents (component, status, title, detail, council_provider_ids, starts_at, created_by)
      VALUES (${input.component}, ${input.status}, ${input.title}, ${input.detail}, ${input.councilProviderIds}, ${input.startsAt}::timestamptz, ${session.userId}::uuid)
      RETURNING id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("The incident could not be created.");
    await audit(transaction, session, "platform-incident.created", id, input.title);
  });
}

export async function updatePlatformIncidentStatus(session: CouncilStaffSession, id: string, status: PlatformIncident["status"]) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ title: string }[]>`
      UPDATE bin_platform_incidents
      SET status = ${status}, resolved_at = CASE WHEN ${status} = 'resolved' THEN now() ELSE NULL END, updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING title
    `;
    if (!rows[0]) throw new Error("The incident was not found.");
    await audit(transaction, session, `platform-incident.${status}`, id, rows[0].title);
  });
}

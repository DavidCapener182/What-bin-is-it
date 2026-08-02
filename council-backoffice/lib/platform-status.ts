import type postgres from "postgres";

import { councilDatabase } from "./database";
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

export async function listPlatformIncidents(limit = 100) {
  const sql = councilDatabase();
  const rows = await sql<{
    id: string; component: string; status: PlatformIncident["status"]; title: string; detail: string;
    council_provider_ids: string[]; starts_at: Date; resolved_at: Date | null; updated_at: Date;
  }[]>`
    SELECT id, component, status, title, detail, council_provider_ids, starts_at, resolved_at, updated_at
    FROM bin_platform_incidents
    ORDER BY CASE status WHEN 'resolved' THEN 1 ELSE 0 END, starts_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row): PlatformIncident => ({
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

import type postgres from "postgres";

import { councilDatabase } from "./database";
import type { CouncilStaffSession } from "./types";

export type ResidentSupportStatus = "waiting-support" | "waiting-resident" | "closed";

export type ResidentSupportMessage = {
  id: string;
  sender: "resident" | "support";
  body: string;
  createdAt: string;
};

export type ResidentSupportThread = {
  id: string;
  residentReference: string;
  councilProviderId?: string;
  councilName?: string;
  topic: string;
  subject: string;
  status: ResidentSupportStatus;
  lastSender: "resident" | "support";
  lastMessageAt: string;
  createdAt: string;
  messages: ResidentSupportMessage[];
};

type ThreadRow = {
  id: string;
  resident_user_id: string;
  council_provider_id: string | null;
  council_name: string | null;
  topic: string;
  subject: string;
  status: ResidentSupportStatus;
  last_sender: "resident" | "support";
  last_message_at: Date;
  created_at: Date;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_kind: "resident" | "support";
  body: string;
  created_at: Date;
};

function supportThread(row: ThreadRow, messages: ResidentSupportMessage[] = []): ResidentSupportThread {
  return {
    id: row.id,
    residentReference: `Resident ${row.resident_user_id.slice(0, 8).toUpperCase()}`,
    councilProviderId: row.council_provider_id ?? undefined,
    councilName: row.council_name ?? undefined,
    topic: row.topic,
    subject: row.subject,
    status: row.status,
    lastSender: row.last_sender,
    lastMessageAt: row.last_message_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    messages,
  };
}

export async function listResidentSupportThreads(filters: {
  query?: string;
  status?: ResidentSupportStatus;
} = {}) {
  const sql = councilDatabase();
  const query = filters.query?.trim().slice(0, 120) || null;
  const rows = await sql<ThreadRow[]>`
    SELECT
      id,
      resident_user_id,
      council_provider_id,
      council_name,
      topic,
      subject,
      status,
      last_sender,
      last_message_at,
      created_at
    FROM bin_resident_support_threads
    WHERE (
      ${filters.status ?? null}::varchar IS NULL
      OR status = ${filters.status ?? null}
    )
      AND (
        ${query}::text IS NULL
        OR subject ILIKE ('%' || ${query} || '%')
        OR council_name ILIKE ('%' || ${query} || '%')
        OR topic ILIKE ('%' || ${query} || '%')
        OR id::text ILIKE ('%' || ${query} || '%')
      )
    ORDER BY
      CASE status
        WHEN 'waiting-support' THEN 0
        WHEN 'waiting-resident' THEN 1
        ELSE 2
      END,
      last_message_at DESC
    LIMIT 500
  `;
  return rows.map((row) => supportThread(row));
}

export async function residentSupportThread(threadId: string) {
  const sql = councilDatabase();
  const [threadRows, messageRows] = await Promise.all([
    sql<ThreadRow[]>`
      SELECT
        id,
        resident_user_id,
        council_provider_id,
        council_name,
        topic,
        subject,
        status,
        last_sender,
        last_message_at,
        created_at
      FROM bin_resident_support_threads
      WHERE id = ${threadId}::uuid
      LIMIT 1
    `,
    sql<MessageRow[]>`
      SELECT id, thread_id, sender_kind, body, created_at
      FROM bin_resident_support_messages
      WHERE thread_id = ${threadId}::uuid
      ORDER BY created_at, id
      LIMIT 1000
    `,
  ]);
  const thread = threadRows[0];
  if (!thread) return undefined;
  return supportThread(
    thread,
    messageRows.map((message) => ({
      id: message.id,
      sender: message.sender_kind,
      body: message.body,
      createdAt: message.created_at.toISOString(),
    })),
  );
}

async function appendSupportAudit(
  sql: postgres.TransactionSql,
  session: CouncilStaffSession,
  action: string,
  threadId: string,
  summary: Record<string, string | boolean | null>,
) {
  await sql`
    INSERT INTO bin_crm_audit_logs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      summary
    ) VALUES (
      ${session.userId}::uuid,
      ${action},
      'resident-support-thread',
      ${threadId}::uuid,
      ${sql.json(summary)}
    )
  `;
}

export async function replyToResidentSupportThread(
  session: CouncilStaffSession,
  threadId: string,
  body: string,
) {
  const sql = councilDatabase();
  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string; status: ResidentSupportStatus }[]>`
      SELECT id, status
      FROM bin_resident_support_threads
      WHERE id = ${threadId}::uuid
      FOR UPDATE
    `;
    const thread = rows[0];
    if (!thread) throw new Error("That resident conversation could not be found.");
    if (thread.status === "closed") throw new Error("Reopen the conversation before replying.");
    await transaction`
      INSERT INTO bin_resident_support_messages (
        thread_id,
        sender_kind,
        sender_user_id,
        body
      ) VALUES (
        ${thread.id}::uuid,
        'support',
        ${session.userId}::uuid,
        ${body}
      )
    `;
    await transaction`
      UPDATE bin_resident_support_threads
      SET
        status = 'waiting-resident',
        last_sender = 'support',
        last_message_at = now(),
        updated_at = now(),
        resolved_at = null
      WHERE id = ${thread.id}::uuid
    `;
    await appendSupportAudit(transaction, session, "resident-support.reply", thread.id, {
      status: "waiting-resident",
      council: session.organisation.providerId,
    });
  });
}

export async function setResidentSupportThreadStatus(
  session: CouncilStaffSession,
  threadId: string,
  status: ResidentSupportStatus,
) {
  const sql = councilDatabase();
  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      UPDATE bin_resident_support_threads
      SET
        status = ${status},
        resolved_at = CASE WHEN ${status} = 'closed' THEN now() ELSE null END,
        updated_at = now()
      WHERE id = ${threadId}::uuid
      RETURNING id
    `;
    if (!rows[0]) throw new Error("That resident conversation could not be found.");
    await appendSupportAudit(transaction, session, `resident-support.${status}`, threadId, {
      status,
      council: session.organisation.providerId,
    });
  });
}

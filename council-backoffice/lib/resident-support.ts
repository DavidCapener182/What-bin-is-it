import type postgres from "postgres";

import { councilDatabase } from "./database";
import {
  clampOperationalQueueRequest,
  operationalQueueRequest,
  type OperationalQueueSearchParams,
  type OperationalQueueServerPage,
} from "./operational-queue";
import type { CouncilStaffSession } from "./types";

export const residentSupportStatuses = [
  "new",
  "in-progress",
  "waiting-resident",
  "waiting-operations",
  "resolved",
  "closed",
] as const;
export type ResidentSupportStatus = (typeof residentSupportStatuses)[number];
export const residentSupportPriorities = ["low", "normal", "high", "urgent"] as const;
export type ResidentSupportPriority = (typeof residentSupportPriorities)[number];
export const residentSupportEscalations = ["none", "operations", "platform", "safeguarding"] as const;
export type ResidentSupportEscalation = (typeof residentSupportEscalations)[number];

export type ResidentSupportMessage = {
  id: string;
  sender: "resident" | "support" | "internal";
  visibility: "resident" | "internal";
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
  priority: ResidentSupportPriority;
  escalationStatus: ResidentSupportEscalation;
  assignedStaffId?: string;
  assignedStaffLabel?: string;
  slaDueAt?: string;
  topicTags: string[];
  linkedReportTrackingId?: string;
  linkedAnnouncementId?: string;
  reopenedCount: number;
  reopenReason?: string;
  firstRespondedAt?: string;
  resolvedAt?: string;
  satisfactionScore?: number;
  lastSender: "resident" | "support";
  lastMessageAt: string;
  createdAt: string;
  messages: ResidentSupportMessage[];
  messageHistory?: {
    page: number;
    pageCount: number;
    pageSize: number;
    total: number;
  };
};

export type ResidentSupportStaffOption = {
  userId: string;
  label: string;
  role: string;
};

export type ResidentSupportSavedResponse = {
  id: string;
  title: string;
  body: string;
  topicTags: string[];
};

type ThreadRow = {
  id: string;
  resident_user_id: string;
  council_provider_id: string | null;
  council_name: string | null;
  topic: string;
  subject: string;
  status: ResidentSupportStatus;
  priority: ResidentSupportPriority;
  escalation_status: ResidentSupportEscalation;
  assigned_staff_id: string | null;
  assigned_staff_email: string | null;
  sla_due_at: Date | null;
  topic_tags: string[];
  linked_report_tracking_id: string | null;
  linked_announcement_id: string | null;
  reopened_count: number;
  reopen_reason: string | null;
  first_responded_at: Date | null;
  resolved_at: Date | null;
  satisfaction_score: number | null;
  last_sender: "resident" | "support";
  last_message_at: Date;
  created_at: Date;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_kind: "resident" | "support" | "internal";
  visibility: "resident" | "internal";
  body: string;
  created_at: Date;
};

const threadSelect = `
  thread.id,
  thread.resident_user_id,
  thread.council_provider_id,
  thread.council_name,
  thread.topic,
  thread.subject,
  thread.status,
  thread.priority,
  thread.escalation_status,
  thread.assigned_staff_id,
  assigned_user.email AS assigned_staff_email,
  thread.sla_due_at,
  thread.topic_tags,
  thread.linked_report_tracking_id,
  thread.linked_announcement_id,
  thread.reopened_count,
  thread.reopen_reason,
  thread.first_responded_at,
  thread.resolved_at,
  thread.satisfaction_score,
  thread.last_sender,
  thread.last_message_at,
  thread.created_at
`;

function supportThread(row: ThreadRow, messages: ResidentSupportMessage[] = []): ResidentSupportThread {
  return {
    id: row.id,
    residentReference: `Resident ${row.resident_user_id.slice(0, 8).toUpperCase()}`,
    councilProviderId: row.council_provider_id ?? undefined,
    councilName: row.council_name ?? undefined,
    topic: row.topic,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    escalationStatus: row.escalation_status,
    assignedStaffId: row.assigned_staff_id ?? undefined,
    assignedStaffLabel: row.assigned_staff_email ?? undefined,
    slaDueAt: row.sla_due_at?.toISOString(),
    topicTags: row.topic_tags,
    linkedReportTrackingId: row.linked_report_tracking_id ?? undefined,
    linkedAnnouncementId: row.linked_announcement_id ?? undefined,
    reopenedCount: row.reopened_count,
    reopenReason: row.reopen_reason ?? undefined,
    firstRespondedAt: row.first_responded_at?.toISOString(),
    resolvedAt: row.resolved_at?.toISOString(),
    satisfactionScore: row.satisfaction_score ?? undefined,
    lastSender: row.last_sender,
    lastMessageAt: row.last_message_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    messages,
  };
}

function residentSupportCouncilScope(session: CouncilStaffSession) {
  return session.platformAdmin ? null : session.organisation.providerId;
}

export async function listResidentSupportThreadsPage(
  session: CouncilStaffSession,
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<ResidentSupportThread>> {
  const sql = councilDatabase();
  const councilScope = residentSupportCouncilScope(session);
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "updated",
    filterValues: residentSupportPriorities,
    sortValues: ["priority", "sla", "status", "updated"],
    statusValues: residentSupportStatuses,
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bin_resident_support_threads AS thread
      WHERE (${councilScope}::text IS NULL OR thread.council_provider_id = ${councilScope})
        AND (${request.status} = '' OR thread.status = ${request.status})
        AND (${request.filter} = '' OR thread.priority = ${request.filter})
        AND (
          ${request.query} = ''
          OR concat_ws(' ', thread.subject, thread.council_name, thread.topic, thread.id::text, thread.topic_tags::text)
            ILIKE ${pattern}
        )
    `,
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bin_resident_support_threads AS thread
      WHERE (${councilScope}::text IS NULL OR thread.council_provider_id = ${councilScope})
    `,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<ThreadRow[]>`
    SELECT ${sql.unsafe(threadSelect)}
    FROM bin_resident_support_threads AS thread
    LEFT JOIN auth.users AS assigned_user ON assigned_user.id = thread.assigned_staff_id
    WHERE (${councilScope}::text IS NULL OR thread.council_provider_id = ${councilScope})
      AND (${clampedRequest.status} = '' OR thread.status = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR thread.priority = ${clampedRequest.filter})
      AND (
        ${clampedRequest.query} = ''
        OR concat_ws(' ', thread.subject, thread.council_name, thread.topic, thread.id::text, thread.topic_tags::text)
          ILIKE ${`%${clampedRequest.query}%`}
      )
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'asc' THEN CASE thread.status WHEN 'new' THEN 0 WHEN 'in-progress' THEN 1 WHEN 'waiting-operations' THEN 2 WHEN 'waiting-resident' THEN 3 WHEN 'resolved' THEN 4 ELSE 5 END END ASC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'desc' THEN CASE thread.status WHEN 'new' THEN 0 WHEN 'in-progress' THEN 1 WHEN 'waiting-operations' THEN 2 WHEN 'waiting-resident' THEN 3 WHEN 'resolved' THEN 4 ELSE 5 END END DESC,
      CASE WHEN ${clampedRequest.sort} = 'priority' AND ${clampedRequest.direction} = 'asc' THEN CASE thread.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END END ASC,
      CASE WHEN ${clampedRequest.sort} = 'priority' AND ${clampedRequest.direction} = 'desc' THEN CASE thread.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END END DESC,
      CASE WHEN ${clampedRequest.sort} = 'sla' AND ${clampedRequest.direction} = 'asc' THEN thread.sla_due_at END ASC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'sla' AND ${clampedRequest.direction} = 'desc' THEN thread.sla_due_at END DESC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'updated' AND ${clampedRequest.direction} = 'asc' THEN thread.last_message_at END ASC,
      CASE WHEN ${clampedRequest.sort} = 'updated' AND ${clampedRequest.direction} = 'desc' THEN thread.last_message_at END DESC,
      thread.last_message_at DESC,
      thread.id DESC
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  return {
    items: rows.map((row) => supportThread(row)),
    request: clampedRequest,
    total,
    unfilteredTotal: unfilteredRows[0]?.count ?? 0,
  };
}

export async function residentSupportMetricsForSession(session: CouncilStaffSession) {
  const sql = councilDatabase();
  const councilScope = residentSupportCouncilScope(session);
  const [metricRows, themeRows] = await Promise.all([
    sql<{
      median_first_response_hours: number | null;
      median_resolution_hours: number | null;
      new_count: number;
      overdue_count: number;
      reopened_count: number;
    }[]>`
      SELECT
        count(*) FILTER (WHERE status = 'new')::int AS new_count,
        count(*) FILTER (WHERE sla_due_at < now() AND status NOT IN ('resolved', 'closed'))::int AS overdue_count,
        coalesce(sum(reopened_count), 0)::int AS reopened_count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (first_responded_at - created_at)) / 3600)
          FILTER (WHERE first_responded_at IS NOT NULL) AS median_first_response_hours,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (resolved_at - created_at)) / 3600)
          FILTER (WHERE resolved_at IS NOT NULL) AS median_resolution_hours
      FROM bin_resident_support_threads
      WHERE (${councilScope}::text IS NULL OR council_provider_id = ${councilScope})
    `,
    sql<{ theme: string; count: number }[]>`
      SELECT theme, count(*)::int AS count
      FROM bin_resident_support_threads AS thread
      CROSS JOIN LATERAL unnest(
        CASE WHEN cardinality(thread.topic_tags) > 0 THEN thread.topic_tags ELSE ARRAY[thread.topic]::varchar[] END
      ) AS theme
      WHERE (${councilScope}::text IS NULL OR thread.council_provider_id = ${councilScope})
      GROUP BY theme
      ORDER BY count DESC, theme
      LIMIT 3
    `,
  ]);
  const metric = metricRows[0];
  return {
    medianFirstResponseHours: metric?.median_first_response_hours ?? undefined,
    medianResolutionHours: metric?.median_resolution_hours ?? undefined,
    newCount: metric?.new_count ?? 0,
    overdueCount: metric?.overdue_count ?? 0,
    reopenedCount: metric?.reopened_count ?? 0,
    topThemes: themeRows.map((row): [string, number] => [row.theme, row.count]),
  };
}

export async function residentSupportThread(session: CouncilStaffSession, threadId: string, requestedHistoryPage = 1) {
  const sql = councilDatabase();
  const councilScope = residentSupportCouncilScope(session);
  const threadRows = await sql<ThreadRow[]>`
    SELECT ${sql.unsafe(threadSelect)}
    FROM bin_resident_support_threads AS thread
    LEFT JOIN auth.users AS assigned_user ON assigned_user.id = thread.assigned_staff_id
    WHERE thread.id = ${threadId}::uuid
      AND (${councilScope}::text IS NULL OR thread.council_provider_id = ${councilScope})
    LIMIT 1
  `;
  const thread = threadRows[0];
  if (!thread) return undefined;
  const messageCountRows = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM bin_resident_support_messages
    WHERE thread_id = ${thread.id}::uuid
  `;
  const messageTotal = messageCountRows[0]?.count ?? 0;
  const messagePageSize = 200;
  const messagePageCount = Math.max(1, Math.ceil(messageTotal / messagePageSize));
  const parsedHistoryPage = Number.isFinite(requestedHistoryPage) ? Math.trunc(requestedHistoryPage) : 1;
  const messagePage = Math.min(Math.max(parsedHistoryPage, 1), messagePageCount);
  const messageRows = await sql<MessageRow[]>`
    SELECT id, thread_id, sender_kind, visibility, body, created_at
    FROM (
      SELECT id, thread_id, sender_kind, visibility, body, created_at
      FROM bin_resident_support_messages
      WHERE thread_id = ${thread.id}::uuid
      ORDER BY created_at DESC, id DESC
      LIMIT ${messagePageSize}
      OFFSET ${(messagePage - 1) * messagePageSize}
    ) AS history_page
    ORDER BY created_at, id
  `;
  const result = supportThread(thread, messageRows.map((message) => ({
    id: message.id,
    sender: message.sender_kind,
    visibility: message.visibility,
    body: message.body,
    createdAt: message.created_at.toISOString(),
  })));
  result.messageHistory = { page: messagePage, pageCount: messagePageCount, pageSize: messagePageSize, total: messageTotal };
  return result;
}

export async function listResidentSupportStaff(session: CouncilStaffSession) {
  const sql = councilDatabase();
  const rows = await sql<{ user_id: string; email: string | null; role: string }[]>`
    SELECT staff.user_id, user_account.email, staff.role
    FROM bin_council_staff AS staff
    INNER JOIN auth.users AS user_account ON user_account.id = staff.user_id
    WHERE staff.organisation_id = ${session.organisation.id}::uuid
      AND staff.status = 'active'
    ORDER BY user_account.email, staff.created_at
  `;
  const options: ResidentSupportStaffOption[] = rows.map((row) => ({
    userId: row.user_id,
    label: row.email ?? `Staff ${row.user_id.slice(0, 8).toUpperCase()}`,
    role: row.role,
  }));
  if (session.platformAdmin && !options.some((option) => option.userId === session.userId)) {
    options.unshift({ userId: session.userId, label: session.email ?? "Platform superadmin", role: "platform" });
  }
  return options;
}

export async function listResidentSupportSavedResponses(session: CouncilStaffSession) {
  const sql = councilDatabase();
  const rows = await sql<{ id: string; title: string; body: string; topic_tags: string[] }[]>`
    SELECT id, title, body, topic_tags
    FROM bin_support_saved_responses
    WHERE status = 'active'
      AND (organisation_id = ${session.organisation.id}::uuid OR organisation_id IS NULL)
    ORDER BY organisation_id NULLS LAST, title
  `;
  return rows.map((row): ResidentSupportSavedResponse => ({
    id: row.id,
    title: row.title,
    body: row.body,
    topicTags: row.topic_tags,
  }));
}

export async function createResidentSupportSavedResponse(
  session: CouncilStaffSession,
  input: { title: string; body: string; topicTags: string[] },
) {
  const sql = councilDatabase();
  await sql`
    INSERT INTO bin_support_saved_responses (organisation_id, title, body, topic_tags, created_by)
    VALUES (
      ${session.organisation.id}::uuid,
      ${input.title},
      ${input.body},
      ${input.topicTags}::varchar(40)[],
      ${session.userId}::uuid
    )
  `;
}

async function appendSupportAudit(
  sql: postgres.TransactionSql,
  session: CouncilStaffSession,
  action: string,
  threadId: string,
  summary: Record<string, string | boolean | number | null | string[]>,
) {
  await sql`
    INSERT INTO bin_crm_audit_logs (actor_user_id, action, entity_type, entity_id, summary)
    VALUES (${session.userId}::uuid, ${action}, 'resident-support-thread', ${threadId}::uuid, ${sql.json(summary)})
  `;
}

export async function replyToResidentSupportThread(session: CouncilStaffSession, threadId: string, body: string) {
  const sql = councilDatabase();
  const councilScope = residentSupportCouncilScope(session);
  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string; status: ResidentSupportStatus; council_provider_id: string | null }[]>`
      SELECT id, status, council_provider_id
      FROM bin_resident_support_threads
      WHERE id = ${threadId}::uuid
        AND (${councilScope}::text IS NULL OR council_provider_id = ${councilScope})
      FOR UPDATE
    `;
    const thread = rows[0];
    if (!thread) throw new Error("That resident conversation could not be found.");
    if (thread.status === "closed") throw new Error("Reopen the conversation before replying.");
    await transaction`
      INSERT INTO bin_resident_support_messages (thread_id, sender_kind, sender_user_id, visibility, body)
      VALUES (${thread.id}::uuid, 'support', ${session.userId}::uuid, 'resident', ${body})
    `;
    await transaction`
      UPDATE bin_resident_support_threads
      SET
        status = 'waiting-resident',
        last_sender = 'support',
        last_message_at = now(),
        first_responded_at = coalesce(first_responded_at, now()),
        assigned_staff_id = coalesce(assigned_staff_id, ${session.userId}::uuid),
        updated_at = now(),
        resolved_at = null
      WHERE id = ${thread.id}::uuid
    `;
    await appendSupportAudit(transaction, session, "resident-support.reply", thread.id, {
      status: "waiting-resident",
      council: thread.council_provider_id,
    });
  });
}

export async function addResidentSupportInternalNote(session: CouncilStaffSession, threadId: string, body: string) {
  const sql = councilDatabase();
  const councilScope = residentSupportCouncilScope(session);
  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string; council_provider_id: string | null }[]>`
      SELECT id, council_provider_id
      FROM bin_resident_support_threads
      WHERE id = ${threadId}::uuid
        AND (${councilScope}::text IS NULL OR council_provider_id = ${councilScope})
      FOR UPDATE
    `;
    if (!rows[0]) throw new Error("That resident conversation could not be found.");
    await transaction`
      INSERT INTO bin_resident_support_messages (thread_id, sender_kind, sender_user_id, visibility, body)
      VALUES (${threadId}::uuid, 'internal', ${session.userId}::uuid, 'internal', ${body})
    `;
    await transaction`
      UPDATE bin_resident_support_threads
      SET assigned_staff_id = coalesce(assigned_staff_id, ${session.userId}::uuid), updated_at = now()
      WHERE id = ${threadId}::uuid
    `;
    await appendSupportAudit(transaction, session, "resident-support.internal-note", threadId, {
      council: rows[0].council_provider_id,
    });
  });
}

export async function updateResidentSupportCase(
  session: CouncilStaffSession,
  threadId: string,
  input: {
    status: ResidentSupportStatus;
    priority: ResidentSupportPriority;
    escalationStatus: ResidentSupportEscalation;
    assignedStaffId?: string;
    slaDueAt?: string;
    topicTags: string[];
    linkedReportTrackingId?: string;
    linkedAnnouncementId?: string;
    reopenReason?: string;
  },
) {
  const sql = councilDatabase();
  const councilScope = residentSupportCouncilScope(session);
  await sql.begin(async (transaction) => {
    const existingRows = await transaction<{ status: ResidentSupportStatus; council_provider_id: string | null }[]>`
      SELECT status, council_provider_id
      FROM bin_resident_support_threads
      WHERE id = ${threadId}::uuid
        AND (${councilScope}::text IS NULL OR council_provider_id = ${councilScope})
      FOR UPDATE
    `;
    const existing = existingRows[0];
    if (!existing) throw new Error("That resident conversation could not be found.");
    const reopening = (existing.status === "closed" || existing.status === "resolved")
      && input.status !== "closed" && input.status !== "resolved";
    if (reopening && !input.reopenReason) throw new Error("Add a reopen reason before reopening this case.");
    if (input.assignedStaffId) {
      const validAssignee = await transaction<{ ok: boolean }[]>`
        SELECT true AS ok
        FROM bin_council_staff
        WHERE organisation_id = ${session.organisation.id}::uuid
          AND user_id = ${input.assignedStaffId}::uuid
          AND status = 'active'
        LIMIT 1
      `;
      if (!validAssignee[0]?.ok && input.assignedStaffId !== session.userId) {
        throw new Error("Choose an active staff member from this council workspace.");
      }
    }
    await transaction`
      UPDATE bin_resident_support_threads
      SET
        status = ${input.status},
        priority = ${input.priority},
        escalation_status = ${input.escalationStatus},
        assigned_staff_id = ${input.assignedStaffId ?? null}::uuid,
        sla_due_at = ${input.slaDueAt ?? null}::timestamptz,
        topic_tags = ${input.topicTags}::varchar(40)[],
        linked_report_tracking_id = ${input.linkedReportTrackingId ?? null}::uuid,
        linked_announcement_id = ${input.linkedAnnouncementId ?? null}::uuid,
        reopened_count = reopened_count + ${reopening ? 1 : 0},
        reopen_reason = CASE WHEN ${reopening} THEN ${input.reopenReason ?? null} ELSE reopen_reason END,
        resolved_at = CASE WHEN ${input.status} IN ('resolved', 'closed') THEN coalesce(resolved_at, now()) ELSE null END,
        updated_at = now()
      WHERE id = ${threadId}::uuid
    `;
    await appendSupportAudit(transaction, session, "resident-support.case-update", threadId, {
      status: input.status,
      priority: input.priority,
      escalation: input.escalationStatus,
      assignee: input.assignedStaffId ?? null,
      tags: input.topicTags,
      reopened: reopening,
      council: existing.council_provider_id,
    });
  });
}

export async function setResidentSupportThreadStatus(
  session: CouncilStaffSession,
  threadId: string,
  status: ResidentSupportStatus,
  reopenReason?: string,
) {
  const thread = await residentSupportThread(session, threadId);
  if (!thread) throw new Error("That resident conversation could not be found.");
  await updateResidentSupportCase(session, threadId, {
    status,
    priority: thread.priority,
    escalationStatus: thread.escalationStatus,
    assignedStaffId: thread.assignedStaffId,
    slaDueAt: thread.slaDueAt,
    topicTags: thread.topicTags,
    linkedReportTrackingId: thread.linkedReportTrackingId,
    linkedAnnouncementId: thread.linkedAnnouncementId,
    reopenReason,
  });
}

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function residentSupportMetrics(threads: ResidentSupportThread[], now = new Date()) {
  const firstResponseHours = threads.flatMap((thread) => thread.firstRespondedAt
    ? [(new Date(thread.firstRespondedAt).getTime() - new Date(thread.createdAt).getTime()) / 3_600_000]
    : []);
  const resolutionHours = threads.flatMap((thread) => thread.resolvedAt
    ? [(new Date(thread.resolvedAt).getTime() - new Date(thread.createdAt).getTime()) / 3_600_000]
    : []);
  const themeCounts = new Map<string, number>();
  threads.forEach((thread) => {
    const themes = thread.topicTags.length ? thread.topicTags : [thread.topic];
    themes.forEach((theme) => themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1));
  });
  const topThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);
  return {
    newCount: threads.filter((thread) => thread.status === "new").length,
    overdueCount: threads.filter((thread) => thread.slaDueAt
      && !["resolved", "closed"].includes(thread.status)
      && new Date(thread.slaDueAt) < now).length,
    medianFirstResponseHours: median(firstResponseHours),
    medianResolutionHours: median(resolutionHours),
    reopenedCount: threads.reduce((total, thread) => total + thread.reopenedCount, 0),
    topThemes,
  };
}

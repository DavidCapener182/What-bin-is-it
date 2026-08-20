import type postgres from "postgres";

import { councilDatabase } from "./database";
import {
  clampOperationalQueueRequest,
  operationalQueueRequest,
  type OperationalQueueSearchParams,
  type OperationalQueueServerPage,
} from "./operational-queue";
import { crmAccountTypes, crmStages } from "./types";
import type {
  CouncilStaffSession,
  CrmAccount,
  CrmAccountType,
  CrmActivity,
  CrmChannel,
  CrmContact,
  CrmMessage,
  CrmStage,
  CrmTask,
} from "./types";

type CrmAccountRow = {
  id: string;
  account_type: CrmAccountType;
  name: string;
  council_organisation_id: string | null;
  website_url: string | null;
  stage: CrmStage;
  annual_value_pence: number | null;
  summary: string | null;
  owner_user_id: string | null;
  last_contact_at: Date | null;
  next_follow_up_at: Date | null;
  created_at: Date;
  updated_at: Date;
  open_task_count?: number;
  overdue_task_count?: number;
};

type CrmContactRow = {
  id: string;
  account_id: string;
  full_name: string;
  job_title: string | null;
  professional_email: string | null;
  professional_phone: string | null;
  linkedin_url: string | null;
  preferred_channel: CrmContact["preferredChannel"];
  lawful_basis: CrmContact["lawfulBasis"];
  source: string;
  do_not_contact: boolean;
  retention_review_at: Date;
  created_at: Date;
  updated_at: Date;
};

type CrmActivityRow = {
  id: string;
  account_id: string;
  contact_id: string | null;
  contact_name: string | null;
  kind: CrmActivity["kind"];
  direction: CrmActivity["direction"];
  subject: string;
  summary: string;
  occurred_at: Date;
  next_step: string | null;
  next_follow_up_at: Date | null;
  created_at: Date;
};

type CrmTaskRow = {
  id: string;
  account_id: string;
  contact_id: string | null;
  contact_name: string | null;
  title: string;
  due_at: Date | null;
  priority: CrmTask["priority"];
  status: CrmTask["status"];
  completed_at: Date | null;
  assigned_to: string | null;
  created_at: Date;
  updated_at: Date;
};

type CrmMessageRow = {
  id: string;
  thread_id: string;
  account_id: string;
  account_name: string;
  contact_id: string | null;
  contact_name: string | null;
  direction: CrmMessage["direction"];
  channel: CrmChannel;
  sender_address: string | null;
  recipient_addresses: string[];
  subject: string;
  body: string;
  occurred_at: Date;
  delivery_status: CrmMessage["deliveryStatus"];
  external_message_id: string | null;
  attachment_names: string[];
  created_at: Date;
};

export type CrmAccountSummary = CrmAccount & {
  openTaskCount: number;
  overdueTaskCount: number;
};

export type PlatformCouncilSummary = {
  id: string;
  providerId: string;
  name: string;
  status: string;
  planTier: string;
  staffCount: number;
  liveAnnouncementCount: number;
  activeDisruptionCount: number;
};

function iso(value: Date | null) {
  return value?.toISOString();
}

function accountFromRow(row: CrmAccountRow): CrmAccountSummary {
  return {
    id: row.id,
    accountType: row.account_type,
    name: row.name,
    councilOrganisationId: row.council_organisation_id ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    stage: row.stage,
    annualValuePence: row.annual_value_pence ?? undefined,
    summary: row.summary ?? undefined,
    ownerUserId: row.owner_user_id ?? undefined,
    lastContactAt: iso(row.last_contact_at),
    nextFollowUpAt: iso(row.next_follow_up_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    openTaskCount: row.open_task_count ?? 0,
    overdueTaskCount: row.overdue_task_count ?? 0,
  };
}

function messageFromRow(row: CrmMessageRow): CrmMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    accountId: row.account_id,
    accountName: row.account_name,
    contactId: row.contact_id ?? undefined,
    contactName: row.contact_name ?? undefined,
    direction: row.direction,
    channel: row.channel,
    senderAddress: row.sender_address ?? undefined,
    recipientAddresses: row.recipient_addresses,
    subject: row.subject,
    body: row.body,
    occurredAt: row.occurred_at.toISOString(),
    deliveryStatus: row.delivery_status,
    externalMessageId: row.external_message_id ?? undefined,
    attachmentNames: row.attachment_names,
    createdAt: row.created_at.toISOString(),
  };
}

async function appendCrmAudit(
  sql: postgres.TransactionSql,
  session: CouncilStaffSession,
  action: string,
  entityType: string,
  entityId: string,
  summary: Record<string, string | number | boolean | null>,
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
      ${entityType},
      ${entityId}::uuid,
      ${sql.json(summary)}
    )
  `;
}

export async function platformOverviewPage(searchParams: OperationalQueueSearchParams) {
  const sql = councilDatabase();
  const statuses = ["prospect", "pilot", "active", "suspended", "ended"] as const;
  const plans = ["pilot", "core", "professional", "enterprise"] as const;
  const request = operationalQueueRequest(searchParams, {
    defaultSort: "name",
    filterValues: plans,
    sortValues: ["content", "name", "staff", "status"],
    statusValues: statuses,
  });
  const pattern = `%${request.query}%`;
  const [countRows, estateMetricRows, crm] = await Promise.all([
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bin_council_organisations AS organisation
      WHERE (${request.status} = '' OR organisation.status = ${request.status})
        AND (${request.filter} = '' OR organisation.plan_tier = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', organisation.name, organisation.provider_id, organisation.plan_tier, organisation.status) ILIKE ${pattern})
    `,
    sql<{ active_count: number; total_count: number }[]>`
      SELECT count(*)::int AS total_count, count(*) FILTER (WHERE status IN ('active', 'pilot'))::int AS active_count
      FROM bin_council_organisations
    `,
    platformCrmMetrics(),
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const councilRows = await sql<{
    id: string;
    provider_id: string;
    name: string;
    status: string;
    plan_tier: string;
    staff_count: number;
    live_announcement_count: number;
    active_disruption_count: number;
  }[]>`
    SELECT
      organisation.id,
      organisation.provider_id,
      organisation.name,
      organisation.status,
      organisation.plan_tier,
      coalesce(staff.staff_count, 0)::int AS staff_count,
      coalesce(announcement.live_announcement_count, 0)::int AS live_announcement_count,
      coalesce(disruption.active_disruption_count, 0)::int AS active_disruption_count
    FROM bin_council_organisations AS organisation
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS staff_count
      FROM bin_council_staff
      WHERE organisation_id = organisation.id AND status = 'active'
    ) AS staff ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_announcement_count
      FROM bin_council_announcements
      WHERE organisation_id = organisation.id
        AND status = 'published'
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at > now())
    ) AS announcement ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS active_disruption_count
      FROM bin_council_disruptions
      WHERE organisation_id = organisation.id
        AND status = 'published'
        AND starts_at <= now()
        AND (ends_at IS NULL OR ends_at > now())
    ) AS disruption ON true
    WHERE (${clampedRequest.status} = '' OR organisation.status = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR organisation.plan_tier = ${clampedRequest.filter})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', organisation.name, organisation.provider_id, organisation.plan_tier, organisation.status) ILIKE ${`%${clampedRequest.query}%`})
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'content' AND ${clampedRequest.direction} = 'asc' THEN coalesce(announcement.live_announcement_count, 0) + coalesce(disruption.active_disruption_count, 0) END ASC,
      CASE WHEN ${clampedRequest.sort} = 'content' AND ${clampedRequest.direction} = 'desc' THEN coalesce(announcement.live_announcement_count, 0) + coalesce(disruption.active_disruption_count, 0) END DESC,
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'asc' THEN organisation.name END ASC,
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'desc' THEN organisation.name END DESC,
      CASE WHEN ${clampedRequest.sort} = 'staff' AND ${clampedRequest.direction} = 'asc' THEN coalesce(staff.staff_count, 0) END ASC,
      CASE WHEN ${clampedRequest.sort} = 'staff' AND ${clampedRequest.direction} = 'desc' THEN coalesce(staff.staff_count, 0) END DESC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'asc' THEN organisation.status END ASC,
      CASE WHEN ${clampedRequest.sort} = 'status' AND ${clampedRequest.direction} = 'desc' THEN organisation.status END DESC,
      organisation.name,
      organisation.id
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  const estateMetrics = estateMetricRows[0];
  return {
    activeCouncilCount: estateMetrics?.active_count ?? 0,
    councils: {
      items: councilRows.map((row): PlatformCouncilSummary => ({
        id: row.id,
        providerId: row.provider_id,
        name: row.name,
        status: row.status,
        planTier: row.plan_tier,
        staffCount: row.staff_count,
        liveAnnouncementCount: row.live_announcement_count,
        activeDisruptionCount: row.active_disruption_count,
      })),
      request: clampedRequest,
      total,
      unfilteredTotal: estateMetrics?.total_count ?? 0,
    },
    crm,
    plans,
    statuses,
  };
}

export async function platformCrmMetrics() {
  const rows = await councilDatabase()<{
    account_count: number;
    active_opportunities: number;
    pipeline_value_pence: number;
    follow_ups_due: number;
  }[]>`
    SELECT
      count(*)::int AS account_count,
      count(*) FILTER (WHERE stage IN ('contacted', 'discovery', 'proposal', 'pilot'))::int AS active_opportunities,
      coalesce(sum(annual_value_pence) FILTER (WHERE stage NOT IN ('lost', 'paused')), 0)::int AS pipeline_value_pence,
      count(*) FILTER (WHERE next_follow_up_at IS NOT NULL AND next_follow_up_at <= now() AND stage NOT IN ('won', 'lost', 'paused'))::int AS follow_ups_due
    FROM bin_crm_accounts
  `;
  const row = rows[0];
  return {
    accountCount: row?.account_count ?? 0,
    activeOpportunities: row?.active_opportunities ?? 0,
    pipelineValuePence: row?.pipeline_value_pence ?? 0,
    followUpsDue: row?.follow_ups_due ?? 0,
  };
}

export async function listCrmAccountsPage(
  searchParams: OperationalQueueSearchParams,
): Promise<OperationalQueueServerPage<CrmAccountSummary>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultSort: "follow-up",
    filterValues: crmAccountTypes,
    sortValues: ["follow-up", "name", "tasks", "value"],
    statusValues: crmStages,
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bin_crm_accounts AS account
      WHERE (${request.status} = '' OR account.stage = ${request.status})
        AND (${request.filter} = '' OR account.account_type = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', account.name, account.summary, account.account_type, account.stage) ILIKE ${pattern})
    `,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM bin_crm_accounts`,
  ]);
  const total = countRows[0]?.count ?? 0;
  const clampedRequest = clampOperationalQueueRequest(request, total);
  const rows = await sql<CrmAccountRow[]>`
    SELECT
      account.*,
      count(task.id) FILTER (
        WHERE task.status IN ('open', 'in-progress')
      )::int AS open_task_count,
      count(task.id) FILTER (
        WHERE task.status IN ('open', 'in-progress')
          AND task.due_at < now()
      )::int AS overdue_task_count
    FROM bin_crm_accounts AS account
    LEFT JOIN bin_crm_tasks AS task
      ON task.account_id = account.id
    WHERE (${clampedRequest.status} = '' OR account.stage = ${clampedRequest.status})
      AND (${clampedRequest.filter} = '' OR account.account_type = ${clampedRequest.filter})
      AND (${clampedRequest.query} = '' OR concat_ws(' ', account.name, account.summary, account.account_type, account.stage) ILIKE ${`%${clampedRequest.query}%`})
    GROUP BY account.id
    ORDER BY
      CASE WHEN ${clampedRequest.sort} = 'follow-up' AND ${clampedRequest.direction} = 'asc' THEN account.next_follow_up_at END ASC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'follow-up' AND ${clampedRequest.direction} = 'desc' THEN account.next_follow_up_at END DESC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'asc' THEN account.name END ASC,
      CASE WHEN ${clampedRequest.sort} = 'name' AND ${clampedRequest.direction} = 'desc' THEN account.name END DESC,
      CASE WHEN ${clampedRequest.sort} = 'tasks' AND ${clampedRequest.direction} = 'asc' THEN count(task.id) FILTER (WHERE task.status IN ('open', 'in-progress')) END ASC,
      CASE WHEN ${clampedRequest.sort} = 'tasks' AND ${clampedRequest.direction} = 'desc' THEN count(task.id) FILTER (WHERE task.status IN ('open', 'in-progress')) END DESC,
      CASE WHEN ${clampedRequest.sort} = 'value' AND ${clampedRequest.direction} = 'asc' THEN account.annual_value_pence END ASC NULLS LAST,
      CASE WHEN ${clampedRequest.sort} = 'value' AND ${clampedRequest.direction} = 'desc' THEN account.annual_value_pence END DESC NULLS LAST,
      account.next_follow_up_at ASC NULLS LAST,
      account.updated_at DESC,
      account.id
    LIMIT ${clampedRequest.pageSize}
    OFFSET ${clampedRequest.offset}
  `;
  return {
    items: rows.map(accountFromRow),
    request: clampedRequest,
    total,
    unfilteredTotal: unfilteredRows[0]?.count ?? 0,
  };
}

function contactFromRow(row: CrmContactRow): CrmContact {
  return {
    id: row.id,
    accountId: row.account_id,
    fullName: row.full_name,
    jobTitle: row.job_title ?? undefined,
    professionalEmail: row.professional_email ?? undefined,
    professionalPhone: row.professional_phone ?? undefined,
    linkedinUrl: row.linkedin_url ?? undefined,
    preferredChannel: row.preferred_channel,
    lawfulBasis: row.lawful_basis,
    source: row.source,
    doNotContact: row.do_not_contact,
    retentionReviewAt: row.retention_review_at.toISOString().slice(0, 10),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function activityFromRow(row: CrmActivityRow): CrmActivity {
  return {
    id: row.id,
    accountId: row.account_id,
    contactId: row.contact_id ?? undefined,
    contactName: row.contact_name ?? undefined,
    kind: row.kind,
    direction: row.direction,
    subject: row.subject,
    summary: row.summary,
    occurredAt: row.occurred_at.toISOString(),
    nextStep: row.next_step ?? undefined,
    nextFollowUpAt: iso(row.next_follow_up_at),
    createdAt: row.created_at.toISOString(),
  };
}

function taskFromRow(row: CrmTaskRow): CrmTask {
  return {
    id: row.id,
    accountId: row.account_id,
    contactId: row.contact_id ?? undefined,
    contactName: row.contact_name ?? undefined,
    title: row.title,
    dueAt: iso(row.due_at),
    priority: row.priority,
    status: row.status,
    completedAt: iso(row.completed_at),
    assignedTo: row.assigned_to ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getCrmAccountOverview(accountId: string) {
  const sql = councilDatabase();
  const [accountRows, countRows, contactRows] = await Promise.all([
    sql<CrmAccountRow[]>`
      SELECT account.*,
        (SELECT count(*)::int FROM bin_crm_tasks WHERE account_id = account.id AND status IN ('open', 'in-progress')) AS open_task_count,
        (SELECT count(*)::int FROM bin_crm_tasks WHERE account_id = account.id AND status IN ('open', 'in-progress') AND due_at < now()) AS overdue_task_count
      FROM bin_crm_accounts AS account
      WHERE account.id = ${accountId}::uuid
      LIMIT 1
    `,
    sql<{ activities: number; contacts: number; messages: number; tasks: number }[]>`
      SELECT
        (SELECT count(*)::int FROM bin_crm_contacts WHERE account_id = ${accountId}::uuid) AS contacts,
        (SELECT count(*)::int FROM bin_crm_messages WHERE account_id = ${accountId}::uuid) AS messages,
        (SELECT count(*)::int FROM bin_crm_activities WHERE account_id = ${accountId}::uuid) AS activities,
        (SELECT count(*)::int FROM bin_crm_tasks WHERE account_id = ${accountId}::uuid) AS tasks
    `,
    sql<{ do_not_contact: boolean; full_name: string; id: string }[]>`
      SELECT id, full_name, do_not_contact
      FROM bin_crm_contacts
      WHERE account_id = ${accountId}::uuid
      ORDER BY do_not_contact, full_name, id
    `,
  ]);
  if (!accountRows[0]) return undefined;
  return {
    account: accountFromRow(accountRows[0]),
    contactOptions: contactRows.map((row) => ({ id: row.id, fullName: row.full_name, doNotContact: row.do_not_contact })),
    recordCounts: countRows[0] ?? { activities: 0, contacts: 0, messages: 0, tasks: 0 },
  };
}

export async function listCrmContactsPage(accountId: string, searchParams: OperationalQueueSearchParams): Promise<OperationalQueueServerPage<CrmContact>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultSort: "name",
    filterValues: ["email", "phone", "linkedin", "meeting", "none"],
    sortValues: ["name", "review", "updated"],
    statusValues: ["active", "suppressed"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM bin_crm_contacts
      WHERE account_id = ${accountId}::uuid
        AND (${request.status} = '' OR (${request.status} = 'suppressed') = do_not_contact)
        AND (${request.filter} = '' OR preferred_channel = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', full_name, job_title, professional_email, professional_phone, source) ILIKE ${pattern})
    `,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM bin_crm_contacts WHERE account_id = ${accountId}::uuid`,
  ]);
  const total = countRows[0]?.count ?? 0;
  const page = clampOperationalQueueRequest(request, total);
  const rows = await sql<CrmContactRow[]>`
    SELECT * FROM bin_crm_contacts
    WHERE account_id = ${accountId}::uuid
      AND (${page.status} = '' OR (${page.status} = 'suppressed') = do_not_contact)
      AND (${page.filter} = '' OR preferred_channel = ${page.filter})
      AND (${page.query} = '' OR concat_ws(' ', full_name, job_title, professional_email, professional_phone, source) ILIKE ${`%${page.query}%`})
    ORDER BY
      CASE WHEN ${page.sort} = 'name' AND ${page.direction} = 'asc' THEN full_name END ASC,
      CASE WHEN ${page.sort} = 'name' AND ${page.direction} = 'desc' THEN full_name END DESC,
      CASE WHEN ${page.sort} = 'review' AND ${page.direction} = 'asc' THEN retention_review_at END ASC,
      CASE WHEN ${page.sort} = 'review' AND ${page.direction} = 'desc' THEN retention_review_at END DESC,
      CASE WHEN ${page.sort} = 'updated' AND ${page.direction} = 'asc' THEN updated_at END ASC,
      CASE WHEN ${page.sort} = 'updated' AND ${page.direction} = 'desc' THEN updated_at END DESC,
      full_name, id
    LIMIT ${page.pageSize} OFFSET ${page.offset}
  `;
  return { items: rows.map(contactFromRow), request: page, total, unfilteredTotal: unfilteredRows[0]?.count ?? 0 };
}

export async function listCrmActivitiesPage(accountId: string, searchParams: OperationalQueueSearchParams): Promise<OperationalQueueServerPage<CrmActivity>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "occurred",
    filterValues: ["email", "call", "meeting", "note", "proposal", "demo", "task-update"],
    sortValues: ["follow-up", "occurred", "subject"],
    statusValues: ["inbound", "outbound", "internal"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM bin_crm_activities AS activity
      LEFT JOIN bin_crm_contacts AS contact ON contact.id = activity.contact_id
      WHERE activity.account_id = ${accountId}::uuid
        AND (${request.status} = '' OR activity.direction = ${request.status})
        AND (${request.filter} = '' OR activity.kind = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', activity.subject, activity.summary, activity.next_step, contact.full_name) ILIKE ${pattern})
    `,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM bin_crm_activities WHERE account_id = ${accountId}::uuid`,
  ]);
  const total = countRows[0]?.count ?? 0;
  const page = clampOperationalQueueRequest(request, total);
  const rows = await sql<CrmActivityRow[]>`
    SELECT activity.*, contact.full_name AS contact_name
    FROM bin_crm_activities AS activity
    LEFT JOIN bin_crm_contacts AS contact ON contact.id = activity.contact_id
    WHERE activity.account_id = ${accountId}::uuid
      AND (${page.status} = '' OR activity.direction = ${page.status})
      AND (${page.filter} = '' OR activity.kind = ${page.filter})
      AND (${page.query} = '' OR concat_ws(' ', activity.subject, activity.summary, activity.next_step, contact.full_name) ILIKE ${`%${page.query}%`})
    ORDER BY
      CASE WHEN ${page.sort} = 'follow-up' AND ${page.direction} = 'asc' THEN activity.next_follow_up_at END ASC NULLS LAST,
      CASE WHEN ${page.sort} = 'follow-up' AND ${page.direction} = 'desc' THEN activity.next_follow_up_at END DESC NULLS LAST,
      CASE WHEN ${page.sort} = 'occurred' AND ${page.direction} = 'asc' THEN activity.occurred_at END ASC,
      CASE WHEN ${page.sort} = 'occurred' AND ${page.direction} = 'desc' THEN activity.occurred_at END DESC,
      CASE WHEN ${page.sort} = 'subject' AND ${page.direction} = 'asc' THEN activity.subject END ASC,
      CASE WHEN ${page.sort} = 'subject' AND ${page.direction} = 'desc' THEN activity.subject END DESC,
      activity.occurred_at DESC, activity.id DESC
    LIMIT ${page.pageSize} OFFSET ${page.offset}
  `;
  return { items: rows.map(activityFromRow), request: page, total, unfilteredTotal: unfilteredRows[0]?.count ?? 0 };
}

export async function listCrmTasksPage(accountId: string, searchParams: OperationalQueueSearchParams): Promise<OperationalQueueServerPage<CrmTask>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultSort: "due",
    filterValues: ["low", "normal", "high", "urgent"],
    sortValues: ["due", "priority", "status", "updated"],
    statusValues: ["open", "in-progress", "completed", "cancelled"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM bin_crm_tasks AS task
      LEFT JOIN bin_crm_contacts AS contact ON contact.id = task.contact_id
      WHERE task.account_id = ${accountId}::uuid
        AND (${request.status} = '' OR task.status = ${request.status})
        AND (${request.filter} = '' OR task.priority = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', task.title, contact.full_name, task.assigned_to::text) ILIKE ${pattern})
    `,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM bin_crm_tasks WHERE account_id = ${accountId}::uuid`,
  ]);
  const total = countRows[0]?.count ?? 0;
  const page = clampOperationalQueueRequest(request, total);
  const rows = await sql<CrmTaskRow[]>`
    SELECT task.*, contact.full_name AS contact_name
    FROM bin_crm_tasks AS task
    LEFT JOIN bin_crm_contacts AS contact ON contact.id = task.contact_id
    WHERE task.account_id = ${accountId}::uuid
      AND (${page.status} = '' OR task.status = ${page.status})
      AND (${page.filter} = '' OR task.priority = ${page.filter})
      AND (${page.query} = '' OR concat_ws(' ', task.title, contact.full_name, task.assigned_to::text) ILIKE ${`%${page.query}%`})
    ORDER BY
      CASE WHEN ${page.sort} = 'due' AND ${page.direction} = 'asc' THEN task.due_at END ASC NULLS LAST,
      CASE WHEN ${page.sort} = 'due' AND ${page.direction} = 'desc' THEN task.due_at END DESC NULLS LAST,
      CASE WHEN ${page.sort} = 'priority' AND ${page.direction} = 'asc' THEN CASE task.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END END ASC,
      CASE WHEN ${page.sort} = 'priority' AND ${page.direction} = 'desc' THEN CASE task.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END END DESC,
      CASE WHEN ${page.sort} = 'status' AND ${page.direction} = 'asc' THEN task.status END ASC,
      CASE WHEN ${page.sort} = 'status' AND ${page.direction} = 'desc' THEN task.status END DESC,
      CASE WHEN ${page.sort} = 'updated' AND ${page.direction} = 'asc' THEN task.updated_at END ASC,
      CASE WHEN ${page.sort} = 'updated' AND ${page.direction} = 'desc' THEN task.updated_at END DESC,
      task.due_at ASC NULLS LAST, task.id
    LIMIT ${page.pageSize} OFFSET ${page.offset}
  `;
  return { items: rows.map(taskFromRow), request: page, total, unfilteredTotal: unfilteredRows[0]?.count ?? 0 };
}

export async function listCrmAccountMessagesPage(accountId: string, searchParams: OperationalQueueSearchParams): Promise<OperationalQueueServerPage<CrmMessage>> {
  const sql = councilDatabase();
  const request = operationalQueueRequest(searchParams, {
    defaultDirection: "desc",
    defaultSort: "occurred",
    filterValues: ["email", "phone", "sms", "linkedin", "meeting", "note"],
    sortValues: ["contact", "occurred", "status", "subject"],
    statusValues: ["draft", "sent", "delivered", "received", "read", "failed"],
  });
  const pattern = `%${request.query}%`;
  const [countRows, unfilteredRows] = await Promise.all([
    sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM bin_crm_messages AS message
      LEFT JOIN bin_crm_contacts AS contact ON contact.id = message.contact_id
      WHERE message.account_id = ${accountId}::uuid
        AND (${request.status} = '' OR message.delivery_status = ${request.status})
        AND (${request.filter} = '' OR message.channel = ${request.filter})
        AND (${request.query} = '' OR concat_ws(' ', message.subject, message.body, contact.full_name, message.recipient_addresses::text) ILIKE ${pattern})
    `,
    sql<{ count: number }[]>`SELECT count(*)::int AS count FROM bin_crm_messages WHERE account_id = ${accountId}::uuid`,
  ]);
  const total = countRows[0]?.count ?? 0;
  const page = clampOperationalQueueRequest(request, total);
  const rows = await sql<CrmMessageRow[]>`
    SELECT message.*, account.name AS account_name, contact.full_name AS contact_name
    FROM bin_crm_messages AS message
    INNER JOIN bin_crm_accounts AS account ON account.id = message.account_id
    LEFT JOIN bin_crm_contacts AS contact ON contact.id = message.contact_id
    WHERE message.account_id = ${accountId}::uuid
      AND (${page.status} = '' OR message.delivery_status = ${page.status})
      AND (${page.filter} = '' OR message.channel = ${page.filter})
      AND (${page.query} = '' OR concat_ws(' ', message.subject, message.body, contact.full_name, message.recipient_addresses::text) ILIKE ${`%${page.query}%`})
    ORDER BY
      CASE WHEN ${page.sort} = 'contact' AND ${page.direction} = 'asc' THEN contact.full_name END ASC NULLS LAST,
      CASE WHEN ${page.sort} = 'contact' AND ${page.direction} = 'desc' THEN contact.full_name END DESC NULLS LAST,
      CASE WHEN ${page.sort} = 'occurred' AND ${page.direction} = 'asc' THEN message.occurred_at END ASC,
      CASE WHEN ${page.sort} = 'occurred' AND ${page.direction} = 'desc' THEN message.occurred_at END DESC,
      CASE WHEN ${page.sort} = 'status' AND ${page.direction} = 'asc' THEN message.delivery_status END ASC,
      CASE WHEN ${page.sort} = 'status' AND ${page.direction} = 'desc' THEN message.delivery_status END DESC,
      CASE WHEN ${page.sort} = 'subject' AND ${page.direction} = 'asc' THEN message.subject END ASC,
      CASE WHEN ${page.sort} = 'subject' AND ${page.direction} = 'desc' THEN message.subject END DESC,
      message.occurred_at DESC, message.id DESC
    LIMIT ${page.pageSize} OFFSET ${page.offset}
  `;
  return { items: rows.map(messageFromRow), request: page, total, unfilteredTotal: unfilteredRows[0]?.count ?? 0 };
}

export async function createCrmAccount(
  session: CouncilStaffSession,
  input: {
    accountType: CrmAccountType;
    name: string;
    websiteUrl?: string;
    stage: CrmStage;
    annualValuePence?: number;
    summary?: string;
  },
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_crm_accounts (
        account_type,
        name,
        website_url,
        stage,
        annual_value_pence,
        summary,
        owner_user_id,
        created_by
      ) VALUES (
        ${input.accountType},
        ${input.name},
        ${input.websiteUrl ?? null},
        ${input.stage},
        ${input.annualValuePence ?? null},
        ${input.summary ?? null},
        ${session.userId}::uuid,
        ${session.userId}::uuid
      )
      RETURNING id
    `;
    await appendCrmAudit(
      transaction,
      session,
      "crm.account.created",
      "crm_account",
      rows[0].id,
      { accountType: input.accountType, stage: input.stage },
    );
    return rows[0].id;
  });
}

export async function updateCrmAccountStage(
  session: CouncilStaffSession,
  accountId: string,
  stage: CrmStage,
) {
  const sql = councilDatabase();
  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      UPDATE bin_crm_accounts
      SET stage = ${stage}, updated_at = now()
      WHERE id = ${accountId}::uuid
      RETURNING id
    `;
    if (!rows[0]) throw new Error("That CRM account no longer exists.");
    await appendCrmAudit(
      transaction,
      session,
      "crm.account.stage-updated",
      "crm_account",
      accountId,
      { stage },
    );
  });
}

export async function createCrmContact(
  session: CouncilStaffSession,
  input: {
    accountId: string;
    fullName: string;
    jobTitle?: string;
    professionalEmail?: string;
    professionalPhone?: string;
    linkedinUrl?: string;
    preferredChannel: CrmContact["preferredChannel"];
    lawfulBasis: CrmContact["lawfulBasis"];
    source: string;
    doNotContact: boolean;
    retentionReviewAt: string;
  },
) {
  const sql = councilDatabase();
  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_crm_contacts (
        account_id,
        full_name,
        job_title,
        professional_email,
        professional_phone,
        linkedin_url,
        preferred_channel,
        lawful_basis,
        source,
        do_not_contact,
        retention_review_at,
        created_by
      ) VALUES (
        ${input.accountId}::uuid,
        ${input.fullName},
        ${input.jobTitle ?? null},
        ${input.professionalEmail ?? null},
        ${input.professionalPhone ?? null},
        ${input.linkedinUrl ?? null},
        ${input.preferredChannel},
        ${input.lawfulBasis},
        ${input.source},
        ${input.doNotContact},
        ${input.retentionReviewAt}::date,
        ${session.userId}::uuid
      )
      RETURNING id
    `;
    await appendCrmAudit(
      transaction,
      session,
      "crm.contact.created",
      "crm_contact",
      rows[0].id,
      { accountId: input.accountId, lawfulBasis: input.lawfulBasis, suppressed: input.doNotContact },
    );
  });
}

export async function createCrmActivity(
  session: CouncilStaffSession,
  input: {
    accountId: string;
    contactId?: string;
    kind: CrmActivity["kind"];
    direction: CrmActivity["direction"];
    subject: string;
    summary: string;
    occurredAt: string;
    nextStep?: string;
    nextFollowUpAt?: string;
  },
) {
  const sql = councilDatabase();
  await sql.begin(async (transaction) => {
    if (input.contactId && input.direction === "outbound") {
      const contactRows = await transaction<{ do_not_contact: boolean }[]>`
        SELECT do_not_contact
        FROM bin_crm_contacts
        WHERE id = ${input.contactId}::uuid
          AND account_id = ${input.accountId}::uuid
        LIMIT 1
      `;
      if (contactRows[0]?.do_not_contact) {
        throw new Error("This contact is suppressed. Remove the outbound activity or use another contact.");
      }
    }
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_crm_activities (
        account_id,
        contact_id,
        kind,
        direction,
        subject,
        summary,
        occurred_at,
        next_step,
        next_follow_up_at,
        created_by
      ) VALUES (
        ${input.accountId}::uuid,
        ${input.contactId ?? null}::uuid,
        ${input.kind},
        ${input.direction},
        ${input.subject},
        ${input.summary},
        ${input.occurredAt}::timestamptz,
        ${input.nextStep ?? null},
        ${input.nextFollowUpAt ?? null}::timestamptz,
        ${session.userId}::uuid
      )
      RETURNING id
    `;
    await transaction`
      UPDATE bin_crm_accounts
      SET
        last_contact_at = greatest(
          coalesce(last_contact_at, ${input.occurredAt}::timestamptz),
          ${input.occurredAt}::timestamptz
        ),
        next_follow_up_at = coalesce(
          ${input.nextFollowUpAt ?? null}::timestamptz,
          next_follow_up_at
        ),
        updated_at = now()
      WHERE id = ${input.accountId}::uuid
    `;
    await appendCrmAudit(
      transaction,
      session,
      "crm.activity.created",
      "crm_activity",
      rows[0].id,
      { accountId: input.accountId, kind: input.kind, direction: input.direction },
    );
  });
}

export async function createCrmTask(
  session: CouncilStaffSession,
  input: {
    accountId: string;
    contactId?: string;
    title: string;
    dueAt?: string;
    priority: CrmTask["priority"];
  },
) {
  const sql = councilDatabase();
  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      INSERT INTO bin_crm_tasks (
        account_id,
        contact_id,
        title,
        due_at,
        priority,
        assigned_to,
        created_by
      ) VALUES (
        ${input.accountId}::uuid,
        ${input.contactId ?? null}::uuid,
        ${input.title},
        ${input.dueAt ?? null}::timestamptz,
        ${input.priority},
        ${session.userId}::uuid,
        ${session.userId}::uuid
      )
      RETURNING id
    `;
    await appendCrmAudit(
      transaction,
      session,
      "crm.task.created",
      "crm_task",
      rows[0].id,
      { accountId: input.accountId, priority: input.priority },
    );
  });
}

export async function updateCrmTaskStatus(
  session: CouncilStaffSession,
  taskId: string,
  status: CrmTask["status"],
) {
  const sql = councilDatabase();
  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string; account_id: string }[]>`
      UPDATE bin_crm_tasks
      SET
        status = ${status},
        completed_at = CASE WHEN ${status} = 'completed' THEN now() ELSE null END,
        updated_at = now()
      WHERE id = ${taskId}::uuid
      RETURNING id, account_id
    `;
    if (!rows[0]) throw new Error("That CRM follow-up no longer exists.");
    await appendCrmAudit(
      transaction,
      session,
      "crm.task.status-updated",
      "crm_task",
      taskId,
      { accountId: rows[0].account_id, status },
    );
  });
}

export async function createCrmMessage(
  session: CouncilStaffSession,
  input: {
    threadId?: string;
    accountId: string;
    contactId?: string;
    direction: CrmMessage["direction"];
    channel: CrmChannel;
    senderAddress?: string;
    recipientAddresses: string[];
    subject: string;
    body: string;
    occurredAt: string;
    deliveryStatus: CrmMessage["deliveryStatus"];
    externalMessageId?: string;
    attachmentNames: string[];
  },
) {
  const sql = councilDatabase();
  return sql.begin(async (transaction) => {
    if (input.contactId && input.direction === "sent") {
      const contactRows = await transaction<{ do_not_contact: boolean }[]>`
        SELECT do_not_contact
        FROM bin_crm_contacts
        WHERE id = ${input.contactId}::uuid
          AND account_id = ${input.accountId}::uuid
        LIMIT 1
      `;
      if (contactRows[0]?.do_not_contact) {
        throw new Error("This contact is suppressed and cannot be recorded as an outbound recipient.");
      }
    }

    let threadId = input.threadId;
    if (threadId) {
      const threadRows = await transaction<{ id: string }[]>`
        SELECT id
        FROM bin_crm_threads
        WHERE id = ${threadId}::uuid
          AND account_id = ${input.accountId}::uuid
        LIMIT 1
      `;
      if (!threadRows[0]) throw new Error("That correspondence thread no longer exists.");
    } else {
      const threadRows = await transaction<{ id: string }[]>`
        INSERT INTO bin_crm_threads (
          account_id,
          contact_id,
          channel,
          subject,
          status,
          last_message_at,
          last_direction,
          created_by
        ) VALUES (
          ${input.accountId}::uuid,
          ${input.contactId ?? null}::uuid,
          ${input.channel},
          ${input.subject},
          'open',
          ${input.occurredAt}::timestamptz,
          ${input.direction},
          ${session.userId}::uuid
        )
        RETURNING id
      `;
      threadId = threadRows[0].id;
    }

    const messageRows = await transaction<{ id: string }[]>`
      INSERT INTO bin_crm_messages (
        thread_id,
        account_id,
        contact_id,
        direction,
        channel,
        sender_address,
        recipient_addresses,
        subject,
        body,
        occurred_at,
        delivery_status,
        external_message_id,
        attachment_names,
        created_by
      ) VALUES (
        ${threadId}::uuid,
        ${input.accountId}::uuid,
        ${input.contactId ?? null}::uuid,
        ${input.direction},
        ${input.channel},
        ${input.senderAddress ?? null},
        ${input.recipientAddresses},
        ${input.subject},
        ${input.body},
        ${input.occurredAt}::timestamptz,
        ${input.deliveryStatus},
        ${input.externalMessageId ?? null},
        ${input.attachmentNames},
        ${session.userId}::uuid
      )
      RETURNING id
    `;
    await transaction`
      UPDATE bin_crm_threads
      SET
        last_message_at = greatest(
          coalesce(last_message_at, ${input.occurredAt}::timestamptz),
          ${input.occurredAt}::timestamptz
        ),
        last_direction = ${input.direction},
        status = CASE
          WHEN ${input.direction} = 'received' THEN 'open'
          WHEN ${input.direction} = 'sent' THEN 'waiting'
          ELSE status
        END,
        updated_at = now()
      WHERE id = ${threadId}::uuid
    `;
    await transaction`
      UPDATE bin_crm_accounts
      SET
        last_contact_at = greatest(
          coalesce(last_contact_at, ${input.occurredAt}::timestamptz),
          ${input.occurredAt}::timestamptz
        ),
        updated_at = now()
      WHERE id = ${input.accountId}::uuid
    `;
    await appendCrmAudit(
      transaction,
      session,
      "crm.message.created",
      "crm_message",
      messageRows[0].id,
      {
        accountId: input.accountId,
        channel: input.channel,
        direction: input.direction,
        deliveryStatus: input.deliveryStatus,
      },
    );
    return { messageId: messageRows[0].id, threadId };
  });
}

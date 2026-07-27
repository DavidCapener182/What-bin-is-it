import type postgres from "postgres";

import { councilDatabase } from "./database";
import type {
  CouncilStaffSession,
  CrmAccount,
  CrmAccountType,
  CrmActivity,
  CrmChannel,
  CrmContact,
  CrmMailboxConnection,
  CrmMessage,
  CrmStage,
  CrmTask,
  CrmThread,
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

export async function platformOverview() {
  const sql = councilDatabase();
  const [councilRows, crmRows] = await Promise.all([
    sql<{
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
        count(DISTINCT staff.id)::int AS staff_count,
        count(DISTINCT announcement.id) FILTER (
          WHERE announcement.status = 'published'
            AND (announcement.starts_at IS NULL OR announcement.starts_at <= now())
            AND (announcement.ends_at IS NULL OR announcement.ends_at > now())
        )::int AS live_announcement_count,
        count(DISTINCT disruption.id) FILTER (
          WHERE disruption.status = 'published'
            AND disruption.starts_at <= now()
            AND (disruption.ends_at IS NULL OR disruption.ends_at > now())
        )::int AS active_disruption_count
      FROM bin_council_organisations AS organisation
      LEFT JOIN bin_council_staff AS staff
        ON staff.organisation_id = organisation.id
        AND staff.status = 'active'
      LEFT JOIN bin_council_announcements AS announcement
        ON announcement.organisation_id = organisation.id
      LEFT JOIN bin_council_disruptions AS disruption
        ON disruption.organisation_id = organisation.id
      GROUP BY organisation.id
      ORDER BY organisation.name
      LIMIT 500
    `,
    sql<{
      account_count: number;
      active_opportunities: number;
      pipeline_value_pence: number;
      follow_ups_due: number;
    }[]>`
      SELECT
        count(*)::int AS account_count,
        count(*) FILTER (
          WHERE stage IN ('contacted', 'discovery', 'proposal', 'pilot')
        )::int AS active_opportunities,
        coalesce(sum(annual_value_pence) FILTER (
          WHERE stage NOT IN ('lost', 'paused')
        ), 0)::int AS pipeline_value_pence,
        count(*) FILTER (
          WHERE next_follow_up_at IS NOT NULL
            AND next_follow_up_at <= now()
            AND stage NOT IN ('won', 'lost', 'paused')
        )::int AS follow_ups_due
      FROM bin_crm_accounts
    `,
  ]);
  const crm = crmRows[0] ?? {
    account_count: 0,
    active_opportunities: 0,
    pipeline_value_pence: 0,
    follow_ups_due: 0,
  };
  return {
    councils: councilRows.map((row): PlatformCouncilSummary => ({
      id: row.id,
      providerId: row.provider_id,
      name: row.name,
      status: row.status,
      planTier: row.plan_tier,
      staffCount: row.staff_count,
      liveAnnouncementCount: row.live_announcement_count,
      activeDisruptionCount: row.active_disruption_count,
    })),
    crm: {
      accountCount: crm.account_count,
      activeOpportunities: crm.active_opportunities,
      pipelineValuePence: crm.pipeline_value_pence,
      followUpsDue: crm.follow_ups_due,
    },
  };
}

export async function listCrmAccounts() {
  const sql = councilDatabase();
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
    GROUP BY account.id
    ORDER BY
      account.next_follow_up_at ASC NULLS LAST,
      account.updated_at DESC
    LIMIT 500
  `;
  return rows.map(accountFromRow);
}

export async function listCrmComposeOptions() {
  const sql = councilDatabase();
  const [accounts, contacts] = await Promise.all([
    sql<{ id: string; name: string; account_type: CrmAccountType }[]>`
      SELECT id, name, account_type
      FROM bin_crm_accounts
      WHERE stage <> 'lost'
      ORDER BY name
      LIMIT 500
    `,
    sql<{
      id: string;
      account_id: string;
      account_name: string;
      full_name: string;
      do_not_contact: boolean;
    }[]>`
      SELECT
        contact.id,
        contact.account_id,
        account.name AS account_name,
        contact.full_name,
        contact.do_not_contact
      FROM bin_crm_contacts AS contact
      INNER JOIN bin_crm_accounts AS account
        ON account.id = contact.account_id
      ORDER BY account.name, contact.full_name
      LIMIT 2000
    `,
  ]);
  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      accountType: account.account_type,
    })),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      accountId: contact.account_id,
      accountName: contact.account_name,
      fullName: contact.full_name,
      doNotContact: contact.do_not_contact,
    })),
  };
}

export async function listCrmMessages(filters: {
  accountId?: string;
  direction?: CrmMessage["direction"];
  channel?: CrmChannel;
  query?: string;
} = {}) {
  const sql = councilDatabase();
  const query = filters.query?.trim().slice(0, 120) || null;
  const rows = await sql<CrmMessageRow[]>`
    SELECT
      message.*,
      account.name AS account_name,
      contact.full_name AS contact_name
    FROM bin_crm_messages AS message
    INNER JOIN bin_crm_accounts AS account
      ON account.id = message.account_id
    LEFT JOIN bin_crm_contacts AS contact
      ON contact.id = message.contact_id
    WHERE (
      ${filters.accountId ?? null}::uuid IS NULL
      OR message.account_id = ${filters.accountId ?? null}::uuid
    )
      AND (
        ${filters.direction ?? null}::varchar IS NULL
        OR message.direction = ${filters.direction ?? null}
      )
      AND (
        ${filters.channel ?? null}::varchar IS NULL
        OR message.channel = ${filters.channel ?? null}
      )
      AND (
        ${query}::text IS NULL
        OR message.subject ILIKE ('%' || ${query} || '%')
        OR message.body ILIKE ('%' || ${query} || '%')
        OR account.name ILIKE ('%' || ${query} || '%')
        OR contact.full_name ILIKE ('%' || ${query} || '%')
      )
    ORDER BY message.occurred_at DESC
    LIMIT 1000
  `;
  return rows.map(messageFromRow);
}

export async function listCrmThreads() {
  const sql = councilDatabase();
  const rows = await sql<{
    id: string;
    account_id: string;
    account_name: string;
    contact_id: string | null;
    contact_name: string | null;
    channel: CrmChannel;
    subject: string;
    status: CrmThread["status"];
    last_message_at: Date | null;
    last_direction: CrmThread["lastDirection"] | null;
    message_count: number;
  }[]>`
    SELECT
      thread.id,
      thread.account_id,
      account.name AS account_name,
      thread.contact_id,
      contact.full_name AS contact_name,
      thread.channel,
      thread.subject,
      thread.status,
      thread.last_message_at,
      thread.last_direction,
      count(message.id)::int AS message_count
    FROM bin_crm_threads AS thread
    INNER JOIN bin_crm_accounts AS account
      ON account.id = thread.account_id
    LEFT JOIN bin_crm_contacts AS contact
      ON contact.id = thread.contact_id
    LEFT JOIN bin_crm_messages AS message
      ON message.thread_id = thread.id
    GROUP BY thread.id, account.name, contact.full_name
    ORDER BY thread.last_message_at DESC NULLS LAST
    LIMIT 500
  `;
  return rows.map((row): CrmThread => ({
    id: row.id,
    accountId: row.account_id,
    accountName: row.account_name,
    contactId: row.contact_id ?? undefined,
    contactName: row.contact_name ?? undefined,
    channel: row.channel,
    subject: row.subject,
    status: row.status,
    lastMessageAt: iso(row.last_message_at),
    lastDirection: row.last_direction ?? undefined,
    messageCount: row.message_count,
  }));
}

export async function listCrmMailboxConnections() {
  const sql = councilDatabase();
  const rows = await sql<{
    id: string;
    provider: CrmMailboxConnection["provider"];
    mailbox_email: string;
    status: CrmMailboxConnection["status"];
    last_synced_at: Date | null;
    last_error_code: string | null;
  }[]>`
    SELECT id, provider, mailbox_email, status, last_synced_at, last_error_code
    FROM bin_crm_mailbox_connections
    ORDER BY provider, mailbox_email
    LIMIT 20
  `;
  return rows.map((row): CrmMailboxConnection => ({
    id: row.id,
    provider: row.provider,
    mailboxEmail: row.mailbox_email,
    status: row.status,
    lastSyncedAt: iso(row.last_synced_at),
    lastErrorCode: row.last_error_code ?? undefined,
  }));
}

export async function getCrmAccountBundle(accountId: string) {
  const sql = councilDatabase();
  const [accountRows, contactRows, activityRows, taskRows] = await Promise.all([
    sql<CrmAccountRow[]>`
      SELECT account.*, 0::int AS open_task_count, 0::int AS overdue_task_count
      FROM bin_crm_accounts AS account
      WHERE account.id = ${accountId}::uuid
      LIMIT 1
    `,
    sql<CrmContactRow[]>`
      SELECT *
      FROM bin_crm_contacts
      WHERE account_id = ${accountId}::uuid
      ORDER BY do_not_contact, full_name
      LIMIT 250
    `,
    sql<CrmActivityRow[]>`
      SELECT activity.*, contact.full_name AS contact_name
      FROM bin_crm_activities AS activity
      LEFT JOIN bin_crm_contacts AS contact
        ON contact.id = activity.contact_id
      WHERE activity.account_id = ${accountId}::uuid
      ORDER BY activity.occurred_at DESC
      LIMIT 500
    `,
    sql<CrmTaskRow[]>`
      SELECT task.*, contact.full_name AS contact_name
      FROM bin_crm_tasks AS task
      LEFT JOIN bin_crm_contacts AS contact
        ON contact.id = task.contact_id
      WHERE task.account_id = ${accountId}::uuid
      ORDER BY
        CASE task.status WHEN 'open' THEN 0 WHEN 'in-progress' THEN 1 ELSE 2 END,
        task.due_at ASC NULLS LAST,
        task.updated_at DESC
      LIMIT 500
    `,
  ]);
  const account = accountRows[0] ? accountFromRow(accountRows[0]) : undefined;
  if (!account) return undefined;
  return {
    account,
    contacts: contactRows.map((row): CrmContact => ({
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
    })),
    activities: activityRows.map((row): CrmActivity => ({
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
    })),
    tasks: taskRows.map((row): CrmTask => ({
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
    })),
  };
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

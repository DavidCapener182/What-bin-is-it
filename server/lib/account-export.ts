import { binDatabase } from './bin-database.ts';

export const ACCOUNT_EXPORT_PAGE_SIZE = 250;

export async function collectAccountExportPages<Row, Cursor>(
  fetchPage: (cursor: Cursor | undefined, pageSize: number) => Promise<Row[]>,
  cursorFor: (row: Row) => Cursor,
) {
  const rows: Row[] = [];
  let cursor: Cursor | undefined;
  while (true) {
    const page = await fetchPage(cursor, ACCOUNT_EXPORT_PAGE_SIZE);
    rows.push(...page);
    if (page.length < ACCOUNT_EXPORT_PAGE_SIZE) return rows;
    const nextCursor = cursorFor(page[page.length - 1]!);
    if (JSON.stringify(nextCursor) === JSON.stringify(cursor)) {
      throw new Error('Account export pagination did not advance.');
    }
    cursor = nextCursor;
  }
}

function iso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Account export contained an invalid date.');
  return date.toISOString();
}

export async function exportResidentAccountRecords(userId: string) {
  const sql = binDatabase();
  await sql`
    DELETE FROM bin_account_re_enrolment_intents
    WHERE user_id = ${userId}::uuid
      AND expires_at <= now()
  `;
  const entitlements = await sql`
    SELECT plan_id, source, status, product_id, current_period_end, created_at, updated_at
    FROM bin_user_entitlements
    WHERE user_id = ${userId}::uuid
  `;
  const providerGrants = await collectAccountExportPages(
    async (cursor: string | undefined, pageSize) => sql`
      SELECT
        id::text AS export_cursor,
        source,
        plan_id,
        status,
        product_id,
        current_period_end,
        provider_event_at,
        created_at,
        updated_at
      FROM bin_entitlement_grants
      WHERE user_id = ${userId}::uuid
        AND (${cursor ?? null}::bigint IS NULL OR id > ${cursor ?? null}::bigint)
      ORDER BY id
      LIMIT ${pageSize}
    `,
    (row) => String(row.export_cursor),
  ).then((rows) => rows.map(({ export_cursor: _cursor, ...row }) => row));
  const webBilling = await sql`
    SELECT plan_id, billing_mode, status, currency, amount_pence, started_at, current_period_end, cancelled_at, updated_at
    FROM bin_supporters
    WHERE user_id = ${userId}::uuid
  `;
  const nativeBillingEvents = await collectAccountExportPages(
    async (cursor: string | undefined, pageSize) => sql`
      SELECT
        revenuecat_event_id AS export_cursor,
        event_type,
        product_id,
        store,
        environment,
        outcome,
        occurred_at,
        received_at
      FROM bin_revenuecat_events
      WHERE user_id = ${userId}::uuid
        AND (${cursor ?? null}::text IS NULL OR revenuecat_event_id > ${cursor ?? null})
      ORDER BY revenuecat_event_id
      LIMIT ${pageSize}
    `,
    (row) => String(row.export_cursor),
  ).then((rows) => rows.map(({ export_cursor: _cursor, ...row }) => row));
  const supportThreads = await collectAccountExportPages(
    async (cursor: string | undefined, pageSize) => sql`
      SELECT
        id AS export_cursor,
        id,
        council_provider_id,
        council_name,
        topic,
        subject,
        status,
        last_message_at,
        resolved_at,
        created_at,
        updated_at
      FROM bin_resident_support_threads
      WHERE resident_user_id = ${userId}::uuid
        AND (${cursor ?? null}::uuid IS NULL OR id > ${cursor ?? null}::uuid)
      ORDER BY id
      LIMIT ${pageSize}
    `,
    (row) => String(row.export_cursor),
  ).then((rows) => rows.map(({ export_cursor: _cursor, ...row }) => row));
  const supportMessages = await collectAccountExportPages(
    async (cursor: string | undefined, pageSize) => sql`
      SELECT
        message.id AS export_cursor,
        message.thread_id,
        message.sender_kind,
        message.body,
        message.created_at
      FROM bin_resident_support_messages AS message
      INNER JOIN bin_resident_support_threads AS thread
        ON thread.id = message.thread_id
      WHERE thread.resident_user_id = ${userId}::uuid
        AND message.visibility = 'resident'
        AND (${cursor ?? null}::uuid IS NULL OR message.id > ${cursor ?? null}::uuid)
      ORDER BY message.id
      LIMIT ${pageSize}
    `,
    (row) => String(row.export_cursor),
  ).then((rows) => rows.map(({ export_cursor: _cursor, ...row }) => row));

  const householdRows = await collectAccountExportPages(
    async (cursor: string | undefined, pageSize) => sql<{
      id: string;
      council_provider_id: string;
      display_name: string;
      owner_user_id: string;
      role: 'owner' | 'member';
      created_at: Date | string;
    }[]>`
      SELECT household.id, household.council_provider_id, household.display_name,
        household.owner_user_id, access.role, household.created_at
      FROM bin_households AS household
      INNER JOIN bin_household_members AS access ON access.household_id = household.id
      WHERE access.user_id = ${userId}::uuid
        AND household.status = 'active'
        AND (${cursor ?? null}::uuid IS NULL OR household.id > ${cursor ?? null}::uuid)
      ORDER BY household.id
      LIMIT ${pageSize}
    `,
    (row) => row.id,
  );
  type MemberCursor = { householdId: string; userId: string };
  const householdMembers = await collectAccountExportPages(
    async (cursor: MemberCursor | undefined, pageSize) => sql<{
      household_id: string;
      user_id: string;
      display_name: string;
      role: 'owner' | 'member';
      joined_at: Date | string;
    }[]>`
      SELECT member.household_id, member.user_id, member.display_name, member.role, member.joined_at
      FROM bin_household_members AS member
      INNER JOIN bin_household_members AS access ON access.household_id = member.household_id
      INNER JOIN bin_households AS household ON household.id = member.household_id
      WHERE access.user_id = ${userId}::uuid
        AND household.status = 'active'
        AND (
          ${cursor?.householdId ?? null}::uuid IS NULL
          OR (member.household_id, member.user_id) > (
            ${cursor?.householdId ?? null}::uuid,
            ${cursor?.userId ?? null}::uuid
          )
        )
      ORDER BY member.household_id, member.user_id
      LIMIT ${pageSize}
    `,
    (row) => ({ householdId: row.household_id, userId: row.user_id }),
  );
  const householdActions = await collectAccountExportPages(
    async (cursor: string | undefined, pageSize) => sql<{
      export_cursor: string;
      id: string;
      household_id: string;
      actor_user_id: string;
      responsible_user_id: string | null;
      collection_date: Date | string;
      waste_type: string;
      action: string;
      occurred_at: Date | string;
    }[]>`
      SELECT action.id::text AS export_cursor, action.id::text AS id,
        action.household_id, action.actor_user_id, action.responsible_user_id,
        action.collection_date, action.waste_type, action.action, action.occurred_at
      FROM bin_household_collection_actions AS action
      INNER JOIN bin_household_members AS access ON access.household_id = action.household_id
      INNER JOIN bin_households AS household ON household.id = action.household_id
      WHERE access.user_id = ${userId}::uuid
        AND household.status = 'active'
        AND (${cursor ?? null}::bigint IS NULL OR action.id > ${cursor ?? null}::bigint)
      ORDER BY action.id
      LIMIT ${pageSize}
    `,
    (row) => row.export_cursor,
  );
  const households = householdRows.map((household) => ({
    id: household.id,
    councilProviderId: household.council_provider_id,
    displayName: household.display_name,
    role: household.role,
    createdAt: iso(household.created_at),
    members: householdMembers
      .filter((member) => member.household_id === household.id)
      .map((member) => ({
        id: member.user_id,
        displayName: member.display_name,
        role: member.role,
        joinedAt: iso(member.joined_at),
      })),
    actions: householdActions
      .filter((action) => action.household_id === household.id)
      .map(({ export_cursor: _cursor, household_id: _householdId, ...action }) => ({
        id: action.id,
        actorUserId: action.actor_user_id,
        responsibleUserId: action.responsible_user_id ?? undefined,
        collectionDate: action.collection_date instanceof Date
          ? action.collection_date.toISOString().slice(0, 10)
          : String(action.collection_date).slice(0, 10),
        wasteType: action.waste_type,
        action: action.action,
        occurredAt: iso(action.occurred_at),
      })),
  }));
  const householdInvitations = await collectAccountExportPages(
    async (cursor: string | undefined, pageSize) => sql`
      SELECT
        invitation.id AS export_cursor,
        invitation.id,
        invitation.household_id,
        invitation.expires_at,
        invitation.max_uses,
        invitation.uses,
        invitation.revoked_at,
        invitation.created_at
      FROM bin_household_invites AS invitation
      INNER JOIN bin_household_members AS membership
        ON membership.household_id = invitation.household_id
      INNER JOIN bin_households AS household
        ON household.id = invitation.household_id
      WHERE invitation.created_by = ${userId}::uuid
        AND membership.user_id = ${userId}::uuid
        AND household.status = 'active'
        AND (${cursor ?? null}::uuid IS NULL OR invitation.id > ${cursor ?? null}::uuid)
      ORDER BY invitation.id
      LIMIT ${pageSize}
    `,
    (row) => String(row.export_cursor),
  ).then((rows) => rows.map(({ export_cursor: _cursor, ...row }) => row));
  const accountRemovalStates = await sql<{ removed_at: Date | string }[]>`
    SELECT removed_at
    FROM bin_account_removal_suppressions
    WHERE user_id = ${userId}::uuid
  `;
  type IntentCursor = { requestedAt: string; source: string; key: string };
  const pendingReEnrolments = await collectAccountExportPages(
    async (cursor: IntentCursor | undefined, pageSize) => sql<{
      requested_at: Date | string;
      expires_at: Date | string;
      source: 'native' | 'stripe';
      intent_key: string;
    }[]>`
      SELECT requested_at, expires_at, source, intent_key
      FROM bin_account_re_enrolment_intents
      WHERE user_id = ${userId}::uuid
        AND expires_at > now()
        AND (
          ${cursor?.requestedAt ?? null}::timestamptz IS NULL
          OR (requested_at, source, intent_key) > (
            ${cursor?.requestedAt ?? null}::timestamptz,
            ${cursor?.source ?? null}::text,
            ${cursor?.key ?? null}::text
          )
        )
      ORDER BY requested_at, source, intent_key
      LIMIT ${pageSize}
    `,
    (row) => ({ requestedAt: iso(row.requested_at), source: row.source, key: row.intent_key }),
  ).then((rows) => rows.map(({ intent_key: _secretKey, requested_at, expires_at, source }) => ({
    requestedAt: iso(requested_at),
    expiresAt: iso(expires_at),
    source,
  })));

  return {
    entitlements,
    providerGrants,
    webBilling,
    nativeBillingEvents,
    supportConversations: { threads: supportThreads, messages: supportMessages },
    households,
    householdInvitations,
    accountRemovalState: accountRemovalStates[0]
      ? {
          removedAt: iso(accountRemovalStates[0].removed_at),
          pendingReEnrolments,
        }
      : null,
  };
}

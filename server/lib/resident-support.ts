import type postgres from 'postgres';

import type { BinAccountUser } from './bin-auth';
import { binDatabase } from './bin-database';
import type {
  NewResidentSupportThreadInput,
  ResidentSupportReplyInput,
  ResidentSupportSatisfactionInput,
  ResidentSupportStatus,
  ResidentSupportTopic,
} from './resident-support-validation';

export {
  parseNewResidentSupportThread,
  parseResidentSupportReply,
  parseResidentSupportSatisfaction,
} from './resident-support-validation';

type ThreadRow = {
  id: string;
  council_provider_id: string | null;
  council_name: string | null;
  topic: ResidentSupportTopic;
  subject: string;
  status: ResidentSupportStatus;
  last_sender: 'resident' | 'support';
  last_message_at: Date;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  satisfaction_score: number | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_kind: 'resident' | 'support';
  body: string;
  created_at: Date;
};

const topicLabels: Record<ResidentSupportTopic, string> = {
  'app-help': 'Using the app',
  notifications: 'Notifications',
  address: 'Address or council lookup',
  accessibility: 'Accessibility',
  'app-problem': 'App problem',
  'guide-item': 'Guide item suggestion',
  other: 'Something else',
};

export class ResidentSupportOperationError extends Error {
  readonly code: 'SUPPORT_THREAD_NOT_FOUND' | 'SUPPORT_THREAD_CLOSED' | 'SUPPORT_RATING_NOT_ALLOWED';
  readonly status: 404 | 409;

  constructor(
    code: 'SUPPORT_THREAD_NOT_FOUND' | 'SUPPORT_THREAD_CLOSED' | 'SUPPORT_RATING_NOT_ALLOWED',
    message: string,
    status: 404 | 409,
  ) {
    super(message);
    this.name = 'ResidentSupportOperationError';
    this.code = code;
    this.status = status;
  }
}

function publicMessage(row: MessageRow) {
  return {
    id: row.id,
    sender: row.sender_kind,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}

function publicThread(row: ThreadRow, messages: MessageRow[]) {
  return {
    id: row.id,
    councilProviderId: row.council_provider_id ?? undefined,
    councilName: row.council_name ?? undefined,
    topic: row.topic,
    subject: row.subject,
    status: row.status,
    lastSender: row.last_sender,
    lastMessageAt: row.last_message_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString(),
    satisfactionScore: row.satisfaction_score ?? undefined,
    messages: messages.map(publicMessage),
  };
}

async function residentThreadRows(
  sql: postgres.Sql | postgres.TransactionSql,
  userId: string,
) {
  return sql<ThreadRow[]>`
    SELECT
      id,
      council_provider_id,
      council_name,
      topic,
      subject,
      status,
      last_sender,
      last_message_at,
      created_at,
      updated_at
      ,resolved_at
      ,satisfaction_score
    FROM bin_resident_support_threads
    WHERE resident_user_id = ${userId}::uuid
    ORDER BY last_message_at DESC
    LIMIT 100
  `;
}

export async function listResidentSupportThreads(userId: string) {
  const sql = binDatabase();
  const threads = await residentThreadRows(sql, userId);
  if (!threads.length) return [];
  const threadIds = threads.map((thread) => thread.id);
  const messages = await sql<MessageRow[]>`
    SELECT id, thread_id, sender_kind, body, created_at
    FROM bin_resident_support_messages
    WHERE thread_id = any(${threadIds}::uuid[])
      AND visibility = 'resident'
    ORDER BY created_at, id
    LIMIT 2000
  `;
  const messagesByThread = new Map<string, MessageRow[]>();
  for (const message of messages) {
    const existing = messagesByThread.get(message.thread_id) ?? [];
    existing.push(message);
    messagesByThread.set(message.thread_id, existing);
  }
  return threads.map((thread) => publicThread(thread, messagesByThread.get(thread.id) ?? []));
}

export async function createResidentSupportThread(
  user: BinAccountUser,
  input: NewResidentSupportThreadInput,
) {
  const sql = binDatabase();
  await sql.begin(async (transaction) => {
    const threads = await transaction<{ id: string }[]>`
      INSERT INTO bin_resident_support_threads (
        resident_user_id,
        council_provider_id,
        council_name,
        topic,
        subject,
        client_request_id
      ) VALUES (
        ${user.id}::uuid,
        ${input.councilProviderId ?? null},
        ${input.councilName ?? null},
        ${input.topic},
        ${topicLabels[input.topic]},
        ${input.clientRequestId}::uuid
      )
      ON CONFLICT (resident_user_id, client_request_id)
      DO UPDATE SET resident_user_id = excluded.resident_user_id
      RETURNING id
    `;
    const thread = threads[0];
    if (!thread) throw new Error('The conversation could not be created.');
    await transaction`
      INSERT INTO bin_resident_support_messages (
        thread_id,
        sender_kind,
        sender_user_id,
        body,
        client_message_id
      ) VALUES (
        ${thread.id}::uuid,
        'resident',
        ${user.id}::uuid,
        ${input.detail},
        ${input.clientRequestId}::uuid
      )
      ON CONFLICT DO NOTHING
    `;
  });
  return listResidentSupportThreads(user.id);
}

export async function replyToResidentSupportThread(
  user: BinAccountUser,
  input: ResidentSupportReplyInput,
) {
  const sql = binDatabase();
  await sql.begin(async (transaction) => {
    const threads = await transaction<{ id: string; status: ResidentSupportStatus }[]>`
      SELECT id, status
      FROM bin_resident_support_threads
      WHERE id = ${input.threadId}::uuid
        AND resident_user_id = ${user.id}::uuid
      FOR UPDATE
    `;
    const thread = threads[0];
    if (!thread) throw new ResidentSupportOperationError(
      'SUPPORT_THREAD_NOT_FOUND',
      'That conversation could not be found.',
      404,
    );
    if (thread.status === 'closed') {
      throw new ResidentSupportOperationError(
        'SUPPORT_THREAD_CLOSED',
        'This conversation is closed. Start a new message if you still need help.',
        409,
      );
    }
    const insertedMessages = await transaction<{ id: string }[]>`
      INSERT INTO bin_resident_support_messages (
        thread_id,
        sender_kind,
        sender_user_id,
        body,
        client_message_id
      ) VALUES (
        ${thread.id}::uuid,
        'resident',
        ${user.id}::uuid,
        ${input.detail},
        ${input.clientMessageId}::uuid
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (insertedMessages.length) {
      await transaction`
        UPDATE bin_resident_support_threads
        SET
          status = 'new',
          last_sender = 'resident',
          last_message_at = now(),
          updated_at = now(),
          resolved_at = null,
          satisfaction_score = null,
          reopened_count = reopened_count + CASE WHEN ${thread.status} = 'resolved' THEN 1 ELSE 0 END,
          reopen_reason = CASE WHEN ${thread.status} = 'resolved' THEN 'Resident replied after resolution' ELSE reopen_reason END
        WHERE id = ${thread.id}::uuid
      `;
    }
  });
  return listResidentSupportThreads(user.id);
}

export async function rateResidentSupportThread(
  user: BinAccountUser,
  input: ResidentSupportSatisfactionInput,
) {
  const sql = binDatabase();
  const rows = await sql<{ id: string }[]>`
    UPDATE bin_resident_support_threads
    SET satisfaction_score = ${input.score}, updated_at = now()
    WHERE id = ${input.threadId}::uuid
      AND resident_user_id = ${user.id}::uuid
      AND status IN ('resolved', 'closed')
      AND satisfaction_score IS NULL
    RETURNING id
  `;
  if (!rows[0]) throw new ResidentSupportOperationError(
    'SUPPORT_RATING_NOT_ALLOWED',
    'This conversation cannot be rated.',
    409,
  );
  return listResidentSupportThreads(user.id);
}

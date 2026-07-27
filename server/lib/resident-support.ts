import type postgres from 'postgres';

import type { BinAccountUser } from './bin-auth';
import { binDatabase } from './bin-database';
import type {
  NewResidentSupportThreadInput,
  ResidentSupportReplyInput,
  ResidentSupportStatus,
  ResidentSupportTopic,
} from './resident-support-validation';

export {
  parseNewResidentSupportThread,
  parseResidentSupportReply,
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
    if (!thread) throw new Error('That conversation could not be found.');
    if (thread.status === 'closed') {
      throw new Error('This conversation is closed. Start a new message if you still need help.');
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
          status = 'waiting-support',
          last_sender = 'resident',
          last_message_at = now(),
          updated_at = now(),
          resolved_at = null
        WHERE id = ${thread.id}::uuid
      `;
    }
  });
  return listResidentSupportThreads(user.id);
}

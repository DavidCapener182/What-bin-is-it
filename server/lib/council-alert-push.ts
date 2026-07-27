import { createHash, timingSafeEqual } from 'node:crypto';

import { binDatabase } from './bin-database.ts';
import {
  deliverWebPush,
  parsePushSubscription,
} from './push-reminders.ts';
import type { BrowserPushSubscription } from './push-reminders.ts';

const councilPattern = /^lad-[ensw]\d{8}$/;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const expoPushTokenPattern = /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{20,200}\]$/;
const registrationChannels = new Set(['web-push', 'expo-push']);

type ExpoDelivery = { token: string };
type CouncilAlertDelivery = BrowserPushSubscription | ExpoDelivery;
type CouncilAlertChannel = 'web-push' | 'expo-push';

export type CouncilAlertRegistration = {
  installationId: string;
  councilIds: string[];
  channel: CouncilAlertChannel;
  delivery?: CouncilAlertDelivery;
  enabled: boolean;
};

type RegistrationRow = {
  id: string;
  channel: CouncilAlertChannel;
  delivery_config: CouncilAlertDelivery;
};

type BroadcastJobRow = {
  id: string;
  organisation_id: string;
  provider_id: string;
  channels: string[];
  status: string;
  delivered_count: number;
  failed_count: number;
  title: string;
  body: string;
  content_status: string;
  content_active: boolean;
};

type ExpoTicket = {
  status?: unknown;
  id?: unknown;
  message?: unknown;
  details?: { error?: unknown };
};

function assertExactKeys(value: object, expected: readonly string[], label: string) {
  const allowed = new Set(expected);
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) throw new Error(`${label} contains an unexpected field.`);
}

function parseInstallationId(value: unknown) {
  if (typeof value !== 'string' || !uuidV4Pattern.test(value)) {
    throw new Error('The notification installation ID is invalid.');
  }
  return value.toLowerCase();
}

function parseCouncilIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 10) {
    throw new Error('Up to 10 councils can receive service alerts.');
  }
  const councilIds = [...new Set(value)];
  if (councilIds.some((id) => typeof id !== 'string' || !councilPattern.test(id))) {
    throw new Error('A council alert destination is invalid.');
  }
  return councilIds as string[];
}

export function parseExpoPushToken(value: unknown) {
  if (typeof value !== 'string' || !expoPushTokenPattern.test(value)) {
    throw new Error('The Expo push token is invalid.');
  }
  return value;
}

function parseDelivery(channel: CouncilAlertChannel, value: unknown): CouncilAlertDelivery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A notification delivery credential is required.');
  }
  if (channel === 'web-push') {
    assertExactKeys(value, ['endpoint', 'expirationTime', 'keys'], 'The browser subscription');
    const keys = (value as { keys?: unknown }).keys;
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
      throw new Error('The browser subscription keys are invalid.');
    }
    assertExactKeys(keys, ['p256dh', 'auth'], 'The browser subscription keys');
    return parsePushSubscription(value);
  }
  assertExactKeys(value, ['token'], 'The native notification credential');
  return { token: parseExpoPushToken((value as { token?: unknown }).token) };
}

export function parseCouncilAlertRegistration(value: unknown): CouncilAlertRegistration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The council alert registration is invalid.');
  }
  assertExactKeys(
    value,
    ['installationId', 'councilIds', 'channel', 'delivery', 'enabled'],
    'The council alert registration',
  );
  const input = value as Record<string, unknown>;
  if (typeof input.channel !== 'string' || !registrationChannels.has(input.channel)) {
    throw new Error('The notification channel is invalid.');
  }
  if (typeof input.enabled !== 'boolean') {
    throw new Error('The notification preference is invalid.');
  }
  const registration: CouncilAlertRegistration = {
    installationId: parseInstallationId(input.installationId),
    councilIds: parseCouncilIds(input.councilIds),
    channel: input.channel as CouncilAlertChannel,
    enabled: input.enabled,
  };
  if (input.enabled) registration.delivery = parseDelivery(registration.channel, input.delivery);
  return registration;
}

export function parseCouncilBroadcastRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The council broadcast job is invalid.');
  }
  assertExactKeys(value, ['jobId'], 'The council broadcast request');
  const jobId = (value as { jobId?: unknown }).jobId;
  if (typeof jobId !== 'string' || !uuidV4Pattern.test(jobId)) {
    throw new Error('The council broadcast job is invalid.');
  }
  return { jobId: jobId.toLowerCase() };
}

export function councilBroadcastAuthorised(authorization: string | null) {
  const configured = process.env.COUNCIL_BROADCAST_SECRET?.trim();
  if (!configured || configured.length < 32 || !authorization?.startsWith('Bearer ')) return false;
  const supplied = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function deliveryIdentity(channel: CouncilAlertChannel, delivery: CouncilAlertDelivery) {
  return channel === 'web-push'
    ? (delivery as BrowserPushSubscription).endpoint
    : (delivery as ExpoDelivery).token;
}

export async function syncCouncilAlertRegistration(registration: CouncilAlertRegistration) {
  const sql = binDatabase();
  const requestedCouncils = registration.enabled ? registration.councilIds : [];
  await sql.begin(async (transaction) => {
    await transaction`
      UPDATE bin_council_push_registrations
      SET
        enabled = false,
        disabled_at = now(),
        last_seen_at = now()
      WHERE installation_id = ${registration.installationId}::uuid
        AND channel = ${registration.channel}
        AND enabled
        AND NOT (council_id = ANY(${requestedCouncils}::varchar[]))
    `;
    if (!registration.enabled || !registration.delivery || !requestedCouncils.length) return;
    const tokenHash = createHash('sha256')
      .update(deliveryIdentity(registration.channel, registration.delivery))
      .digest('hex');
    for (const councilId of requestedCouncils) {
      await transaction`
        INSERT INTO bin_council_push_registrations (
          installation_id,
          council_id,
          channel,
          token_hash,
          delivery_config,
          enabled,
          disabled_at,
          last_seen_at,
          last_error_code
        ) VALUES (
          ${registration.installationId}::uuid,
          ${councilId},
          ${registration.channel},
          ${tokenHash},
          ${transaction.json(registration.delivery)},
          true,
          null,
          now(),
          null
        )
        ON CONFLICT (installation_id, council_id, channel) DO UPDATE
        SET
          token_hash = excluded.token_hash,
          delivery_config = excluded.delivery_config,
          enabled = true,
          disabled_at = null,
          last_seen_at = now(),
          last_error_code = null
      `;
    }
  });
  return { enabled: registration.enabled, councilCount: requestedCouncils.length };
}

async function loadBroadcastJob(jobId: string) {
  const sql = binDatabase();
  const rows = await sql<BroadcastJobRow[]>`
    SELECT
      job.id,
      job.organisation_id,
      organisation.provider_id,
      job.channels,
      job.status,
      job.delivered_count,
      job.failed_count,
      coalesce(announcement.title, disruption.title) AS title,
      coalesce(
        announcement.body,
        concat_ws(' ', disruption.detail, disruption.resident_instruction)
      ) AS body,
      coalesce(announcement.status, disruption.status) AS content_status,
      CASE
        WHEN announcement.id IS NOT NULL THEN
          (announcement.starts_at IS NULL OR announcement.starts_at <= now())
          AND (announcement.ends_at IS NULL OR announcement.ends_at > now())
        WHEN disruption.id IS NOT NULL THEN
          disruption.starts_at <= now()
          AND (disruption.ends_at IS NULL OR disruption.ends_at > now())
        ELSE false
      END AS content_active
    FROM bin_council_broadcast_jobs AS job
    INNER JOIN bin_council_organisations AS organisation
      ON organisation.id = job.organisation_id
      AND organisation.status IN ('pilot', 'active')
    LEFT JOIN bin_council_announcements AS announcement
      ON announcement.id = job.announcement_id
      AND announcement.organisation_id = job.organisation_id
    LEFT JOIN bin_council_disruptions AS disruption
      ON disruption.id = job.disruption_id
      AND disruption.organisation_id = job.organisation_id
    WHERE job.id = ${jobId}::uuid
    LIMIT 1
  `;
  return rows[0];
}

async function recordReceipt(
  jobId: string,
  registration: RegistrationRow,
  status: 'accepted' | 'failed' | 'expired',
  providerTicketId?: string,
  errorCode?: string,
) {
  const sql = binDatabase();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO bin_council_broadcast_receipts (
        broadcast_job_id,
        registration_id,
        channel,
        status,
        provider_ticket_id,
        error_code
      ) VALUES (
        ${jobId}::uuid,
        ${registration.id}::uuid,
        ${registration.channel},
        ${status},
        ${providerTicketId ?? null},
        ${errorCode ?? null}
      )
      ON CONFLICT (broadcast_job_id, registration_id) DO NOTHING
    `;
    await transaction`
      UPDATE bin_council_push_registrations
      SET
        last_delivery_at = CASE WHEN ${status} = 'accepted' THEN now() ELSE last_delivery_at END,
        last_error_code = ${errorCode ?? null},
        enabled = CASE WHEN ${status} = 'expired' THEN false ELSE enabled END,
        disabled_at = CASE WHEN ${status} = 'expired' THEN now() ELSE disabled_at END
      WHERE id = ${registration.id}::uuid
    `;
  });
}

async function deliverExpoPush(
  registrations: RegistrationRow[],
  notification: { title: string; body: string; jobId: string },
) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate',
      'content-type': 'application/json',
    },
    body: JSON.stringify(registrations.map((registration) => ({
      to: (registration.delivery_config as ExpoDelivery).token,
      title: notification.title,
      body: notification.body,
      sound: 'default',
      priority: 'high',
      channelId: 'bin-reminders',
      data: { kind: 'council-service-alert', url: '/', broadcastJobId: notification.jobId },
    }))),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`expo-http-${response.status}`);
  const payload = await response.json() as { data?: unknown };
  const tickets = Array.isArray(payload.data) ? payload.data as ExpoTicket[] : [];
  if (tickets.length !== registrations.length) throw new Error('expo-ticket-count');
  return tickets;
}

function safeErrorCode(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value : fallback;
  return text.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64) || fallback;
}

export async function processCouncilBroadcast(jobId: string) {
  const sql = binDatabase();
  const job = await loadBroadcastJob(jobId);
  if (!job) throw new Error('The authorised council broadcast job was not found.');
  if (job.status === 'completed' || job.status === 'cancelled') {
    return {
      jobId: job.id,
      status: job.status,
      accepted: job.delivered_count,
      failed: job.failed_count,
    };
  }
  if (job.content_status !== 'published' || !job.content_active) {
    await sql`
      UPDATE bin_council_broadcast_jobs
      SET status = 'cancelled', completed_at = now(), error_code = 'content-not-active'
      WHERE id = ${job.id}::uuid
    `;
    return { jobId: job.id, status: 'cancelled', accepted: 0, failed: 0 };
  }
  const claimed = await sql<{ id: string }[]>`
    UPDATE bin_council_broadcast_jobs
    SET status = 'processing', started_at = coalesce(started_at, now()), error_code = null
    WHERE id = ${job.id}::uuid
      AND status IN ('queued', 'failed')
    RETURNING id
  `;
  if (!claimed[0]) {
    const current = await loadBroadcastJob(job.id);
    return {
      jobId: job.id,
      status: current?.status ?? job.status,
      accepted: current?.delivered_count ?? job.delivered_count,
      failed: current?.failed_count ?? job.failed_count,
    };
  }

  await sql`
    DELETE FROM bin_council_push_registrations
    WHERE council_id = ${job.provider_id}
      AND (
        last_seen_at < now() - interval '180 days'
        OR (NOT enabled AND disabled_at < now() - interval '30 days')
      )
  `;
  const requestedChannels = new Set(job.channels);
  const registrations = await sql<RegistrationRow[]>`
    SELECT registration.id, registration.channel, registration.delivery_config
    FROM bin_council_push_registrations AS registration
    WHERE registration.council_id = ${job.provider_id}
      AND registration.enabled
      AND (
        (registration.channel = 'web-push' AND ${requestedChannels.has('web-push')})
        OR (registration.channel = 'expo-push' AND ${requestedChannels.has('native-push')})
      )
      AND NOT EXISTS (
        SELECT 1
        FROM bin_council_broadcast_receipts AS receipt
        WHERE receipt.broadcast_job_id = ${job.id}::uuid
          AND receipt.registration_id = registration.id
      )
    ORDER BY registration.channel, registration.id
  `;
  const title = job.title.trim().slice(0, 80);
  const body = job.body.trim().replace(/\s+/g, ' ').slice(0, 180);

  for (const registration of registrations.filter((item) => item.channel === 'web-push')) {
    try {
      const outcome = await deliverWebPush(
        parsePushSubscription(registration.delivery_config),
        {
          id: job.id,
          title,
          body,
          url: '/',
          tag: `council-alert-${job.id}`,
        },
      );
      await recordReceipt(
        job.id,
        registration,
        outcome === 'expired' ? 'expired' : 'accepted',
        undefined,
        outcome === 'expired' ? 'subscription-expired' : undefined,
      );
    } catch (error) {
      await recordReceipt(job.id, registration, 'failed', undefined, safeErrorCode(
        error instanceof Error ? error.message : undefined,
        'web-push-failed',
      ));
    }
  }

  const expoRegistrations = registrations.filter((item) => item.channel === 'expo-push');
  for (let start = 0; start < expoRegistrations.length; start += 100) {
    const batch = expoRegistrations.slice(start, start + 100);
    try {
      const tickets = await deliverExpoPush(batch, { title, body, jobId: job.id });
      for (let index = 0; index < batch.length; index += 1) {
        const ticket = tickets[index] ?? {};
        const errorCode = typeof ticket.details?.error === 'string'
          ? safeErrorCode(ticket.details.error, 'expo-push-failed')
          : undefined;
        const expired = errorCode === 'DeviceNotRegistered';
        await recordReceipt(
          job.id,
          batch[index],
          ticket.status === 'ok' ? 'accepted' : expired ? 'expired' : 'failed',
          typeof ticket.id === 'string' ? ticket.id.slice(0, 160) : undefined,
          errorCode ?? (ticket.status === 'ok' ? undefined : 'expo-push-failed'),
        );
      }
    } catch (error) {
      for (const registration of batch) {
        await recordReceipt(job.id, registration, 'failed', undefined, safeErrorCode(
          error instanceof Error ? error.message : undefined,
          'expo-push-failed',
        ));
      }
    }
  }

  const counts = await sql<{ accepted: number; failed: number }[]>`
    SELECT
      count(*) FILTER (WHERE status = 'accepted')::int AS accepted,
      count(*) FILTER (WHERE status IN ('failed', 'expired'))::int AS failed
    FROM bin_council_broadcast_receipts
    WHERE broadcast_job_id = ${job.id}::uuid
  `;
  const accepted = counts[0]?.accepted ?? 0;
  const failed = counts[0]?.failed ?? 0;
  await sql`
    UPDATE bin_council_broadcast_jobs
    SET
      status = 'completed',
      completed_at = now(),
      delivered_count = ${accepted},
      failed_count = ${failed},
      error_code = null
    WHERE id = ${job.id}::uuid
  `;
  return { jobId: job.id, status: 'completed', accepted, failed };
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import webPush from 'web-push';

export type BrowserPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushReminderPayload = {
  id: string;
  collectionId: string;
  triggerAt: string;
  title: string;
  body: string;
  url: '/' | '/schedule';
  tag: string;
};

const trustedPushHosts = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
];
const trustedPushSuffixes = [
  '.push.apple.com',
  '.push.services.mozilla.com',
  '.notify.windows.com',
];
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

export function isTrustedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 20 || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (
        trustedPushHosts.includes(url.hostname)
        || trustedPushSuffixes.some((suffix) => url.hostname.endsWith(suffix))
      );
  } catch {
    return false;
  }
}

function validSubscriptionKey(value: unknown, maximum: number): value is string {
  return typeof value === 'string'
    && value.length >= 16
    && value.length <= maximum
    && base64UrlPattern.test(value);
}

export function parsePushSubscription(value: unknown): BrowserPushSubscription {
  if (!value || typeof value !== 'object') {
    throw new Error('A browser push subscription is required.');
  }
  const subscription = value as {
    endpoint?: unknown;
    expirationTime?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  if (!isTrustedPushEndpoint(subscription.endpoint)) {
    throw new Error('The subscription is not from a recognised browser push service.');
  }
  if (
    subscription.expirationTime !== null
    && subscription.expirationTime !== undefined
    && (
      typeof subscription.expirationTime !== 'number'
      || !Number.isFinite(subscription.expirationTime)
      || subscription.expirationTime < 0
    )
  ) {
    throw new Error('The browser push subscription expiry is invalid.');
  }
  if (
    !validSubscriptionKey(p256dh, 180)
    || !validSubscriptionKey(auth, 80)
  ) {
    throw new Error('The browser push subscription keys are invalid.');
  }
  return {
    endpoint: subscription.endpoint,
    expirationTime: typeof subscription.expirationTime === 'number'
      ? subscription.expirationTime
      : null,
    keys: {
      p256dh,
      auth,
    },
  };
}

export function parsePushReminders(value: unknown, now = new Date()): PushReminderPayload[] {
  if (!Array.isArray(value) || value.length > 48) {
    throw new Error('Up to 48 reminders can be scheduled at once.');
  }
  const earliest = now.getTime() + 5_000;
  const latest = now.getTime() + (366 * 24 * 60 * 60 * 1_000);
  const seen = new Set<string>();
  const reminders = value.map((item): PushReminderPayload => {
    if (!item || typeof item !== 'object') throw new Error('A reminder is invalid.');
    const reminder = item as Record<string, unknown>;
    const triggerTime = typeof reminder.triggerAt === 'string'
      ? Date.parse(reminder.triggerAt)
      : Number.NaN;
    if (!Number.isFinite(triggerTime) || triggerTime < earliest || triggerTime > latest) {
      throw new Error('Every reminder must have a future delivery time within one year.');
    }
    if (
      typeof reminder.id !== 'string'
      || reminder.id.length < 1
      || reminder.id.length > 240
      || seen.has(reminder.id)
    ) {
      throw new Error('Every reminder needs a unique ID.');
    }
    if (
      typeof reminder.collectionId !== 'string'
      || reminder.collectionId.length < 1
      || reminder.collectionId.length > 180
    ) {
      throw new Error('A reminder collection ID is invalid.');
    }
    if (
      typeof reminder.body !== 'string'
      || reminder.body.length < 1
      || reminder.body.length > 180
    ) {
      throw new Error('A reminder message is invalid.');
    }
    if (
      typeof reminder.title !== 'string'
      || reminder.title.length < 1
      || reminder.title.length > 80
    ) {
      throw new Error('A reminder title is invalid.');
    }
    if (reminder.url !== '/' && reminder.url !== '/schedule') {
      throw new Error('A reminder destination is invalid.');
    }
    seen.add(reminder.id);
    return {
      id: reminder.id,
      collectionId: reminder.collectionId,
      triggerAt: new Date(triggerTime).toISOString(),
      title: reminder.title,
      body: reminder.body,
      url: reminder.url,
      tag: `reminder-${reminder.id}`.slice(0, 220),
    };
  });
  return reminders.sort((left, right) => left.triggerAt.localeCompare(right.triggerAt));
}

export function vapidConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (
    !publicKey
    || !privateKey
    || !base64UrlPattern.test(publicKey)
    || !base64UrlPattern.test(privateKey)
  ) {
    throw new Error('Web push is not configured for this deployment.');
  }
  return { publicKey, privateKey };
}

export function signRunId(runId: string, secret: string) {
  return createHmac('sha256', secret).update(runId).digest('base64url');
}

export function verifyRunToken(runId: string, token: string, secret: string) {
  if (!runId || !token || token.length > 100) return false;
  const expected = signRunId(runId, secret);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  return expectedBuffer.length === tokenBuffer.length
    && timingSafeEqual(expectedBuffer, tokenBuffer);
}

export async function deliverWebPush(
  subscription: BrowserPushSubscription,
  reminder: {
    id: string;
    title: string;
    body: string;
    url: string;
    tag: string;
  }
) {
  const { publicKey, privateKey } = vapidConfiguration();
  webPush.setVapidDetails(
    'https://what-bin-is-it-tonight.vercel.app',
    publicKey,
    privateKey
  );
  try {
    await webPush.sendNotification(subscription, JSON.stringify({
      title: reminder.title,
      body: reminder.body,
      url: reminder.url,
      tag: reminder.tag,
      reminderId: reminder.id,
    }), {
      TTL: 86_400,
      urgency: 'high',
    });
    return 'accepted' as const;
  } catch (error) {
    const statusCode = (
      error
      && typeof error === 'object'
      && 'statusCode' in error
      && typeof error.statusCode === 'number'
    ) ? error.statusCode : undefined;
    if (statusCode === 404 || statusCode === 410) return 'expired' as const;
    throw error;
  }
}

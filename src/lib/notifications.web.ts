import { planCollectionReminders, PlannedReminder } from '@/lib/reminder-plan';
import { getPwaInstallStatus } from '@/lib/pwa-install.web';
import { Collection, NotificationPreferences } from '@/lib/types';

type PushRunReference = {
  runId: string;
  token: string;
  scheduledCount: number;
  nextTriggerAt?: string;
  syncedAt: string;
};

export type WebNotificationStatus = {
  state: 'unsupported' | 'off' | 'permission-required' | 'ready' | 'syncing' | 'scheduled' | 'error';
  message: string;
  scheduledCount: number;
  permission: NotificationPermission | 'unsupported';
};

const scheduleStorageKey = '@what-bin-is-it-tonight/web-push-run-v1';
const alertInstallationStorageKey = '@what-bin-is-it-tonight/alert-installation-v1';
const statusListeners = new Set<() => void>();
const serverNotificationStatus: WebNotificationStatus = {
  state: 'unsupported',
  message: 'This browser does not support app notifications.',
  scheduledCount: 0,
  permission: 'unsupported',
};
let currentStatus: WebNotificationStatus = initialStatus();

function browserAvailable() {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function notificationPermission(): WebNotificationStatus['permission'] {
  return browserAvailable() && 'Notification' in window
    ? Notification.permission
    : 'unsupported';
}

function initialStatus(): WebNotificationStatus {
  const permission = notificationPermission();
  if (permission === 'unsupported') {
    const install = getPwaInstallStatus();
    return {
      state: 'unsupported',
      message: install.isIos && !install.installed
        ? 'Install the app from Safari to enable reminders. Add it to your Home Screen, then open the new app icon.'
        : 'This browser cannot send reminders. Try Safari on iPhone or Chrome on Android.',
      scheduledCount: 0,
      permission,
    };
  }
  if (permission !== 'granted') {
    const install = getPwaInstallStatus();
    return {
      state: 'permission-required',
      message: install.isIos && !install.installed
        ? 'Install the app to enable reminders. Add it to your Home Screen, then open the installed app.'
        : 'Notifications are off. Enable reminders for this place when you are ready.',
      scheduledCount: 0,
      permission,
    };
  }
  return {
    state: 'ready',
    message: 'Notifications are allowed. Verified dates can now be scheduled.',
    scheduledCount: 0,
    permission,
  };
}

function setStatus(status: WebNotificationStatus) {
  currentStatus = status;
  statusListeners.forEach((listener) => listener());
}

export function getWebNotificationStatus() {
  return currentStatus;
}

export function getServerWebNotificationStatus() {
  return serverNotificationStatus;
}

export function subscribeWebNotificationStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function parseResponseError(value: unknown, fallback: string) {
  return value
    && typeof value === 'object'
    && 'error' in value
    && typeof value.error === 'string'
    ? value.error
    : fallback;
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => undefined) as unknown;
  if (!response.ok) throw new Error(parseResponseError(payload, `Request failed with ${response.status}.`));
  return payload as T;
}

function notificationApiPath(path: string) {
  const configured = process.env.EXPO_PUBLIC_COUNCIL_API_BASE?.replace(/\/$/, '');
  if (!configured || !path.startsWith('/api/')) return path;
  return `${configured}${path.slice('/api'.length)}`;
}

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function serviceWorkerRegistration() {
  if (!browserAvailable() || !('serviceWorker' in navigator)) {
    throw new Error('This browser cannot install the notification service.');
  }
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

async function pushSubscription() {
  const registration = await serviceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  const config = await jsonRequest<{ enabled: boolean; publicKey: string }>('/api/push/config');
  if (!config.enabled || !config.publicKey) {
    throw new Error('Web push is not configured for this app yet.');
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(config.publicKey),
  });
}

function alertInstallationId() {
  if (!browserAvailable()) return undefined;
  const existing = localStorage.getItem(alertInstallationStorageKey);
  if (existing) return existing;
  const id = globalThis.crypto?.randomUUID?.();
  if (!id) return undefined;
  localStorage.setItem(alertInstallationStorageKey, id);
  return id;
}

export async function syncCouncilAlertRegistration(councilIds: string[], enabled: boolean) {
  if (!browserAvailable()) return;
  const installationId = alertInstallationId();
  if (!installationId) return;
  const canDeliver = enabled
    && councilIds.length > 0
    && notificationPermission() === 'granted';
  const delivery = canDeliver ? (await pushSubscription()).toJSON() : undefined;
  await jsonRequest<{ councilCount: number; enabled: boolean }>(
    notificationApiPath('/api/push/registrations'),
    {
    method: 'POST',
    body: JSON.stringify({
      installationId,
      councilIds,
      channel: 'web-push',
      delivery,
      enabled: canDeliver,
    }),
    },
  );
}

function readPreviousRun(): PushRunReference | undefined {
  if (!browserAvailable()) return undefined;
  try {
    const value = JSON.parse(localStorage.getItem(scheduleStorageKey) ?? 'null') as Partial<PushRunReference> | null;
    if (
      !value
      || typeof value.runId !== 'string'
      || typeof value.token !== 'string'
      || typeof value.scheduledCount !== 'number'
      || typeof value.syncedAt !== 'string'
    ) return undefined;
    return value as PushRunReference;
  } catch {
    return undefined;
  }
}

function storeRun(value: PushRunReference | undefined) {
  if (!browserAvailable()) return;
  if (value) localStorage.setItem(scheduleStorageKey, JSON.stringify(value));
  else localStorage.removeItem(scheduleStorageKey);
}

export async function requestNotificationPermission() {
  const permission = notificationPermission();
  if (permission === 'unsupported') {
    const reason = 'This browser does not support app notifications.';
    setStatus({ state: 'unsupported', message: reason, scheduledCount: 0, permission });
    return { granted: false, reason };
  }
  if (getPwaInstallStatus().isIos && !getPwaInstallStatus().installed) {
    const reason = 'On iPhone, first add this app to your Home Screen, then open the new app icon and turn reminders on.';
    setStatus({ state: 'permission-required', message: reason, scheduledCount: 0, permission });
    return { granted: false, reason };
  }
  const result = permission === 'granted'
    ? permission
    : await Notification.requestPermission();
  if (result !== 'granted') {
    const reason = result === 'denied'
      ? 'Notifications are blocked. Allow them in your browser or phone settings.'
      : 'Notification permission was not granted.';
    setStatus({ state: 'permission-required', message: reason, scheduledCount: 0, permission: result });
    return { granted: false, reason };
  }
  try {
    await pushSubscription();
    const previous = readPreviousRun();
    setStatus({
      state: previous?.scheduledCount ? 'scheduled' : 'ready',
      message: previous?.scheduledCount
        ? `${previous.scheduledCount} verified collection reminder${previous.scheduledCount === 1 ? '' : 's'} scheduled.`
        : 'Notifications are ready. Verified dates can now be scheduled.',
      scheduledCount: previous?.scheduledCount ?? 0,
      permission: 'granted',
    });
    return { granted: true, reason: undefined };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The notification service could not be enabled.';
    setStatus({ state: 'error', message: reason, scheduledCount: 0, permission: 'granted' });
    return { granted: false, reason };
  }
}

export async function rescheduleCollectionReminders(
  collections: Collection[],
  preferences: NotificationPreferences
) {
  return reschedulePlannedReminders(
    planCollectionReminders(collections, preferences),
    preferences.enabled,
  );
}

export async function reschedulePlannedReminders(
  reminders: PlannedReminder[],
  enabled: boolean,
) {
  if (!browserAvailable()) return;
  const previous = readPreviousRun();

  if (!enabled || reminders.length === 0) {
    if (previous) {
      setStatus({
        state: 'syncing',
        message: 'Updating your reminder schedule…',
        scheduledCount: previous.scheduledCount,
        permission: notificationPermission(),
      });
      await jsonRequest<{ scheduledCount: number }>('/api/push/reminders', {
        method: 'POST',
        body: JSON.stringify({ reminders: [], previous }),
      });
      storeRun(undefined);
    }
    setStatus({
      state: enabled ? 'ready' : 'off',
      message: enabled
        ? 'Notifications are ready. Add verified collection dates to schedule reminders.'
        : 'Bin reminders are switched off.',
      scheduledCount: 0,
      permission: notificationPermission(),
    });
    return;
  }

  if (notificationPermission() !== 'granted') {
    setStatus({
      state: 'permission-required',
      message: 'Open Settings and allow notifications before reminders can be scheduled.',
      scheduledCount: 0,
      permission: notificationPermission(),
    });
    return;
  }

  setStatus({
    state: 'syncing',
    message: 'Scheduling reminders for your verified collection dates…',
    scheduledCount: previous?.scheduledCount ?? 0,
    permission: 'granted',
  });
  try {
    const subscription = await pushSubscription();
    const result = await jsonRequest<{
      runId: string;
      token: string;
      scheduledCount: number;
      nextTriggerAt?: string;
    }>('/api/push/reminders', {
      method: 'POST',
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        previous,
        reminders: reminders.map((reminder) => ({
          ...reminder,
          triggerAt: reminder.triggerAt.toISOString(),
        })),
      }),
    });
    storeRun({ ...result, syncedAt: new Date().toISOString() });
    setStatus({
      state: 'scheduled',
      message: `${result.scheduledCount} verified collection reminder${result.scheduledCount === 1 ? '' : 's'} scheduled.`,
      scheduledCount: result.scheduledCount,
      permission: 'granted',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The reminder schedule could not be updated.';
    setStatus({
      state: 'error',
      message,
      scheduledCount: previous?.scheduledCount ?? 0,
      permission: 'granted',
    });
    throw error;
  }
}

export async function sendTestWebNotification() {
  const permission = await requestNotificationPermission();
  if (!permission.granted) throw new Error(permission.reason);
  setStatus({
    state: 'syncing',
    message: 'Sending a test notification through the push service…',
    scheduledCount: readPreviousRun()?.scheduledCount ?? 0,
    permission: 'granted',
  });
  try {
    const subscription = await pushSubscription();
    await jsonRequest<{ delivered: true }>('/api/push/test', {
      method: 'POST',
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    const previous = readPreviousRun();
    setStatus({
      state: previous?.scheduledCount ? 'scheduled' : 'ready',
      message: 'Test sent. It should appear as an app notification now.',
      scheduledCount: previous?.scheduledCount ?? 0,
      permission: 'granted',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The test notification could not be sent.';
    setStatus({
      state: 'error',
      message,
      scheduledCount: readPreviousRun()?.scheduledCount ?? 0,
      permission: 'granted',
    });
    throw error;
  }
}

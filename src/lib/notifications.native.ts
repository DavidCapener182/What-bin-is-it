import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { planCollectionReminders, PlannedReminder } from '@/lib/reminder-plan';
import { Collection, CouncilAlertSubscription, NotificationPreferences } from '@/lib/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const channelId = 'bin-reminders';
const reminderKind = 'collection-reminder';
const alertInstallationStorageKey = '@what-bin-is-it-tonight/alert-installation-v1';
let reminderQueue = Promise.resolve();

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: 'Bin reminders and service alerts',
    description: 'Collection reminders and verified council service changes',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#0062CC',
    sound: 'default',
  });
}

function hasNotificationPermission(status: Notifications.NotificationPermissionsStatus) {
  if (Platform.OS !== 'ios') return status.granted;
  const iosStatus = status.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED
    || iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL
    || iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export async function requestNotificationPermission() {
  await ensureAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  const finalStatus = hasNotificationPermission(existing)
    ? existing
    : await Notifications.requestPermissionsAsync();
  const granted = hasNotificationPermission(finalStatus);
  return {
    granted,
    reason: granted ? undefined : 'Permission was not granted. You can enable it in your phone settings.',
  };
}

async function alertInstallationId() {
  const existing = await AsyncStorage.getItem(alertInstallationStorageKey);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(alertInstallationStorageKey, id);
  return id;
}

function alertRegistrationUrl() {
  const apiBase = process.env.EXPO_PUBLIC_COUNCIL_API_BASE?.replace(/\/$/, '')
    || 'https://what-bin-is-it-tonight.vercel.app/api';
  return `${apiBase}/push/registrations`;
}

export async function syncCouncilAlertRegistration(
  subscriptions: CouncilAlertSubscription[],
  enabled: boolean,
) {
  await ensureAndroidChannel();
  const installationId = await alertInstallationId();
  const permission = await Notifications.getPermissionsAsync();
  const canDeliver = enabled && subscriptions.length > 0 && hasNotificationPermission(permission);
  let delivery: { token: string } | undefined;
  if (canDeliver) {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('The native notification project is not configured.');
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    delivery = { token: token.data };
  }
  const response = await fetch(alertRegistrationUrl(), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      installationId,
      subscriptions,
      channel: 'expo-push',
      delivery,
      enabled: canDeliver,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined) as { error?: unknown } | undefined;
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : `The council alert registration failed with ${response.status}.`,
    );
  }
}

async function cancelCollectionReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((request) => (
      request.content.data?.kind === reminderKind
      || (request.content.data?.url === '/schedule' && typeof request.content.data?.collectionId === 'string')
    ))
    .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
}

async function reconcilePlannedReminders(reminders: PlannedReminder[], enabled: boolean) {
  await ensureAndroidChannel();
  await cancelCollectionReminders();
  if (!enabled) return;
  await Promise.all(
    reminders.map(async (reminder) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { kind: reminderKind, url: reminder.url, collectionId: reminder.collectionId },
          sound: 'default',
        },
        trigger: Platform.OS === 'android'
          ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.triggerAt, channelId }
          : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.triggerAt },
      });
    })
  );
}

export function rescheduleCollectionReminders(collections: Collection[], preferences: NotificationPreferences) {
  return reschedulePlannedReminders(
    planCollectionReminders(collections, preferences),
    preferences.enabled,
  );
}

export function reschedulePlannedReminders(reminders: PlannedReminder[], enabled: boolean) {
  const task = reminderQueue.then(() => reconcilePlannedReminders(reminders, enabled));
  reminderQueue = task.catch(() => undefined);
  return task;
}

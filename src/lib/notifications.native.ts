import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { planCollectionReminders, PlannedReminder } from '@/lib/reminder-plan';
import { Collection, NotificationPreferences } from '@/lib/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const channelId = 'bin-reminders';
const reminderKind = 'collection-reminder';
let reminderQueue = Promise.resolve();

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: 'Bin reminders',
    description: 'A gentle reminder before your collection day',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#007AFF',
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

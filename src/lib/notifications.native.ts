import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { collectionDisplayMeta, sortCollections } from '@/lib/data';
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
    lightColor: '#0E9F6E',
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
      || (request.content.data?.url === '/calendar' && typeof request.content.data?.collectionId === 'string')
    ))
    .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
}

async function reconcileCollectionReminders(collections: Collection[], preferences: NotificationPreferences) {
  await ensureAndroidChannel();
  await cancelCollectionReminders();
  if (!preferences.enabled) return;

  const now = new Date();
  const eligible = sortCollections(collections)
    .filter((collection) => preferences.wasteTypes[collection.wasteType])
    .slice(0, 48);
  await Promise.all(
    eligible.map(async (collection) => {
      const trigger = new Date(`${collection.date}T12:00:00`);
      trigger.setDate(trigger.getDate() - preferences.reminderDayOffset);
      trigger.setHours(preferences.reminderHour, 0, 0, 0);
      if (trigger <= now) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Bin reminder',
          body: `${collectionDisplayMeta(collection).label} collection is ${preferences.reminderDayOffset === 0 ? 'today' : 'tomorrow'}. Put it out before 7am.`,
          data: { kind: reminderKind, url: '/calendar', collectionId: collection.id },
          sound: 'default',
        },
        trigger: Platform.OS === 'android' ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger, channelId } : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      });
    })
  );
}

export function rescheduleCollectionReminders(collections: Collection[], preferences: NotificationPreferences) {
  const task = reminderQueue.then(() => reconcileCollectionReminders(collections, preferences));
  reminderQueue = task.catch(() => undefined);
  return task;
}

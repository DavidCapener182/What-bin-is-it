import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { Collection, NotificationPreferences } from '@/lib/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const channelId = 'bin-reminders';

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return { granted: false, reason: 'Notifications are available in the mobile app.' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'Bin reminders',
      description: 'A gentle reminder before your collection day',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#0E9F6E',
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted ? existing.status : (await Notifications.requestPermissionsAsync()).status;
  return { granted: status === 'granted', reason: status === 'granted' ? undefined : 'Permission was not granted. You can enable it in your phone settings.' };
}

export async function rescheduleCollectionReminders(collections: Collection[], preferences: NotificationPreferences) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!preferences.enabled) return;

  const now = new Date();
  const eligible = collections.filter((collection) => preferences.wasteTypes[collection.wasteType]);
  await Promise.all(
    eligible.map(async (collection) => {
      const trigger = new Date(`${collection.date}T12:00:00`);
      trigger.setDate(trigger.getDate() - preferences.reminderDayOffset);
      trigger.setHours(preferences.reminderHour, 0, 0, 0);
      if (trigger <= now) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Bin reminder',
          body: `${collection.wasteType === 'general' ? 'General waste' : collection.wasteType[0].toUpperCase() + collection.wasteType.slice(1)} collection is tomorrow. Put it out before 7am.`,
          data: { url: '/calendar', collectionId: collection.id },
        },
        trigger: Platform.OS === 'android' ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger, channelId } : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
      });
    })
  );
}

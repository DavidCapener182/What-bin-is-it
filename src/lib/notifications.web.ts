import { Collection, NotificationPreferences } from '@/lib/types';

export async function requestNotificationPermission() {
  return { granted: false, reason: 'Notifications are available in the mobile app.' };
}

export async function rescheduleCollectionReminders(
  _collections: Collection[],
  _preferences: NotificationPreferences
) {
  // The web deployment is a product preview; reminders are scheduled by the native apps.
}

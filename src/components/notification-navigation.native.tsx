import { Href, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { approvedNativeNotificationPath } from '@/lib/notification-routes';

export function NotificationNavigation() {
  useEffect(() => {
    const openNotification = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      const target = approvedNativeNotificationPath(url);
      if (target) router.push(target as Href);
    };
    const initialResponse = Notifications.getLastNotificationResponse();
    if (initialResponse?.notification) openNotification(initialResponse.notification);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotification(response.notification);
    });
    return () => subscription.remove();
  }, []);

  return null;
}

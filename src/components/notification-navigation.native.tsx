import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

export function NotificationNavigation() {
  useEffect(() => {
    const openNotification = (notification: Notifications.Notification) => {
      if (notification.request.content.data?.url === '/calendar') router.push('/calendar');
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

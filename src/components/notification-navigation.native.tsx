import { Href, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

export function NotificationNavigation() {
  useEffect(() => {
    const openNotification = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (url === '/schedule') router.push('/schedule');
      else if (url === '/reports' || url === '/activity') router.push('/activity' as Href);
      else if (url === '/') router.push('/');
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

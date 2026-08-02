import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import type { CollectionLiveSurfaceSnapshot } from './collection-live-surface-data.ts';

const storageKey = '@what-bin-is-it-tonight/bin-night-notification-v1';
const channelId = 'bin-night-status';

type StoredNotification = { id: string; signature: string };

async function storedNotification() {
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredNotification>;
    return typeof parsed.id === 'string' && typeof parsed.signature === 'string'
      ? parsed as StoredNotification
      : undefined;
  } catch {
    return undefined;
  }
}

export async function syncCollectionLiveSurface(snapshot?: CollectionLiveSurfaceSnapshot) {
  const previous = await storedNotification();
  if (!snapshot || snapshot.state === 'collected') {
    if (previous) await Notifications.dismissNotificationAsync(previous.id).catch(() => undefined);
    await AsyncStorage.removeItem(storageKey);
    return;
  }
  const signature = `${snapshot.activityKey}:${snapshot.state}`;
  if (previous?.signature === signature) return;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: 'Bin-night status',
    description: 'An optional collection status notification shown only on bin night and collection day.',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: snapshot.binColour,
  });
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: snapshot.headline,
      body: `${snapshot.status} · ${snapshot.placeLabel}`,
      data: { kind: 'bin-night-status', url: '/' },
      color: snapshot.binColour,
    },
    trigger: null,
  });
  if (previous) await Notifications.dismissNotificationAsync(previous.id).catch(() => undefined);
  await AsyncStorage.setItem(storageKey, JSON.stringify({ id, signature } satisfies StoredNotification));
}

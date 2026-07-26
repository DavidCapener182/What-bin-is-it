import { Platform, Share } from 'react-native';

import { collectionDisplayMeta, formatCollectionDate, sortCollections } from '@/lib/data';
import { collectionCalendar, collectionReminderMessage } from '@/lib/schedule-format';
import { Collection, SavedAddress, WasteType } from '@/lib/types';

export { collectionCalendar, collectionReminderMessage } from '@/lib/schedule-format';

export function downloadCollectionCalendar(collections: Collection[], address: SavedAddress) {
  const calendar = collectionCalendar(collections, address);
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(calendar)}`;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
  link.download = `bin-collections-${address.postcode.replace(/\s/g, '-').toLowerCase()}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
  return undefined;
}

export async function shareCollectionSchedule(collections: Collection[], address: SavedAddress) {
  const lines = sortCollections(collections).slice(0, 12).map((collection) => (
    `${formatCollectionDate(collection.date, 'weekday')}: ${collectionDisplayMeta(collection).label}`
  ));
  return Share.share({
    title: `Bin collections for ${address.label}`,
    message: [`Bin collections for ${address.label}`, address.postcode, '', ...lines, '', 'Shared from What Bin Is It Tonight?'].join('\n'),
  });
}

export async function shareCollectionReminder(collections: Collection[], address: SavedAddress) {
  return Share.share({
    title: 'Bins tonight',
    message: collectionReminderMessage(collections, address),
  });
}

export async function shareSavedPlace(address: SavedAddress) {
  return Share.share({
    title: `Bin collection place: ${address.label}`,
    message: [
      address.label,
      address.line1,
      address.postcode,
      address.councilName,
      '',
      'Shared from What Bin Is It Tonight?',
    ].join('\n'),
  });
}

export function collectionSubscriptionUrl(address: SavedAddress, wasteTypes: WasteType[]) {
  const origin = Platform.OS === 'web' && typeof globalThis.location?.origin === 'string'
    ? globalThis.location.origin
    : 'https://what-bin-is-it-tonight.vercel.app';
  const query = new URLSearchParams({
    postcode: address.postcode,
    providerId: address.providerId,
    wasteTypes: wasteTypes.join(','),
  });
  if (address.councilAddressId) query.set('addressId', address.councilAddressId);
  return `${origin}/api/v1/calendar?${query.toString()}`;
}

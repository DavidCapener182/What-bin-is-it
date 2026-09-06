type DatedCollection = { date: string };

export function collectionDayKey(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export function hasUpcomingCollections(collections: DatedCollection[], now = new Date()) {
  const today = collectionDayKey(now);
  return collections.some((collection) => collection.date >= today);
}

export function collectionDataStateFor(
  schedule: { collections: DatedCollection[]; lastError?: string },
  now = new Date(),
): 'ready' | 'cached' | 'empty' | 'error' {
  if (hasUpcomingCollections(schedule.collections, now)) return schedule.lastError ? 'cached' : 'ready';
  return schedule.lastError ? 'error' : 'empty';
}

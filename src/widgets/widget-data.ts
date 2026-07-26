import { verifiedCollectionsOnly } from '../lib/collection-safety.ts';
import {
  collectionDisplayMeta,
  contrastTextForColour,
  formatCollectionDate,
  primaryCollectionForDate,
  sortCollections,
} from '../lib/data.ts';
import type { Collection, SavedAddress } from '../lib/types.ts';

export const appDataStorageKey = '@what-bin-is-it-tonight/state-v4';
export const collectionWidgetName = 'NextCollectionWidget';

export type CollectionWidgetSnapshot = {
  kicker: string;
  headline: string;
  detail: string;
  addressLabel: string;
  councilLabel: string;
  binColour: `#${string}`;
  foregroundColour: '#0F2A3A' | '#FFFFFF';
  secondaryColour: `#${string}`;
  countdown: string;
  nextCollectionDate?: string;
};

export type CollectionWidgetTimelineEntry = {
  date: Date;
  props: CollectionWidgetSnapshot;
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function daysFrom(value: string, now: Date) {
  const target = new Date(`${value}T12:00:00`);
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

function collectionAnswer(collections: Collection[]) {
  const labels = collections.map((collection) => collectionDisplayMeta(collection).label);
  if (labels.length <= 2) return labels.join(' + ');
  return `${labels[0]} + ${labels.length - 1} more`;
}

function coloursFor(collection?: Collection) {
  const binColour = (collection
    ? collectionDisplayMeta(collection).colour
    : '#0F2A3A') as `#${string}`;
  const foregroundColour = contrastTextForColour(binColour);
  return {
    binColour,
    foregroundColour,
    secondaryColour: (foregroundColour === '#FFFFFF' ? '#F6E8EC' : '#31404A') as `#${string}`,
  } as const;
}

export function buildCollectionWidgetSnapshot(
  address: SavedAddress | undefined,
  value: unknown,
  now = new Date(),
): CollectionWidgetSnapshot {
  const collections = sortCollections(
    verifiedCollectionsOnly(value) as Collection[],
  ).filter((collection) => daysFrom(collection.date, now) >= 0);
  const tomorrow = collections.filter((collection) => daysFrom(collection.date, now) === 1);
  const next = collections[0];
  const nextDateCollections = next
    ? collections.filter((collection) => collection.date === next.date)
    : [];
  const primary = primaryCollectionForDate(tomorrow.length ? tomorrow : nextDateCollections);
  const colours = coloursFor(primary);

  if (!address) {
    return {
      kicker: 'SET UP WHAT BIN?',
      headline: 'Add your address',
      detail: 'Open the app to connect your council collection dates.',
      addressLabel: 'No saved place',
      councilLabel: 'Verified council dates only',
      countdown: '—',
      ...colours,
    };
  }

  if (!next) {
    return {
      kicker: 'WHAT BIN?',
      headline: 'No verified dates yet',
      detail: `Open the app to check ${address.councilName}.`,
      addressLabel: address.label,
      councilLabel: address.councilName,
      countdown: '—',
      ...colours,
    };
  }

  const daysAway = daysFrom(next.date, now);
  const countdown = daysAway === 0
    ? 'TODAY'
    : daysAway === 1
      ? 'TONIGHT'
      : `${daysAway} DAYS`;

  if (tomorrow.length) {
    return {
      kicker: 'PUT OUT TONIGHT',
      headline: collectionAnswer(tomorrow),
      detail: `Collection tomorrow · ${formatCollectionDate(next.date, 'weekday')}`,
      addressLabel: address.label,
      councilLabel: address.councilName,
      countdown,
      nextCollectionDate: next.date,
      ...colours,
    };
  }

  return {
    kicker: 'WHAT BIN?',
    headline: 'Nothing goes out tonight',
    detail: `${daysAway === 0 ? 'Collection today' : `Next: ${formatCollectionDate(next.date, 'weekday')}`} · ${collectionAnswer(nextDateCollections)}`,
    addressLabel: address.label,
    councilLabel: address.councilName,
    countdown,
    nextCollectionDate: next.date,
    ...colours,
  };
}

export function buildCollectionWidgetTimeline(
  address: SavedAddress | undefined,
  collections: unknown,
  now = new Date(),
): CollectionWidgetTimelineEntry[] {
  const timeline: CollectionWidgetTimelineEntry[] = [
    {
      date: now,
      props: buildCollectionWidgetSnapshot(address, collections, now),
    },
  ];

  for (let offset = 1; offset <= 14; offset += 1) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
    );
    timeline.push({
      date,
      props: buildCollectionWidgetSnapshot(address, collections, date),
    });
  }

  return timeline;
}

function isWidgetAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== 'object') return false;
  const address = value as Partial<SavedAddress>;
  return Boolean(
    typeof address.id === 'string'
    && typeof address.label === 'string'
    && typeof address.line1 === 'string'
    && typeof address.postcode === 'string'
    && typeof address.councilName === 'string'
    && typeof address.providerId === 'string',
  );
}

export function widgetStateFromStoredAppData(raw: string | null): {
  address: SavedAddress | undefined;
  collections: Collection[];
} {
  if (!raw) return { address: undefined, collections: [] };
  try {
    const stored = JSON.parse(raw) as {
      addresses?: unknown;
      activeAddressId?: unknown;
      schedulesByAddressId?: unknown;
    };
    if (!Array.isArray(stored.addresses) || typeof stored.activeAddressId !== 'string') {
      return { address: undefined, collections: [] };
    }
    const address = stored.addresses.find((candidate) => (
      isWidgetAddress(candidate) && candidate.id === stored.activeAddressId
    ));
    if (!isWidgetAddress(address)) return { address: undefined, collections: [] };
    const schedules = stored.schedulesByAddressId && typeof stored.schedulesByAddressId === 'object'
      ? stored.schedulesByAddressId as Record<string, { collections?: unknown }>
      : {};
    return {
      address,
      collections: verifiedCollectionsOnly(schedules[address.id]?.collections) as Collection[],
    };
  } catch {
    return { address: undefined, collections: [] };
  }
}

import {
  collectionDisplayMeta,
  contrastTextForColour,
  primaryCollectionForDate,
  sortCollections,
} from '../lib/data.ts';
import type { Collection, CollectionOutcome, SavedAddress } from '../lib/types.ts';

export type CollectionLiveSurfaceSnapshot = {
  activityKey: string;
  collectionDate: string;
  headline: string;
  status: string;
  placeLabel: string;
  countdown: string;
  binColour: `#${string}`;
  foregroundColour: '#0F2A3A' | '#FFFFFF';
  state: 'not-out' | 'put-out' | 'due' | 'collected';
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function daysFrom(value: string, now: Date) {
  const target = new Date(`${value}T12:00:00`);
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

function collectionAnswer(collections: Collection[]) {
  const labels = [...new Set(collections.map((collection) => collectionDisplayMeta(collection).label))];
  if (labels.length <= 2) return labels.join(' + ');
  return `${labels[0]} + ${labels.length - 1} more`;
}

export function buildCollectionLiveSurfaceSnapshot(
  address: SavedAddress | undefined,
  collections: Collection[],
  outcomes: CollectionOutcome[],
  now = new Date(),
): CollectionLiveSurfaceSnapshot | undefined {
  if (!address) return undefined;
  const relevant = sortCollections(collections).filter((collection) => {
    const difference = daysFrom(collection.date, now);
    return difference === 0 || difference === 1;
  });
  const date = relevant[0]?.date;
  if (!date) return undefined;
  const due = relevant.filter((collection) => collection.date === date);
  const difference = daysFrom(date, now);
  const currentOutcomes = due.map((collection) => outcomes.find((outcome) => (
    outcome.addressId === address.id && outcome.collectionId === collection.id
  )));
  const collected = currentOutcomes.length > 0 && currentOutcomes.every((outcome) => (
    outcome?.status === 'collected' || outcome?.status === 'brought-in'
  ));
  const putOut = currentOutcomes.some((outcome) => outcome?.status === 'put-out');
  const primary = primaryCollectionForDate(due);
  const binColour = (primary ? collectionDisplayMeta(primary).colour : '#0F2A3A') as `#${string}`;
  const answer = collectionAnswer(due);
  const state = collected ? 'collected' : difference === 0 ? 'due' : putOut ? 'put-out' : 'not-out';
  return {
    activityKey: `${address.id}:${date}`,
    collectionDate: date,
    headline: collected ? 'Collection completed' : difference === 0 ? `${answer} due today` : `${answer} tonight`,
    status: collected
      ? 'You confirmed the collection was completed.'
      : difference === 0
        ? 'Leave the bin accessible until the collection window ends.'
        : putOut
          ? 'Bin marked as out.'
          : 'Not marked as out yet.',
    placeLabel: address.label || address.line1,
    countdown: collected ? 'DONE' : difference === 0 ? 'TODAY' : 'TONIGHT',
    binColour,
    foregroundColour: contrastTextForColour(binColour),
    state,
  };
}

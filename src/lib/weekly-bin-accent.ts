import {
  collectionDisplayMeta,
  hasSourceCollectionColour,
  primaryCollectionForDate,
  sortCollections,
} from './data.ts';
import type { Collection } from './types.ts';

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function compactBinLabel(label: string) {
  return label
    .replace(/\bgeneral waste bin\b/i, 'bin')
    .replace(/\b(?:mixed |dry )?recycling bin\b/i, 'bin')
    .replace(/\bgarden waste bin\b/i, 'bin')
    .replace(/\brefuse bin\b/i, 'bin')
    .replace(/\s+/g, ' ')
    .trim();
}

export function colourWithAlpha(colour: string, alpha: number) {
  const hex = colour.replace('#', '');
  if (!/^[0-9A-F]{6}$/i.test(hex)) return colour;
  const [red, green, blue] = [0, 2, 4].map((offset) => (
    Number.parseInt(hex.slice(offset, offset + 2), 16)
  ));
  return `rgba(${red},${green},${blue},${Math.min(Math.max(alpha, 0), 1)})`;
}

export function nextWeeklyBinAccent(collections: Collection[], now = new Date()) {
  const today = localDateKey(now);
  const upcoming = sortCollections(collections).filter((collection) => collection.date >= today);
  const next = upcoming[0];
  if (!next) return undefined;

  const nextDateCollections = upcoming.filter((collection) => collection.date === next.date);
  const primary = primaryCollectionForDate(nextDateCollections);
  if (!primary || !hasSourceCollectionColour(primary)) return undefined;

  const meta = collectionDisplayMeta(primary);
  const daysAway = Math.round(
    (new Date(`${primary.date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime())
      / 86_400_000,
  );
  const binLabel = compactBinLabel(meta.label);

  return {
    colour: meta.colour,
    collection: primary,
    cue: daysAway <= 6 ? `${binLabel} this week` : `Next · ${binLabel}`,
    label: meta.label,
  };
}

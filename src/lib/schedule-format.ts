import { collectionDisplayMeta, formatCollectionDate, sortCollections } from './data.ts';
import type { Collection, SavedAddress } from './types.ts';

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function compactDate(value: string) {
  return value.replace(/-/g, '');
}

function nextDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function collectionCalendar(collections: Collection[], address: SavedAddress) {
  const events = sortCollections(collections).map((collection) => {
    const label = collectionDisplayMeta(collection).label;
    return [
      'BEGIN:VEVENT',
      `UID:${escapeIcs(`${address.id}-${collection.id}@what-bin-is-it-tonight`)}`,
      `DTSTART;VALUE=DATE:${compactDate(collection.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(collection.date))}`,
      `SUMMARY:${escapeIcs(`${label} collection`)}`,
      `DESCRIPTION:${escapeIcs(`Put ${label.toLowerCase()} out at ${address.line1}. Verified council date from What Bin Is It Tonight?`)}`,
      'END:VEVENT',
    ].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//What Bin Is It Tonight//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n');
}

export function collectionReminderMessage(collections: Collection[], address: SavedAddress) {
  const ordered = sortCollections(collections);
  const nextDate = ordered[0]?.date;
  if (!nextDate) return `No verified collection is currently shown for ${address.label}.`;
  const due = ordered.filter((collection) => collection.date === nextDate);
  const labels = due.map((collection) => collectionDisplayMeta(collection).label);
  const bins = labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
  return [
    'Bins tonight',
    `${bins} ${labels.length === 1 ? 'goes' : 'go'} out tonight`,
    `for collection ${formatCollectionDate(nextDate, 'weekday').toLowerCase()}.`,
    '',
    `${address.label} · ${address.postcode}`,
    'Shared from What Bin Is It Tonight?',
  ].join('\n');
}

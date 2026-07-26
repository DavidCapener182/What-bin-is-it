import type { Collection, WasteType } from './types.ts';

export const wasteTypes: WasteType[] = ['recycling', 'general', 'food', 'garden'];

export const collectionMeta: Record<WasteType, { label: string; shortLabel: string; colour: string; tint: string; example: string }> = {
  general: { label: 'General waste', shortLabel: 'GENERAL', colour: '#253744', tint: '#E2E9E9', example: 'Everyday rubbish' },
  recycling: { label: 'Mixed recycling', shortLabel: 'RECYCLING', colour: '#1784D1', tint: '#E3F3FF', example: 'Paper, cans & plastic' },
  garden: { label: 'Garden waste', shortLabel: 'GARDEN', colour: '#3D8B54', tint: '#E7F4E7', example: 'Clippings & leaves' },
  food: { label: 'Food waste', shortLabel: 'FOOD', colour: '#9A6334', tint: '#F8EEDF', example: 'Food scraps' },
  other: { label: 'Council bin', shortLabel: 'COUNCIL BIN', colour: '#52656C', tint: '#E9EEEE', example: 'Named by your council' },
};

const namedSourceColours: [RegExp, string][] = [
  [/\b(maroon|burgundy)\b/i, '#7A263A'],
  [/\b(grey|gray|silver|charcoal)\b/i, '#6F777D'],
  [/\bnavy\b/i, '#1F3A5F'],
  [/\bblue\b/i, '#286A96'],
  [/\b(green|lime)\b/i, '#3D7F4D'],
  [/\b(brown|tan)\b/i, '#8A5A2B'],
  [/\bblack\b/i, '#253744'],
  [/\b(red|crimson)\b/i, '#B52A36'],
  [/\b(orange|amber)\b/i, '#B96518'],
  [/\byellow\b/i, '#9A7200'],
  [/\b(purple|violet)\b/i, '#6B4C9A'],
  [/\bpink\b/i, '#A94168'],
  [/\b(teal|turquoise)\b/i, '#087F78'],
  [/\bwhite\b/i, '#F2F2F2'],
];

export function sourceCollectionColour(
  collection?: Pick<Collection, 'label' | 'colour'>,
) {
  if (collection?.colour && /^#[0-9A-F]{6}$/i.test(collection.colour)) {
    return collection.colour.toUpperCase();
  }
  const label = collection?.label?.trim();
  if (!label) return undefined;
  return namedSourceColours.find(([pattern]) => pattern.test(label))?.[1];
}

export function collectionDisplayMeta(collection: Pick<Collection, 'wasteType' | 'label' | 'colour'>) {
  const base = collectionMeta[collection.wasteType];
  const label = collection.label?.trim() || base.label;
  const colour = sourceCollectionColour(collection) ?? base.colour;
  return {
    ...base,
    label,
    shortLabel: label.toUpperCase().slice(0, 24),
    colour,
    tint: collection.wasteType === 'other' ? '#E9EEEE' : base.tint,
  };
}

const primaryWastePriority: Record<WasteType, number> = {
  general: 0,
  recycling: 1,
  garden: 2,
  other: 3,
  food: 4,
};

export function primaryCollectionForDate(collections: Collection[]) {
  return [...collections].sort((a, b) => (
    primaryWastePriority[a.wasteType] - primaryWastePriority[b.wasteType]
  ))[0];
}

export function hasSourceCollectionColour(
  collection?: Pick<Collection, 'label' | 'colour'>,
) {
  return Boolean(sourceCollectionColour(collection));
}

export function contrastTextForColour(colour: string) {
  const hex = colour.replace('#', '');
  if (!/^[0-9A-F]{6}$/i.test(hex)) return '#FFFFFF';
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  const luminance = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
  return luminance > 0.43 ? '#0F2A3A' : '#FFFFFF';
}

function dateAtStartOfDay(value: string | Date) {
  const date = typeof value === 'string' ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function sortCollections(collections: Collection[]) {
  return [...collections].sort((a, b) => a.date.localeCompare(b.date));
}

export function getNextCollection(collections: Collection[]) {
  return sortCollections(collections).find((collection) => dayDifference(collection.date) >= 0);
}

export function dayDifference(value: string) {
  const start = dateAtStartOfDay(new Date()).getTime();
  const target = dateAtStartOfDay(value).getTime();
  return Math.round((target - start) / 86_400_000);
}

export function formatCollectionDate(value: string, form: 'weekday' | 'short' | 'day' | 'dateNumber') {
  const date = new Date(`${value}T12:00:00`);
  if (form === 'weekday') return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  if (form === 'short') return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  if (form === 'day') return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date).toUpperCase();
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(date);
}

export function calendarMonthLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

import { Collection, WasteType } from '@/lib/types';

export const wasteTypes: WasteType[] = ['recycling', 'general', 'food', 'garden'];

export const collectionMeta: Record<WasteType, { label: string; shortLabel: string; colour: string; tint: string; example: string }> = {
  general: { label: 'General waste', shortLabel: 'GENERAL', colour: '#253744', tint: '#E2E9E9', example: 'Everyday rubbish' },
  recycling: { label: 'Mixed recycling', shortLabel: 'RECYCLING', colour: '#1784D1', tint: '#E3F3FF', example: 'Paper, cans & plastic' },
  garden: { label: 'Garden waste', shortLabel: 'GARDEN', colour: '#3D8B54', tint: '#E7F4E7', example: 'Clippings & leaves' },
  food: { label: 'Food waste', shortLabel: 'FOOD', colour: '#9A6334', tint: '#F8EEDF', example: 'Food scraps' },
};

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

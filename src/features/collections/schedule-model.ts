import { type Collection, type SavedAddress } from '@/lib/types';

export type ScheduleItem = { address?: SavedAddress; collection: Collection };
export type ScheduleSection = { data: ScheduleItem[]; title: string };

export const scheduleWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function scheduleDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

export function scheduleMonthCells(anchor: string) {
  const date = dateAtNoon(anchor);
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const leading = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - leading);
  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    return { inMonth: value.getMonth() === date.getMonth(), key: scheduleDateKey(value), number: value.getDate() };
  });
}

export function scheduleMonthLabel(anchor: string) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(dateAtNoon(anchor));
}

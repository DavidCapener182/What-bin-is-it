import type { ActivityEntry, MissedCollectionReport } from './types.ts';

export type ActivityFilter = 'all' | 'reports' | 'council' | 'support';

const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;

const reportActivityTypes = new Set<ActivityEntry['type']>([
  'missed-collection',
  'report-opened',
  'report-updated',
]);

const terminalReportStatuses = new Set<MissedCollectionReport['status']>([
  'resolved',
  'rejected',
  'cancelled',
  'closed',
]);

const residentActionStatuses = new Set<MissedCollectionReport['status']>([
  'draft',
  'ready',
  'opened-council-service',
]);

export function reportNeedsResidentAttention(
  report: MissedCollectionReport,
  seenStatus?: string,
) {
  if (terminalReportStatuses.has(report.status)) return false;
  return residentActionStatuses.has(report.status) || seenStatus !== report.status;
}

export function supportReplyNeedsAttention(
  thread: {
    id: string;
    status: string;
    lastSender: string;
    messages: { id: string }[];
  },
  seenMessageId?: string,
) {
  const latestMessageId = thread.messages.at(-1)?.id;
  return Boolean(
    thread.status === 'waiting-resident'
    && thread.lastSender === 'support'
    && latestMessageId
    && latestMessageId !== seenMessageId,
  );
}

export function activityHistoryForFilter(
  entries: ActivityEntry[],
  filter: ActivityFilter,
  activeAddressId?: string,
) {
  if (filter === 'council' || filter === 'support') return [];
  return entries.filter((entry) => (
    (!activeAddressId || !entry.addressId || entry.addressId === activeAddressId)
    && (filter !== 'reports' || reportActivityTypes.has(entry.type))
  ));
}

export function formatActivityDetail(detail?: string) {
  if (!detail) return undefined;
  const match = isoDateOnly.exec(detail);
  if (!match) return detail;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (!Number.isFinite(date.getTime())) return detail;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

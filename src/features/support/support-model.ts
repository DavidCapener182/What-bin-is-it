import { SupportRequest } from '@/lib/types';

export const supportTopics: { value: SupportRequest['topic']; label: string }[] = [
  { value: 'app-help', label: 'Using the app' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'address', label: 'Address or council lookup' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'app-problem', label: 'App problem' },
  { value: 'guide-item', label: 'Suggest a guide item' },
  { value: 'other', label: 'Something else' },
];

export type SupportMessage = {
  id: string;
  sender: 'resident' | 'support';
  body: string;
  createdAt: string;
};

export type SupportThread = {
  id: string;
  councilProviderId?: string;
  councilName?: string;
  topic: SupportRequest['topic'];
  subject: string;
  status: 'new' | 'in-progress' | 'waiting-resident' | 'waiting-operations' | 'resolved' | 'closed';
  resolvedAt?: string;
  satisfactionScore?: number;
  lastSender: 'resident' | 'support';
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
};

export type ThreadsResponse = {
  threads?: SupportThread[];
  error?: string;
};

export function friendlySupportDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function supportStatusLabel(thread: SupportThread) {
  if (thread.status === 'closed') return 'Closed';
  if (thread.status === 'resolved') return 'Resolved';
  if (thread.status === 'waiting-resident') return 'Reply received';
  if (thread.status === 'waiting-operations') return 'With council operations';
  return thread.status === 'in-progress' ? 'In progress' : 'Sent to support';
}

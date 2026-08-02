import { useCallback, useEffect, useState } from 'react';

import { apiBase } from '@/lib/api-base';
import { SupportRequest } from '@/lib/types';
import { useAccount } from '@/lib/use-account';

export type ResidentSupportMessage = {
  id: string;
  sender: 'resident' | 'support';
  body: string;
  createdAt: string;
};

export type ResidentSupportThread = {
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
  messages: ResidentSupportMessage[];
};

export function useResidentSupport() {
  const { accessToken, ready: accountReady } = useAccount();
  const [threads, setThreads] = useState<ResidentSupportThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setThreads([]);
      setError(undefined);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/support/threads`, {
        headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json() as { threads?: ResidentSupportThread[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Your conversations could not be loaded.');
      setThreads(payload.threads ?? []);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your conversations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accountReady) return;
    const initialTimer = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 60_000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [accountReady, refresh]);

  return { threads, loading, error, refresh };
}

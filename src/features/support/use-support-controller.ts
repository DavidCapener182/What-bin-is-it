import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supportTopics, SupportThread, ThreadsResponse } from '@/features/support/support-model';
import { apiBase } from '@/lib/api-base';
import { fetchBoundedResponseJson } from '@/lib/bounded-response';
import { SupportRequest } from '@/lib/types';
import { useAccount } from '@/lib/use-account';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';
import { useProductState } from '@/lib/use-product-state';

async function supportRequest(path: string, accessToken: string, init?: RequestInit) {
  const { response, payload } = await fetchBoundedResponseJson(`${apiBase}${path}`, {
    init: {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    },
    maximumBytes: 2 * 1024 * 1024,
    timeoutMs: 15_000,
  });
  return { response, payload: (payload ?? {}) as ThreadsResponse };
}

export function useSupportController() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const { activeAddress } = useAppData();
  const councilProfile = useCouncilProfile(activeAddress?.providerId);
  const councilSupportEnabled = councilProfile?.featureFlags?.supportInbox === true;
  const account = useAccount();
  const { markSupportThreadSeen, supportSeenMessageIdByThreadId } = useProductState();
  const initialTopic = supportTopics.some((item) => item.value === params.topic)
    ? params.topic as SupportRequest['topic']
    : 'app-help';
  const [topic, setTopic] = useState<SupportRequest['topic']>(initialTopic);
  const [detail, setDetail] = useState('');
  const [reply, setReply] = useState('');
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0],
    [selectedThreadId, threads],
  );

  useEffect(() => {
    const latestMessageId = selectedThread?.messages.at(-1)?.id;
    if (selectedThread?.lastSender === 'support' && latestMessageId && supportSeenMessageIdByThreadId[selectedThread.id] !== latestMessageId) {
      markSupportThreadSeen(selectedThread.id, latestMessageId);
    }
  }, [markSupportThreadSeen, selectedThread, supportSeenMessageIdByThreadId]);

  const acceptThreads = useCallback((next: SupportThread[]) => {
    setThreads(next);
    setSelectedThreadId((current) => current && next.some((thread) => thread.id === current) ? current : next[0]?.id);
  }, []);

  const loadThreads = useCallback(async () => {
    if (!account.accessToken) {
      acceptThreads([]);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const { response, payload } = await supportRequest('/support/threads', account.accessToken);
      if (!response.ok) throw new Error(payload.error ?? 'Your conversations could not be loaded.');
      acceptThreads(payload.threads ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your conversations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [acceptThreads, account.accessToken]);

  useEffect(() => {
    if (!account.ready) return;
    const loadTimer = setTimeout(() => { void loadThreads(); }, 0);
    return () => clearTimeout(loadTimer);
  }, [account.ready, loadThreads]);

  async function send() {
    if (!account.accessToken || !account.user) {
      router.push('/account');
      return;
    }
    if (!detail.trim()) {
      setError('Add a short description so the support request is useful.');
      return;
    }
    setSending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const { response, payload } = await supportRequest('/support/threads', account.accessToken, {
        method: 'POST',
        body: JSON.stringify({
          topic,
          detail: detail.trim(),
          councilProviderId: councilSupportEnabled ? activeAddress?.providerId : undefined,
          councilName: councilSupportEnabled ? activeAddress?.councilName : undefined,
          clientRequestId: Crypto.randomUUID(),
        }),
      });
      if (!response.ok) throw new Error(payload.error ?? 'Your message could not be sent.');
      acceptThreads(payload.threads ?? []);
      setDetail('');
      setMessage('Message sent. Replies will appear here in the app.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  async function sendReply() {
    if (!account.accessToken || !selectedThread || !reply.trim()) return;
    setSending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const { response, payload } = await supportRequest('/support/reply', account.accessToken, {
        method: 'POST',
        body: JSON.stringify({ threadId: selectedThread.id, detail: reply.trim(), clientMessageId: Crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error(payload.error ?? 'Your reply could not be sent.');
      acceptThreads(payload.threads ?? []);
      setReply('');
      setMessage('Reply sent.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your reply could not be sent.');
    } finally {
      setSending(false);
    }
  }

  async function rateSupport(score: number) {
    if (!account.accessToken || !selectedThread) return;
    setSending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const { response, payload } = await supportRequest('/support/satisfaction', account.accessToken, {
        method: 'POST',
        body: JSON.stringify({ threadId: selectedThread.id, score }),
      });
      if (!response.ok) throw new Error(payload.error ?? 'Your response could not be saved.');
      acceptThreads(payload.threads ?? []);
      setMessage('Thanks — your feedback was saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your response could not be saved.');
    } finally {
      setSending(false);
    }
  }

  return {
    account,
    activeAddress,
    councilSupportEnabled,
    detail,
    error,
    loadThreads,
    loading,
    message,
    rateSupport,
    reply,
    selectedThread,
    send,
    sendReply,
    sending,
    setDetail,
    setReply,
    setSelectedThreadId,
    setTopic,
    threads,
    topic,
  };
}

export type SupportController = ReturnType<typeof useSupportController>;

import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { apiBase } from '@/lib/api-base';
import { useAppTheme } from '@/lib/theme';
import { SupportRequest } from '@/lib/types';
import { useAccount } from '@/lib/use-account';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';

const topics: { value: SupportRequest['topic']; label: string }[] = [
  { value: 'app-help', label: 'Using the app' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'address', label: 'Address or council lookup' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'app-problem', label: 'App problem' },
  { value: 'guide-item', label: 'Suggest a guide item' },
  { value: 'other', label: 'Something else' },
];

type SupportMessage = {
  id: string;
  sender: 'resident' | 'support';
  body: string;
  createdAt: string;
};

type SupportThread = {
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

type ThreadsResponse = {
  threads?: SupportThread[];
  error?: string;
};

function friendlyDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(thread: SupportThread) {
  if (thread.status === 'closed') return 'Closed';
  if (thread.status === 'resolved') return 'Resolved';
  if (thread.status === 'waiting-resident') return 'Reply received';
  if (thread.status === 'waiting-operations') return 'With council operations';
  return thread.status === 'in-progress' ? 'In progress' : 'Sent to support';
}

export default function SupportScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ topic?: string }>();
  const { activeAddress } = useAppData();
  const councilProfile = useCouncilProfile(activeAddress?.providerId);
  const councilSupportEnabled = councilProfile?.featureFlags?.supportInbox === true;
  const { accessToken, configured, ready: accountReady, user } = useAccount();
  const initialTopic = topics.some((item) => item.value === params.topic)
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

  const acceptThreads = useCallback((next: SupportThread[]) => {
    setThreads(next);
    setSelectedThreadId((current) => (
      current && next.some((thread) => thread.id === current) ? current : next[0]?.id
    ));
  }, []);

  const loadThreads = useCallback(async () => {
    if (!accessToken) {
      acceptThreads([]);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`${apiBase}/support/threads`, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = await response.json() as ThreadsResponse;
      if (!response.ok) throw new Error(payload.error ?? 'Your conversations could not be loaded.');
      acceptThreads(payload.threads ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your conversations could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [acceptThreads, accessToken]);

  useEffect(() => {
    if (!accountReady) return;
    const loadTimer = setTimeout(() => {
      void loadThreads();
    }, 0);
    return () => clearTimeout(loadTimer);
  }, [accountReady, loadThreads]);

  async function send() {
    if (!accessToken || !user) {
      router.push('/account');
      return;
    }
    if (!detail.trim()) {
      Alert.alert('Tell us what you need', 'Add a short description so the support request is useful.');
      return;
    }
    setSending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await fetch(`${apiBase}/support/threads`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          detail: detail.trim(),
          councilProviderId: councilSupportEnabled ? activeAddress?.providerId : undefined,
          councilName: councilSupportEnabled ? activeAddress?.councilName : undefined,
          clientRequestId: Crypto.randomUUID(),
        }),
      });
      const payload = await response.json() as ThreadsResponse;
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
    if (!accessToken || !selectedThread || !reply.trim()) return;
    setSending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await fetch(`${apiBase}/support/reply`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          threadId: selectedThread.id,
          detail: reply.trim(),
          clientMessageId: Crypto.randomUUID(),
        }),
      });
      const payload = await response.json() as ThreadsResponse;
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
    if (!accessToken || !selectedThread) return;
    setSending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await fetch(`${apiBase}/support/satisfaction`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ threadId: selectedThread.id, score }),
      });
      const payload = await response.json() as ThreadsResponse;
      if (!response.ok) throw new Error(payload.error ?? 'Your response could not be saved.');
      acceptThreads(payload.threads ?? []);
      setMessage('Thanks — your feedback was saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your response could not be saved.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell activeRoute="/activity">
      <RouteHead title="Help and Support" description="Message the What Bin support team inside the app." path="/support" />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Close support" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Ionicons color={theme.accent} name="close" size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Help and support</Text>
          <Pressable accessibilityLabel="Refresh conversations" accessibilityRole="button" onPress={() => void loadThreads()} style={styles.back}>
            {loading
              ? <ActivityIndicator color={theme.accent} size="small" />
              : <Ionicons color={theme.accent} name="refresh" size={20} />}
          </Pressable>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>Message the team</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
            Send and receive support messages here. Council missed-collection reports remain separate.
          </Text>

          {!configured ? (
            <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Ionicons color={theme.warning} name="warning-outline" size={22} />
              <Text style={[styles.noticeText, { color: theme.text }]}>In-app support is not configured in this build.</Text>
            </View>
          ) : !accountReady ? (
            <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <ActivityIndicator color={theme.accent} />
              <Text style={[styles.noticeText, { color: theme.text }]}>Checking your account…</Text>
            </View>
          ) : !user ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/account')}
              style={({ pressed }) => [
                styles.signInCard,
                { backgroundColor: theme.hero },
                pressed && styles.pressed,
              ]}>
              <View style={[styles.signInIcon, { backgroundColor: 'rgba(255,255,255,0.13)' }]}>
                <Ionicons color="#FFFFFF" name="person-outline" size={25} />
              </View>
              <View style={styles.signInCopy}>
                <Text style={styles.signInTitle}>Sign in to message support</Text>
                <Text style={styles.signInBody}>Your conversations stay private and follow your account.</Text>
              </View>
              <Ionicons color="#FFFFFF" name="chevron-forward" size={21} />
            </Pressable>
          ) : (
            <>
              <View style={styles.topicGrid}>
                {topics.map((item) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: topic === item.value }}
                    key={item.value}
                    onPress={() => setTopic(item.value)}
                    style={[
                      styles.topic,
                      {
                        borderColor: topic === item.value ? theme.accent : theme.separator,
                        backgroundColor: topic === item.value ? theme.accentSoft : theme.surface,
                      },
                    ]}>
                    <Text style={[styles.topicText, { color: topic === item.value ? theme.accent : theme.text }]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                accessibilityLabel="Support message"
                maxLength={5_000}
                multiline
                onChangeText={setDetail}
                placeholder="Describe what happened and what you expected."
                placeholderTextColor={theme.tertiaryText}
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]}
                value={detail}
              />
              {activeAddress ? (
                <View style={styles.councilContext}>
                  <Ionicons color={theme.success} name="shield-checkmark-outline" size={17} />
                  <Text style={[styles.councilContextText, { color: theme.secondaryText }]}>
                    {councilSupportEnabled
                      ? `Routed to ${activeAddress.councilName}. Your address and postcode are not sent.`
                      : `Routed to What Bin support. ${activeAddress.councilName} has not enabled its resident inbox.`}
                  </Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: sending }}
                disabled={sending}
                onPress={() => void send()}
                style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && styles.pressed, sending && styles.disabled]}>
                {sending
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <><Ionicons color="#FFFFFF" name="send" size={18} /><Text style={styles.buttonText}>Send message</Text></>}
              </Pressable>
            </>
          )}

          {error ? <Text accessibilityRole="alert" style={[styles.feedback, { color: theme.danger }]}>{error}</Text> : null}
          {message ? <Text accessibilityRole="alert" style={[styles.feedback, { color: theme.success }]}>{message}</Text> : null}

          {user && threads.length ? (
            <View style={styles.conversationSection}>
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={[styles.sectionKicker, { color: theme.secondaryText }]}>YOUR INBOX</Text>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Conversations</Text>
                </View>
                <Text style={[styles.count, { color: theme.secondaryText }]}>{threads.length}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.threadTabs}>
                {threads.map((thread) => {
                  const selected = selectedThread?.id === thread.id;
                  return (
                    <Pressable
                      key={thread.id}
                      onPress={() => setSelectedThreadId(thread.id)}
                      style={[
                        styles.threadTab,
                        {
                          backgroundColor: selected ? theme.accentSoft : theme.surface,
                          borderColor: selected ? theme.accent : theme.separator,
                        },
                      ]}>
                      <Text numberOfLines={1} style={[styles.threadTabTitle, { color: selected ? theme.accent : theme.text }]}>{thread.subject}</Text>
                      <Text style={[styles.threadTabMeta, { color: theme.secondaryText }]}>{statusLabel(thread)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {selectedThread ? (
                <View style={[styles.conversation, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                  <View style={[styles.conversationHead, { borderBottomColor: theme.separator }]}>
                    <View style={styles.conversationHeadCopy}>
                      <Text style={[styles.conversationTitle, { color: theme.text }]}>{selectedThread.subject}</Text>
                      <Text style={[styles.conversationMeta, { color: theme.secondaryText }]}>
                        {selectedThread.councilName ? `${selectedThread.councilName} · ` : ''}{statusLabel(selectedThread)}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: selectedThread.status === 'waiting-resident' ? theme.success : theme.accent },
                    ]} />
                  </View>
                  <View style={styles.messageStack}>
                    {selectedThread.messages.map((item) => {
                      const resident = item.sender === 'resident';
                      return (
                        <View key={item.id} style={[styles.messageRow, resident && styles.messageRowResident]}>
                          <View style={[
                            styles.messageBubble,
                            resident
                              ? { backgroundColor: theme.accent }
                              : { backgroundColor: theme.groupedBackground, borderColor: theme.separator, borderWidth: StyleSheet.hairlineWidth },
                          ]}>
                            <Text style={[styles.messageText, { color: resident ? '#FFFFFF' : theme.text }]}>{item.body}</Text>
                            <Text style={[styles.messageTime, { color: resident ? 'rgba(255,255,255,0.72)' : theme.secondaryText }]}>
                              {resident ? 'You' : 'What Bin support'} · {friendlyDate(item.createdAt)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  {!['resolved', 'closed'].includes(selectedThread.status) ? (
                    <View style={[styles.replyBox, { borderTopColor: theme.separator }]}>
                      <TextInput
                        accessibilityLabel="Reply to support"
                        maxLength={5_000}
                        multiline
                        onChangeText={setReply}
                        placeholder="Write a reply…"
                        placeholderTextColor={theme.tertiaryText}
                        style={[styles.replyInput, { backgroundColor: theme.background, color: theme.text }]}
                        value={reply}
                      />
                      <Pressable
                        accessibilityLabel="Send reply"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: sending || !reply.trim() }}
                        disabled={sending || !reply.trim()}
                        onPress={() => void sendReply()}
                        style={[styles.replyButton, { backgroundColor: theme.accent }, (!reply.trim() || sending) && styles.disabled]}>
                        {sending
                          ? <ActivityIndicator color="#FFFFFF" size="small" />
                          : <Ionicons color="#FFFFFF" name="arrow-up" size={19} />}
                      </Pressable>
                    </View>
                  ) : selectedThread.satisfactionScore ? (
                    <View style={[styles.satisfactionResult, { borderTopColor: theme.separator }]}>
                      <Ionicons color={theme.success} name="checkmark-circle-outline" size={20} />
                      <Text style={[styles.closedText, { color: theme.secondaryText }]}>You rated this support conversation {selectedThread.satisfactionScore} out of 5.</Text>
                    </View>
                  ) : (
                    <View style={[styles.satisfaction, { borderTopColor: theme.separator }]}>
                      <Text style={[styles.satisfactionTitle, { color: theme.text }]}>Was this support helpful?</Text>
                      <Text style={[styles.satisfactionBody, { color: theme.secondaryText }]}>Your rating helps improve resident support.</Text>
                      <View accessibilityRole="radiogroup" style={styles.satisfactionScores}>
                        {[1, 2, 3, 4, 5].map((score) => (
                          <Pressable
                            accessibilityLabel={`Rate support ${score} out of 5`}
                            accessibilityRole="radio"
                            disabled={sending}
                            key={score}
                            onPress={() => void rateSupport(score)}
                            style={({ pressed }) => [styles.scoreButton, { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}
                          >
                            <Text style={[styles.scoreText, { color: theme.accent }]}>{score}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={[styles.closedText, { color: theme.secondaryText }]}>Start a new message above if you still need help.</Text>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { height: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 18, paddingBottom: 120, gap: 14, width: '100%', maxWidth: 680, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: -6 },
  notice: { minHeight: 66, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  signInCard: { minHeight: 92, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13 },
  signInIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  signInCopy: { flex: 1 },
  signInTitle: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '700' },
  signInBody: { color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 19, marginTop: 2 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  topic: { minHeight: 44, borderRadius: 11, borderWidth: 1, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  topicText: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 138, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  councilContext: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 2 },
  councilContextText: { flex: 1, fontSize: 13, lineHeight: 18 },
  button: { minHeight: 50, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  feedback: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  conversationSection: { gap: 12, marginTop: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionKicker: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  sectionTitle: { fontSize: 24, lineHeight: 29, fontWeight: '700', letterSpacing: -0.5, marginTop: 2 },
  count: { fontSize: 14, fontWeight: '600' },
  threadTabs: { gap: 9, paddingRight: 4 },
  threadTab: { width: 180, minHeight: 68, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10, justifyContent: 'center' },
  threadTabTitle: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  threadTabMeta: { fontSize: 12, lineHeight: 16, marginTop: 3 },
  conversation: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  conversationHead: { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  conversationHeadCopy: { flex: 1 },
  conversationTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  conversationMeta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  messageStack: { padding: 13, gap: 9 },
  messageRow: { flexDirection: 'row', paddingRight: 34 },
  messageRowResident: { justifyContent: 'flex-end', paddingRight: 0, paddingLeft: 34 },
  messageBubble: { maxWidth: '100%', borderRadius: 15, paddingHorizontal: 13, paddingVertical: 10 },
  messageText: { fontSize: 15, lineHeight: 21 },
  messageTime: { fontSize: 11, lineHeight: 15, marginTop: 5 },
  replyBox: { minHeight: 65, borderTopWidth: StyleSheet.hairlineWidth, padding: 9, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  replyInput: { flex: 1, minHeight: 44, maxHeight: 130, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, lineHeight: 20 },
  replyButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  closedText: { padding: 14, fontSize: 13, lineHeight: 18 },
  satisfaction: { padding: 15, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  satisfactionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  satisfactionBody: { marginTop: 3, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  satisfactionScores: { flexDirection: 'row', gap: 8, marginTop: 12 },
  scoreButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 15, fontWeight: '700' },
  satisfactionResult: { minHeight: 62, padding: 14, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.48 },
});

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteHead } from '@/components/route-head';
import { apiBase } from '@/lib/api-base';
import { fetchBoundedResponseJson } from '@/lib/bounded-response';
import { AppTheme, useAppTheme } from '@/lib/theme';

type StatusComponent = { id: string; label: string; state: string; detail: string };
type StatusIncident = { id: string; component: string; status: string; title: string; detail: string; startsAt: string; resolvedAt?: string };
type StatusData = {
  checkedAt: string;
  components: StatusComponent[];
  incidents: StatusIncident[];
  coverage: { mappedAuthorities: number; liveAuthorities: number | null; note: string };
};

const automaticRefreshMs = 60_000;

function boundedText(value: unknown, maximum: number) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

function isStatusData(value: unknown): value is StatusData {
  if (!value || typeof value !== 'object') return false;
  const status = value as Partial<StatusData>;
  return (
    boundedText(status.checkedAt, 80)
    && Number.isFinite(new Date(status.checkedAt!).getTime())
    && Array.isArray(status.components)
    && status.components.length <= 40
    && status.components.every((component) => (
      boundedText(component?.id, 80)
      && boundedText(component?.label, 120)
      && boundedText(component?.state, 40)
      && boundedText(component?.detail, 500)
    ))
    && Array.isArray(status.incidents)
    && status.incidents.length <= 100
    && status.incidents.every((incident) => (
      boundedText(incident?.id, 120)
      && boundedText(incident?.component, 80)
      && boundedText(incident?.status, 40)
      && boundedText(incident?.title, 160)
      && boundedText(incident?.detail, 800)
      && boundedText(incident?.startsAt, 80)
      && (incident.resolvedAt === undefined || boundedText(incident.resolvedAt, 80))
    ))
    && Boolean(status.coverage)
    && Number.isInteger(status.coverage?.mappedAuthorities)
    && status.coverage!.mappedAuthorities >= 0
    && (status.coverage?.liveAuthorities === null || Number.isInteger(status.coverage?.liveAuthorities))
    && boundedText(status.coverage?.note, 500)
  );
}

export default function StatusScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const [status, setStatus] = useState<StatusData>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mounted.current) {
      setRefreshing(true);
      setError(undefined);
    }
    try {
      const { payload, response } = await fetchBoundedResponseJson(`${apiBase}/status`, {
        maximumBytes: 256 * 1024,
        timeoutMs: 10_000,
      });
      if (!response.ok) throw new Error('Status information is unavailable.');
      if (!isStatusData(payload)) throw new Error('Status information could not be verified.');
      if (mounted.current) setStatus(payload);
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof Error ? reason.message : 'Status information is unavailable.');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const initialTimer = setTimeout(() => void refreshStatus(), 0);
    const timer = setInterval(() => void refreshStatus(), automaticRefreshMs);
    return () => {
      mounted.current = false;
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [refreshStatus]);

  return <View style={styles.page}>
    <RouteHead title="Service status" description="Current recorded incidents and What Bin council coverage information." path="/status" />
    <SafeAreaView edges={['top']} style={styles.header}>
      <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons color={theme.accent} name="chevron-back" size={25} /></Pressable>
      <View style={styles.headerCopy}><Text style={styles.kicker}>What Bin</Text><Text style={styles.title}>Service status</Text></View>
      <Pressable accessibilityLabel="Refresh status" accessibilityRole="button" accessibilityState={{ busy: refreshing, disabled: refreshing }} disabled={refreshing} onPress={() => void refreshStatus()} style={styles.refresh}>
        {refreshing ? <ActivityIndicator color={theme.accent} size="small" /> : <Ionicons color={theme.accent} name="refresh" size={21} />}
      </Pressable>
    </SafeAreaView>
    <ScrollView contentContainerStyle={styles.content}>
      {!status && refreshing ? <ActivityIndicator color={theme.accent} /> : null}
      {refreshing && status ? <Text accessibilityLiveRegion="polite" style={styles.refreshing}>Refreshing recorded status…</Text> : null}
      {error ? <View accessibilityRole="alert" style={styles.card}><Text style={styles.cardTitle}>Couldn’t refresh status</Text><Text style={styles.cardDetail}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void refreshStatus()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
      {status ? <>
        <Text style={styles.section}>Components</Text>
        <View style={styles.group}>{status.components.map((component, index) => <View key={component.id} style={[styles.row, index > 0 && styles.border]}><Ionicons color={component.state === 'incident' || component.state === 'degraded' ? theme.warning : theme.success} name={component.state === 'incident' || component.state === 'degraded' ? 'warning-outline' : 'checkmark-circle-outline'} size={22} /><View style={styles.copy}><Text style={styles.cardTitle}>{component.label}</Text><Text style={styles.state}>{component.state.replaceAll('-', ' ')}</Text><Text style={styles.cardDetail}>{component.detail}</Text></View></View>)}</View>
        <Text style={styles.section}>Coverage</Text><View style={styles.card}><Text style={styles.cardTitle}>{status.coverage.mappedAuthorities} postcode authorities mapped</Text><Text style={styles.cardDetail}>{status.coverage.note}</Text></View>
        <Text style={styles.section}>Incident history</Text>{status.incidents.length ? <View style={styles.group}>{status.incidents.map((incident, index) => <View key={incident.id} style={[styles.row, index > 0 && styles.border]}><Ionicons color={incident.status === 'resolved' ? theme.success : theme.warning} name={incident.status === 'resolved' ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={22} /><View style={styles.copy}><Text style={styles.cardTitle}>{incident.title}</Text><Text style={styles.state}>{incident.status.replaceAll('-', ' ')}</Text><Text style={styles.cardDetail}>{incident.detail}</Text></View></View>)}</View> : <View style={styles.card}><Text style={styles.cardTitle}>No recorded incidents</Text><Text style={styles.cardDetail}>No active incident is published. This is not a guarantee of uninterrupted service.</Text></View>}
        <Text style={styles.checked}>Status checked {new Date(status.checkedAt).toLocaleString('en-GB')} · automatically refreshes every minute</Text>
      </> : null}
    </ScrollView>
  </View>;
}

function createStyles(theme: AppTheme) { return StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background }, header: { minHeight: 112, paddingHorizontal: 8, paddingBottom: 18, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }, headerCopy: { flex: 1, minWidth: 0 }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, refresh: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, kicker: { color: theme.accent, fontSize: 12, fontWeight: '800' }, title: { color: theme.text, fontSize: 30, lineHeight: 35, fontWeight: '800' }, content: { padding: 18, paddingBottom: 44, gap: 14 }, refreshing: { color: theme.secondaryText, fontSize: 12, textAlign: 'center' }, section: { color: theme.secondaryText, fontSize: 12, fontWeight: '800', marginTop: 6 }, group: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface }, row: { minHeight: 92, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 11 }, border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }, copy: { flex: 1 }, card: { borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface }, cardTitle: { color: theme.text, fontSize: 14, fontWeight: '800' }, state: { color: theme.secondaryText, fontSize: 11, fontWeight: '800', textTransform: 'capitalize', marginTop: 3 }, cardDetail: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 5 }, retry: { minHeight: 44, borderRadius: 12, marginTop: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentFill }, retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, checked: { color: theme.tertiaryText, fontSize: 11, textAlign: 'center', marginTop: 8 },
}); }

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteHead } from '@/components/route-head';
import { AppTheme, useAppTheme } from '@/lib/theme';

type StatusData = {
  checkedAt: string;
  components: { id: string; label: string; state: string; detail: string }[];
  incidents: { id: string; component: string; status: string; title: string; detail: string; startsAt: string; resolvedAt?: string }[];
  coverage: { mappedAuthorities: number; liveAuthorities: number | null; note: string };
};

const configuredApiBase = process.env.EXPO_PUBLIC_COUNCIL_API_BASE?.replace(/\/$/, '');
const apiBase = configuredApiBase || (typeof globalThis.location?.origin === 'string' ? `${globalThis.location.origin}/api` : 'https://what-bin-is-it-tonight.vercel.app/api');

export default function StatusScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [status, setStatus] = useState<StatusData>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void fetch(`${apiBase}/status`).then(async (response) => {
      if (!response.ok) throw new Error('Status information is unavailable.');
      const next = await response.json() as StatusData;
      if (active) setStatus(next);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Status information is unavailable.');
    });
    return () => { active = false; };
  }, []);
  return <View style={styles.page}>
    <RouteHead title="Service status" description="Current recorded incidents and What Bin council coverage information." path="/status" />
    <SafeAreaView edges={['top']} style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons color={theme.accent} name="chevron-back" size={25} /></Pressable><View><Text style={styles.kicker}>What Bin</Text><Text style={styles.title}>Service status</Text></View></SafeAreaView>
    <ScrollView contentContainerStyle={styles.content}>
      {!status && !error ? <ActivityIndicator color={theme.accent} /> : null}
      {error ? <View style={styles.card}><Text style={styles.cardTitle}>Couldn’t load status</Text><Text style={styles.cardDetail}>{error}</Text></View> : null}
      {status ? <>
        <Text style={styles.section}>Components</Text>
        <View style={styles.group}>{status.components.map((component, index) => <View key={component.id} style={[styles.row, index > 0 && styles.border]}><Ionicons color={component.state === 'incident' || component.state === 'degraded' ? theme.warning : theme.success} name={component.state === 'incident' || component.state === 'degraded' ? 'warning-outline' : 'checkmark-circle-outline'} size={22} /><View style={styles.copy}><Text style={styles.cardTitle}>{component.label}</Text><Text style={styles.state}>{component.state.replaceAll('-', ' ')}</Text><Text style={styles.cardDetail}>{component.detail}</Text></View></View>)}</View>
        <Text style={styles.section}>Coverage</Text><View style={styles.card}><Text style={styles.cardTitle}>{status.coverage.mappedAuthorities} postcode authorities mapped</Text><Text style={styles.cardDetail}>{status.coverage.note}</Text></View>
        <Text style={styles.section}>Incident history</Text>{status.incidents.length ? <View style={styles.group}>{status.incidents.map((incident, index) => <View key={incident.id} style={[styles.row, index > 0 && styles.border]}><Ionicons color={incident.status === 'resolved' ? theme.success : theme.warning} name={incident.status === 'resolved' ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={22} /><View style={styles.copy}><Text style={styles.cardTitle}>{incident.title}</Text><Text style={styles.state}>{incident.status.replaceAll('-', ' ')}</Text><Text style={styles.cardDetail}>{incident.detail}</Text></View></View>)}</View> : <View style={styles.card}><Text style={styles.cardTitle}>No recorded incidents</Text><Text style={styles.cardDetail}>No active incident is published. This is not a guarantee of uninterrupted service.</Text></View>}
        <Text style={styles.checked}>Checked {new Date(status.checkedAt).toLocaleString('en-GB')}</Text>
      </> : null}
    </ScrollView>
  </View>;
}

function createStyles(theme: AppTheme) { return StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background }, header: { minHeight: 112, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12 }, kicker: { color: theme.accent, fontSize: 12, fontWeight: '800' }, title: { color: theme.text, fontSize: 30, lineHeight: 35, fontWeight: '800' }, content: { padding: 18, paddingBottom: 44, gap: 14 }, section: { color: theme.secondaryText, fontSize: 12, fontWeight: '800', marginTop: 6 }, group: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface }, row: { minHeight: 92, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 11 }, border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }, copy: { flex: 1 }, card: { borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface }, cardTitle: { color: theme.text, fontSize: 14, fontWeight: '800' }, state: { color: theme.secondaryText, fontSize: 11, fontWeight: '800', textTransform: 'capitalize', marginTop: 3 }, cardDetail: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 5 }, checked: { color: theme.tertiaryText, fontSize: 11, textAlign: 'center', marginTop: 8 },
}); }

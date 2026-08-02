import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { formatCollectionDate } from '@/lib/data';
import { appFonts } from '@/lib/design-system';
import { useAppTheme } from '@/lib/theme';
import { MissedCollectionReport } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useProductState } from '@/lib/use-product-state';

const statusLabels: Record<MissedCollectionReport['status'], string> = {
  draft: 'Draft',
  'not-yet-eligible': 'Waiting for eligibility',
  ready: 'Ready to report',
  'opened-council-service': 'Council service opened',
  reported: 'Reported to council',
  'awaiting-response': 'Awaiting response',
  acknowledged: 'Acknowledged',
  'recollection-scheduled': 'Recollection scheduled',
  resolved: 'Resolved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  closed: 'Closed',
};

export default function ReportsScreen() {
  const theme = useAppTheme();
  const { activeAddress } = useAppData();
  const { reports, updateReport } = useProductState();
  const [referenceById, setReferenceById] = useState<Record<string, string>>({});
  const [updateById, setUpdateById] = useState<Record<string, string>>({});
  const [recollectionById, setRecollectionById] = useState<Record<string, string>>({});
  const visibleReports = useMemo(
    () => reports.filter((report) => !activeAddress || report.addressId === activeAddress.id),
    [activeAddress, reports],
  );

  function setStatus(report: MissedCollectionReport, status: MissedCollectionReport['status']) {
    updateReport(report.id, {
      status,
      statusSource: 'resident',
      reportedAt: status === 'reported' || status === 'awaiting-response' ? new Date().toISOString() : report.reportedAt,
      resolvedAt: status === 'resolved' ? new Date().toISOString() : report.resolvedAt,
    });
  }

  function saveRecollection(report: MissedCollectionReport) {
    const value = (recollectionById[report.id] ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T12:00:00`).getTime())) {
      Alert.alert('Check the date', 'Enter the council recollection date as YYYY-MM-DD.');
      return;
    }
    if (value < new Date().toISOString().slice(0, 10)) {
      Alert.alert('Check the date', 'The recollection date cannot be in the past.');
      return;
    }
    updateReport(report.id, {
      expectedRecollectionDate: value,
      status: 'recollection-scheduled',
      statusSource: 'resident',
    });
    setRecollectionById((current) => ({ ...current, [report.id]: '' }));
  }

  function reportSummary(report: MissedCollectionReport) {
    return [
      `Missed ${report.binLabel.toLowerCase()} collection`,
      `${report.propertyAddress}, ${report.postcode}`,
      `Scheduled: ${formatCollectionDate(report.collectionDate, 'weekday')}`,
      `Council: ${report.councilName}`,
      `Status: ${statusLabels[report.status]}`,
      `Council reference: ${report.councilReference || 'Not supplied'}`,
      report.expectedRecollectionDate
        ? `Expected recollection: ${formatCollectionDate(report.expectedRecollectionDate, 'weekday')}`
        : '',
      `Local tracking ID: ${report.localTrackingId}`,
      report.userUpdate ? `Update: ${report.userUpdate}` : '',
    ].filter(Boolean).join('\n');
  }

  async function copyReference(report: MissedCollectionReport) {
    await Clipboard.setStringAsync(report.councilReference || report.localTrackingId);
    Alert.alert('Copied', report.councilReference ? 'Council reference copied.' : 'Local tracking ID copied.');
  }

  async function shareReport(report: MissedCollectionReport) {
    await Share.share({ message: reportSummary(report) });
  }

  return (
    <AppShell activeRoute="/activity">
      <RouteHead
        title="Missed Collection Reports"
        description="Track missed bin collection reports and council references."
        path="/reports"
      />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView
          edges={['top']}
          style={[
            styles.header,
            {
              backgroundColor: theme.surface,
              borderBottomColor: theme.separator,
            },
          ]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.kicker, { color: theme.accent }]}>Activity</Text>
              <Text style={[styles.title, { color: theme.text }]}>Missed collections</Text>
              <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Official handoff, references and recollection updates</Text>
            </View>
            <Pressable
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.groupedBackground }, pressed && styles.pressed]}>
              <Ionicons color={theme.accent} name="settings-outline" size={21} />
            </Pressable>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.explainer, { backgroundColor: theme.accentSoft }]}>
            <Ionicons color={theme.accent} name="shield-checkmark-outline" size={23} />
            <Text style={[styles.explainerText, { color: theme.text }]}>
              Reports are tracked on this device. A council reference appears only when you enter one from the official council service.
            </Text>
          </View>

          {visibleReports.length ? visibleReports.map((report) => (
            <View key={report.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <View style={styles.cardTop}>
                <View style={[styles.reportIcon, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons color={theme.accent} name="document-text-outline" size={22} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{report.binLabel}</Text>
                  <Text style={[styles.cardMeta, { color: theme.secondaryText }]}>
                    {formatCollectionDate(report.collectionDate, 'weekday')} · {report.postcode}
                  </Text>
                </View>
                <View style={[styles.status, { backgroundColor: theme.groupedBackground }]}>
                  <Text style={[styles.statusText, { color: theme.accent }]}>{statusLabels[report.status]}</Text>
                </View>
              </View>

              <View style={[styles.detailGroup, { borderTopColor: theme.separator }]}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Local tracking ID</Text>
                  <Text selectable style={[styles.detailValue, { color: theme.text }]}>{report.localTrackingId}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Council reference</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{report.councilReference || 'Not added'}</Text>
                </View>
                {report.expectedRecollectionDate ? (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Expected recollection</Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {formatCollectionDate(report.expectedRecollectionDate, 'weekday')}
                    </Text>
                  </View>
                ) : null}
              </View>

              {!report.councilReference ? (
                <View style={styles.referenceRow}>
                  <TextInput
                    accessibilityLabel={`Council reference for ${report.binLabel}`}
                    onChangeText={(value) => setReferenceById((current) => ({ ...current, [report.id]: value }))}
                    placeholder="Add council reference"
                    placeholderTextColor={theme.tertiaryText}
                    style={[styles.referenceInput, { color: theme.text, backgroundColor: theme.groupedBackground, borderColor: theme.separator }]}
                    value={referenceById[report.id] ?? ''}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !(referenceById[report.id] ?? '').trim() }}
                    disabled={!(referenceById[report.id] ?? '').trim()}
                    onPress={() => updateReport(report.id, {
                      councilReference: referenceById[report.id].trim().slice(0, 80),
                      status: 'acknowledged',
                      statusSource: 'resident',
                      reportedAt: new Date().toISOString(),
                    })}
                    style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
                    <Text style={styles.smallButtonText}>Save</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.referenceRow}>
                <TextInput
                  accessibilityLabel={`Add an update for ${report.binLabel}`}
                  onChangeText={(value) => setUpdateById((current) => ({ ...current, [report.id]: value }))}
                  placeholder="Add a local update"
                  placeholderTextColor={theme.tertiaryText}
                  style={[styles.referenceInput, { color: theme.text, backgroundColor: theme.groupedBackground, borderColor: theme.separator }]}
                  value={updateById[report.id] ?? ''}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !(updateById[report.id] ?? '').trim() }}
                  disabled={!(updateById[report.id] ?? '').trim()}
                  onPress={() => {
                    updateReport(report.id, { userUpdate: updateById[report.id].trim().slice(0, 500) });
                    setUpdateById((current) => ({ ...current, [report.id]: '' }));
                  }}
                  style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
                  <Text style={styles.smallButtonText}>Add</Text>
                </Pressable>
              </View>

              {report.status !== 'resolved' && report.status !== 'cancelled' && report.status !== 'rejected' ? (
                <View style={styles.recollectionGroup}>
                  <Text style={[styles.recollectionLabel, { color: theme.secondaryText }]}>
                    Did the council give you a recollection date?
                  </Text>
                  <View style={styles.referenceRow}>
                    <TextInput
                      accessibilityLabel={`Expected recollection date for ${report.binLabel}`}
                      autoCapitalize="none"
                      inputMode="numeric"
                      maxLength={10}
                      onChangeText={(value) => setRecollectionById((current) => ({ ...current, [report.id]: value }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.tertiaryText}
                      style={[styles.referenceInput, { color: theme.text, backgroundColor: theme.groupedBackground, borderColor: theme.separator }]}
                      value={recollectionById[report.id] ?? ''}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !(recollectionById[report.id] ?? '').trim() }}
                      disabled={!(recollectionById[report.id] ?? '').trim()}
                      onPress={() => saveRecollection(report)}
                      style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
                      <Text style={styles.smallButtonText}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(report.officialServiceUrl)}
                  style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.separator }, pressed && styles.pressed]}>
                  <Ionicons color={theme.accent} name="open-outline" size={18} />
                  <Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Official council service</Text>
                </Pressable>
                <View style={styles.actionPair}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void copyReference(report)}
                    style={({ pressed }) => [styles.pairButton, { borderColor: theme.separator }, pressed && styles.pressed]}>
                    <Ionicons color={theme.accent} name="copy-outline" size={18} />
                    <Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Copy ID</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void shareReport(report)}
                    style={({ pressed }) => [styles.pairButton, { borderColor: theme.separator }, pressed && styles.pressed]}>
                    <Ionicons color={theme.accent} name="share-outline" size={18} />
                    <Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Share</Text>
                  </Pressable>
                </View>
                {report.status !== 'resolved' && report.status !== 'cancelled' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setStatus(
                      report,
                      report.status === 'awaiting-response' || report.status === 'reported'
                        || report.status === 'acknowledged' || report.status === 'recollection-scheduled'
                        ? 'resolved'
                        : 'reported',
                    )}
                    style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
                    <Text style={styles.primaryButtonText}>
                      {report.status === 'awaiting-response' || report.status === 'reported'
                        || report.status === 'acknowledged' || report.status === 'recollection-scheduled'
                        ? 'Mark resolved'
                        : 'I submitted this to the council'}
                    </Text>
                  </Pressable>
                ) : null}
                {report.status !== 'resolved' && report.status !== 'cancelled' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => Alert.alert(
                      'Stop tracking this report?',
                      'This only cancels the local record. It does not cancel anything submitted to the council.',
                      [
                        { text: 'Keep tracking', style: 'cancel' },
                        { text: 'Cancel local tracking', style: 'destructive', onPress: () => setStatus(report, 'cancelled') },
                      ],
                    )}
                    style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                    <Text style={[styles.cancelText, { color: theme.danger }]}>Cancel local tracking</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )) : (
            <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Ionicons color={theme.accent} name="checkmark-circle-outline" size={36} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No missed collection reports</Text>
              <Text style={[styles.emptyCopy, { color: theme.secondaryText }]}>
                If a due collection is missed, start the report from Today after the collection window ends.
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/history')}
            style={({ pressed }) => [styles.historyLink, { backgroundColor: theme.surface, borderColor: theme.separator }, pressed && styles.pressed]}>
            <Ionicons color={theme.accent} name="time-outline" size={21} />
            <View style={styles.historyCopy}>
              <Text style={[styles.historyTitle, { color: theme.text }]}>Activity history</Text>
              <Text style={[styles.historyDetail, { color: theme.secondaryText }]}>Collections, reports, and data feedback</Text>
            </View>
            <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
          </Pressable>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  kicker: { fontFamily: appFonts.text, fontSize: 13, fontWeight: '700' },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1, marginTop: 2 },
  subtitle: { fontSize: 15, lineHeight: 20, marginTop: 2 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 112, gap: 14 },
  explainer: { padding: 14, borderRadius: 14, flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  explainerText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 15, gap: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  reportIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  cardMeta: { fontSize: 13, marginTop: 3 },
  status: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, maxWidth: 115 },
  statusText: { fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  detailGroup: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 7 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { fontSize: 13 },
  detailValue: { flexShrink: 1, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  referenceRow: { flexDirection: 'row', gap: 8 },
  recollectionGroup: { gap: 7 },
  recollectionLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  referenceInput: { flex: 1, height: 44, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, fontSize: 14 },
  smallButton: { minWidth: 68, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  actions: { gap: 9 },
  actionPair: { flexDirection: 'row', gap: 9 },
  pairButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryButton: { minHeight: 46, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryButtonText: { fontSize: 14, fontWeight: '700' },
  primaryButton: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700' },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 28, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyCopy: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 7, maxWidth: 330 },
  historyLink: { minHeight: 70, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  historyCopy: { flex: 1 },
  historyTitle: { fontSize: 15, fontWeight: '700' },
  historyDetail: { fontSize: 13, marginTop: 3 },
  pressed: { opacity: 0.66 },
});

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, Linking, Pressable, Share, Text, TextInput, View } from 'react-native';

import { reportsStyles as styles } from '@/features/reports/reports-styles';
import { formatCollectionDate } from '@/lib/data';
import { useAppTheme } from '@/lib/theme';
import { MissedCollectionReport } from '@/lib/types';

export const reportStatusLabels: Record<MissedCollectionReport['status'], string> = {
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

type Feedback = { message: string; tone: 'danger' | 'success' };

export function MissedCollectionReportCard({
  report,
  onFeedback,
  updateReport,
}: {
  report: MissedCollectionReport;
  onFeedback: (feedback: Feedback) => void;
  updateReport: (id: string, patch: Partial<MissedCollectionReport>) => void;
}) {
  const theme = useAppTheme();
  const [reference, setReference] = useState('');
  const [residentUpdate, setResidentUpdate] = useState('');
  const [recollection, setRecollection] = useState('');

  function setStatus(status: MissedCollectionReport['status']) {
    updateReport(report.id, {
      status,
      statusSource: 'resident',
      reportedAt: status === 'reported' || status === 'awaiting-response' ? new Date().toISOString() : report.reportedAt,
      resolvedAt: status === 'resolved' ? new Date().toISOString() : report.resolvedAt,
    });
  }

  function saveRecollection() {
    const value = recollection.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T12:00:00`).getTime())) {
      onFeedback({ message: 'Enter the council recollection date as YYYY-MM-DD.', tone: 'danger' });
      return;
    }
    if (value < new Date().toISOString().slice(0, 10)) {
      onFeedback({ message: 'The recollection date cannot be in the past.', tone: 'danger' });
      return;
    }
    updateReport(report.id, { expectedRecollectionDate: value, status: 'recollection-scheduled', statusSource: 'resident' });
    setRecollection('');
    onFeedback({ message: 'The expected recollection date was saved on this device.', tone: 'success' });
  }

  function summary() {
    return [
      `Missed ${report.binLabel.toLowerCase()} collection`,
      `${report.propertyAddress}, ${report.postcode}`,
      `Scheduled: ${formatCollectionDate(report.collectionDate, 'weekday')}`,
      `Council: ${report.councilName}`,
      `Status: ${reportStatusLabels[report.status]}`,
      `Council reference: ${report.councilReference || 'Not supplied'}`,
      report.expectedRecollectionDate ? `Expected recollection: ${formatCollectionDate(report.expectedRecollectionDate, 'weekday')}` : '',
      `Local tracking ID: ${report.localTrackingId}`,
      report.userUpdate ? `Update: ${report.userUpdate}` : '',
    ].filter(Boolean).join('\n');
  }

  async function copyReference() {
    await Clipboard.setStringAsync(report.councilReference || report.localTrackingId);
    onFeedback({ message: report.councilReference ? 'Council reference copied.' : 'Local tracking ID copied.', tone: 'success' });
  }

  const terminal = report.status === 'resolved' || report.status === 'cancelled';
  const reportInProgress = ['awaiting-response', 'reported', 'acknowledged', 'recollection-scheduled'].includes(report.status);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
      <View style={styles.cardTop}>
        <View style={[styles.reportIcon, { backgroundColor: theme.accentSoft }]}><Ionicons color={theme.accent} name="document-text-outline" size={22} /></View>
        <View style={styles.cardCopy}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.text }]}>{report.binLabel}</Text>
          <Text style={[styles.cardMeta, { color: theme.secondaryText }]}>{formatCollectionDate(report.collectionDate, 'weekday')} · {report.postcode}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: theme.groupedBackground }]}><Text style={[styles.statusText, { color: theme.accent }]}>{reportStatusLabels[report.status]}</Text></View>
      </View>

      <View style={[styles.detailGroup, { borderTopColor: theme.separator }]}>
        <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Local tracking ID</Text><Text selectable style={[styles.detailValue, { color: theme.text }]}>{report.localTrackingId}</Text></View>
        <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Council reference</Text><Text style={[styles.detailValue, { color: theme.text }]}>{report.councilReference || 'Not added'}</Text></View>
        {report.expectedRecollectionDate ? <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Expected recollection</Text><Text style={[styles.detailValue, { color: theme.text }]}>{formatCollectionDate(report.expectedRecollectionDate, 'weekday')}</Text></View> : null}
      </View>

      {!report.councilReference ? (
        <View style={styles.referenceRow}>
          <TextInput accessibilityLabel={`Council reference for ${report.binLabel}`} onChangeText={setReference} placeholder="Add council reference" placeholderTextColor={theme.tertiaryText} style={[styles.referenceInput, { color: theme.text, backgroundColor: theme.groupedBackground, borderColor: theme.separator }]} value={reference} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !reference.trim() }} disabled={!reference.trim()} onPress={() => updateReport(report.id, { councilReference: reference.trim().slice(0, 80), status: 'acknowledged', statusSource: 'resident', reportedAt: new Date().toISOString() })} style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.accentFill }, pressed && styles.pressed]}><Text style={styles.smallButtonText}>Save</Text></Pressable>
        </View>
      ) : null}

      <View style={styles.referenceRow}>
        <TextInput accessibilityLabel={`Add an update for ${report.binLabel}`} onChangeText={setResidentUpdate} placeholder="Add a local update" placeholderTextColor={theme.tertiaryText} style={[styles.referenceInput, { color: theme.text, backgroundColor: theme.groupedBackground, borderColor: theme.separator }]} value={residentUpdate} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !residentUpdate.trim() }} disabled={!residentUpdate.trim()} onPress={() => { updateReport(report.id, { userUpdate: residentUpdate.trim().slice(0, 500) }); setResidentUpdate(''); }} style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.accentFill }, pressed && styles.pressed]}><Text style={styles.smallButtonText}>Add</Text></Pressable>
      </View>

      {!['resolved', 'cancelled', 'rejected'].includes(report.status) ? (
        <View style={styles.recollectionGroup}>
          <Text style={[styles.recollectionLabel, { color: theme.secondaryText }]}>Did the council give you a recollection date?</Text>
          <View style={styles.referenceRow}>
            <TextInput accessibilityLabel={`Expected recollection date for ${report.binLabel}`} autoCapitalize="none" inputMode="numeric" maxLength={10} onChangeText={setRecollection} placeholder="YYYY-MM-DD" placeholderTextColor={theme.tertiaryText} style={[styles.referenceInput, { color: theme.text, backgroundColor: theme.groupedBackground, borderColor: theme.separator }]} value={recollection} />
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !recollection.trim() }} disabled={!recollection.trim()} onPress={saveRecollection} style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.accentFill }, pressed && styles.pressed]}><Text style={styles.smallButtonText}>Save</Text></Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(report.officialServiceUrl)} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.separator }, pressed && styles.pressed]}><Ionicons color={theme.accent} name="open-outline" size={18} /><Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Official council service</Text></Pressable>
        <View style={styles.actionPair}>
          <Pressable accessibilityRole="button" onPress={() => void copyReference()} style={({ pressed }) => [styles.pairButton, { borderColor: theme.separator }, pressed && styles.pressed]}><Ionicons color={theme.accent} name="copy-outline" size={18} /><Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Copy ID</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void Share.share({ message: summary() })} style={({ pressed }) => [styles.pairButton, { borderColor: theme.separator }, pressed && styles.pressed]}><Ionicons color={theme.accent} name="share-outline" size={18} /><Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Share</Text></Pressable>
        </View>
        {!terminal ? <Pressable accessibilityRole="button" onPress={() => setStatus(reportInProgress ? 'resolved' : 'reported')} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.accentFill }, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{reportInProgress ? 'Mark resolved' : 'I submitted this to the council'}</Text></Pressable> : null}
        {!terminal ? <Pressable accessibilityRole="button" onPress={() => Alert.alert('Stop tracking this report?', 'This only cancels the local record. It does not cancel anything submitted to the council.', [{ text: 'Keep tracking', style: 'cancel' }, { text: 'Cancel local tracking', style: 'destructive', onPress: () => setStatus('cancelled') }])} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={[styles.cancelText, { color: theme.danger }]}>Cancel local tracking</Text></Pressable> : null}
      </View>
    </View>
  );
}

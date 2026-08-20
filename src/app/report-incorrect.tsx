import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { InlineNotice } from '@/components/resident-layout';
import { RouteHead } from '@/components/route-head';
import { apiBase } from '@/lib/api-base';
import { dataQualityClientId } from '@/lib/data-quality-client';
import { DataQualityReportPayload, redactDataQualityText } from '@/lib/data-quality-report';
import { useAppTheme } from '@/lib/theme';
import { IncorrectDataFeedback } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useOnlineStatus } from '@/lib/use-online-status';
import { useProductState } from '@/lib/use-product-state';

const issues: { value: IncorrectDataFeedback['issue']; label: string }[] = [
  { value: 'wrong-date', label: 'Wrong collection date' },
  { value: 'wrong-bin', label: 'Wrong bin or container' },
  { value: 'missing-collection', label: 'A collection is missing' },
  { value: 'address-not-recognised', label: 'Address not recognised' },
  { value: 'wrong-council', label: 'Wrong council' },
  { value: 'guide-problem', label: 'Disposal guidance is wrong' },
  { value: 'service-problem', label: 'Local service information is wrong' },
  { value: 'other', label: 'Something else' },
];

type SubmissionResponse = {
  trackingReference?: unknown;
  submittedAt?: unknown;
  error?: unknown;
};

export default function ReportIncorrectScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ issue?: string; detail?: string }>();
  const { activeAddress, collections, lastVerifiedAt } = useAppData();
  const online = useOnlineStatus();
  const { saveIncorrectFeedback } = useProductState();
  const initialIssue = issues.some((item) => item.value === params.issue)
    ? params.issue as IncorrectDataFeedback['issue']
    : 'wrong-date';
  const [issue, setIssue] = useState<IncorrectDataFeedback['issue']>(initialIssue);
  const [detail, setDetail] = useState(params.detail?.slice(0, 1_000) ?? '');
  const [expectedValue, setExpectedValue] = useState('');
  const [preview, setPreview] = useState<DataQualityReportPayload>();
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [successReference, setSuccessReference] = useState<string>();

  function invalidatePreview() {
    setPreview(undefined);
    setError(undefined);
    setSuccessReference(undefined);
  }

  async function preparePreview() {
    const safeDetail = redactDataQualityText(detail, 1_000);
    const safeExpectedValue = redactDataQualityText(expectedValue, 500);
    if (!safeDetail) {
      setError('Add a short description of what the app shows and why it is wrong. Do not include an address or postcode.');
      return;
    }
    setPreparing(true);
    setError(undefined);
    try {
      const nextPreview: DataQualityReportPayload = {
        issue,
        detail: safeDetail,
        ...(safeExpectedValue ? { expectedValue: safeExpectedValue } : {}),
        ...(activeAddress?.providerId ? { councilProviderId: activeAddress.providerId } : {}),
        ...(collections[0]?.date ? { displayedCollectionDate: collections[0].date } : {}),
        ...(lastVerifiedAt ? { lastVerifiedAt } : {}),
        appVersion: Constants.expoConfig?.version ?? '1.1.0',
        online,
        clientId: await dataQualityClientId(),
        clientRequestId: Crypto.randomUUID(),
      };
      setDetail(safeDetail);
      setExpectedValue(safeExpectedValue);
      setPreview(nextPreview);
    } catch {
      setError('The private report preview could not be prepared. Try again.');
    } finally {
      setPreparing(false);
    }
  }

  async function submitPreview() {
    if (!preview || submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await fetch(`${apiBase}/data-quality/reports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(preview),
      });
      const result = await response.json().catch((): SubmissionResponse => ({})) as SubmissionResponse;
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after') ?? 0);
          const retryText = Number.isFinite(retryAfter) && retryAfter > 0
            ? ` Try again in about ${Math.ceil(retryAfter / 60)} minute${retryAfter > 60 ? 's' : ''}.`
            : ' Try again later.';
          throw new Error(`This app installation has sent too many reports.${retryText}`);
        }
        throw new Error(typeof result.error === 'string' ? result.error : 'The private report could not be sent.');
      }
      if (
        typeof result.trackingReference !== 'string'
        || !/^DQ-\d{8}-[0-9A-F]{12}$/.test(result.trackingReference)
        || typeof result.submittedAt !== 'string'
        || !Number.isFinite(new Date(result.submittedAt).getTime())
      ) {
        throw new Error('The private report was not acknowledged correctly. Try again.');
      }
      saveIncorrectFeedback({
        issue: preview.issue,
        detail: preview.detail,
        expectedValue: preview.expectedValue,
        technicalContext: {
          appVersion: preview.appVersion,
          providerId: preview.councilProviderId,
          displayedDate: preview.displayedCollectionDate,
          lastRefreshAt: preview.lastVerifiedAt,
          online: preview.online,
          clientRequestId: preview.clientRequestId,
          trackingReference: result.trackingReference,
        },
      });
      setPreview(undefined);
      setSuccessReference(result.trackingReference);
    } catch (submissionError) {
      setError(submissionError instanceof Error
        ? submissionError.message
        : 'The private report could not be sent.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell activeRoute="/report-incorrect">
      <RouteHead title="Report Incorrect Information" description="Privately report an incorrect date, bin, council or recycling entry without sending your address." path="/report-incorrect" private />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Close feedback form" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Ionicons color={theme.accent} name="close" size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Incorrect app information</Text>
          <View style={styles.back} />
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.notice, { backgroundColor: theme.accentSoft }]}>
            <Ionicons color={theme.accent} name="shield-checkmark-outline" size={21} />
            <Text style={[styles.noticeText, { color: theme.text }]}>
              This goes to a private first-party queue. The client ID in the preview is a dedicated pseudonymous reference used only to rate-limit this queue. We do not attach your saved postcode, street address, property reference or place label. Postcode-shaped text is removed, but addresses and place names typed into these boxes cannot always be detected—remove them in the preview.
            </Text>
          </View>

          {successReference ? (
            <View accessibilityLiveRegion="polite" style={styles.successBlock}>
              <InlineNotice body={`Tracking reference: ${successReference}`} title="Report sent privately" tone="success" />
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.button, { backgroundColor: theme.accentFill }]}>
                <Text style={styles.buttonText}>Done</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={[styles.label, { color: theme.secondaryText }]}>What is wrong?</Text>
          <View style={[styles.options, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            {issues.map((item, index) => (
              <Pressable
                aria-checked={issue === item.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: issue === item.value }}
                key={item.value}
                onPress={() => { setIssue(item.value); invalidatePreview(); }}
                style={[styles.option, index < issues.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.optionText, { color: theme.text }]}>{item.label}</Text>
                <Ionicons color={issue === item.value ? theme.accent : theme.tertiaryText} name={issue === item.value ? 'checkmark-circle' : 'ellipse-outline'} size={22} />
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.secondaryText }]}>What does the app show?</Text>
          <TextInput
            accessibilityLabel="What the app shows"
            maxLength={1_000}
            multiline
            onChangeText={(value) => { setDetail(value); invalidatePreview(); }}
            placeholder="Describe the incorrect information without an address or postcode"
            placeholderTextColor={theme.tertiaryText}
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]}
            value={detail}
          />

          <Text style={[styles.label, { color: theme.secondaryText }]}>What should it show? (optional)</Text>
          <TextInput
            accessibilityLabel="Expected information"
            maxLength={500}
            multiline
            onChangeText={(value) => { setExpectedValue(value); invalidatePreview(); }}
            placeholder="Add the expected date, bin type, council or guidance"
            placeholderTextColor={theme.tertiaryText}
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]}
            value={expectedValue}
          />

          {!preview ? (
            <Pressable
              accessibilityRole="button"
              disabled={preparing}
              onPress={() => void preparePreview()}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.accentFill }, (pressed || preparing) && styles.pressed]}>
              <Text style={styles.buttonText}>{preparing ? 'Preparing preview…' : 'Review private report'}</Text>
            </Pressable>
          ) : (
            <View style={[styles.preview, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <View style={styles.previewHeading}>
                <View style={styles.previewCopy}>
                  <Text style={[styles.previewTitle, { color: theme.text }]}>Exact payload to be sent</Text>
                  <Text style={[styles.previewDescription, { color: theme.secondaryText }]}>Check this redacted payload before submitting. Remove any address or place name that remains; nothing else is added by the app.</Text>
                </View>
                <Ionicons color={theme.accent} name="eye-outline" size={22} />
              </View>
              <ScrollView horizontal style={[styles.codeFrame, { backgroundColor: theme.background }]}>
                <Text selectable style={[styles.code, { color: theme.text }]}>{JSON.stringify(preview, null, 2)}</Text>
              </ScrollView>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void submitPreview()}
                style={({ pressed }) => [styles.button, { backgroundColor: theme.accentFill }, (pressed || submitting) && styles.pressed]}>
                <Text style={styles.buttonText}>{submitting ? 'Sending privately…' : 'Send private report'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={submitting} onPress={() => setPreview(undefined)} style={styles.editButton}>
                <Text style={[styles.editButtonText, { color: theme.accent }]}>Edit report</Text>
              </Pressable>
            </View>
          )}

          {error ? (
            <View accessibilityRole="alert" style={[styles.error, { backgroundColor: theme.accentSoft }]}>
              <Ionicons color={theme.warning} name="alert-circle-outline" size={20} />
              <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
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
  content: { padding: 16, paddingBottom: 50, gap: 13 },
  notice: { padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  options: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, overflow: 'hidden' },
  option: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  optionText: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 92, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, padding: 13, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  button: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4, paddingHorizontal: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.58 },
  preview: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 14, gap: 13 },
  previewHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  previewCopy: { flex: 1, gap: 4 },
  previewTitle: { fontSize: 15, fontWeight: '700' },
  previewDescription: { fontSize: 13, lineHeight: 18 },
  codeFrame: { borderRadius: 10, padding: 12 },
  code: { fontFamily: 'monospace', fontSize: 12, lineHeight: 17 },
  editButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  editButtonText: { fontSize: 14, fontWeight: '700' },
  error: { padding: 13, borderRadius: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
  successBlock: { gap: 8 },
});

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { ToggleIndicator } from '@/components/toggle-indicator';
import { collectionDisplayMeta, formatCollectionDate, sortCollections } from '@/lib/data';
import {
  buildMissedReport,
  evaluateMissedReportEligibility,
  reportingCapability,
  residentReportingRule,
} from '@/lib/council-reporting';
import { useAppTheme } from '@/lib/theme';
import { useAppData } from '@/lib/use-app-data';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useProductState } from '@/lib/use-product-state';
import { useCouncilProfile } from '@/lib/use-council-profile';

export default function ReportMissedScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ collectionId?: string }>();
  const { activeAddress, collections } = useAppData();
  const analytics = usePilotAnalytics();
  const { markCollection, outcomeFor, reports, saveReport } = useProductState();
  const councilProfile = useCouncilProfile(activeAddress?.providerId);
  const remoteReporting = residentReportingRule(councilProfile);
  const collection = useMemo(() => (
    collections.find((item) => item.id === params.collectionId)
    ?? sortCollections(collections).find((item) => new Date(`${item.date}T17:00:00`) <= new Date())
  ), [collections, params.collectionId]);
  const existingOutcome = outcomeFor(activeAddress?.id, collection);
  const existingReport = reports.find((report) => (
    report.addressId === activeAddress?.id
    && report.collectionId === collection?.id
    && report.status !== 'cancelled'
    && report.status !== 'closed'
  ));
  const [putOutOnTime, setPutOutOnTime] = useState(existingOutcome?.status === 'put-out');
  const [accessibleToCrew, setAccessibleToCrew] = useState(false);
  const [noAttachedNotice, setNoAttachedNotice] = useState(false);
  const [stillOutside, setStillOutside] = useState(false);
  const [contentsAccepted, setContentsAccepted] = useState(false);
  const [lidClosed, setLidClosed] = useState(false);
  const [notOverweight, setNotOverweight] = useState(false);
  const [knownServiceIssueChecked, setKnownServiceIssueChecked] = useState(false);
  const [neighboursCollected, setNeighboursCollected] = useState<'yes' | 'no' | 'unknown'>('unknown');
  const [notes, setNotes] = useState('');
  const eligibilityRecorded = useRef<string | undefined>(undefined);
  const analyticsEligibility = activeAddress && collection
    ? evaluateMissedReportEligibility(activeAddress, collection, new Date(), remoteReporting)
    : undefined;
  const analyticsCapability = activeAddress ? reportingCapability(activeAddress, remoteReporting) : undefined;

  useEffect(() => {
    if (
      !analyticsEligibility?.eligible
      || !analyticsCapability
      || !activeAddress
      || !collection
      || eligibilityRecorded.current === collection.id
    ) return;
    eligibilityRecorded.current = collection.id;
    analytics.track('missed_report_eligible', {
      councilId: activeAddress.providerId,
      context: analyticsCapability.method === 'direct-api' ? 'direct-api' : 'council-website',
      outcome: 'eligible',
    });
  }, [activeAddress, analytics, analyticsCapability, analyticsEligibility?.eligible, collection]);

  if (!activeAddress || !collection) {
    return (
      <AppShell activeRoute="/report-missed">
        <RouteHead title="Report a Missed Collection" description="Check council eligibility and continue to the official missed-bin reporting service." path="/report-missed" private />
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Ionicons color={theme.accent} name="calendar-outline" size={36} />
          <Text style={[styles.centerTitle, { color: theme.text }]}>No eligible collection selected</Text>
          <Text style={[styles.centerCopy, { color: theme.secondaryText }]}>Open Today after a collection window to report a missed bin.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={[styles.cta, { backgroundColor: theme.accentFill }]}>
            <Text style={styles.ctaText}>Back to Today</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  if (councilProfile?.featureFlags?.missedCollection === false) {
    return (
      <AppShell activeRoute="/activity">
        <RouteHead title="Missed Collection" description="Missed-collection reporting availability for the selected council." path="/report-missed" private />
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Ionicons color={theme.secondaryText} name="shield-outline" size={36} />
          <Text style={[styles.centerTitle, { color: theme.text }]}>Reporting is not enabled here</Text>
          <Text style={[styles.centerCopy, { color: theme.secondaryText }]}>This council has not enabled a missed-collection route inside What Bin. No report has been created.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/activity' as Href)} style={[styles.cta, { backgroundColor: theme.accentFill }]}>
            <Text style={styles.ctaText}>Back to Activity</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  if (existingReport) {
    return (
      <AppShell activeRoute="/report-missed">
        <RouteHead title="Report Already Tracked" description="Open the existing local missed-collection record and official council service." path="/report-missed" private />
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Ionicons color={theme.accent} name="document-text-outline" size={36} />
          <Text style={[styles.centerTitle, { color: theme.text }]}>This report is already tracked</Text>
          <Text style={[styles.centerCopy, { color: theme.secondaryText }]}>
            Open Activity to copy its reference, add an update or return to the official council service.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/activity' as Href)} style={[styles.cta, { backgroundColor: theme.accentFill }]}>
            <Text style={styles.ctaText}>View report</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  const meta = collectionDisplayMeta(collection);
  const capability = reportingCapability(activeAddress, remoteReporting);
  const eligibility = evaluateMissedReportEligibility(activeAddress, collection, new Date(), remoteReporting);
  const eligible = eligibility.eligible;
  const canContinue = (
    putOutOnTime
    && accessibleToCrew
    && noAttachedNotice
    && stillOutside
    && (!eligibility.policy.requiresContentCheck || contentsAccepted)
    && (!eligibility.policy.requiresLidClosed || lidClosed)
    && (!eligibility.policy.requiresWeightCheck || notOverweight)
    && (!eligibility.policy.requiresKnownIssuesCheck || knownServiceIssueChecked)
  );

  async function continueToCouncil() {
    if (!activeAddress || !collection || !eligible || !canContinue) return;
    const report = buildMissedReport(activeAddress, collection, meta.label, {
      putOutOnTime,
      accessibleToCrew,
      attachedNotice: false,
      stillOutside,
      contentsAccepted: eligibility.policy.requiresContentCheck ? contentsAccepted : undefined,
      lidClosed: eligibility.policy.requiresLidClosed ? lidClosed : undefined,
      notOverweight: eligibility.policy.requiresWeightCheck ? notOverweight : undefined,
      neighboursCollected,
      knownServiceIssueChecked: eligibility.policy.requiresKnownIssuesCheck
        ? knownServiceIssueChecked
        : undefined,
      notes: notes.trim() || undefined,
    }, new Date(), remoteReporting);
    report.status = 'opened-council-service';
    report.updatedAt = new Date().toISOString();
    saveReport(report);
    markCollection(activeAddress, collection, 'missed');
    await Clipboard.setStringAsync([
      'Missed collection details',
      `Address: ${activeAddress.line1}, ${activeAddress.postcode}`,
      `Council: ${activeAddress.councilName}`,
      `Collection: ${meta.label}`,
      `Scheduled date: ${formatCollectionDate(collection.date, 'weekday')}`,
      `Put out on time: ${putOutOnTime ? 'Yes' : 'No'}`,
      `Accessible to crew: ${accessibleToCrew ? 'Yes' : 'No'}`,
      'Tag or notice attached: No',
      `Bin still outside: ${stillOutside ? 'Yes' : 'No'}`,
      eligibility.policy.requiresContentCheck ? `Contents accepted: ${contentsAccepted ? 'Yes' : 'No'}` : '',
      eligibility.policy.requiresLidClosed ? `Lid closed: ${lidClosed ? 'Yes' : 'No'}` : '',
      eligibility.policy.requiresWeightCheck ? `Not overweight: ${notOverweight ? 'Yes' : 'No'}` : '',
      eligibility.policy.requiresKnownIssuesCheck ? 'Checked known service issues: Yes' : '',
      `Neighbours collected: ${neighboursCollected === 'unknown' ? 'Not sure' : neighboursCollected === 'yes' ? 'Yes' : 'No'}`,
      notes.trim() ? `Note: ${notes.trim()}` : '',
      `Local tracking ID: ${report.localTrackingId}`,
    ].filter(Boolean).join('\n'));
    await Linking.openURL(report.officialServiceUrl);
    analytics.track('missed_report_route_opened', {
      councilId: activeAddress.providerId,
      context: capability.method === 'direct-api' ? 'direct-api' : 'council-website',
      outcome: 'opened',
    });
    router.replace('/activity' as Href);
  }

  const checks = [
    ['Put out before the council cut-off', putOutOnTime, setPutOutOnTime],
    ['Accessible to the collection crew', accessibleToCrew, setAccessibleToCrew],
    ['No tag or notice is attached to the bin', noAttachedNotice, setNoAttachedNotice],
    ['The bin is still outside', stillOutside, setStillOutside],
    ...(eligibility.policy.requiresContentCheck
      ? [['The bin contains only accepted items', contentsAccepted, setContentsAccepted] as const]
      : []),
    ...(eligibility.policy.requiresLidClosed
      ? [['The lid was fully closed', lidClosed, setLidClosed] as const]
      : []),
    ...(eligibility.policy.requiresWeightCheck
      ? [['The bin was not overloaded or too heavy', notOverweight, setNotOverweight] as const]
      : []),
    ...(eligibility.policy.requiresKnownIssuesCheck
      ? [['I checked the live missed-streets or service-issues list', knownServiceIssueChecked, setKnownServiceIssueChecked] as const]
      : []),
  ] as const;

  return (
    <AppShell activeRoute="/report-missed">
      <RouteHead title="Report a Missed Collection" description="Check council eligibility and continue to the official missed-bin reporting service." path="/report-missed" private />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <View style={styles.navRow}>
            <Pressable accessibilityLabel="Close missed collection report" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
              <Ionicons color={theme.accent} name="chevron-back" size={24} />
            </Pressable>
            <Text style={[styles.navTitle, { color: theme.text }]}>Report missed collection</Text>
            <View style={styles.back} />
          </View>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons color={theme.accent} name="trash-bin-outline" size={25} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>{meta.label}</Text>
              <Text style={[styles.summaryMeta, { color: theme.secondaryText }]}>{formatCollectionDate(collection.date, 'weekday')}</Text>
              <Text style={[styles.summaryMeta, { color: theme.secondaryText }]}>{activeAddress.line1} · {activeAddress.postcode}</Text>
            </View>
          </View>

          <View style={[styles.eligibility, { backgroundColor: eligible ? theme.accentSoft : theme.groupedBackground }]}>
            <Ionicons color={eligible ? theme.success : theme.warning} name={eligible ? 'checkmark-circle-outline' : 'time-outline'} size={22} />
            <View style={styles.eligibilityCopy}>
              <Text style={[styles.eligibilityTitle, { color: theme.text }]}>
                {eligible
                  ? 'Ready to check the council service'
                  : eligibility.expired
                    ? 'The app reporting window has passed'
                    : 'Collection window still open'}
              </Text>
              <Text style={[styles.eligibilityText, { color: theme.secondaryText }]}>
                {eligible
                  ? `${capability.description} Your report details will be copied so they are ready to paste.`
                  : eligibility.reason}
              </Text>
              {eligibility.policy.sourceUrl ? (
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(eligibility.policy.sourceUrl!)}>
                  <Text style={[styles.policyLink, { color: theme.accent }]}>View this council’s reporting rules</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Before you continue</Text>
          {eligibility.policy.knownIssuesUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(eligibility.policy.knownIssuesUrl!)}
              style={({ pressed }) => [
                styles.knownIssuesButton,
                { backgroundColor: theme.accentSoft, borderColor: theme.separator },
                pressed && styles.pressed,
              ]}>
              <Ionicons color={theme.accent} name="megaphone-outline" size={20} />
              <View style={styles.knownIssuesCopy}>
                <Text style={[styles.knownIssuesTitle, { color: theme.text }]}>Check known missed streets first</Text>
                <Text style={[styles.knownIssuesDetail, { color: theme.secondaryText }]}>
                  If your street is listed, leave the bin out and do not send another report.
                </Text>
              </View>
              <Ionicons color={theme.accent} name="open-outline" size={18} />
            </Pressable>
          ) : null}
          <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            {checks.map(([label, value, setter], index) => (
              <Pressable
                aria-checked={value}
                accessibilityRole="switch"
                accessibilityState={{ checked: value }}
                key={label}
                onPress={() => setter(!value)}
                style={[styles.toggleRow, index < checks.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
                <ToggleIndicator value={value} />
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>Were neighbouring bins collected?</Text>
          <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: theme.groupedBackground }]}>
            {(['yes', 'no', 'unknown'] as const).map((value) => (
              <Pressable
                aria-checked={neighboursCollected === value}
                accessibilityRole="radio"
                accessibilityState={{ checked: neighboursCollected === value }}
                key={value}
                onPress={() => setNeighboursCollected(value)}
                style={[styles.segmentOption, neighboursCollected === value && { backgroundColor: theme.surface }]}>
                <Text style={[styles.segmentText, { color: neighboursCollected === value ? theme.accent : theme.secondaryText }]}>
                  {value === 'unknown' ? 'Not sure' : value === 'yes' ? 'Yes' : 'No'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>Anything else? (optional)</Text>
          <TextInput
            accessibilityLabel="Additional missed collection details"
            multiline
            onChangeText={setNotes}
            placeholder="For example, the rest of the street was collected."
            placeholderTextColor={theme.tertiaryText}
            style={[styles.notes, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]}
            value={notes}
          />

          {!canContinue ? (
            <View style={[styles.warning, { borderColor: theme.warning }]}>
              <Ionicons color={theme.warning} name="information-circle-outline" size={20} />
              <Text style={[styles.warningText, { color: theme.secondaryText }]}>
                The council may reject this as a missed collection. Review any sticker or access issue first.
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="link"
            accessibilityState={{ disabled: !eligible || !canContinue }}
            disabled={!eligible || !canContinue}
            onPress={() => void continueToCouncil()}
            style={({ pressed }) => [styles.cta, { backgroundColor: theme.accentFill }, (!eligible || !canContinue) && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.ctaText}>Continue to official council service</Text>
            <Ionicons color="#FFFFFF" name="open-outline" size={18} />
          </Pressable>
          <Text style={[styles.truthNote, { color: theme.secondaryText }]}>
            The app does not claim to submit the report. It opens the official service and keeps a local tracking record for you.
          </Text>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  navRow: { height: 54, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 110, gap: 14 },
  summary: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1 },
  summaryTitle: { fontSize: 18, fontWeight: '700' },
  summaryMeta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  eligibility: { borderRadius: 14, padding: 14, flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  eligibilityCopy: { flex: 1 },
  eligibilityTitle: { fontSize: 15, fontWeight: '700' },
  eligibilityText: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  policyLink: { minHeight: 44, paddingTop: 9, fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 },
  knownIssuesButton: { minHeight: 68, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  knownIssuesCopy: { flex: 1 },
  knownIssuesTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  knownIssuesDetail: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  formCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, overflow: 'hidden' },
  toggleRow: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 11 },
  segmentOption: { flex: 1, minHeight: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
  notes: { minHeight: 96, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, padding: 13, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  warning: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18 },
  cta: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  truthNote: { fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerTitle: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  centerCopy: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 7, marginBottom: 18 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.68 },
});

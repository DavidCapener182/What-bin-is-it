import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { residentAlertsForProfile, ResidentAlert } from '@/lib/resident-alerts';
import { AppTheme, useAppTheme } from '@/lib/theme';
import { ActivityEntry, MissedCollectionReport } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';
import { useProductState } from '@/lib/use-product-state';
import { useResidentSupport } from '@/lib/use-resident-support';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';

const activityIcons: Record<ActivityEntry['type'], keyof typeof Ionicons.glyphMap> = {
  'address-added': 'location-outline',
  'dates-refreshed': 'refresh-outline',
  'bin-put-out': 'arrow-up-circle-outline',
  'collection-confirmed': 'checkmark-circle-outline',
  'missed-collection': 'alert-circle-outline',
  'report-opened': 'document-text-outline',
  'report-updated': 'create-outline',
  'feedback-saved': 'flag-outline',
};

const terminalReportStatuses = new Set<MissedCollectionReport['status']>(['resolved', 'rejected', 'cancelled', 'closed']);

function friendlyDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function ActivityScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { activeAddress, collections } = useAppData();
  const profile = useCouncilProfile(activeAddress?.providerId);
  const support = useResidentSupport();
  const analytics = usePilotAnalytics();
  const shownAlertIds = useRef(new Set<string>());
  const {
    reports,
    history,
    councilNotices,
    markCouncilNoticeRead,
    markCouncilNoticesRead,
    archiveCouncilNotice,
    setCouncilNoticesMuted,
  } = useProductState();
  const alerts = residentAlertsForProfile(profile, collections)
    .filter((alert) => !councilNotices.archivedAtById[alert.id]);
  const unreadAlerts = alerts.filter((alert) => !councilNotices.readAtById[alert.id]);
  const openReports = reports.filter((report) => (
    (!activeAddress || report.addressId === activeAddress.id)
    && !terminalReportStatuses.has(report.status)
  ));
  const supportReplies = support.threads.filter((thread) => thread.status === 'waiting-resident' && thread.lastSender === 'support');
  const recentHistory = history
    .filter((entry) => !activeAddress || !entry.addressId || entry.addressId === activeAddress.id)
    .slice(0, 8);
  const muted = activeAddress?.providerId
    ? councilNotices.mutedProviderIds.includes(activeAddress.providerId)
    : false;
  const needsAttention = unreadAlerts.length + openReports.length + supportReplies.length;

  useEffect(() => {
    if (!activeAddress?.providerId) return;
    alerts.forEach((alert) => {
      if (shownAlertIds.current.has(alert.id)) return;
      shownAlertIds.current.add(alert.id);
      analytics.track('council_alert_shown', {
        councilId: activeAddress.providerId,
        outcome: 'success',
        context: alert.kind,
      });
    });
  }, [activeAddress?.providerId, alerts, analytics]);

  async function openAlert(alert: ResidentAlert) {
    markCouncilNoticeRead(alert.id);
    analytics.track('council_alert_opened', {
      councilId: activeAddress?.providerId,
      outcome: 'opened',
      context: alert.kind,
    });
    if (alert.sourceUrl) {
      await Linking.openURL(alert.sourceUrl);
      return;
    }
    router.push(alert.deepLink as Href);
  }

  return (
    <AppShell activeRoute="/activity">
      <RouteHead title="Activity" description="Collection history, council alerts, missed reports and support replies in one place." path="/activity" />
      <View style={styles.page}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>Activity</Text>
              <Text style={styles.title}>Your bin timeline</Text>
              <Text style={styles.subtitle}>Updates that need attention and a record of what happened.</Text>
            </View>
            <Pressable accessibilityLabel="Open settings" accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
              <Ionicons color={theme.accent} name="settings-outline" size={22} />
            </Pressable>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionKicker}>NEEDS ATTENTION</Text>
              <Text style={styles.sectionTitle}>{needsAttention ? `${needsAttention} update${needsAttention === 1 ? '' : 's'}` : 'You’re up to date'}</Text>
            </View>
            {unreadAlerts.length ? (
              <Pressable accessibilityRole="button" onPress={() => markCouncilNoticesRead(unreadAlerts.map((alert) => alert.id))}>
                <Text style={styles.link}>Mark all read</Text>
              </Pressable>
            ) : null}
          </View>

          {unreadAlerts.map((alert) => (
            <Pressable key={alert.id} accessibilityRole="button" onPress={() => void openAlert(alert)} style={({ pressed }) => [styles.attentionCard, alert.severity === 'critical' && styles.urgentCard, pressed && styles.pressed]}>
              <View style={[styles.icon, { backgroundColor: alert.severity === 'critical' ? `${theme.warning}18` : theme.accentSoft }]}>
                <Ionicons color={alert.severity === 'critical' ? theme.warning : theme.accent} name={alert.kind === 'disruption' ? 'warning-outline' : 'megaphone-outline'} size={22} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardEyebrow}>{alert.councilName}</Text>
                <Text style={styles.cardTitle}>{alert.title}</Text>
                <Text numberOfLines={2} style={styles.cardBody}>{alert.body}</Text>
              </View>
              <Ionicons color={theme.tertiaryText} name="chevron-forward" size={20} />
            </Pressable>
          ))}

          {openReports.map((report) => (
            <Pressable key={report.id} accessibilityRole="button" onPress={() => router.push('/reports')} style={({ pressed }) => [styles.attentionCard, pressed && styles.pressed]}>
              <View style={styles.icon}><Ionicons color={theme.accent} name="document-text-outline" size={22} /></View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardEyebrow}>MISSED COLLECTION</Text>
                <Text style={styles.cardTitle}>{report.binLabel}</Text>
                <Text style={styles.cardBody}>{report.councilReference ? `Council reference ${report.councilReference}` : 'Report awaiting council confirmation'}</Text>
              </View>
              <Ionicons color={theme.tertiaryText} name="chevron-forward" size={20} />
            </Pressable>
          ))}

          {supportReplies.map((thread) => (
            <Pressable key={thread.id} accessibilityRole="button" onPress={() => router.push('/support')} style={({ pressed }) => [styles.attentionCard, pressed && styles.pressed]}>
              <View style={styles.icon}><Ionicons color={theme.accent} name="chatbubble-ellipses-outline" size={22} /></View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardEyebrow}>SUPPORT REPLIED</Text>
                <Text style={styles.cardTitle}>{thread.subject}</Text>
                <Text numberOfLines={2} style={styles.cardBody}>{thread.messages.at(-1)?.body ?? 'Open the conversation to read the reply.'}</Text>
              </View>
              <Ionicons color={theme.tertiaryText} name="chevron-forward" size={20} />
            </Pressable>
          ))}

          {!needsAttention ? (
            <View style={styles.clearCard}>
              <Ionicons color={theme.success} name="checkmark-circle-outline" size={30} />
              <Text style={styles.clearTitle}>Nothing needs your attention</Text>
              <Text style={styles.clearBody}>Council messages, report updates and support replies will appear here.</Text>
            </View>
          ) : null}

          <View style={[styles.sectionHeader, styles.sectionSpacing]}>
            <View>
              <Text style={styles.sectionKicker}>COUNCIL ALERTS</Text>
              <Text style={styles.sectionTitle}>{profile?.branding?.displayName ?? profile?.councilName ?? 'Your council'}</Text>
            </View>
            {activeAddress?.providerId ? (
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: muted }} onPress={() => {
                setCouncilNoticesMuted(activeAddress.providerId, !muted);
                analytics.track('council_alert_muted', {
                  councilId: activeAddress.providerId,
                  outcome: muted ? 'disabled' : 'enabled',
                  context: 'automatic',
                });
              }}>
                <Text style={styles.link}>{muted ? 'Unmute' : 'Mute'}</Text>
              </Pressable>
            ) : null}
          </View>
          {muted ? <Text style={styles.mutedCopy}>Council alert notifications are muted for this place. Urgent notices still remain visible here.</Text> : null}
          {alerts.length ? (
            <View style={styles.list}>
              {alerts.map((alert, index) => (
                <View key={alert.id} style={[styles.listRow, index < alerts.length - 1 && styles.listBorder]}>
                  <Pressable accessibilityRole="button" onPress={() => void openAlert(alert)} style={({ pressed }) => [styles.listMain, pressed && styles.pressed]}>
                    <View style={styles.listCopy}>
                      <View style={styles.inlineTitle}>
                        {!councilNotices.readAtById[alert.id] ? <View style={styles.unreadDot} /> : null}
                        <Text style={styles.listTitle}>{alert.title}</Text>
                      </View>
                      <Text numberOfLines={2} style={styles.listDetail}>{alert.body}</Text>
                      {friendlyDate(alert.startsAt) ? <Text style={styles.listDate}>{friendlyDate(alert.startsAt)}</Text> : null}
                    </View>
                  </Pressable>
                  <Pressable accessibilityLabel={`Archive ${alert.title}`} accessibilityRole="button" onPress={() => archiveCouncilNotice(alert.id)} style={styles.archiveButton}>
                    <Ionicons color={theme.tertiaryText} name="archive-outline" size={20} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : <Text style={styles.mutedCopy}>No current announcements or service disruptions.</Text>}

          <View style={[styles.sectionHeader, styles.sectionSpacing]}>
            <View><Text style={styles.sectionKicker}>RECENT</Text><Text style={styles.sectionTitle}>Collection history</Text></View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/history')}><Text style={styles.link}>View all</Text></Pressable>
          </View>
          {recentHistory.length ? (
            <View style={styles.list}>
              {recentHistory.map((entry, index) => (
                <View key={entry.id} style={[styles.historyRow, index < recentHistory.length - 1 && styles.listBorder]}>
                  <View style={styles.smallIcon}><Ionicons color={theme.accent} name={activityIcons[entry.type]} size={19} /></View>
                  <View style={styles.listCopy}><Text style={styles.listTitle}>{entry.title}</Text>{entry.detail ? <Text style={styles.listDetail}>{entry.detail}</Text> : null}<Text style={styles.listDate}>{friendlyDate(entry.occurredAt)}</Text></View>
                </View>
              ))}
            </View>
          ) : <Text style={styles.mutedCopy}>Collection actions will appear here as you use the app.</Text>}

          <Pressable accessibilityRole="button" onPress={() => router.push('/support')} style={({ pressed }) => [styles.supportLink, pressed && styles.pressed]}>
            <View style={styles.icon}><Ionicons color={theme.accent} name="chatbubble-ellipses-outline" size={22} /></View>
            <View style={styles.cardCopy}><Text style={styles.cardTitle}>Support conversations</Text><Text style={styles.cardBody}>Message the team and see replies inside the app.</Text></View>
            <Ionicons color={theme.tertiaryText} name="chevron-forward" size={20} />
          </Pressable>
        </ScrollView>
      </View>
    </AppShell>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    header: { backgroundColor: theme.surface, borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    headerCopy: { flex: 1 },
    kicker: { color: theme.accent, fontSize: 13, fontWeight: '700' },
    title: { color: theme.text, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.1, marginTop: 3 },
    subtitle: { color: theme.secondaryText, fontSize: 14, lineHeight: 20, marginTop: 4 },
    headerButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.groupedBackground, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: 122, gap: 10 },
    sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: 3, marginBottom: 2 },
    sectionSpacing: { marginTop: 18 },
    sectionKicker: { color: theme.secondaryText, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.1 },
    sectionTitle: { color: theme.text, fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.45, marginTop: 3 },
    link: { color: theme.accent, fontSize: 13.5, fontWeight: '700' },
    attentionCard: { minHeight: 88, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: 16 },
    urgentCard: { borderColor: `${theme.warning}55`, backgroundColor: `${theme.warning}0D` },
    icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
    smallIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
    cardCopy: { flex: 1 },
    cardEyebrow: { color: theme.secondaryText, fontSize: 10.5, fontWeight: '800', letterSpacing: .7 },
    cardTitle: { color: theme.text, fontSize: 15.5, lineHeight: 20, fontWeight: '700', marginTop: 2 },
    cardBody: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 3 },
    clearCard: { alignItems: 'center', padding: 24, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: 16 },
    clearTitle: { color: theme.text, fontSize: 17, fontWeight: '700', marginTop: 9 },
    clearBody: { color: theme.secondaryText, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 5 },
    mutedCopy: { color: theme.secondaryText, fontSize: 13, lineHeight: 19, paddingHorizontal: 3 },
    list: { backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: 16, overflow: 'hidden' },
    listRow: { minHeight: 80, flexDirection: 'row', alignItems: 'stretch' },
    listMain: { flex: 1, padding: 14, justifyContent: 'center' },
    listBorder: { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth },
    listCopy: { flex: 1 },
    inlineTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.accent },
    listTitle: { color: theme.text, fontSize: 14.5, lineHeight: 19, fontWeight: '700', flexShrink: 1 },
    listDetail: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
    listDate: { color: theme.tertiaryText, fontSize: 11.5, marginTop: 4 },
    archiveButton: { width: 50, alignItems: 'center', justifyContent: 'center' },
    historyRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
    supportLink: { minHeight: 82, marginTop: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, borderRadius: 16 },
    pressed: { opacity: .68, transform: [{ scale: .988 }] },
  });
}

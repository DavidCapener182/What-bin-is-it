import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ResidentScreenHeader, ResidentSearchField } from '@/components/resident-layout';
import { RouteHead } from '@/components/route-head';
import { ToggleIndicator } from '@/components/toggle-indicator';
import {
  ActivityDetail,
  ActivityInbox,
  type ResidentActivityItem,
  type ResidentActivitySection,
} from '@/features/activity/activity-inbox';
import {
  activityHistoryForFilter,
  type ActivityFilter,
  formatActivityDetail,
  reportNeedsResidentAttention,
  supportReplyNeedsAttention,
} from '@/lib/activity-attention';
import { appLayout } from '@/lib/design-system';
import { residentAlertsForProfile, type ResidentAlert } from '@/lib/resident-alerts';
import { type AppTheme, useAppTheme } from '@/lib/theme';
import { type ActivityEntry } from '@/lib/types';
import { useAdaptiveLayout } from '@/lib/use-adaptive-layout';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useProductState } from '@/lib/use-product-state';
import { useResidentSupport } from '@/lib/use-resident-support';

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

function friendlyDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function ActivityScreen() {
  const theme = useAppTheme();
  const adaptive = useAdaptiveLayout();
  const styles = createStyles(theme);
  const { activeAddress, collections } = useAppData();
  const profile = useCouncilProfile(activeAddress?.providerId);
  const support = useResidentSupport();
  const analytics = usePilotAnalytics();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const shownAlertIds = useRef(new Set<string>());
  const {
    archiveCouncilNotice,
    councilNotices,
    history,
    markCouncilNoticeRead,
    markCouncilNoticesRead,
    markReportStatusSeen,
    markSupportThreadSeen,
    reportStatusSeenById,
    reports,
    setCouncilNoticesMuted,
    supportSeenMessageIdByThreadId,
  } = useProductState();

  const alerts = residentAlertsForProfile(profile, collections)
    .filter((alert) => !councilNotices.archivedAtById[alert.id]);
  const unreadAlerts = alerts.filter((alert) => !councilNotices.readAtById[alert.id]);
  const openReports = reports.filter((report) => (
    (!activeAddress || report.addressId === activeAddress.id)
    && reportNeedsResidentAttention(report, reportStatusSeenById[report.id])
  ));
  const supportReplies = support.threads.filter((thread) => (
    supportReplyNeedsAttention(thread, supportSeenMessageIdByThreadId[thread.id])
  ));
  const recentHistory = activityHistoryForFilter(history, filter, activeAddress?.id);
  const muted = activeAddress?.providerId
    ? councilNotices.mutedProviderIds.includes(activeAddress.providerId)
    : false;
  const showCouncil = filter === 'all' || filter === 'council';
  const showReports = filter === 'all' || filter === 'reports';
  const showSupport = filter === 'all' || filter === 'support';

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

  const attentionItems: ResidentActivityItem[] = [
    ...(showCouncil ? unreadAlerts.map((alert): ResidentActivityItem => ({
      archiveLabel: `Archive ${alert.title}`,
      body: alert.body,
      eyebrow: alert.councilName,
      icon: alert.kind === 'disruption' ? 'warning-outline' : 'megaphone-outline',
      id: `council:${alert.id}`,
      kind: 'council',
      meta: friendlyDate(alert.startsAt),
      needsAttention: true,
      severity: alert.severity === 'critical' ? 'critical' : 'normal',
      title: alert.title,
    })) : []),
    ...(showReports ? openReports.map((report): ResidentActivityItem => ({
      body: report.councilReference ? `Council reference ${report.councilReference}` : 'Report awaiting council confirmation',
      eyebrow: `Missed collection · ${report.status.replaceAll('-', ' ')}`,
      icon: 'document-text-outline',
      id: `report:${report.id}`,
      kind: 'report',
      meta: friendlyDate(report.updatedAt),
      needsAttention: true,
      title: report.binLabel,
    })) : []),
    ...(showSupport ? supportReplies.map((thread): ResidentActivityItem => ({
      body: thread.messages.at(-1)?.body ?? 'Open the conversation to read the reply.',
      eyebrow: `Support · ${thread.status.replaceAll('-', ' ')}`,
      icon: 'chatbubble-ellipses-outline',
      id: `support:${thread.id}`,
      kind: 'support',
      meta: friendlyDate(thread.lastMessageAt),
      needsAttention: true,
      title: thread.subject,
    })) : []),
  ];
  const previousCouncilItems: ResidentActivityItem[] = showCouncil
    ? alerts.filter((alert) => Boolean(councilNotices.readAtById[alert.id])).map((alert) => ({
        archiveLabel: `Archive ${alert.title}`,
        body: alert.body,
        eyebrow: alert.councilName,
        icon: alert.kind === 'disruption' ? 'warning-outline' : 'megaphone-outline',
        id: `council:${alert.id}`,
        kind: 'council',
        meta: friendlyDate(alert.startsAt),
        severity: alert.severity === 'critical' ? 'critical' : 'normal',
        title: alert.title,
      }))
    : [];
  const historyItems: ResidentActivityItem[] = recentHistory.map((entry) => ({
    body: formatActivityDetail(entry.detail),
    eyebrow: 'Collection history',
    icon: activityIcons[entry.type],
    id: `history:${entry.id}`,
    kind: 'history',
    meta: friendlyDate(entry.occurredAt),
    title: entry.title,
  }));
  const normalisedQuery = query.trim().toLowerCase();
  const matchesQuery = (item: ResidentActivityItem) => !normalisedQuery
    || [item.title, item.body, item.eyebrow, item.meta].some((value) => value?.toLowerCase().includes(normalisedQuery));
  const sections: ResidentActivitySection[] = [
    { title: 'Needs attention', data: attentionItems.filter(matchesQuery) },
    { title: 'Council updates', data: previousCouncilItems.filter(matchesQuery) },
    { title: filter === 'reports' ? 'Report history' : 'Collection history', data: historyItems.filter(matchesQuery) },
  ];
  const selectedItem = sections.flatMap((section) => section.data).find((item) => item.id === selectedId);

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

  function openItem(item: ResidentActivityItem) {
    const [kind, ...idParts] = item.id.split(':');
    const entityId = idParts.join(':');
    if (kind === 'council') {
      const alert = alerts.find((candidate) => candidate.id === entityId);
      if (alert) void openAlert(alert);
      return;
    }
    if (kind === 'report') {
      const report = reports.find((candidate) => candidate.id === entityId);
      if (report) markReportStatusSeen(report.id, report.status);
      router.push('/reports');
      return;
    }
    if (kind === 'support') {
      const thread = support.threads.find((candidate) => candidate.id === entityId);
      const latestMessageId = thread?.messages.at(-1)?.id;
      if (thread && latestMessageId) markSupportThreadSeen(thread.id, latestMessageId);
      router.push('/support');
      return;
    }
    router.push('/history');
  }

  function selectItem(item: ResidentActivityItem) {
    if (adaptive.mode === 'compact') openItem(item);
    else setSelectedId(item.id);
  }

  function archiveItem(item: ResidentActivityItem) {
    if (!item.id.startsWith('council:')) return;
    archiveCouncilNotice(item.id.slice('council:'.length));
    if (selectedId === item.id) setSelectedId(undefined);
  }

  const inboxHeader = (
    <>
      <ResidentSearchField accessibilityLabel="Search activity" clear={() => setQuery('')} onChangeText={setQuery} placeholder="Search updates and history" value={query} />
      <View accessibilityLabel="Activity filters" accessibilityRole="tablist" style={styles.filters}>
        {([['all', 'All'], ['reports', 'Reports'], ['council', 'Council'], ['support', 'Support']] as const).map(([value, label]) => (
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === value }} key={value} onPress={() => { setFilter(value); setSelectedId(undefined); }} style={[styles.filter, filter === value && styles.filterSelected]}>
            <Text style={[styles.filterText, filter === value && styles.filterTextSelected]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View accessibilityLiveRegion="polite" style={styles.summaryRow}>
        <View><Text style={styles.summaryKicker}>Needs attention</Text><Text style={styles.summaryTitle}>{attentionItems.length ? `${attentionItems.length} update${attentionItems.length === 1 ? '' : 's'}` : 'You’re up to date'}</Text></View>
        {showCouncil && unreadAlerts.length ? <Pressable accessibilityRole="button" onPress={() => markCouncilNoticesRead(unreadAlerts.map((alert) => alert.id))} style={styles.textButton}><Text style={styles.textButtonLabel}>Mark all read</Text></Pressable> : null}
      </View>
      {showCouncil && activeAddress?.providerId ? (
        <Pressable aria-checked={!muted} accessibilityRole="switch" accessibilityState={{ checked: !muted }} onPress={() => setCouncilNoticesMuted(activeAddress.providerId, !muted)} style={styles.muteRow}>
          <View style={styles.muteCopy}><Text style={styles.muteTitle}>Council alert notifications</Text><Text style={styles.muteBody}>Urgent notices remain visible in Activity.</Text></View>
          <ToggleIndicator value={!muted} />
        </Pressable>
      ) : null}
    </>
  );

  return (
    <AppShell activeRoute="/activity">
      <RouteHead title="Activity" description="Collection history, council alerts, missed reports and support replies in one place." path="/activity" private />
      <View style={styles.page}>
        <ResidentScreenHeader
          action={<Pressable accessibilityLabel="Open settings" accessibilityRole="button" onPress={() => router.push('/settings')} style={styles.headerButton}><Ionicons color={theme.accent} name="settings-outline" size={22} /></Pressable>}
          kicker="Activity"
          subtitle="Council notices, report status, support replies and the actions taken at this place."
          title="Your bin timeline"
        />
        <View style={styles.workspace}>
          <View style={[styles.inboxPane, adaptive.mode === 'compact' && styles.inboxPaneCompact]}>
            <ActivityInbox
              emptyBody={normalisedQuery ? 'No activity matches this search and filter.' : 'Council messages, report updates and support replies will appear here.'}
              header={inboxHeader}
              onArchive={archiveItem}
              onSelect={selectItem}
              sections={sections}
              selectedId={selectedId}
            />
          </View>
          {adaptive.mode !== 'compact' ? (
            <ScrollView contentContainerStyle={styles.detailPane} showsVerticalScrollIndicator={false}>
              <ActivityDetail item={selectedItem} onArchive={archiveItem} onOpen={openItem} />
              <Pressable accessibilityRole="button" onPress={() => router.push('/support')} style={styles.supportCard}>
                <View style={styles.supportIcon}><Ionicons color={theme.accent} name="chatbubble-ellipses-outline" size={22} /></View>
                <View style={styles.supportCopy}><Text style={styles.supportTitle}>Support conversations</Text><Text style={styles.supportBody}>Message the team and see replies inside the app.</Text></View>
                <Ionicons color={theme.tertiaryText} name="chevron-forward" size={19} />
              </Pressable>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </AppShell>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    headerButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
    workspace: { flex: 1, minWidth: 0, flexDirection: 'row' },
    inboxPane: { width: 450, minWidth: 340, maxWidth: '48%', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.separator },
    inboxPaneCompact: { width: '100%', maxWidth: '100%', borderRightWidth: 0 },
    detailPane: { padding: appLayout.residentMediumGutter, gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
    filters: { minHeight: 46, padding: 3, borderRadius: 14, backgroundColor: theme.groupedBackground, flexDirection: 'row', gap: 3 },
    filter: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    filterSelected: { backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator },
    filterText: { color: theme.secondaryText, fontSize: 12, fontWeight: '700' },
    filterTextSelected: { color: theme.text },
    summaryRow: { minHeight: 52, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
    summaryKicker: { color: theme.secondaryText, fontSize: 12, lineHeight: 16, fontWeight: '700' },
    summaryTitle: { color: theme.text, fontSize: 21, lineHeight: 26, fontWeight: '700', marginTop: 2 },
    textButton: { minHeight: 44, justifyContent: 'center' },
    textButtonLabel: { color: theme.accent, fontSize: 13, fontWeight: '700' },
    muteRow: { minHeight: 66, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 14, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, flexDirection: 'row', alignItems: 'center', gap: 10 },
    muteCopy: { flex: 1, minWidth: 0 },
    muteTitle: { color: theme.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    muteBody: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 2 },
    supportCard: { minHeight: 86, padding: 14, borderRadius: 16, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, flexDirection: 'row', alignItems: 'center', gap: 12 },
    supportIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
    supportCopy: { flex: 1, minWidth: 0 },
    supportTitle: { color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
    supportBody: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 3 },
  });
}

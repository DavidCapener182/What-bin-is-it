import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InlineNotice, ResidentEmptyState, ResidentMasterDetail } from '@/components/resident-layout';
import { MissedCollectionReportCard } from '@/features/reports/missed-collection-report-card';
import { MissedCollectionReportRow } from '@/features/reports/missed-collection-report-row';
import { reportsStyles as styles } from '@/features/reports/reports-styles';
import { useAppTheme } from '@/lib/theme';
import { useAdaptiveLayout } from '@/lib/use-adaptive-layout';
import { useAppData } from '@/lib/use-app-data';
import { useProductState } from '@/lib/use-product-state';

type Feedback = { message: string; tone: 'danger' | 'success' };

export function ReportsScreen() {
  const theme = useAppTheme();
  const adaptive = useAdaptiveLayout();
  const { activeAddress } = useAppData();
  const { reports, reportStatusSeenById, markReportStatusSeen, updateReport } = useProductState();
  const [feedback, setFeedback] = useState<Feedback>();
  const [selectedId, setSelectedId] = useState<string>();
  const visibleReports = useMemo(
    () => reports.filter((report) => !activeAddress || report.addressId === activeAddress.id),
    [activeAddress, reports],
  );
  const selected = visibleReports.find((report) => report.id === selectedId) ?? visibleReports[0];

  useEffect(() => {
    visibleReports.forEach((report) => {
      if (reportStatusSeenById[report.id] !== report.status) markReportStatusSeen(report.id, report.status);
    });
  }, [markReportStatusSeen, reportStatusSeenById, visibleReports]);

  const reportDetail = selected ? (
    <MissedCollectionReportCard key={selected.id} onFeedback={setFeedback} report={selected} updateReport={updateReport} />
  ) : null;

  const list = (
    <FlatList
      contentContainerStyle={styles.listContent}
      data={visibleReports}
      extraData={`${adaptive.mode}:${selected?.id ?? ''}:${feedback?.message ?? ''}`}
      initialNumToRender={12}
      ItemSeparatorComponent={() => <View style={styles.itemGap} />}
      keyExtractor={(report) => report.id}
      ListEmptyComponent={(
        <ResidentEmptyState
          body="If a due collection is missed, start the report from Today after the collection window ends."
          icon="checkmark-circle-outline"
          title="No missed collection reports"
        />
      )}
      ListFooterComponent={(
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
      )}
      ListHeaderComponent={(
        <View style={styles.listHeader}>
          <View style={[styles.explainer, { backgroundColor: theme.accentSoft }]}>
            <Ionicons color={theme.accent} name="shield-checkmark-outline" size={23} />
            <Text style={[styles.explainerText, { color: theme.text }]}>Reports are tracked on this device. A council reference appears only when you enter one from the official council service.</Text>
          </View>
          {feedback ? <InlineNotice title={feedback.message} tone={feedback.tone} /> : null}
          <Text accessibilityLiveRegion="polite" style={[styles.reportCount, { color: theme.secondaryText }]}>
            {visibleReports.length} {visibleReports.length === 1 ? 'report' : 'reports'}
          </Text>
        </View>
      )}
      maxToRenderPerBatch={12}
      renderItem={({ item }) => {
        const isSelected = selected?.id === item.id;
        return (
          <MissedCollectionReportRow
            detail={adaptive.mode === 'compact' && isSelected ? reportDetail : undefined}
            isCompact={adaptive.mode === 'compact'}
            isSelected={isSelected}
            onPress={() => setSelectedId(item.id)}
            report={item}
          />
        );
      }}
      showsVerticalScrollIndicator={false}
      style={[styles.listPane, { backgroundColor: theme.background, borderRightColor: theme.separator }]}
      updateCellsBatchingPeriod={35}
      windowSize={7}
    />
  );

  const detail = selected ? (
    <ScrollView
      contentContainerStyle={styles.detailContent}
      showsVerticalScrollIndicator={false}
      style={[styles.detailPane, { backgroundColor: theme.background }]}>
      <Text style={[styles.detailKicker, { color: theme.accent }]}>Selected report</Text>
      <Text accessibilityRole="header" style={[styles.detailTitle, { color: theme.text }]}>{selected.binLabel}</Text>
      <Text style={[styles.detailSubtitle, { color: theme.secondaryText }]}>Review the official handoff, update the council reference, or close local tracking.</Text>
      {reportDetail}
    </ScrollView>
  ) : (
    <View style={[styles.detailEmpty, { backgroundColor: theme.background }]}>
      <ResidentEmptyState body="Choose a report to review its local tracking details." icon="document-text-outline" title="Choose a report" />
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.kicker, { color: theme.accent }]}>Activity</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Missed collections</Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Official handoff, references and recollection updates</Text>
          </View>
          <Pressable accessibilityLabel="Open settings" accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.groupedBackground }, pressed && styles.pressed]}>
            <Ionicons color={theme.accent} name="settings-outline" size={21} />
          </Pressable>
        </View>
      </SafeAreaView>
      <ResidentMasterDetail detail={detail} master={list} style={styles.body} />
    </View>
  );
}

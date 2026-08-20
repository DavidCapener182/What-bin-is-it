import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, Share, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ResidentEmptyState, ResidentMasterDetail, ResidentScreenHeader, ResidentSearchField } from '@/components/resident-layout';
import { RouteHead } from '@/components/route-head';
import { appFonts, appLayout } from '@/lib/design-system';
import { type AppTheme, useAppTheme } from '@/lib/theme';
import { type ActivityEntry, type ActivityType } from '@/lib/types';
import { useAdaptiveLayout } from '@/lib/use-adaptive-layout';
import { useAppData } from '@/lib/use-app-data';
import { useProductState } from '@/lib/use-product-state';

type HistoryFilter = 'all' | 'collection' | 'report' | 'place';

const icons: Record<ActivityType, keyof typeof Ionicons.glyphMap> = {
  'address-added': 'location-outline',
  'dates-refreshed': 'refresh-outline',
  'bin-put-out': 'arrow-up-circle-outline',
  'collection-confirmed': 'checkmark-circle-outline',
  'missed-collection': 'alert-circle-outline',
  'report-opened': 'document-text-outline',
  'report-updated': 'create-outline',
  'feedback-saved': 'flag-outline',
};

const filterTypes: Record<Exclude<HistoryFilter, 'all'>, ActivityType[]> = {
  collection: ['bin-put-out', 'collection-confirmed', 'missed-collection'],
  report: ['report-opened', 'report-updated', 'feedback-saved'],
  place: ['address-added', 'dates-refreshed'],
};

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function HistoryScreen() {
  const theme = useAppTheme();
  const adaptive = useAdaptiveLayout();
  const styles = createStyles(theme);
  const { activeAddress } = useAppData();
  const { history } = useProductState();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();

  const entries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en-GB');
    return history.filter((entry) => {
      if (activeAddress && entry.addressId && entry.addressId !== activeAddress.id) return false;
      if (filter !== 'all' && !filterTypes[filter].includes(entry.type)) return false;
      return !needle || `${entry.title} ${entry.detail ?? ''}`.toLocaleLowerCase('en-GB').includes(needle);
    });
  }, [activeAddress, filter, history, query]);

  const sections = useMemo(() => {
    const grouped = new Map<string, ActivityEntry[]>();
    entries.forEach((entry) => {
      const key = monthLabel(entry.occurredAt);
      grouped.set(key, [...(grouped.get(key) ?? []), entry]);
    });
    return [...grouped.entries()].map(([title, data]) => ({ title, data }));
  }, [entries]);

  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];

  async function exportHistory() {
    const lines = entries.map((entry) => `${dateLabel(entry.occurredAt)} — ${entry.title}${entry.detail ? `: ${entry.detail}` : ''}`);
    await Share.share({ message: ['What Bin? activity history', ...lines].join('\n') });
  }

  const list = (
    <View style={styles.listPane}>
      <View style={styles.controls}>
        <ResidentSearchField accessibilityLabel="Search activity history" clear={() => setQuery('')} onChangeText={setQuery} placeholder="Search activity" value={query} />
        <View accessibilityLabel="History filters" accessibilityRole="tablist" style={styles.filters}>
          {(['all', 'collection', 'report', 'place'] as const).map((item) => (
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === item }} key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterSelected]}>
              <Text style={[styles.filterText, filter === item && styles.filterTextSelected]}>{item === 'all' ? 'All' : item === 'place' ? 'Places' : `${item[0].toUpperCase()}${item.slice(1)}`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <SectionList
        contentContainerStyle={styles.listContent}
        initialNumToRender={18}
        keyExtractor={(entry) => entry.id}
        ListEmptyComponent={<ResidentEmptyState body={query || filter !== 'all' ? 'Try a different search or filter.' : 'Actions from Today and Activity will appear here.'} icon="time-outline" title={query || filter !== 'all' ? 'No matching activity' : 'No activity yet'} />}
        maxToRenderPerBatch={20}
        renderItem={({ item }) => {
          const isSelected = selected?.id === item.id;
          return (
            <Pressable accessibilityHint="Shows the full recorded event" accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => setSelectedId(item.id)} style={[styles.row, isSelected && adaptive.mode !== 'compact' && styles.rowSelected]}>
              <View style={styles.icon}><Ionicons color={theme.accent} name={icons[item.type]} size={20} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                {item.detail ? <Text numberOfLines={adaptive.mode === 'compact' ? 2 : 1} style={styles.rowDetail}>{item.detail}</Text> : null}
                <Text style={styles.rowDate}>{dateLabel(item.occurredAt)}</Text>
                {adaptive.mode === 'compact' && isSelected ? <Text accessibilityLiveRegion="polite" style={styles.expandedLabel}>Recorded on this device · {item.type.replaceAll('-', ' ')}</Text> : null}
              </View>
              <Ionicons color={theme.tertiaryText} name={isSelected ? 'chevron-down' : 'chevron-forward'} size={17} />
            </Pressable>
          );
        }}
        renderSectionHeader={({ section }) => <Text accessibilityRole="header" style={styles.month}>{section.title}</Text>}
        sections={sections}
        stickySectionHeadersEnabled
        windowSize={9}
      />
    </View>
  );

  const detail = selected ? (
    <View style={styles.detailPane}>
      <View style={styles.detailIcon}><Ionicons color={theme.accent} name={icons[selected.type]} size={28} /></View>
      <Text accessibilityRole="header" style={styles.detailTitle}>{selected.title}</Text>
      {selected.detail ? <Text style={styles.detailBody}>{selected.detail}</Text> : null}
      <View style={styles.fact}><Text style={styles.factLabel}>Recorded</Text><Text style={styles.factValue}>{dateLabel(selected.occurredAt)}</Text></View>
      <View style={styles.fact}><Text style={styles.factLabel}>Category</Text><Text style={styles.factValue}>{selected.type.replaceAll('-', ' ')}</Text></View>
      <Text style={styles.retention}>Activity is stored on this device and kept for up to the app’s 500-event local limit. This view does not estimate environmental impact.</Text>
    </View>
  ) : <ResidentEmptyState body="Choose an event to see its recorded detail." icon="time-outline" title="Choose activity" />;

  return (
    <AppShell activeRoute="/activity">
      <RouteHead title="Activity History" description="Review locally recorded bin-night actions and report updates." path="/history" private />
      <View style={styles.page}>
        <ResidentScreenHeader action={<Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><Ionicons color={theme.accent} name="close" size={22} /></Pressable>} kicker="Activity" subtitle="Search and filter the history kept on this device." title="History" />
        <View style={styles.toolbar}>
          <Text accessibilityLiveRegion="polite" style={styles.count}>{entries.length} {entries.length === 1 ? 'event' : 'events'}</Text>
          <Pressable accessibilityRole="button" disabled={!entries.length} onPress={exportHistory} style={styles.exportButton}><Ionicons color={theme.accent} name="share-outline" size={18} /><Text style={styles.exportText}>Export view</Text></Pressable>
        </View>
        <ResidentMasterDetail detail={detail} master={list} style={styles.body} />
      </View>
    </AppShell>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background }, body: { flex: 1 },
    headerButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.elevated, alignItems: 'center', justifyContent: 'center' },
    toolbar: { minHeight: 52, paddingHorizontal: appLayout.residentCompactGutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
    count: { color: theme.secondaryText, fontSize: 13, fontWeight: '700' }, exportButton: { minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, exportText: { color: theme.accent, fontFamily: appFonts.text, fontSize: 13, fontWeight: '700' },
    listPane: { flex: 1, minWidth: 0, backgroundColor: theme.background, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.separator },
    controls: { padding: 14, gap: 10, backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, filter: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator }, filterSelected: { backgroundColor: theme.accentFill, borderColor: theme.accent }, filterText: { color: theme.secondaryText, fontSize: 13, fontWeight: '700' }, filterTextSelected: { color: theme.heroText },
    listContent: { paddingBottom: 40 }, month: { color: theme.secondaryText, backgroundColor: theme.background, paddingHorizontal: 16, paddingVertical: 9, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
    row: { minHeight: 84, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }, rowSelected: { backgroundColor: theme.accentSoft }, icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { color: theme.text, fontSize: 15, lineHeight: 20, fontWeight: '700' }, rowDetail: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 2 }, rowDate: { color: theme.tertiaryText, fontSize: 12, marginTop: 4 }, expandedLabel: { color: theme.accent, fontSize: 12, lineHeight: 17, marginTop: 7, fontWeight: '700' },
    detailPane: { flex: 1, padding: 28, backgroundColor: theme.surface }, detailIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }, detailTitle: { color: theme.text, fontFamily: appFonts.display, fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: 18 }, detailBody: { color: theme.secondaryText, fontSize: 15, lineHeight: 22, marginTop: 9, maxWidth: 640 }, fact: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator, gap: 4 }, factLabel: { color: theme.tertiaryText, fontSize: 12, fontWeight: '700' }, factValue: { color: theme.text, fontSize: 14, lineHeight: 20, fontWeight: '600', textTransform: 'capitalize' }, retention: { color: theme.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 22, maxWidth: 620 },
  });
}

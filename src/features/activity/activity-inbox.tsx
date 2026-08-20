import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { ResidentEmptyState } from '@/components/resident-layout';
import { appFonts, appLayout } from '@/lib/design-system';
import { type AppTheme, useAppTheme } from '@/lib/theme';

export type ResidentActivityKind = 'council' | 'report' | 'support' | 'history';

export type ResidentActivityItem = {
  archiveLabel?: string;
  body?: string;
  eyebrow: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  id: string;
  kind: ResidentActivityKind;
  meta?: string;
  needsAttention?: boolean;
  severity?: 'critical' | 'normal';
  title: string;
};

export type ResidentActivitySection = {
  data: ResidentActivityItem[];
  title: string;
};

export function ActivityInbox({
  emptyBody,
  header,
  onArchive,
  onSelect,
  sections,
  selectedId,
}: {
  emptyBody: string;
  header: ReactNode;
  onArchive: (item: ResidentActivityItem) => void;
  onSelect: (item: ResidentActivityItem) => void;
  sections: ResidentActivitySection[];
  selectedId?: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <SectionList
      contentContainerStyle={styles.content}
      data-testid="resident-activity-inbox"
      initialNumToRender={14}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<ResidentEmptyState body={emptyBody} icon="checkmark-circle-outline" title="You’re up to date" />}
      ListHeaderComponent={<View style={styles.header}>{header}</View>}
      maxToRenderPerBatch={14}
      renderItem={({ item }) => (
        <ActivityInboxRow
          item={item}
          onArchive={() => onArchive(item)}
          onSelect={() => onSelect(item)}
          selected={selectedId === item.id}
        />
      )}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionCount}>{section.data.length}</Text>
        </View>
      )}
      sections={sections.filter((section) => section.data.length > 0)}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled
      windowSize={7}
    />
  );
}

function ActivityInboxRow({
  item,
  onArchive,
  onSelect,
  selected,
}: {
  item: ResidentActivityItem;
  onArchive: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const critical = item.severity === 'critical';
  return (
    <View style={[styles.row, selected && styles.rowSelected, critical && styles.rowCritical]}>
      <Pressable
        accessibilityLabel={`${item.title}. ${item.body ?? item.eyebrow}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
        <View style={[styles.icon, { backgroundColor: critical ? `${theme.warning}18` : theme.accentSoft }]}>
          <Ionicons color={critical ? theme.warning : theme.accent} name={item.icon} size={21} />
        </View>
        <View style={styles.copy}>
          <View style={styles.eyebrowLine}>
            {item.needsAttention ? <View accessibilityElementsHidden style={styles.unreadDot} /> : null}
            <Text style={styles.eyebrow}>{item.eyebrow}</Text>
          </View>
          <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
          {item.body ? <Text numberOfLines={2} style={styles.body}>{item.body}</Text> : null}
          {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
        </View>
        <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
      </Pressable>
      {item.archiveLabel ? (
        <Pressable accessibilityLabel={item.archiveLabel} accessibilityRole="button" onPress={onArchive} style={styles.archive}>
          <Ionicons color={theme.secondaryText} name="archive-outline" size={19} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function ActivityDetail({
  item,
  onArchive,
  onOpen,
}: {
  item?: ResidentActivityItem;
  onArchive: (item: ResidentActivityItem) => void;
  onOpen: (item: ResidentActivityItem) => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  if (!item) {
    return <ResidentEmptyState body="Choose an update to see its full status and available action." icon="notifications-outline" title="Choose an activity item" />;
  }

  return (
    <View style={styles.detailCard}>
      <View style={styles.detailIcon}><Ionicons color={item.severity === 'critical' ? theme.warning : theme.accent} name={item.icon} size={28} /></View>
      <Text style={styles.detailEyebrow}>{item.eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.detailTitle}>{item.title}</Text>
      {item.body ? <Text style={styles.detailBody}>{item.body}</Text> : null}
      {item.meta ? <Text style={styles.detailMeta}>{item.meta}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => onOpen(item)} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>{item.kind === 'council' ? 'Open council update' : item.kind === 'report' ? 'Open report' : item.kind === 'support' ? 'Open conversation' : 'View full history'}</Text>
        <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
      </Pressable>
      {item.archiveLabel ? (
        <Pressable accessibilityRole="button" onPress={() => onArchive(item)} style={styles.secondary}>
          <Ionicons color={theme.secondaryText} name="archive-outline" size={18} />
          <Text style={styles.secondaryText}>Archive this update</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: { paddingBottom: 120 },
    header: { padding: appLayout.residentCompactGutter, gap: 13 },
    sectionHeader: { minHeight: 46, paddingHorizontal: appLayout.residentCompactGutter, backgroundColor: theme.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
    sectionCount: { color: theme.tertiaryText, fontSize: 12, fontWeight: '700' },
    row: { minHeight: 88, flexDirection: 'row', alignItems: 'stretch', backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
    rowSelected: { backgroundColor: theme.accentSoft },
    rowCritical: { borderLeftWidth: 3, borderLeftColor: theme.warning },
    rowMain: { flex: 1, minWidth: 0, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
    icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1, minWidth: 0 },
    eyebrowLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.accentFill },
    eyebrow: { color: theme.secondaryText, fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
    title: { color: theme.text, fontSize: 14.5, lineHeight: 19, fontWeight: '700', marginTop: 2 },
    body: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, marginTop: 3 },
    meta: { color: theme.tertiaryText, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
    archive: { width: 48, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.68 },
    detailCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface, padding: 22, alignItems: 'flex-start' },
    detailIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft },
    detailEyebrow: { color: theme.accent, fontSize: 12, lineHeight: 16, fontWeight: '800', marginTop: 16 },
    detailTitle: { color: theme.text, fontFamily: appFonts.display, fontSize: 25, lineHeight: 31, fontWeight: '700', marginTop: 4 },
    detailBody: { color: theme.secondaryText, fontSize: 14, lineHeight: 21, marginTop: 9 },
    detailMeta: { color: theme.tertiaryText, fontSize: 12, lineHeight: 17, marginTop: 9 },
    primary: { minHeight: 50, borderRadius: 14, backgroundColor: theme.accentFill, alignSelf: 'stretch', marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    secondary: { minHeight: appLayout.minimumTouchTarget, alignSelf: 'stretch', marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    secondaryText: { color: theme.secondaryText, fontSize: 13.5, fontWeight: '700' },
  });
}

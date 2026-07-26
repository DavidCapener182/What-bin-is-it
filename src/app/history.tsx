import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { useAppTheme } from '@/lib/theme';
import { ActivityEntry } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useProductState } from '@/lib/use-product-state';

const icons: Record<ActivityEntry['type'], keyof typeof Ionicons.glyphMap> = {
  'address-added': 'location-outline',
  'dates-refreshed': 'refresh-outline',
  'bin-put-out': 'arrow-up-circle-outline',
  'collection-confirmed': 'checkmark-circle-outline',
  'missed-collection': 'alert-circle-outline',
  'report-opened': 'document-text-outline',
  'report-updated': 'create-outline',
  'feedback-saved': 'flag-outline',
};

export default function HistoryScreen() {
  const theme = useAppTheme();
  const { activeAddress } = useAppData();
  const { history } = useProductState();
  const entries = history.filter((entry) => !activeAddress || !entry.addressId || entry.addressId === activeAddress.id);

  return (
    <AppShell activeRoute="/history">
      <RouteHead title="Activity History" description="Review bin-night actions, collection outcomes and locally tracked reports." path="/history" />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Back to reports" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Ionicons color={theme.accent} name="chevron-back" size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Activity history</Text>
          <View style={styles.back} />
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content}>
          {entries.length ? (
            <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              {entries.map((entry, index) => (
                <View key={entry.id} style={[styles.row, index < entries.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                  <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
                    <Ionicons color={theme.accent} name={icons[entry.type]} size={20} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={[styles.title, { color: theme.text }]}>{entry.title}</Text>
                    {entry.detail ? <Text style={[styles.detail, { color: theme.secondaryText }]}>{entry.detail}</Text> : null}
                    <Text style={[styles.date, { color: theme.tertiaryText }]}>
                      {new Date(entry.occurredAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons color={theme.accent} name="time-outline" size={34} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No activity yet</Text>
              <Text style={[styles.emptyCopy, { color: theme.secondaryText }]}>Actions from Today and Reports will appear here.</Text>
            </View>
          )}
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
  content: { padding: 16, paddingBottom: 40 },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  row: { minHeight: 82, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  date: { fontSize: 12, marginTop: 5 },
  empty: { paddingTop: 90, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyCopy: { fontSize: 14, marginTop: 6, textAlign: 'center' },
});

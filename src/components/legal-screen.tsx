import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { useAppTheme } from '@/lib/theme';

export type LegalSection = {
  title: string;
  body: string;
};

export function LegalScreen({
  title,
  description,
  path,
  updated,
  sections,
}: {
  title: string;
  description: string;
  path: string;
  updated: string;
  sections: LegalSection[];
}) {
  const theme = useAppTheme();
  return (
    <AppShell activeRoute="/settings">
      <RouteHead title={title} description={description} path={path} />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Back to settings" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Ionicons color={theme.accent} name="chevron-back" size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
          <View style={styles.back} />
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.updated, { color: theme.secondaryText }]}>Updated {updated}</Text>
          <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            {sections.map((section, index) => (
              <View
                key={section.title}
                style={[styles.section, index < sections.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.title, { color: theme.text }]}>{section.title}</Text>
                <Text style={[styles.body, { color: theme.secondaryText }]}>{section.body}</Text>
              </View>
            ))}
          </View>
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
  content: { padding: 16, paddingBottom: 48, gap: 10 },
  updated: { fontSize: 13, paddingHorizontal: 3 },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  section: { padding: 16 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, marginTop: 7 },
});

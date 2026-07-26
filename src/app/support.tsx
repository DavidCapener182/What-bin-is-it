import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { useAppTheme } from '@/lib/theme';
import { SupportRequest } from '@/lib/types';
import { useProductState } from '@/lib/use-product-state';

const topics: { value: SupportRequest['topic']; label: string }[] = [
  { value: 'app-help', label: 'Using the app' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'address', label: 'Address or council lookup' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'app-problem', label: 'App problem' },
  { value: 'guide-item', label: 'Suggest a guide item' },
  { value: 'other', label: 'Something else' },
];

export default function SupportScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ topic?: string }>();
  const { saveSupportRequest } = useProductState();
  const initialTopic = topics.some((item) => item.value === params.topic)
    ? params.topic as SupportRequest['topic']
    : 'app-help';
  const [topic, setTopic] = useState<SupportRequest['topic']>(initialTopic);
  const [detail, setDetail] = useState('');

  function send() {
    if (!detail.trim()) {
      Alert.alert('Tell us what you need', 'Add a short description so the support request is useful.');
      return;
    }
    saveSupportRequest({ topic, detail: detail.trim() });
    const title = encodeURIComponent(`App feedback: ${topics.find((item) => item.value === topic)?.label}`);
    const body = encodeURIComponent([
      detail.trim(),
      '',
      'Submitted from What Bin Is It Tonight?',
      'Please remove any personal address details before publishing this issue.',
    ].join('\n'));
    void Linking.openURL(`https://github.com/DavidCapener182/What-bin-is-it/issues/new?title=${title}&body=${body}`);
  }

  return (
    <AppShell activeRoute="/support">
      <RouteHead title="Help and Support" description="Get help with addresses, reminders, accessibility and app problems." path="/support" />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Close support" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Ionicons color={theme.accent} name="close" size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Help and support</Text>
          <View style={styles.back} />
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>How can we help?</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>App support is separate from council missed-collection reporting.</Text>
          <View style={styles.topicGrid}>
            {topics.map((item) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: topic === item.value }}
                key={item.value}
                onPress={() => setTopic(item.value)}
                style={[styles.topic, { borderColor: topic === item.value ? theme.accent : theme.separator, backgroundColor: theme.surface }]}>
                <Text style={[styles.topicText, { color: topic === item.value ? theme.accent : theme.text }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Support request details"
            multiline
            onChangeText={setDetail}
            placeholder="Describe what happened and what you expected."
            placeholderTextColor={theme.tertiaryText}
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]}
            value={detail}
          />
          <Pressable accessibilityRole="button" onPress={send} style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
            <Ionicons color="#FFFFFF" name="logo-github" size={18} />
            <Text style={styles.buttonText}>Open support issue</Text>
          </Pressable>
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
  content: { padding: 18, gap: 14 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: -6 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  topic: { minHeight: 44, borderRadius: 11, borderWidth: 1, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  topicText: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 150, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' },
  button: { minHeight: 50, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.68 },
});

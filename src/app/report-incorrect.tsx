import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
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

export default function ReportIncorrectScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ issue?: string; detail?: string }>();
  const { activeAddress, collections, lastVerifiedAt, sourceStatus } = useAppData();
  const online = useOnlineStatus();
  const { saveIncorrectFeedback } = useProductState();
  const initialIssue = issues.some((item) => item.value === params.issue)
    ? params.issue as IncorrectDataFeedback['issue']
    : 'wrong-date';
  const [issue, setIssue] = useState<IncorrectDataFeedback['issue']>(initialIssue);
  const [detail, setDetail] = useState(params.detail?.slice(0, 160) ?? '');
  const [expectedValue, setExpectedValue] = useState('');

  function save() {
    if (!detail.trim()) {
      Alert.alert('Add a little detail', 'Tell us what the app shows and why it is wrong.');
      return;
    }
    const technicalContext = {
      appVersion: Constants.expoConfig?.version ?? '1.1.0',
      place: activeAddress?.label,
      postcode: activeAddress?.postcode,
      council: activeAddress?.councilName,
      providerId: activeAddress?.providerId,
      displayedDate: collections[0]?.date,
      lastRefreshAt: lastVerifiedAt,
      online,
    };
    saveIncorrectFeedback({
      addressId: activeAddress?.id,
      issue,
      detail: [
        detail.trim(),
        activeAddress ? `Place: ${activeAddress.line1}, ${activeAddress.postcode}` : 'No active address',
        `Displayed source status: ${sourceStatus}`,
      ].join('\n'),
      expectedValue: expectedValue.trim() || undefined,
      technicalContext,
    });
    const issueLabel = issues.find((item) => item.value === issue)?.label ?? 'Incorrect app information';
    const issueBody = [
      '## What is wrong?',
      issueLabel,
      '',
      '## What the app shows',
      detail.trim(),
      '',
      '## What it should show',
      expectedValue.trim() || 'Not supplied',
      '',
      '## App context',
      `- Version: ${technicalContext.appVersion}`,
      `- Place: ${technicalContext.place ?? 'Not configured'}`,
      `- Postcode: ${technicalContext.postcode ?? 'Not configured'}`,
      `- Council: ${technicalContext.council ?? 'Not configured'}`,
      `- Provider: ${technicalContext.providerId ?? 'Not configured'}`,
      `- Displayed date: ${technicalContext.displayedDate ?? 'None'}`,
      `- Last refresh: ${technicalContext.lastRefreshAt ?? 'Not available'}`,
      `- Online: ${technicalContext.online ? 'Yes' : 'No'}`,
    ].join('\n');
    const supportUrl = `https://github.com/DavidCapener182/What-bin-is-it/issues/new?${new URLSearchParams({
      title: `[Data] ${issueLabel}`,
      body: issueBody,
    }).toString()}`;
    Alert.alert(
      'Feedback saved on this device',
      'To send it to the app team, continue to the support issue. Review the text before submitting and remove anything personal.',
      [
        { text: 'Keep local', style: 'cancel', onPress: () => router.back() },
        { text: 'Continue to support', onPress: () => { void Linking.openURL(supportUrl); router.back(); } },
      ],
    );
  }

  return (
    <AppShell activeRoute="/report-incorrect">
      <RouteHead title="Report Incorrect Information" description="Tell the app team when a date, bin, address, council or recycling entry looks wrong." path="/report-incorrect" />
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
            <Ionicons color={theme.accent} name="information-circle-outline" size={21} />
            <Text style={[styles.noticeText, { color: theme.text }]}>
              Use this form when the app shows the wrong date, bin, address, or council. Use “Report missed” only when the council did not collect a due bin.
            </Text>
          </View>

          <Text style={[styles.label, { color: theme.secondaryText }]}>What is wrong?</Text>
          <View style={[styles.options, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            {issues.map((item, index) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: issue === item.value }}
                key={item.value}
                onPress={() => setIssue(item.value)}
                style={[styles.option, index < issues.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.optionText, { color: theme.text }]}>{item.label}</Text>
                <Ionicons color={issue === item.value ? theme.accent : theme.tertiaryText} name={issue === item.value ? 'checkmark-circle' : 'ellipse-outline'} size={22} />
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.secondaryText }]}>What does the app show?</Text>
          <TextInput
            accessibilityLabel="What the app shows"
            multiline
            onChangeText={setDetail}
            placeholder="Describe the incorrect information"
            placeholderTextColor={theme.tertiaryText}
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]}
            value={detail}
          />

          <Text style={[styles.label, { color: theme.secondaryText }]}>What should it show? (optional)</Text>
          <TextInput
            accessibilityLabel="Expected information"
            multiline
            onChangeText={setExpectedValue}
            placeholder="Add the date, bin type, or council you expected"
            placeholderTextColor={theme.tertiaryText}
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]}
            value={expectedValue}
          />

          <Pressable accessibilityRole="button" onPress={save} style={({ pressed }) => [styles.button, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Save feedback</Text>
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
  content: { padding: 16, paddingBottom: 50, gap: 13 },
  notice: { padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  options: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, overflow: 'hidden' },
  option: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  optionText: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 92, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, padding: 13, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  button: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.68 },
});

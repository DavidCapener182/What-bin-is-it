import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { SupportInbox } from '@/features/support/support-inbox';
import { supportStyles as styles } from '@/features/support/support-styles';
import { useSupportController } from '@/features/support/use-support-controller';
import { useAppTheme } from '@/lib/theme';

export default function SupportScreen() {
  const theme = useAppTheme();
  const controller = useSupportController();
  const account = controller.account;

  return (
    <AppShell activeRoute="/activity">
      <RouteHead title="Help and Support" description="Message the What Bin support team inside the app." path="/support" private />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Close support" accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons color={theme.accent} name="close" size={24} /></Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Help and support</Text>
          <Pressable accessibilityLabel="Refresh conversations" accessibilityRole="button" onPress={() => void controller.loadThreads()} style={styles.back}>{controller.loading ? <ActivityIndicator color={theme.accent} size="small" /> : <Ionicons color={theme.accent} name="refresh" size={20} />}</Pressable>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>Message the team</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Send and receive support messages here. Council missed-collection reports remain separate.</Text>

          {!account.configured ? (
            <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Ionicons color={theme.warning} name="warning-outline" size={22} /><Text style={[styles.noticeText, { color: theme.text }]}>In-app support is not configured in this build.</Text></View>
          ) : !account.ready ? (
            <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.separator }]}><ActivityIndicator color={theme.accent} /><Text style={[styles.noticeText, { color: theme.text }]}>Checking your account…</Text></View>
          ) : !account.user ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={({ pressed }) => [styles.signInCard, { backgroundColor: theme.hero }, pressed && styles.pressed]}><View style={[styles.signInIcon, { backgroundColor: 'rgba(255,255,255,0.13)' }]}><Ionicons color="#FFFFFF" name="person-outline" size={25} /></View><View style={styles.signInCopy}><Text style={styles.signInTitle}>Sign in to message support</Text><Text style={styles.signInBody}>Your conversations stay private and follow your account.</Text></View><Ionicons color="#FFFFFF" name="chevron-forward" size={21} /></Pressable>
          ) : (
            <SupportInbox controller={controller} />
          )}

          {account.user ? null : controller.error ? <Text accessibilityRole="alert" style={[styles.feedback, { color: theme.danger }]}>{controller.error}</Text> : null}
        </ScrollView>
      </View>
    </AppShell>
  );
}

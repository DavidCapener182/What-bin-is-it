import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { entitlementLabel } from '@/lib/entitlements';
import { useAppTheme } from '@/lib/theme';
import { useAccount } from '@/lib/use-account';

export default function AccountScreen() {
  const theme = useAppTheme();
  const account = useAccount();
  const [email, setEmail] = useState('');

  return (
    <AppShell activeRoute="/settings" hideNavigation>
      <RouteHead
        title="Account"
        description="Sign in to keep your What Bin plan available across devices."
        path="/account"
      />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Back to settings" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons color={theme.accent} name="chevron-back" size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Account</Text>
          <View style={styles.headerButton} />
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.hero, { backgroundColor: theme.hero }]}>
            <View style={styles.heroIcon}>
              <Ionicons color="#FFFFFF" name="person-outline" size={26} />
            </View>
            <Text style={styles.heroTitle}>{account.user ? 'Your plan, wherever you use the app.' : 'A quick, password-free sign in.'}</Text>
            <Text style={[styles.heroBody, { color: theme.heroSecondary }]}>
              Your saved addresses stay on this device. The account keeps only your email and Free or Plus access.
            </Text>
          </View>

          {!account.configured ? (
            <View style={[styles.notice, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Ionicons color={theme.secondaryText} name="construct-outline" size={22} />
              <Text style={[styles.noticeText, { color: theme.secondaryText }]}>
                Account sign-in is being connected. You can continue using all free bin-day features without it.
              </Text>
            </View>
          ) : account.user ? (
            <>
              <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                <View style={[styles.row, { borderBottomColor: theme.separator }]}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
                    <Ionicons color={theme.accent} name="mail-outline" size={21} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowLabel, { color: theme.secondaryText }]}>Signed in as</Text>
                    <Text selectable style={[styles.rowValue, { color: theme.text }]}>{account.user.email ?? 'Email account'}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.accentSoft }]}>
                    <Ionicons color={theme.accent} name={account.entitlement.isPlus ? 'sparkles' : 'shield-checkmark-outline'} size={21} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowLabel, { color: theme.secondaryText }]}>Current plan</Text>
                    <Text style={[styles.rowValue, { color: theme.text }]}>{entitlementLabel(account.entitlement.planId)}</Text>
                  </View>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={account.busy}
                onPress={() => void account.refreshEntitlement()}
                style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.accent }, pressed && styles.pressed]}>
                {account.busy
                  ? <ActivityIndicator color={theme.accent} />
                  : <>
                      <Ionicons color={theme.accent} name="refresh-outline" size={19} />
                      <Text style={[styles.secondaryButtonText, { color: theme.accent }]}>Refresh plan</Text>
                    </>}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={account.busy}
                onPress={() => void account.signOut()}
                style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
                <Text style={[styles.signOutText, { color: theme.danger }]}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Sign in or create your account</Text>
              <Text style={[styles.formBody, { color: theme.secondaryText }]}>
                Enter your email and we’ll send a one-time secure link. There is no password to remember.
              </Text>
              <Text style={[styles.inputLabel, { color: theme.secondaryText }]}>Email address</Text>
              <TextInput
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                onSubmitEditing={() => void account.sendSignInLink(email)}
                placeholder="you@example.com"
                placeholderTextColor={theme.tertiaryText}
                returnKeyType="send"
                style={[styles.input, { backgroundColor: theme.groupedBackground, borderColor: theme.separator, color: theme.text }]}
                value={email}
              />
              <Pressable
                accessibilityRole="button"
                disabled={account.busy}
                onPress={() => void account.sendSignInLink(email)}
                style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.accent }, pressed && styles.pressed, account.busy && styles.disabled]}>
                {account.busy
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <>
                      <Text style={styles.primaryButtonText}>Email me a sign-in link</Text>
                      <Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
                    </>}
              </Pressable>
              <Text style={[styles.smallPrint, { color: theme.secondaryText }]}>
                Signing in creates a Free account if this email is new. It does not upload your saved addresses.
              </Text>
            </View>
          )}

          {account.error ? (
            <View accessibilityLiveRegion="assertive" style={[styles.message, { backgroundColor: `${theme.danger}14` }]}>
              <Ionicons color={theme.danger} name="alert-circle-outline" size={19} />
              <Text style={[styles.messageText, { color: theme.danger }]}>{account.error}</Text>
            </View>
          ) : null}
          {account.message ? (
            <View accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: theme.accentSoft }]}>
              <Ionicons color={theme.accent} name="checkmark-circle-outline" size={19} />
              <Text style={[styles.messageText, { color: theme.text }]}>{account.message}</Text>
            </View>
          ) : null}

          <View style={[styles.privacy, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            <Ionicons color={theme.accent} name="lock-closed-outline" size={20} />
            <Text style={[styles.privacyText, { color: theme.secondaryText }]}>
              Supabase securely handles sign-in. What Bin stores the minimum account and plan record needed to restore access; Stripe, Apple or Google handles payment details.
            </Text>
          </View>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { height: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  hero: { borderRadius: 24, padding: 22 },
  heroIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, lineHeight: 33, letterSpacing: -0.6, fontWeight: '700', marginTop: 18 },
  heroBody: { fontSize: 14.5, lineHeight: 20, fontWeight: '500', marginTop: 9 },
  notice: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, overflow: 'hidden' },
  row: { minHeight: 74, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowLabel: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  rowValue: { fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 2 },
  form: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, padding: 17 },
  formTitle: { fontSize: 19, lineHeight: 24, fontWeight: '700' },
  formBody: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  inputLabel: { fontSize: 12.5, lineHeight: 17, fontWeight: '600', marginTop: 18, marginBottom: 7 },
  input: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 14, fontSize: 16 },
  primaryButton: { minHeight: 52, borderRadius: 14, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '700' },
  smallPrint: { fontSize: 12, lineHeight: 17, marginTop: 12 },
  secondaryButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { fontSize: 15, fontWeight: '700' },
  signOut: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontSize: 15, fontWeight: '700' },
  message: { borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  messageText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  privacy: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  privacyText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.5 },
});

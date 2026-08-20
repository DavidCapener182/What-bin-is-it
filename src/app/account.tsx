import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { entitlementLabel } from '@/lib/entitlements';
import { useAppTheme } from '@/lib/theme';
import { useAccount } from '@/lib/use-account';

export default function AccountScreen() {
  const theme = useAppTheme();
  const account = useAccount();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');

  function confirmAccountRemoval() {
    const title = 'Remove What Bin account data?';
    const message = 'This removes your What Bin plan, support history and any eligible solo household, then signs out this device. Saved addresses stay on this device. A minimal removal marker prevents delayed billing updates from restoring access. Starting a new Plus purchase or restore records only a short-lived pending intent; the marker clears only after the provider verifies successful access. Closing or cancelling the purchase leaves it in place. It does not delete the shared Supabase sign-in identity or access used by another product. Resolve active billing or shared households first; contact support for assisted identity deletion.';
    const remove = () => { void account.removeAccountData(); };
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm(`${title}\n\n${message}`)) remove();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove account data', style: 'destructive', onPress: remove },
    ]);
  }

  return (
    <AppShell activeRoute="/settings" hideNavigation>
      <RouteHead
        title="Account"
        description="Sign in to keep your What Bin plan available across devices."
        path="/account"
        private
      />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Back to settings" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons color={theme.accent} name="chevron-back" size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Account</Text>
          <View style={styles.headerButton} />
        </SafeAreaView>

        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 28) }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: theme.hero }]}>
            <View style={styles.heroIcon}>
              <Ionicons color="#FFFFFF" name="person-outline" size={23} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{account.user ? 'Your plan follows you.' : 'Sign in without a password.'}</Text>
              <Text style={[styles.heroBody, { color: theme.heroSecondary }]}>
                Keep Free or Plus access across devices. Your saved bin addresses stay on this device.
              </Text>
            </View>
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
              <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                <Pressable
                  accessibilityRole="button"
                  disabled={account.busy}
                  onPress={() => void account.exportAccountData()}
                  style={({ pressed }) => [styles.accountAction, { borderBottomColor: theme.separator }, pressed && styles.pressed]}>
                  <Ionicons color={theme.accent} name="download-outline" size={21} />
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowValue, { color: theme.text }]}>Export account data</Text>
                    <Text style={[styles.rowLabel, { color: theme.secondaryText }]}>Downloads JSON on web or opens the phone’s share sheet</Text>
                  </View>
                  <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={account.busy}
                  onPress={confirmAccountRemoval}
                  style={({ pressed }) => [styles.accountAction, pressed && styles.pressed]}>
                  <Ionicons color={theme.danger} name="trash-outline" size={21} />
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowValue, { color: theme.danger }]}>Remove What Bin account data</Text>
                    <Text style={[styles.rowLabel, { color: theme.secondaryText }]}>Shared sign-in identity and on-device places remain</Text>
                  </View>
                  <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
                </Pressable>
              </View>
            </>
          ) : (
            <View style={[styles.form, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Continue with email</Text>
              <Text style={[styles.formBody, { color: theme.secondaryText }]}>
                We’ll send you a one-time secure sign-in link.
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
                style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.accentFill }, pressed && styles.pressed, account.busy && styles.disabled]}>
                {account.busy
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <>
                      <Text style={styles.primaryButtonText}>Email me a sign-in link</Text>
                      <Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
                    </>}
              </Pressable>
              <Text style={[styles.smallPrint, { color: theme.secondaryText }]}>
                New here? We’ll create a Free account. Your saved addresses are never uploaded.
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
              Secure sign-in by Supabase. Payment details stay with Stripe, Apple or Google.
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
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  hero: { borderRadius: 21, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  heroIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#FFFFFF', fontSize: 21, lineHeight: 25, letterSpacing: -0.35, fontWeight: '700' },
  heroBody: { fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 4 },
  notice: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, overflow: 'hidden' },
  row: { minHeight: 74, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowLabel: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  rowValue: { fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 2 },
  accountAction: { minHeight: 70, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  form: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, padding: 16 },
  formTitle: { fontSize: 19, lineHeight: 24, fontWeight: '700' },
  formBody: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  inputLabel: { fontSize: 12.5, lineHeight: 17, fontWeight: '600', marginTop: 14, marginBottom: 7 },
  input: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 14, fontSize: 16 },
  primaryButton: { minHeight: 52, borderRadius: 14, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '700' },
  smallPrint: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  secondaryButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonText: { fontSize: 15, fontWeight: '700' },
  signOut: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  signOutText: { fontSize: 15, fontWeight: '700' },
  message: { borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  messageText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  privacy: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  privacyText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.5 },
});

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { WebSupporterOffer } from '@/components/web-supporter-offer';
import { commercialLaunchPhase, residentPaymentsEnabled } from '@/lib/commercial-offer';
import { appFonts } from '@/lib/design-system';
import { useAppTheme } from '@/lib/theme';
import { useAccount } from '@/lib/use-account';
import { useSubscription } from '@/lib/use-subscription';

const benefits = [
  ['location-outline', 'Up to five places', 'Keep households, family and managed properties together.'],
  ['notifications-outline', 'Smarter reminders', 'Add morning, second and follow-up reminders.'],
  ['calendar-outline', 'Calendar and widgets', 'Keep collection dates visible beyond the app.'],
  ['people-outline', 'Household sharing', 'Make the same verified schedule useful to everyone at home.'],
] as const;

export default function PlusScreen() {
  const theme = useAppTheme();
  const account = useAccount();
  const subscription = useSubscription();
  const paymentsEnabled = residentPaymentsEnabled();
  const nativeStore = Platform.OS === 'ios' || Platform.OS === 'android';
  const canOpenStore = paymentsEnabled && nativeStore && subscription.configured;
  const status = subscription.isPlus
    ? subscription.sponsoredBy ?? 'Plus is active'
    : commercialLaunchPhase === 'proof'
      ? 'Included in the free preview'
      : canOpenStore
        ? 'Free plan'
        : 'Store setup in progress';

  return (
    <AppShell activeRoute="/settings" hideNavigation>
      <RouteHead
        title="What Bin? Plus"
        description="Optional support and household convenience features for What Bin Is It Tonight?"
        path="/plus"
      />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Back to settings" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons color={theme.accent} name="chevron-back" size={24} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>What Bin? Plus</Text>
          <View style={styles.headerButton} />
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: theme.hero }]}>
            <View style={[styles.heroIcon, { backgroundColor: theme.accentFill }]}>
              <Ionicons color="#FFFFFF" name="sparkles" size={27} />
            </View>
            <Text style={styles.kicker}>OPTIONAL CONVENIENCE</Text>
            <Text style={styles.title}>More help for busy households.</Text>
            <Text style={[styles.subtitle, { color: theme.heroSecondary }]}>
              Collection dates, one address, the standard reminder, recycling guidance and council routes stay free.
            </Text>
            <View style={styles.statusPill}>
              <Ionicons color={subscription.isPlus ? '#5EE188' : '#FFFFFF'} name={subscription.isPlus ? 'checkmark-circle' : 'shield-checkmark-outline'} size={17} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

          <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            {benefits.map(([icon, title, detail], index) => (
              <View key={title} style={[styles.benefit, index < benefits.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.benefitIcon, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons color={theme.accent} name={icon} size={21} />
                </View>
                <View style={styles.benefitCopy}>
                  <Text style={[styles.benefitTitle, { color: theme.text }]}>{title}</Text>
                  <Text style={[styles.benefitDetail, { color: theme.secondaryText }]}>{detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.freeNote, { backgroundColor: theme.accentSoft }]}>
            <Ionicons color={theme.accent} name="heart-outline" size={21} />
            <Text style={[styles.freeNoteText, { color: theme.text }]}>
              Plus never blocks the verified bin-day answer or the basic reminder.
            </Text>
          </View>

          {subscription.sponsoredBy ? (
            <View style={[styles.previewNote, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Text style={[styles.previewTitle, { color: theme.text }]}>Your council includes Plus</Text>
              <Text style={[styles.previewBody, { color: theme.secondaryText }]}>
                {subscription.sponsoredBy}. Access follows the currently selected place and is recalculated if you change address.
              </Text>
            </View>
          ) : null}

          {subscription.error ? (
            <View style={[styles.error, { backgroundColor: `${theme.danger}14` }]}>
              <Ionicons color={theme.danger} name="alert-circle-outline" size={20} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{subscription.error}</Text>
            </View>
          ) : null}

          {subscription.sponsoredBy ? null : paymentsEnabled && Platform.OS === 'web' ? (
            <WebSupporterOffer />
          ) : paymentsEnabled ? (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: subscription.busy || !canOpenStore }}
                disabled={subscription.busy || !canOpenStore}
                onPress={() => {
                  if (!account.user) {
                    router.push('/account');
                    return;
                  }
                  void (subscription.isPlus ? subscription.manage() : subscription.showPaywall());
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.accentFill },
                  pressed && styles.pressed,
                  (!canOpenStore || subscription.busy) && styles.disabled,
                ]}>
                {subscription.busy
                  ? <ActivityIndicator color="#FFFFFF" />
                  : (
                    <>
                      <Text style={styles.primaryButtonText}>
                        {subscription.isPlus ? 'Manage subscription' : account.user ? 'View App Store plans' : 'Sign in to view plans'}
                      </Text>
                      <Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
                    </>
                  )}
              </Pressable>
              {canOpenStore ? (
                <Pressable accessibilityRole="button" disabled={subscription.busy} onPress={() => void subscription.restore()} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={[styles.textButtonText, { color: theme.accent }]}>Restore purchases</Text>
                </Pressable>
              ) : (
                <Text style={[styles.storeMessage, { color: theme.secondaryText }]}>
                  {nativeStore
                    ? !account.user
                      ? 'Sign in first so a purchase can be restored safely on another device.'
                      : subscription.message ?? 'The store connection is being prepared for this build.'
                    : 'Purchases are offered only through the installed iPhone and Android apps.'}
                </Text>
              )}
            </View>
          ) : (
            <View style={[styles.previewNote, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Text style={[styles.previewTitle, { color: theme.text }]}>Free proof release</Text>
              <Text style={[styles.previewBody, { color: theme.secondaryText }]}>
                Payments stay off until Apple and Google products have passed sandbox testing. Current features remain available while collection accuracy is proven.
              </Text>
            </View>
          )}

          <Text style={[styles.terms, { color: theme.secondaryText }]}>
            {Platform.OS === 'web'
              ? 'Web supporter prices are shown before Stripe checkout. Recurring support renews unless cancelled in Stripe’s billing portal.'
              : 'Plans and local prices are shown by Apple or Google before purchase. Subscriptions renew unless cancelled in your store account. Restore is always user initiated.'}
          </Text>
          <View style={styles.legalLinks}>
            <Pressable accessibilityRole="link" onPress={() => router.push('/terms')}><Text style={[styles.link, { color: theme.accent }]}>Terms</Text></Pressable>
            <Text style={[styles.linkDivider, { color: theme.tertiaryText }]}>·</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}><Text style={[styles.link, { color: theme.accent }]}>Privacy</Text></Pressable>
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
  headerTitle: { fontFamily: appFonts.text, fontSize: 17, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 42, gap: 16 },
  hero: { borderRadius: 24, padding: 22, overflow: 'hidden' },
  heroIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  kicker: { color: '#64B5FF', fontSize: 12, letterSpacing: 0.7, fontWeight: '800' },
  title: { color: '#FFFFFF', fontFamily: appFonts.display, fontSize: 32, lineHeight: 37, letterSpacing: -1, fontWeight: '700', marginTop: 7 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 10, fontWeight: '500' },
  statusPill: { alignSelf: 'flex-start', minHeight: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, marginTop: 18 },
  statusText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, overflow: 'hidden' },
  benefit: { minHeight: 78, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  benefitCopy: { flex: 1 },
  benefitTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  benefitDetail: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  freeNote: { borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  freeNoteText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  error: { borderRadius: 14, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  actions: { gap: 8 },
  primaryButton: { minHeight: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { fontSize: 15, fontWeight: '700' },
  storeMessage: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12 },
  previewNote: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 16 },
  previewTitle: { fontSize: 15, fontWeight: '700' },
  previewBody: { fontSize: 13.5, lineHeight: 19, marginTop: 5 },
  terms: { fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  link: { fontSize: 13, fontWeight: '600' },
  linkDivider: { fontSize: 13 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
});

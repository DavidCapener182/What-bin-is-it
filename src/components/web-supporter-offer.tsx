import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { apiBase } from '@/lib/api-base';
import { useAppTheme } from '@/lib/theme';
import { useAccount } from '@/lib/use-account';

type WebPlan = {
  id: 'plus-monthly' | 'plus-yearly' | 'plus-lifetime';
  name: string;
  description: string;
  amountPence: number;
  cadence: 'monthly' | 'yearly' | 'one-time';
};
type BillingConfig = {
  configured: boolean;
  live: boolean;
  currency: 'GBP';
  plans: WebPlan[];
};

function price(plan: WebPlan) {
  const amount = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(plan.amountPence / 100);
  return plan.cadence === 'monthly'
    ? `${amount} / month`
    : plan.cadence === 'yearly'
      ? `${amount} / year`
      : `${amount} once`;
}

export function WebSupporterOffer() {
  const theme = useAppTheme();
  const {
    accessToken,
    entitlement,
    refreshEntitlement,
    user,
  } = useAccount();
  const params = useLocalSearchParams<{ web_checkout?: string; session_id?: string }>();
  const [config, setConfig] = useState<BillingConfig>();
  const [busyPlan, setBusyPlan] = useState<string>();
  const [message, setMessage] = useState<string | undefined>(() => (
    params.web_checkout === 'cancelled'
      ? 'Checkout was cancelled. Nothing was charged.'
      : undefined
  ));
  const [supporterActive, setSupporterActive] = useState(entitlement.isPlus);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    void fetch(`${apiBase}/billing/config`, { headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Web support plans are temporarily unavailable.');
        return response.json() as Promise<BillingConfig>;
      })
      .then(setConfig)
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Web support plans are temporarily unavailable.'));
  }, []);

  useEffect(() => {
    if (
      Platform.OS !== 'web'
      || params.web_checkout !== 'success'
      || typeof params.session_id !== 'string'
    ) return;
    void Promise.resolve()
      .then(() => {
        if (!accessToken) throw new Error('Sign in to confirm your purchase.');
        setBusyPlan('confirm');
        return fetch(`${apiBase}/billing/confirm`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ sessionId: params.session_id }),
        });
      })
      .then(async (response) => {
        const payload = await response.json() as { active?: boolean; error?: string };
        if (!response.ok || !payload.active) throw new Error(payload.error ?? 'Payment could not be confirmed.');
        setSupporterActive(true);
        setMessage('Thank you—you are now supporting verified UK bin information.');
        void refreshEntitlement();
        router.replace('/plus');
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Payment could not be confirmed.'))
      .finally(() => setBusyPlan(undefined));
  }, [accessToken, params.session_id, params.web_checkout, refreshEntitlement]);

  if (Platform.OS !== 'web') return null;

  async function startCheckout(planId: WebPlan['id']) {
    if (!accessToken) {
      router.push('/account');
      return;
    }
    setBusyPlan(planId);
    setMessage(undefined);
    try {
      const response = await fetch(`${apiBase}/billing/checkout`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? 'Secure checkout could not be opened.');
      const url = new URL(payload.url);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('stripe.com')) {
        throw new Error('Stripe returned an unexpected checkout address.');
      }
      globalThis.location?.assign(url.toString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Secure checkout could not be opened.');
      setBusyPlan(undefined);
    }
  }

  async function openPortal() {
    if (!accessToken) {
      router.push('/account');
      return;
    }
    setBusyPlan('portal');
    setMessage(undefined);
    try {
      const response = await fetch(`${apiBase}/billing/portal`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? 'Billing could not be opened.');
      const url = new URL(payload.url);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('stripe.com')) {
        throw new Error('Stripe returned an unexpected billing address.');
      }
      globalThis.location?.assign(url.toString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Billing could not be opened.');
      setBusyPlan(undefined);
    }
  }

  return (
    <View style={styles.section}>
      <View style={[styles.heading, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons color={theme.accent} name="heart" size={22} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Support the web app</Text>
          <Text style={[styles.body, { color: theme.secondaryText }]}>
            Help fund more council connections, reliable reminders and resident-safe evidence while the App Store builds are prepared.
          </Text>
        </View>
      </View>

      <View style={[styles.freePromise, { backgroundColor: theme.accentSoft }]}>
        <Ionicons color={theme.accent} name="shield-checkmark-outline" size={19} />
        <Text style={[styles.freePromiseText, { color: theme.text }]}>
          Paying is optional. Verified dates, standard reminders, recycling guidance and council report routes remain free.
        </Text>
      </View>

      {!user ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/account')}
          style={({ pressed }) => [styles.signIn, { backgroundColor: theme.accentFill }, pressed && styles.pressed]}>
          <View style={styles.signInCopy}>
            <Text style={styles.signInTitle}>Sign in before choosing a plan</Text>
            <Text style={styles.signInDetail}>This makes your access restorable on another device.</Text>
          </View>
          <Ionicons color="#FFFFFF" name="arrow-forward" size={20} />
        </Pressable>
      ) : !config || busyPlan === 'confirm' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
            {busyPlan === 'confirm' ? 'Confirming your Stripe payment…' : 'Checking secure web billing…'}
          </Text>
        </View>
      ) : config.configured && config.live ? (
        <View style={[styles.planGroup, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          {config.plans.map((plan, index) => (
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(busyPlan)}
              key={plan.id}
              onPress={() => void startCheckout(plan.id)}
              style={({ pressed }) => [
                styles.plan,
                index < config.plans.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth },
                pressed && styles.pressed,
                busyPlan && styles.disabled,
              ]}>
              <View style={styles.planCopy}>
                <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                <Text style={[styles.planDescription, { color: theme.secondaryText }]}>{plan.description}</Text>
                <Text style={[styles.planPrice, { color: theme.accent }]}>{price(plan)}</Text>
              </View>
              {busyPlan === plan.id
                ? <ActivityIndicator color={theme.accent} />
                : <Ionicons color={theme.accent} name="arrow-forward-circle" size={24} />}
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[styles.pending, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          <Ionicons color={theme.secondaryText} name="card-outline" size={22} />
          <View style={styles.headingCopy}>
            <Text style={[styles.planName, { color: theme.text }]}>Secure checkout is being connected</Text>
            <Text style={[styles.planDescription, { color: theme.secondaryText }]}>
              Plans will appear only after the publisher’s live UK Stripe account is verified. Test payments are never shown to residents.
            </Text>
          </View>
        </View>
      )}

      {supporterActive ? (
        <Pressable accessibilityRole="button" disabled={Boolean(busyPlan)} onPress={() => void openPortal()} style={[styles.portal, { borderColor: theme.accent }]}>
          <Text style={[styles.portalText, { color: theme.accent }]}>Manage web billing</Text>
          <Ionicons color={theme.accent} name="open-outline" size={18} />
        </Pressable>
      ) : null}

      {message ? (
        <View accessibilityLiveRegion="polite" style={[styles.message, { backgroundColor: theme.groupedBackground }]}>
          <Text style={[styles.messageText, { color: theme.secondaryText }]}>{message}</Text>
        </View>
      ) : null}

      <Text style={[styles.legal, { color: theme.secondaryText }]}>
        Stripe processes payment and payer contact details. What Bin stores only Stripe IDs, plan, amount and billing status—not card details or your bin address.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, padding: 15, flexDirection: 'row', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '700' },
  body: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  freePromise: { borderRadius: 15, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  freePromiseText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  signIn: { minHeight: 68, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  signInCopy: { flex: 1 },
  signInTitle: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  signInDetail: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  loading: { minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 13, fontWeight: '600' },
  planGroup: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, overflow: 'hidden' },
  plan: { minHeight: 112, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  planCopy: { flex: 1 },
  planName: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  planDescription: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  planPrice: { fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 7 },
  pending: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  portal: { minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  portalText: { fontSize: 15, fontWeight: '700' },
  message: { borderRadius: 13, padding: 12 },
  messageText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  legal: { fontSize: 11.5, lineHeight: 16, textAlign: 'center', paddingHorizontal: 6 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
});

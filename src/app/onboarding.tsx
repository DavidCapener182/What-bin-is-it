import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { onboardingStyles as styles } from '@/features/onboarding/onboarding-styles';
import { OnboardingSteps } from '@/features/onboarding/onboarding-steps';
import { fetchCouncilAddresses, lookupPostcode, ResolvedPlace } from '@/lib/council-provider';
import { requestNotificationPermission } from '@/lib/notifications';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import { councilIdsForResidentUse } from '@/lib/resident-adoption';
import { syncResidentCouncilLinks } from '@/lib/resident-council-links';
import { useAppTheme } from '@/lib/theme';
import { CouncilAddressOption } from '@/lib/types';
import { CollectionRefreshOutcome, useAppData } from '@/lib/use-app-data';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useProductState } from '@/lib/use-product-state';

const totalSteps = 5;

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const { addAddress, collections } = useAppData();
  const analytics = usePilotAnalytics();
  const { completeOnboarding, skipOnboarding, updatePlaceReminders } = useProductState();
  const [step, setStep] = useState(0);
  const [postcode, setPostcode] = useState('');
  const [place, setPlace] = useState<ResolvedPlace>();
  const [addresses, setAddresses] = useState<CouncilAddressOption[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CouncilAddressOption>();
  const [reminders, setReminders] = useState(true);
  const [reminderHour, setReminderHour] = useState(19);
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState<CollectionRefreshOutcome>();
  const [savedAddressId, setSavedAddressId] = useState<string>();
  const [addressQuery, setAddressQuery] = useState('');
  const [inlineError, setInlineError] = useState<string>();

  function skip() {
    skipOnboarding();
    router.replace('/');
  }

  async function findAddress() {
    analytics.track('postcode_lookup_started', { context: 'manual' });
    setBusy(true);
    setInlineError(undefined);
    try {
      const resolved = await lookupPostcode(postcode);
      if (!resolved.providerId || !resolved.councilName) throw new Error('We found the postcode but could not match its waste collection authority.');
      const options = await fetchCouncilAddresses(resolved.postcode, resolved.providerId);
      if (requiresExactCouncilAddress(resolved.providerId) && !options.length) throw new Error('The council property list is temporarily unavailable. Try again shortly.');
      setPlace(resolved);
      setAddresses(options);
      setSelectedAddress(options.length === 1 ? options[0] : undefined);
      analytics.track('postcode_lookup_succeeded', { councilId: resolved.providerId, context: 'manual', outcome: 'success' });
      void syncResidentCouncilLinks(councilIdsForResidentUse([], resolved.providerId)).catch(() => undefined);
      void analytics.syncCouncilWorkspaces(councilIdsForResidentUse([], resolved.providerId)).catch(() => undefined);
      analytics.track('address_options_loaded', { councilId: resolved.providerId, context: options.length ? 'exact-address' : 'postcode-only', outcome: 'success', metricValue: Math.min(1000, options.length) });
      setStep(1);
    } catch (error) {
      analytics.track('postcode_lookup_failed', { context: 'manual', outcome: 'failure', reasonCode: /postcode/i.test(error instanceof Error ? error.message : '') ? 'invalid-postcode' : 'unavailable' });
      setInlineError(error instanceof Error ? error.message : 'Check the postcode and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function checkCollection() {
    if (!place?.providerId || !place.councilName) return;
    setBusy(true);
    setInlineError(undefined);
    try {
      const outcome = await addAddress({
        label: 'Home',
        line1: selectedAddress?.line1 ?? place.line1,
        postcode: selectedAddress?.postcode ?? place.postcode,
        councilName: place.councilName,
        providerId: place.providerId,
        councilAddressId: selectedAddress?.id,
        latitude: place.latitude,
        longitude: place.longitude,
      });
      setSavedAddressId(`address-${(selectedAddress?.id || place.postcode).replace(/[^A-Z0-9]/gi, '').toLowerCase()}`);
      setVerification(outcome);
      setStep(2);
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'This address could not be checked. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!savedAddressId) return;
    setBusy(true);
    setInlineError(undefined);
    try {
      let notificationGranted = false;
      if (reminders) notificationGranted = (await requestNotificationPermission()).granted;
      updatePlaceReminders(savedAddressId, { enabled: reminders && notificationGranted, reminderHour, reminderDayOffset: 1 });
      completeOnboarding();
      router.replace('/');
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'Setup could not finish. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const visibleAddresses = addresses.filter((address) => `${address.line1} ${address.postcode}`.toLocaleLowerCase('en-GB').includes(addressQuery.trim().toLocaleLowerCase('en-GB')));

  return (
    <AppShell activeRoute="/onboarding" hideNavigation>
      <RouteHead title="Set Up Your Bin Reminders" description="Add an exact UK address, check its live council collection dates and choose reminders." path="/onboarding" private />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <View style={styles.topRow}>
            {step > 0 && step !== 2 ? <Pressable accessibilityLabel="Previous setup step" accessibilityRole="button" onPress={() => setStep((current) => Math.max(0, current - 1))} style={styles.topButton}><Ionicons color={theme.accent} name="chevron-back" size={24} /></Pressable> : <View style={styles.topButton} />}
            <Text accessibilityLiveRegion="polite" style={[styles.progressLabel, { color: theme.secondaryText }]}>{Math.min(step + 1, totalSteps)} of {totalSteps}</Text>
            <Pressable accessibilityRole="button" onPress={skip} style={styles.skip}><Text style={[styles.skipText, { color: theme.accent }]}>Skip</Text></Pressable>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.separator }]}><View style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%`, backgroundColor: theme.accentFill }]} /></View>
        </SafeAreaView>
        <OnboardingSteps
          addressQuery={addressQuery}
          addresses={addresses}
          busy={busy}
          checkCollection={() => void checkCollection()}
          findAddress={() => void findAddress()}
          finish={() => void finish()}
          firstCollection={collections[0]}
          inlineError={inlineError}
          place={place}
          postcode={postcode}
          reminderHour={reminderHour}
          reminders={reminders}
          selectedAddress={selectedAddress}
          setAddressQuery={setAddressQuery}
          setPostcode={(value) => { setPostcode(value); setInlineError(undefined); }}
          setReminderHour={setReminderHour}
          setReminders={setReminders}
          setSelectedAddress={setSelectedAddress}
          setStep={setStep}
          step={step}
          verification={verification}
          visibleAddresses={visibleAddresses}
        />
      </View>
    </AppShell>
  );
}

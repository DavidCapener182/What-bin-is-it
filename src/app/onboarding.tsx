import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { fetchCouncilAddresses, lookupPostcode, ResolvedPlace } from '@/lib/council-provider';
import { requestNotificationPermission } from '@/lib/notifications';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import { councilIdsForResidentUse } from '@/lib/resident-adoption';
import { useAppTheme } from '@/lib/theme';
import { CouncilAddressOption } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useProductState } from '@/lib/use-product-state';

const totalSteps = 8;
const reminderTimes = [18, 19, 20, 21];

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const { addAddress } = useAppData();
  const analytics = usePilotAnalytics();
  const { completeOnboarding, skipOnboarding, updatePlaceReminders } = useProductState();
  const [step, setStep] = useState(0);
  const [postcode, setPostcode] = useState('');
  const [place, setPlace] = useState<ResolvedPlace>();
  const [addresses, setAddresses] = useState<CouncilAddressOption[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CouncilAddressOption>();
  const [name, setName] = useState('Home');
  const [reminders, setReminders] = useState(true);
  const [reminderHour, setReminderHour] = useState(19);
  const [busy, setBusy] = useState(false);
  const [permissionReady, setPermissionReady] = useState(false);

  function skip() {
    skipOnboarding();
    router.replace('/');
  }

  async function findAddress() {
    analytics.track('postcode_lookup_started', { context: 'manual' });
    setBusy(true);
    try {
      const resolved = await lookupPostcode(postcode);
      if (!resolved.providerId || !resolved.councilName) {
        throw new Error('We found the postcode but could not match its waste collection authority.');
      }
      const options = await fetchCouncilAddresses(resolved.postcode, resolved.providerId);
      if (requiresExactCouncilAddress(resolved.providerId) && !options.length) {
        throw new Error('The council property list is temporarily unavailable. Try again shortly.');
      }
      setPlace(resolved);
      setAddresses(options);
      setSelectedAddress(options.length === 1 ? options[0] : undefined);
      analytics.track('postcode_lookup_succeeded', {
        councilId: resolved.providerId,
        context: 'manual',
        outcome: 'success',
      });
      void analytics.syncCouncilLinks(
        councilIdsForResidentUse([], resolved.providerId),
      ).catch(() => {
        // Council adoption evidence is retried after the place is saved.
      });
      analytics.track('address_options_loaded', {
        councilId: resolved.providerId,
        context: options.length ? 'exact-address' : 'postcode-only',
        outcome: 'success',
        metricValue: Math.min(1000, options.length),
      });
      setStep(2);
    } catch (error) {
      analytics.track('postcode_lookup_failed', {
        context: 'manual',
        outcome: 'failure',
        reasonCode: /postcode/i.test(error instanceof Error ? error.message : '')
          ? 'invalid-postcode'
          : 'unavailable',
      });
      Alert.alert('Could not find that address', error instanceof Error ? error.message : 'Check the postcode and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function askForNotifications() {
    if (!reminders) {
      setPermissionReady(false);
      setStep(7);
      return;
    }
    setBusy(true);
    try {
      const result = await requestNotificationPermission();
      setPermissionReady(result.granted);
      if (!result.granted) Alert.alert('You can enable this later', result.reason);
      setStep(7);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!place?.providerId || !place.councilName) return;
    setBusy(true);
    try {
      const line1 = selectedAddress?.line1 ?? place.line1;
      const outcome = await addAddress({
        label: name.trim() || 'Home',
        line1,
        postcode: selectedAddress?.postcode ?? place.postcode,
        councilName: place.councilName,
        providerId: place.providerId,
        councilAddressId: selectedAddress?.id,
        latitude: place.latitude,
        longitude: place.longitude,
      });
      const addressId = `address-${(selectedAddress?.id || place.postcode).replace(/[^A-Z0-9]/gi, '').toLowerCase()}`;
      updatePlaceReminders(addressId, {
        enabled: reminders && permissionReady,
        reminderHour,
        reminderDayOffset: 1,
      });
      completeOnboarding();
      if (!outcome.verified) {
        Alert.alert('Address saved', `${outcome.message}\n\nYou can retry the live council check from Today.`);
      }
      router.replace('/');
    } catch (error) {
      Alert.alert('Could not finish setup', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  const progress = `${Math.min(step + 1, totalSteps)} of ${totalSteps}`;
  const selectedPropertyRequired = Boolean(addresses.length && !selectedAddress);

  return (
    <AppShell activeRoute="/onboarding" hideNavigation>
      <RouteHead title="Set Up Your Bin Reminders" description="Add an exact UK address, check its live council collection dates and choose reminders." path="/onboarding" />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <View style={styles.topRow}>
            {step > 0 ? (
              <Pressable accessibilityLabel="Previous setup step" accessibilityRole="button" onPress={() => setStep((current) => Math.max(0, current - 1))} style={styles.topButton}>
                <Ionicons color={theme.accent} name="chevron-back" size={24} />
              </Pressable>
            ) : <View style={styles.topButton} />}
            <Text accessibilityLiveRegion="polite" style={[styles.progressLabel, { color: theme.secondaryText }]}>{progress}</Text>
            <Pressable accessibilityRole="button" onPress={skip} style={styles.skip}>
              <Text style={[styles.skipText, { color: theme.accent }]}>Skip</Text>
            </Pressable>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.separator }]}>
            <View style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%`, backgroundColor: theme.accent }]} />
          </View>
        </SafeAreaView>

        <View style={styles.body}>
          {step === 0 ? (
            <View style={styles.step}>
              <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons color={theme.accent} name="trash-bin-outline" size={38} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Never guess bin night again</Text>
              <Text style={[styles.copy, { color: theme.secondaryText }]}>
                Add your exact property once. We will show only dates returned by its live council source and help you track what happened after collection day.
              </Text>
              <View style={[styles.promise, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                {[
                  ['calendar-outline', 'Verified collection dates'],
                  ['notifications-outline', 'Reminders you control'],
                  ['document-text-outline', 'Honest missed-bin reporting'],
                ].map(([icon, label]) => (
                  <View key={label} style={styles.promiseRow}>
                    <Ionicons color={theme.accent} name={icon as keyof typeof Ionicons.glyphMap} size={21} />
                    <Text style={[styles.promiseText, { color: theme.text }]}>{label}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: analytics.enabled }}
                onPress={() => void analytics.setEnabled(!analytics.enabled)}
                style={[styles.evidenceChoice, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                <View style={styles.evidenceCopy}>
                  <Text style={[styles.evidenceTitle, { color: theme.text }]}>Help improve local bin services</Text>
                  <Text style={[styles.evidenceText, { color: theme.secondaryText }]}>
                    Optional anonymous app evidence only. It can count a random installation against its council, but never includes your postcode, address, location, search words or report notes.
                  </Text>
                </View>
                <Switch
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  pointerEvents="none"
                  trackColor={{ false: theme.tertiaryText, true: theme.accent }}
                  value={analytics.enabled}
                />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setStep(1)} style={[styles.primary, { backgroundColor: theme.accent }]}>
                <Text style={styles.primaryText}>Get started</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.step}>
              <Text style={[styles.title, { color: theme.text }]}>What is your postcode?</Text>
              <Text style={[styles.copy, { color: theme.secondaryText }]}>A postcode finds the local authority. Your exact property selects the correct collection round.</Text>
              <TextInput
                accessibilityLabel="UK postcode"
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setPostcode}
                onSubmitEditing={() => void findAddress()}
                placeholder="e.g. M1 1AE"
                placeholderTextColor={theme.tertiaryText}
                returnKeyType="go"
                style={[styles.postcodeInput, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]}
                value={postcode}
              />
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void findAddress()} style={[styles.primary, { backgroundColor: theme.accent }, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Find my council</Text>}
              </Pressable>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.step}>
              <Text style={[styles.title, { color: theme.text }]}>{addresses.length ? 'Choose your property' : 'Confirm your area'}</Text>
              <Text style={[styles.copy, { color: theme.secondaryText }]}>
                {addresses.length
                  ? `${place?.councilName} needs the exact property to return the correct round.`
                  : `${place?.line1} · ${place?.postcode}`}
              </Text>
              {addresses.length ? (
                <FlatList
                  data={addresses}
                  keyExtractor={(item) => item.id}
                  style={styles.addressList}
                  renderItem={({ item }) => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selectedAddress?.id === item.id }}
                      onPress={() => setSelectedAddress(item)}
                      style={[styles.addressOption, { backgroundColor: theme.surface, borderColor: selectedAddress?.id === item.id ? theme.accent : theme.separator }]}>
                      <View style={styles.addressCopy}>
                        <Text style={[styles.addressTitle, { color: theme.text }]}>{item.line1}</Text>
                        <Text style={[styles.addressPostcode, { color: theme.secondaryText }]}>{item.postcode}</Text>
                      </View>
                      <Ionicons color={selectedAddress?.id === item.id ? theme.accent : theme.tertiaryText} name={selectedAddress?.id === item.id ? 'checkmark-circle' : 'ellipse-outline'} size={22} />
                    </Pressable>
                  )}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: selectedPropertyRequired }}
                disabled={selectedPropertyRequired}
                onPress={() => setStep(3)}
                style={[styles.primary, { backgroundColor: theme.accent }, selectedPropertyRequired && styles.disabled]}>
                <Text style={styles.primaryText}>Continue</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.step}>
              <Text style={[styles.title, { color: theme.text }]}>Name this place</Text>
              <Text style={[styles.copy, { color: theme.secondaryText }]}>Use a short name you will recognise in reminders and when switching addresses.</Text>
              <TextInput
                accessibilityLabel="Place name"
                onChangeText={setName}
                placeholder="Home"
                placeholderTextColor={theme.tertiaryText}
                style={[styles.postcodeInput, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]}
                value={name}
              />
              <Pressable accessibilityRole="button" onPress={() => setStep(4)} style={[styles.primary, { backgroundColor: theme.accent }]}>
                <Text style={styles.primaryText}>Continue</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.step}>
              <Text style={[styles.title, { color: theme.text }]}>Would you like bin-night reminders?</Text>
              <Text style={[styles.copy, { color: theme.secondaryText }]}>The app schedules alerts only for verified collection dates. You can change each place separately later.</Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: reminders }}
                onPress={() => setReminders((current) => !current)}
                style={[styles.switchCard, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                <View style={[styles.switchIcon, { backgroundColor: theme.accentSoft }]}>
                  <Ionicons color={theme.accent} name="notifications-outline" size={24} />
                </View>
                <View style={styles.switchCopy}>
                  <Text style={[styles.switchTitle, { color: theme.text }]}>Bin-night reminders</Text>
                  <Text style={[styles.switchDetail, { color: theme.secondaryText }]}>{reminders ? 'On' : 'Off'}</Text>
                </View>
                <Switch pointerEvents="none" value={reminders} trackColor={{ false: theme.tertiaryText, true: theme.accent }} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setStep(reminders ? 5 : 6)} style={[styles.primary, { backgroundColor: theme.accent }]}>
                <Text style={styles.primaryText}>Continue</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 5 ? (
            <View style={styles.step}>
              <Text style={[styles.title, { color: theme.text }]}>What time should we remind you?</Text>
              <Text style={[styles.copy, { color: theme.secondaryText }]}>This reminder arrives the evening before collection.</Text>
              <View style={[styles.timePicker, { backgroundColor: theme.groupedBackground }]}>
                {reminderTimes.map((hour) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: reminderHour === hour }}
                    key={hour}
                    onPress={() => setReminderHour(hour)}
                    style={[styles.time, reminderHour === hour && { backgroundColor: theme.surface }]}>
                    <Text style={[styles.timeText, { color: reminderHour === hour ? theme.accent : theme.secondaryText }]}>{hour}:00</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable accessibilityRole="button" onPress={() => setStep(6)} style={[styles.primary, { backgroundColor: theme.accent }]}>
                <Text style={styles.primaryText}>Continue</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 6 ? (
            <View style={styles.step}>
              <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons color={theme.accent} name="notifications-outline" size={38} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>{reminders ? 'Allow notifications' : 'Notifications are optional'}</Text>
              <Text style={[styles.copy, { color: theme.secondaryText }]}>
                {reminders
                  ? 'Your phone or browser will show its own permission prompt. On iPhone web, install the app to the Home Screen first.'
                  : 'You can turn reminders on for any saved place from Settings.'}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => void askForNotifications()} style={[styles.primary, { backgroundColor: theme.accent }]}>
                <Text style={styles.primaryText}>{reminders ? 'Continue to permission' : 'Continue'}</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 7 ? (
            <View style={styles.step}>
              <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}>
                <Ionicons color={theme.success} name="checkmark" size={40} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>You are ready</Text>
              <Text style={[styles.copy, { color: theme.secondaryText }]}>We will now save {name || 'this place'} and check its live {place?.councilName} collection source.</Text>
              <View style={[styles.confirmation, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                <Text style={[styles.confirmTitle, { color: theme.text }]}>{selectedAddress?.line1 ?? place?.line1}</Text>
                <Text style={[styles.confirmDetail, { color: theme.secondaryText }]}>{place?.postcode} · {place?.councilName}</Text>
                <Text style={[styles.confirmDetail, { color: theme.secondaryText }]}>
                  Reminders: {reminders && permissionReady ? `${reminderHour}:00 the night before` : 'Not enabled'}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void finish()} style={[styles.primary, { backgroundColor: theme.accent }, busy && styles.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Check my collection dates</Text>}
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  safe: { paddingHorizontal: 16, paddingTop: 4 },
  topRow: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topButton: { width: 54, height: 44, justifyContent: 'center' },
  skip: { minWidth: 54, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontSize: 15, fontWeight: '600' },
  progressLabel: { fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  body: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  step: { flex: 1, paddingHorizontal: 22, paddingTop: 38, paddingBottom: 28, gap: 16 },
  heroIcon: { width: 74, height: 74, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1.15 },
  copy: { fontSize: 16, lineHeight: 23 },
  promise: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 15, gap: 14 },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  promiseText: { fontSize: 15, fontWeight: '600' },
  evidenceChoice: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  evidenceCopy: { flex: 1 },
  evidenceTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  evidenceText: { fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  primary: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 'auto', paddingHorizontal: 16 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  postcodeInput: { height: 56, borderRadius: 13, borderWidth: 1, paddingHorizontal: 15, fontSize: 18, fontWeight: '600' },
  addressList: { flex: 1 },
  addressOption: { minHeight: 70, borderWidth: 1, borderRadius: 13, padding: 13, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  addressCopy: { flex: 1 },
  addressTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  addressPostcode: { fontSize: 13, marginTop: 3 },
  switchCard: { minHeight: 82, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  switchCopy: { flex: 1 },
  switchTitle: { fontSize: 16, fontWeight: '700' },
  switchDetail: { fontSize: 14, marginTop: 4 },
  timePicker: { padding: 4, borderRadius: 13, flexDirection: 'row', gap: 3 },
  time: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  timeText: { fontSize: 15, fontWeight: '700' },
  confirmation: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16 },
  confirmTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  confirmDetail: { fontSize: 14, lineHeight: 20, marginTop: 5 },
  disabled: { opacity: 0.5 },
});

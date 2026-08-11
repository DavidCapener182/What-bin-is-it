import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { PwaSettingsCard } from '@/components/pwa-settings-card';
import { HomeScreenWidgetCard } from '@/components/home-screen-widget-card';
import { RouteHead } from '@/components/route-head';
import { residentPaymentsEnabled } from '@/lib/commercial-offer';
import { nonInteractiveStyle } from '@/lib/design-system';
import { requestNotificationPermission } from '@/lib/notifications';
import { useAppTheme } from '@/lib/theme';
import { AppearancePreference } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useAccount } from '@/lib/use-account';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useProductState } from '@/lib/use-product-state';
import { useSubscription } from '@/lib/use-subscription';
import { useCouncilProfile } from '@/lib/use-council-profile';

function Row({
  icon,
  title,
  detail,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { borderBottomColor: theme.separator }, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? `${theme.danger}16` : theme.accentSoft }]}>
        <Ionicons color={danger ? theme.danger : theme.accent} name={icon} size={20} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: danger ? theme.danger : theme.text }]}>{title}</Text>
        <Text style={[styles.rowDetail, { color: theme.secondaryText }]}>{detail}</Text>
      </View>
      <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function ToggleRow({
  title,
  detail,
  value,
  onChange,
  disabled = false,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.toggleRow, { borderBottomColor: theme.separator }, pressed && styles.pressed, disabled && styles.disabled]}>
      <View style={styles.rowCopy}>
        <Text style={[styles.toggleTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.toggleDetail, { color: theme.secondaryText }]}>{detail}</Text>
      </View>
      <Switch
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={nonInteractiveStyle}
        trackColor={{ false: theme.tertiaryText, true: theme.accent }}
        value={value}
      />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useAppTheme();
  const {
    addresses,
    activeAddress,
    sourceStatus,
    lastVerifiedAt,
    refreshCollections,
    clearAllAppData,
  } = useAppData();
  const {
    appearance,
    setAppearance,
    showSponsoredServices,
    setShowSponsoredServices,
    liveCollectionSurfaceEnabled,
    setLiveCollectionSurfaceEnabled,
    reports,
    history,
    reminderPreferencesFor,
    clearProductData,
  } = useProductState();
  const subscription = useSubscription();
  const account = useAccount();
  const analytics = usePilotAnalytics();
  const councilProfile = useCouncilProfile(activeAddress?.providerId);
  const placePreferences = reminderPreferencesFor(activeAddress?.id);

  function withPlus(action: () => void) {
    if (!residentPaymentsEnabled() || subscription.isPlus) {
      action();
      return;
    }
    router.push('/plus');
  }

  async function changeLiveCollectionSurface(next: boolean) {
    if (!next) {
      setLiveCollectionSurfaceEnabled(false);
      return;
    }
    try {
      if (Platform.OS === 'android') {
        const permission = await requestNotificationPermission();
        if (!permission.granted) {
          Alert.alert('Notifications are not ready', permission.reason);
          return;
        }
      }
      setLiveCollectionSurfaceEnabled(true);
    } catch {
      Alert.alert('Could not enable bin-night status', 'Please try again.');
    }
  }

  function confirmClear() {
    const message = 'This removes saved addresses, schedules, reminder settings, activity, optional app-improvement evidence, the anonymous council resident record, and local report tracking. It cannot be undone.';
    const clear = () => {
      void Promise.all([clearAllAppData(), clearProductData()]).then(() => router.replace('/onboarding'));
    };
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm(`Clear all app data?\n\n${message}`)) clear();
      return;
    }
    Alert.alert(
      'Clear all app data?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all data',
          style: 'destructive',
          onPress: clear,
        },
      ],
    );
  }

  return (
    <AppShell activeRoute="/settings">
      <RouteHead
        title="Settings"
        description="Manage saved places, reminders, appearance, privacy, reports and support."
        path="/settings"
      />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <View style={styles.headerRow}>
            <Pressable accessibilityLabel="Close settings" accessibilityRole="button" onPress={() => router.back()} style={styles.close}>
              <Ionicons color={theme.accent} name="chevron-back" size={24} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
            <View style={styles.close} />
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Addresses</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Row
                detail={addresses.length ? `${addresses.length} saved · ${activeAddress?.label ?? 'choose a place'}` : 'Add your first UK postcode'}
                icon="location-outline"
                onPress={() => router.push('/places')}
                title="Manage addresses"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Reminders for {activeAddress?.label ?? 'a saved place'}</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Row
                detail={!activeAddress
                  ? 'Add an address first'
                  : !placePreferences.enabled
                    ? 'Off'
                    : `${placePreferences.reminderDayOffset ? 'Day before' : 'Collection day'} · ${String(placePreferences.reminderHour).padStart(2, '0')}:${String(placePreferences.reminderMinute).padStart(2, '0')} · ${Object.values(placePreferences.wasteTypes).filter(Boolean).length} bin types`}
                icon="notifications-outline"
                onPress={() => activeAddress ? router.push('/reminder-settings' as Href) : router.push('/places')}
                title="Bin reminders"
              />
            </View>
          </View>

          {residentPaymentsEnabled() || Platform.OS === 'web' ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Account and plan</Text>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                <Row
                  detail={account.user?.email ?? 'Optional sign-in to sync Free or Plus access'}
                  icon={account.user ? 'person-circle-outline' : 'person-add-outline'}
                  onPress={() => router.push('/account')}
                  title={account.user ? 'Your account' : 'Sign in'}
                />
                <Row
                  detail={subscription.sponsoredBy ?? (subscription.isPlus ? 'Plus active · manage or restore purchases' : 'Free plan · optional household conveniences')}
                  icon={subscription.isPlus ? 'checkmark-circle-outline' : 'sparkles-outline'}
                  onPress={() => router.push('/plus')}
                  title={subscription.sponsoredBy ? 'What Bin? Plus · included' : 'What Bin? Plus'}
                />
                <Row
                  detail="Share responsibility and collection status without uploading your address"
                  icon="people-outline"
                  onPress={() => router.push('/household' as Href)}
                  title="Household sharing"
                />
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Appearance</Text>
            <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: theme.groupedBackground }]}>
              {(['system', 'light', 'dark'] as AppearancePreference[]).map((value) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: appearance === value }}
                  key={value}
                  onPress={() => setAppearance(value)}
                  style={[styles.segmentOption, appearance === value && { backgroundColor: theme.surface }]}>
                  <Text style={[styles.segmentText, { color: appearance === value ? theme.accent : theme.secondaryText }]}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Reports and activity</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              {councilProfile?.featureFlags?.missedCollection !== false ? <Row detail="Use after a verified collection window has passed" icon="alert-circle-outline" onPress={() => router.push('/report-missed')} title="Report a missed collection" /> : null}
              <Row detail={`${reports.length} locally tracked`} icon="notifications-outline" onPress={() => router.push('/activity' as Href)} title="Activity, alerts and reports" />
              <Row detail={`${history.length} recorded actions`} icon="time-outline" onPress={() => withPlus(() => router.push('/history'))} title="Activity history" />
            </View>
          </View>

          <HomeScreenWidgetCard />

          {Platform.OS !== 'web' ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Lock Screen</Text>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                <ToggleRow
                  detail="Show an iOS Live Activity or Android collection notification only on bin night and collection day."
                  onChange={(enabled) => void changeLiveCollectionSurface(enabled)}
                  title="Bin-night status"
                  value={liveCollectionSurfaceEnabled}
                />
              </View>
            </View>
          ) : null}

          <PwaSettingsCard />

          {Platform.OS !== 'web' ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>App notifications</Text>
              <View style={[styles.platformNote, { backgroundColor: theme.accentSoft }]}>
                <Ionicons color={theme.accent} name="phone-portrait-outline" size={21} />
                <Text style={[styles.platformText, { color: theme.text }]}>This installed app uses your phone’s notification settings. If alerts are blocked, enable them in iOS or Android Settings.</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Collection data and privacy</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Row detail={activeAddress?.councilName ?? 'Add an address to connect its council'} icon="business-outline" onPress={() => router.push('/schedule')} title="Council" />
              <Row detail={lastVerifiedAt ? new Date(lastVerifiedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : sourceStatus} icon="refresh-outline" onPress={() => void refreshCollections()} title="Refresh verified dates" />
              <Row detail="See how council dates, locations and report routes are sourced" icon="server-outline" onPress={() => router.push('/data-sources')} title="View data sources" />
              <ToggleRow
                detail="Optional app-improvement events, such as lookup success or failure; council resident counting is separate"
                onChange={(enabled) => void analytics.setEnabled(enabled)}
                title="Help improve local bin services"
                value={analytics.enabled}
              />
              <ToggleRow
                detail="Show clearly labelled council-approved services after free council and reuse options"
                onChange={setShowSponsoredServices}
                title="Show sponsored local services"
                value={showSponsoredServices}
              />
              <View style={styles.privacyRow}>
                <Ionicons color={theme.accent} name="lock-closed-outline" size={20} />
                <Text style={[styles.privacyText, { color: theme.secondaryText }]}>
                  Saved places, local report tracking, and preferences stay on this device. A separate random installation ID and council identifier provide automatic resident totals without sending your postcode, address, property reference, account or email.
                </Text>
              </View>
              <Row
                detail="Delete optional app-improvement events while keeping saved places and the separate council resident count"
                icon="shield-checkmark-outline"
                onPress={() => void analytics.eraseAnalytics()}
                title="Erase app-improvement evidence"
              />
              <Row danger detail="Remove all local addresses, schedules, reports and preferences" icon="trash-outline" onPress={confirmClear} title="Clear all app data" />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Help and feedback</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Row detail="Wrong date, bin, address or council in the app" icon="flag-outline" onPress={() => router.push('/report-incorrect')} title="Report incorrect app information" />
              <Row detail="Help with using the app" icon="help-circle-outline" onPress={() => router.push({ pathname: '/support', params: { topic: 'app-help' } })} title="Help" />
              <Row detail="Tell us about a crash or feature that did not work" icon="bug-outline" onPress={() => router.push({ pathname: '/support', params: { topic: 'app-problem' } })} title="Report an app problem" />
              <Row detail="Request another household item or search term" icon="add-circle-outline" onPress={() => router.push({ pathname: '/support', params: { topic: 'guide-item' } })} title="Suggest an item" />
              <Row detail="Open the support form" icon="mail-outline" onPress={() => router.push('/support')} title="Contact support" />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>For organisations</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Row
                detail="Council pilots, housing providers and managed-property plans"
                icon="business-outline"
                onPress={() => router.push('/partners')}
                title="Council and property partnerships"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>About</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <View style={styles.about}>
                <Text style={[styles.aboutName, { color: theme.text }]}>What Bin Is It Tonight?</Text>
                <Text style={[styles.aboutDetail, { color: theme.secondaryText }]}>Version 1.1.0 · Verified council dates only</Text>
              </View>
              <Row detail="How local information is stored and requested" icon="lock-closed-outline" onPress={() => router.push('/privacy')} title="Privacy" />
              <Row detail="Important limits and safe-use information" icon="document-outline" onPress={() => router.push('/terms')} title="Terms" />
              <Row detail="Council, postcode, report and map providers" icon="server-outline" onPress={() => router.push('/data-sources')} title="Data sources" />
              <Row detail="Recorded incidents, components and council coverage" icon="pulse-outline" onPress={() => router.push('/status' as Href)} title="Service status" />
            </View>
          </View>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { height: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 42, gap: 24 },
  section: { gap: 9 },
  sectionLabel: { fontSize: 13, fontWeight: '600', paddingHorizontal: 3 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, overflow: 'hidden' },
  row: { minHeight: 66, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowDetail: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  toggleRow: { minHeight: 66, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  toggleTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '600' },
  toggleDetail: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  inlineLabel: { fontSize: 12.5, fontWeight: '600', paddingHorizontal: 3, marginTop: 3 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 11, gap: 2 },
  segmentOption: { flex: 1, minHeight: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13.5, fontWeight: '600' },
  timeStepper: { minHeight: 60, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeButton: { width: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  timeCopy: { alignItems: 'center' },
  timeTitle: { fontSize: 13, fontWeight: '600' },
  timeValue: { fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
  binRow: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5 },
  binLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  platformNote: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  platformText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  privacyRow: { padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 19 },
  about: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  aboutName: { fontSize: 15, fontWeight: '700' },
  aboutDetail: { fontSize: 13, marginTop: 5 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
});

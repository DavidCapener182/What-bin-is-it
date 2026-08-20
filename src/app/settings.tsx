import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { InlineNotice, ResidentSearchField } from '@/components/resident-layout';
import { PwaSettingsCard } from '@/components/pwa-settings-card';
import { HomeScreenWidgetCard } from '@/components/home-screen-widget-card';
import { RouteHead } from '@/components/route-head';
import { settingsCategories, SettingsCategory } from '@/features/settings/settings-model';
import { SettingsRow, SettingsToggleRow } from '@/features/settings/settings-primitives';
import { settingsStyles as styles } from '@/features/settings/settings-styles';
import { SettingsUtilitySections } from '@/features/settings/settings-utility-sections';
import { residentPaymentsEnabled } from '@/lib/commercial-offer';
import { requestNotificationPermission } from '@/lib/notifications';
import { useAppTheme } from '@/lib/theme';
import { AppearancePreference } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useAccount } from '@/lib/use-account';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useProductState } from '@/lib/use-product-state';
import { useSubscription } from '@/lib/use-subscription';
import { useCouncilProfile } from '@/lib/use-council-profile';

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
  const [feedback, setFeedback] = useState<{ error: boolean; message: string }>();
  const [category, setCategory] = useState<SettingsCategory>('all');
  const [settingsQuery, setSettingsQuery] = useState('');
  const query = settingsQuery.trim().toLocaleLowerCase('en-GB');
  const visibleCategories = settingsCategories.filter((item) => item.id !== 'all' && (!query || `${item.label} ${item.terms}`.toLocaleLowerCase('en-GB').includes(query)));
  const shows = (value: SettingsCategory) => (category === 'all' || category === value) && (!query || visibleCategories.some((item) => item.id === value));

  function withPlus(action: () => void) {
    if (!residentPaymentsEnabled() || subscription.isPlus) {
      action();
      return;
    }
    router.push('/plus');
  }

  async function changeLiveCollectionSurface(next: boolean) {
    setFeedback(undefined);
    if (!next) {
      setLiveCollectionSurfaceEnabled(false);
      setFeedback({ error: false, message: 'Bin-night status is off.' });
      return;
    }
    try {
      if (Platform.OS === 'android') {
        const permission = await requestNotificationPermission();
        if (!permission.granted) {
          setFeedback({ error: true, message: permission.reason ?? 'Notifications are not enabled for this app.' });
          return;
        }
      }
      setLiveCollectionSurfaceEnabled(true);
      setFeedback({ error: false, message: 'Bin-night status is on.' });
    } catch {
      setFeedback({ error: true, message: 'Bin-night status could not be enabled. Please try again.' });
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
        private
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
          {feedback ? <InlineNotice title={feedback.message} tone={feedback.error ? 'danger' : 'success'} /> : null}
          <View style={styles.finder}>
            <ResidentSearchField
              accessibilityLabel="Search settings"
              clear={() => setSettingsQuery('')}
              onChangeText={(value) => { setSettingsQuery(value); setCategory('all'); }}
              placeholder="Search settings"
              value={settingsQuery}
            />
            <ScrollView accessibilityLabel="Settings categories" accessibilityRole="tablist" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabs}>
              {settingsCategories.filter((item) => item.id === 'all' || !query || visibleCategories.some((visible) => visible.id === item.id)).map((item) => {
                const selected = category === item.id;
                return <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  key={item.id}
                  onPress={() => { setCategory(item.id); setSettingsQuery(''); }}
                  style={[styles.categoryTab, { backgroundColor: selected ? theme.accentFill : theme.surface, borderColor: selected ? theme.accent : theme.separator }]}>
                  <Text style={[styles.categoryTabText, { color: selected ? '#FFFFFF' : theme.secondaryText }]}>{item.label}</Text>
                </Pressable>;
              })}
            </ScrollView>
          </View>
          {query && !visibleCategories.length ? <InlineNotice title="No settings match that search" tone="warning" /> : null}
          <View style={[styles.section, !shows('places') && styles.hidden]}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Addresses</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <SettingsRow
                detail={addresses.length ? `${addresses.length} saved · ${activeAddress?.label ?? 'choose a place'}` : 'Add your first UK postcode'}
                icon="location-outline"
                onPress={() => router.push('/places')}
                title="Manage addresses"
              />
            </View>
          </View>

          <View style={[styles.section, !shows('places') && styles.hidden]}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Reminders for {activeAddress?.label ?? 'a saved place'}</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <SettingsRow
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
            <View style={[styles.section, !shows('account') && styles.hidden]}>
              <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Account and plan</Text>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                <SettingsRow
                  detail={account.user?.email ?? 'Optional sign-in to sync Free or Plus access'}
                  icon={account.user ? 'person-circle-outline' : 'person-add-outline'}
                  onPress={() => router.push('/account')}
                  title={account.user ? 'Your account' : 'Sign in'}
                />
                <SettingsRow
                  detail={subscription.sponsoredBy ?? (subscription.isPlus ? 'Plus active · manage or restore purchases' : 'Free plan · optional household conveniences')}
                  icon={subscription.isPlus ? 'checkmark-circle-outline' : 'sparkles-outline'}
                  onPress={() => router.push('/plus')}
                  title={subscription.sponsoredBy ? 'What Bin? Plus · included' : 'What Bin? Plus'}
                />
                <SettingsRow
                  detail="Share responsibility and collection status without uploading your address"
                  icon="people-outline"
                  onPress={() => router.push('/household' as Href)}
                  title="Household sharing"
                />
              </View>
            </View>
          ) : null}

          <View style={[styles.section, !shows('appearance') && styles.hidden]}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Appearance</Text>
            <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: theme.groupedBackground }]}>
              {(['system', 'light', 'dark'] as AppearancePreference[]).map((value) => (
                <Pressable
                  aria-checked={appearance === value}
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

          <View style={[styles.section, !shows('activity') && styles.hidden]}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Reports and activity</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              {councilProfile?.featureFlags?.missedCollection !== false ? <SettingsRow detail="Use after a verified collection window has passed" icon="alert-circle-outline" onPress={() => router.push('/report-missed')} title="Report a missed collection" /> : null}
              <SettingsRow detail={`${reports.length} locally tracked`} icon="notifications-outline" onPress={() => router.push('/activity' as Href)} title="Activity, alerts and reports" />
              <SettingsRow detail={`${history.length} recorded actions`} icon="time-outline" onPress={() => withPlus(() => router.push('/history'))} title="Activity history" />
            </View>
          </View>

          {shows('notifications') ? <HomeScreenWidgetCard /> : null}

          {Platform.OS !== 'web' ? (
            <View style={[styles.section, !shows('notifications') && styles.hidden]}>
              <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Lock Screen</Text>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                <SettingsToggleRow
                  detail="Show an iOS Live Activity or Android collection notification only on bin night and collection day."
                  onChange={(enabled) => void changeLiveCollectionSurface(enabled)}
                  title="Bin-night status"
                  value={liveCollectionSurfaceEnabled}
                />
              </View>
            </View>
          ) : null}

          {shows('notifications') ? <PwaSettingsCard /> : null}

          {Platform.OS !== 'web' ? (
            <View style={[styles.section, !shows('notifications') && styles.hidden]}>
              <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>App notifications</Text>
              <View style={[styles.platformNote, { backgroundColor: theme.accentSoft }]}>
                <Ionicons color={theme.accent} name="phone-portrait-outline" size={21} />
                <Text style={[styles.platformText, { color: theme.text }]}>This installed app uses your phone’s notification settings. If alerts are blocked, enable them in iOS or Android Settings.</Text>
              </View>
            </View>
          ) : null}

          <SettingsUtilitySections
            analyticsEnabled={analytics.enabled}
            clearAnalytics={() => { void analytics.eraseAnalytics(); }}
            confirmClear={confirmClear}
            councilName={activeAddress?.councilName}
            lastVerifiedAt={lastVerifiedAt}
            refreshCollections={() => { void refreshCollections(); }}
            setAnalyticsEnabled={(enabled) => { void analytics.setEnabled(enabled); }}
            setShowSponsoredServices={setShowSponsoredServices}
            showSponsoredServices={showSponsoredServices}
            shows={shows}
            sourceStatus={sourceStatus}
          />
        </ScrollView>
      </View>
    </AppShell>
  );
}

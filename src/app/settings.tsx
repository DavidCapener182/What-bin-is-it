import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { PwaSettingsCard } from '@/components/pwa-settings-card';
import { RouteHead } from '@/components/route-head';
import { collectionMeta, wasteTypes } from '@/lib/data';
import { appColours, appFonts } from '@/lib/design-system';
import { requestNotificationPermission } from '@/lib/notifications';
import { WasteType } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';

const times = [{ hour: 18, label: '6pm' }, { hour: 19, label: '7pm' }, { hour: 20, label: '8pm' }];

function ChevronRow({
  icon,
  iconColour = appColours.brand,
  iconBackground = '#E4F3ED',
  title,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColour?: string;
  iconBackground?: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chevronRow, pressed && styles.pressed]}>
      <View style={[styles.roundIcon, { backgroundColor: iconBackground }]}>
        <Ionicons color={iconColour} name={icon} size={20} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoText}>{detail}</Text>
      </View>
      <Ionicons color="#6F878A" name="chevron-forward" size={19} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const {
    preferences,
    addresses,
    activeAddress,
    collections,
    sourceStatus,
    updatePreferences,
    toggleWasteType,
  } = useAppData();
  const [busy, setBusy] = useState(false);
  const presentWasteTypes = new Set(collections.map((collection) => collection.wasteType));
  const relevantWasteTypes = collections.length
    ? wasteTypes.filter((type) => presentWasteTypes.has(type))
    : [];

  async function changeNotifications(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const permission = await requestNotificationPermission();
        if (!permission.granted) {
          Alert.alert('Notifications are off', permission.reason);
          return;
        }
      }
      updatePreferences({ enabled: next });
    } catch {
      Alert.alert('Could not update reminders', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function reportIncorrectData() {
    const subject = encodeURIComponent('Incorrect bin collection data');
    const body = encodeURIComponent([
      'What is wrong?',
      '',
      `Place: ${activeAddress?.label ?? 'No saved place'}`,
      `Postcode: ${activeAddress?.postcode ?? 'Not available'}`,
      `Council: ${activeAddress?.councilName ?? 'Not available'}`,
      `Displayed status: ${sourceStatus}`,
      '',
      'Expected result:',
    ].join('\n'));
    void Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  }

  return (
    <AppShell activeRoute="/settings">
      <RouteHead
        title="Settings"
        description="Manage saved places, bin reminders, app installation, privacy and collection data."
        path="/settings"
      />
      <View style={styles.page}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <Text style={styles.kicker}>MAKE IT YOURS</Text>
          <Text style={styles.title}>Settings</Text>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PLACES</Text>
            <View style={styles.settingCard}>
              <ChevronRow
                detail={addresses.length ? `${addresses.length} saved · ${activeAddress?.label ?? 'choose a place'}` : 'Add your first UK postcode'}
                icon="location-outline"
                onPress={() => router.push('/places')}
                title="Manage addresses"
              />
            </View>
          </View>

          <PwaSettingsCard />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
            <View style={styles.settingCard}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: preferences.enabled, disabled: busy }}
                disabled={busy}
                onPress={() => void changeNotifications(!preferences.enabled)}
                style={({ pressed }) => [styles.notificationRow, pressed && styles.pressed]}>
                <View style={styles.bell}><Ionicons color="#FFFFFF" name="notifications" size={22} /></View>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>Bin-night reminders</Text>
                  <Text style={styles.heroText}>{addresses.length ? 'Get an alert before verified collections.' : 'Add an address to schedule reminders.'}</Text>
                </View>
                <Switch
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.passiveSwitch}
                  value={preferences.enabled}
                  thumbColor="#FFFFFF"
                  trackColor={{ false: '#839C9E', true: '#34C759' }}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>REMINDER TIME</Text>
            <View style={styles.timePicker}>
              {times.map((time) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: preferences.reminderHour === time.hour, disabled: busy }}
                  disabled={busy}
                  key={time.hour}
                  onPress={() => updatePreferences({ reminderHour: time.hour })}
                  style={[styles.timeOption, preferences.reminderHour === time.hour && styles.timeOptionActive]}>
                  <Text style={[styles.timeText, preferences.reminderHour === time.hour && styles.timeTextActive]}>{time.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BINS AT THIS PLACE</Text>
            <View style={styles.settingCard}>
              {relevantWasteTypes.length ? relevantWasteTypes.map((type, index) => {
                const meta = collectionMeta[type];
                return (
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityState={{ checked: preferences.wasteTypes[type], disabled: busy }}
                    disabled={busy}
                    key={type}
                    onPress={() => toggleWasteType(type as WasteType)}
                    style={({ pressed }) => [styles.binSetting, index !== relevantWasteTypes.length - 1 && styles.binBorder, pressed && styles.pressed]}>
                    <View style={[styles.typeDot, { backgroundColor: meta.colour }]} />
                    <Text style={styles.binLabel}>{meta.label}</Text>
                    <Switch
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={styles.passiveSwitch}
                      value={preferences.wasteTypes[type]}
                      thumbColor="#FFFFFF"
                      trackColor={{ false: '#B9C8C6', true: '#34C759' }}
                    />
                  </Pressable>
                );
              }) : (
                <View style={styles.inlineEmpty}>
                  <Ionicons color="#627D80" name="information-circle-outline" size={21} />
                  <Text style={styles.inlineEmptyText}>Bin choices will appear after this place returns verified collection dates.</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COLLECTION DATA</Text>
            <View style={styles.settingCard}>
              <ChevronRow
                detail={activeAddress ? sourceStatus : 'Add an address to connect its council'}
                icon="checkmark-circle-outline"
                onPress={() => router.push('/schedule')}
                title="Verified schedule"
              />
              <ChevronRow
                detail="Tell us about a wrong date, bin type or missing collection"
                icon="flag-outline"
                iconBackground="#F8E9E5"
                iconColour="#A74638"
                onPress={reportIncorrectData}
                title="Report incorrect data"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DATA & PRIVACY</Text>
            <View style={styles.settingCard}>
              <View style={styles.privacyRow}>
                <Ionicons color={appColours.brand} name="lock-closed-outline" size={20} />
                <Text style={styles.privacyText}>Saved places and preferences stay on this device. Your postcode and selected council property are sent only when checking live dates. Location is requested only after you tap the location button.</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <View style={styles.settingCard}>
              <View style={styles.aboutRow}><Text style={styles.aboutLabel}>App</Text><Text style={styles.aboutValue}>What Bin Is It Tonight?</Text></View>
              <View style={styles.aboutRow}><Text style={styles.aboutLabel}>Version</Text><Text style={styles.aboutValue}>1.0.0</Text></View>
              <View style={styles.aboutRow}><Text style={styles.aboutLabel}>Platform</Text><Text style={styles.aboutValue}>{Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'Web app'}</Text></View>
            </View>
          </View>
          <Text style={styles.footer}>Built to make collection day simple.</Text>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: appColours.background },
  safe: { backgroundColor: '#FFFFFF', paddingTop: 14, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE6E1' },
  kicker: { color: '#1D7A70', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 1, fontWeight: '700' },
  title: { color: '#14323B', fontFamily: appFonts.display, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1.05, marginTop: 3 },
  content: { padding: 18, paddingBottom: 122, gap: 22 },
  section: { gap: 9 },
  sectionLabel: { color: '#5D797C', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.85, fontWeight: '700', paddingHorizontal: 2 },
  settingCard: { backgroundColor: appColours.card, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, overflow: 'hidden', shadowColor: '#18333A', shadowOpacity: 0.045, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  chevronRow: { minHeight: 68, padding: 14, flexDirection: 'row', gap: 11, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4EBE7' },
  roundIcon: { height: 40, width: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1 },
  infoTitle: { color: '#1D3E43', fontSize: 15, fontWeight: '700' },
  infoText: { color: '#5E777B', fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: '500' },
  notificationRow: { minHeight: 92, backgroundColor: '#092D39', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { height: 44, width: 44, borderRadius: 15, backgroundColor: appColours.brand, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#F1FFF8', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  heroText: { color: '#B4D8CB', fontSize: 12.5, lineHeight: 17, marginTop: 4, fontWeight: '500' },
  timePicker: { flexDirection: 'row', backgroundColor: '#DCE4E0', padding: 3, borderRadius: 13, gap: 2 },
  timeOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  timeOptionActive: { backgroundColor: '#FFFFFF', shadowColor: '#12323A', shadowOpacity: 0.11, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  timeText: { color: '#587376', fontFamily: appFonts.text, fontSize: 14, fontWeight: '600' },
  timeTextActive: { color: appColours.brand, fontWeight: '700' },
  binSetting: { minHeight: 60, paddingHorizontal: 15, alignItems: 'center', flexDirection: 'row', gap: 10 },
  binBorder: { borderBottomColor: '#E5ECE7', borderBottomWidth: StyleSheet.hairlineWidth },
  typeDot: { width: 12, height: 12, borderRadius: 6 },
  binLabel: { flex: 1, color: '#1F4146', fontSize: 14.5, fontWeight: '700' },
  passiveSwitch: { pointerEvents: 'none' },
  inlineEmpty: { minHeight: 72, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineEmptyText: { color: '#587376', fontSize: 13, lineHeight: 18, flex: 1 },
  privacyRow: { padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  privacyText: { color: '#536F73', fontSize: 13, lineHeight: 19, flex: 1 },
  aboutRow: { minHeight: 50, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5ECE7', gap: 14 },
  aboutLabel: { color: '#536D70', fontSize: 13, fontWeight: '600' },
  aboutValue: { color: '#203F44', fontSize: 13, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  footer: { color: '#718587', textAlign: 'center', fontSize: 12.5, marginTop: -4 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
});

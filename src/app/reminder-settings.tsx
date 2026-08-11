import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { residentPaymentsEnabled } from '@/lib/commercial-offer';
import { collectionMeta, wasteTypes } from '@/lib/data';
import { requestNotificationPermission } from '@/lib/notifications';
import { useAppTheme } from '@/lib/theme';
import { PlaceReminderPreferences, WasteType } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useProductState } from '@/lib/use-product-state';
import { useSubscription } from '@/lib/use-subscription';

const times = [18, 19, 20, 21];

function ToggleRow({
  title,
  detail,
  value,
  onChange,
  disabled = false,
  plus = false,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  plus?: boolean;
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
        <View style={styles.titleLine}>
          <Text style={[styles.toggleTitle, { color: theme.text }]}>{title}</Text>
          {plus ? <Text style={[styles.plus, { color: theme.accent, backgroundColor: theme.accentSoft }]}>Plus</Text> : null}
        </View>
        <Text style={[styles.toggleDetail, { color: theme.secondaryText }]}>{detail}</Text>
      </View>
      <Switch
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        trackColor={{ false: theme.tertiaryText, true: theme.accent }}
        value={value}
      />
    </Pressable>
  );
}

export default function ReminderSettingsScreen() {
  const theme = useAppTheme();
  const {
    activeAddress,
    collections,
    preferences,
    updatePreferences,
    toggleWasteType,
  } = useAppData();
  const { reminderPreferencesFor, updatePlaceReminders } = useProductState();
  const subscription = useSubscription();
  const [busy, setBusy] = useState(false);
  const placePreferences = reminderPreferencesFor(activeAddress?.id);
  const presentWasteTypes = new Set(collections.map((collection) => collection.wasteType));
  const relevantWasteTypes = collections.length
    ? wasteTypes.filter((type) => presentWasteTypes.has(type))
    : [];

  function updatePlace(next: Partial<PlaceReminderPreferences>) {
    if (!activeAddress) return;
    updatePlaceReminders(activeAddress.id, next);
  }

  function withPlus(action: () => void) {
    if (!residentPaymentsEnabled() || subscription.isPlus) {
      action();
      return;
    }
    router.push('/plus');
  }

  async function changeNotifications(next: boolean) {
    if (!activeAddress) {
      router.replace('/places');
      return;
    }
    setBusy(true);
    try {
      if (next) {
        const permission = await requestNotificationPermission();
        if (!permission.granted) {
          Alert.alert('Notifications are not ready', permission.reason);
          return;
        }
      }
      updatePlace({ enabled: next });
      updatePreferences({ enabled: next });
    } catch {
      Alert.alert('Could not update reminders', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function changeReminderTime(hour: number, minute = 0) {
    updatePlace({ reminderHour: hour, reminderMinute: minute });
    updatePreferences({ reminderHour: hour, reminderMinute: minute });
  }

  function adjustReminderTime(amountMinutes: number) {
    const current = placePreferences.reminderHour * 60 + placePreferences.reminderMinute;
    const next = (current + amountMinutes + (24 * 60)) % (24 * 60);
    changeReminderTime(Math.floor(next / 60), next % 60);
  }

  function changeWasteType(type: WasteType) {
    updatePlace({
      wasteTypes: {
        ...placePreferences.wasteTypes,
        [type]: !placePreferences.wasteTypes[type],
      },
    });
    if (preferences.wasteTypes[type] === placePreferences.wasteTypes[type]) toggleWasteType(type);
  }

  return (
    <AppShell activeRoute="/reminder-settings" hideNavigation>
      <RouteHead title="Reminder settings" description="Choose collection reminder timing and follow-up alerts for this place." path="/reminder-settings" />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Back to Settings" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons color={theme.accent} name="chevron-back" size={25} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Reminder settings</Text>
          <View style={styles.headerButton} />
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Text style={[styles.title, { color: theme.text }]}>{activeAddress?.label ?? 'Your place'}</Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Only verified collection dates create reminders. Every place can have its own schedule.</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Main reminder</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <ToggleRow
                detail={activeAddress ? 'Alert before verified collections at this place.' : 'Add an address first.'}
                disabled={busy || !activeAddress}
                onChange={(value) => void changeNotifications(value)}
                title="Bin-night reminder"
                value={activeAddress ? placePreferences.enabled : false}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Timing</Text>
            <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: theme.groupedBackground }]}>
              {([[1, 'Day before'], [0, 'Collection day']] as const).map(([value, label]) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: placePreferences.reminderDayOffset === value, disabled: !placePreferences.enabled }}
                  disabled={!placePreferences.enabled}
                  key={value}
                  onPress={() => updatePlace({ reminderDayOffset: value })}
                  style={[styles.segmentOption, placePreferences.reminderDayOffset === value && { backgroundColor: theme.surface }]}>
                  <Text style={[styles.segmentText, { color: placePreferences.reminderDayOffset === value ? theme.accent : theme.secondaryText }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: theme.groupedBackground }]}>
              {times.map((hour) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: placePreferences.reminderHour === hour && placePreferences.reminderMinute === 0, disabled: !placePreferences.enabled }}
                  disabled={!placePreferences.enabled}
                  key={hour}
                  onPress={() => changeReminderTime(hour)}
                  style={[styles.segmentOption, placePreferences.reminderHour === hour && placePreferences.reminderMinute === 0 && { backgroundColor: theme.surface }]}>
                  <Text style={[styles.segmentText, { color: placePreferences.reminderHour === hour && placePreferences.reminderMinute === 0 ? theme.accent : theme.secondaryText }]}>{hour}:00</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.timeStepper, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <Pressable accessibilityLabel="Set reminder 15 minutes earlier" accessibilityRole="button" disabled={!placePreferences.enabled} onPress={() => adjustReminderTime(-15)} style={styles.timeButton}>
                <Ionicons color={theme.accent} name="remove" size={21} />
              </Pressable>
              <View style={styles.timeCopy}>
                <Text style={[styles.timeTitle, { color: theme.text }]}>Custom time</Text>
                <Text style={[styles.timeValue, { color: theme.secondaryText }]}>{String(placePreferences.reminderHour).padStart(2, '0')}:{String(placePreferences.reminderMinute).padStart(2, '0')}</Text>
              </View>
              <Pressable accessibilityLabel="Set reminder 15 minutes later" accessibilityRole="button" disabled={!placePreferences.enabled} onPress={() => adjustReminderTime(15)} style={styles.timeButton}>
                <Ionicons color={theme.accent} name="add" size={21} />
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Follow-ups and changes</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <ToggleRow detail={`Optional ${placePreferences.morningHour}:00 prompt on collection morning.`} disabled={!placePreferences.enabled} onChange={(morningReminder) => withPlus(() => updatePlace({ morningReminder }))} plus title="Morning reminder" value={placePreferences.morningReminder} />
              <ToggleRow detail={`A second prompt at ${placePreferences.secondReminderHour}:00 if the bin is not marked out.`} disabled={!placePreferences.enabled} onChange={(secondReminder) => withPlus(() => updatePlace({ secondReminder }))} plus title="Second reminder" value={placePreferences.secondReminder} />
              <ToggleRow detail="Ask whether the collection was completed after the collection window." disabled={!placePreferences.enabled} onChange={(collectionFollowUp) => withPlus(() => updatePlace({ collectionFollowUp }))} plus title="Collection follow-up" value={placePreferences.collectionFollowUp} />
              <ToggleRow detail="Notify when a newly verified date differs from the saved schedule." disabled={!placePreferences.enabled} onChange={(collectionChangeAlerts) => updatePlace({ collectionChangeAlerts })} title="Date-change alerts" value={placePreferences.collectionChangeAlerts} />
              <ToggleRow detail="Notify only when a verified council service alert is available." disabled={!placePreferences.enabled} onChange={(disruptionAlerts) => updatePlace({ disruptionAlerts })} title="Disruption alerts" value={placePreferences.disruptionAlerts} />
              <ToggleRow detail="Follow up when a council recollection date is recorded." disabled={!placePreferences.enabled} onChange={(recollectionAlerts) => updatePlace({ recollectionAlerts })} title="Recollection alerts" value={placePreferences.recollectionAlerts} />
            </View>
          </View>

          {relevantWasteTypes.length ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Bin types</Text>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
                {relevantWasteTypes.map((type) => (
                  <Pressable accessibilityRole="switch" accessibilityState={{ checked: placePreferences.wasteTypes[type] }} key={type} onPress={() => changeWasteType(type)} style={[styles.binRow, { borderBottomColor: theme.separator }]}>
                    <View style={[styles.dot, { backgroundColor: collectionMeta[type].colour }]} />
                    <Text style={[styles.binLabel, { color: theme.text }]}>{collectionMeta[type].label}</Text>
                    <Switch accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" trackColor={{ false: theme.tertiaryText, true: theme.accent }} value={placePreferences.wasteTypes[type]} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 44, gap: 24 },
  intro: { gap: 5 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  section: { gap: 9 },
  sectionLabel: { fontSize: 13, fontWeight: '600', paddingHorizontal: 3 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, overflow: 'hidden' },
  toggleRow: { minHeight: 66, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  toggleTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '600' },
  toggleDetail: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  plus: { fontSize: 11, lineHeight: 17, fontWeight: '700', borderRadius: 8, paddingHorizontal: 6 },
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
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
});

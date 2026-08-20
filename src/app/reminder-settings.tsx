import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { InlineNotice } from '@/components/resident-layout';
import { RouteHead } from '@/components/route-head';
import { ToggleIndicator } from '@/components/toggle-indicator';
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
      aria-checked={value}
      aria-disabled={disabled}
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
      <ToggleIndicator value={value} />
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
  const [feedback, setFeedback] = useState<string>();
  const [feedbackError, setFeedbackError] = useState(false);
  const placePreferences = reminderPreferencesFor(activeAddress?.id);
  const [timeDraft, setTimeDraft] = useState<string>();
  const presentWasteTypes = new Set(collections.map((collection) => collection.wasteType));
  const relevantWasteTypes = collections.length
    ? wasteTypes.filter((type) => presentWasteTypes.has(type))
    : [];

  const timeInput = timeDraft
    ?? `${String(placePreferences.reminderHour).padStart(2, '0')}:${String(placePreferences.reminderMinute).padStart(2, '0')}`;

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
    setFeedback(undefined);
    try {
      if (next) {
        const permission = await requestNotificationPermission();
        if (!permission.granted) {
          setFeedback(permission.reason);
          setFeedbackError(true);
          return;
        }
      }
      updatePlace({ enabled: next });
      updatePreferences({ enabled: next });
      setFeedback(next ? 'Bin-night reminders are on for this place.' : 'Bin-night reminders are off for this place.');
      setFeedbackError(false);
    } catch {
      setFeedback('Reminders could not be updated. Please try again.');
      setFeedbackError(true);
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

  function commitTimeInput() {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeInput.trim());
    if (!match) {
      setFeedback('Enter a 24-hour time as HH:MM, for example 19:30.');
      setFeedbackError(true);
      return;
    }
    changeReminderTime(Number(match[1]), Number(match[2]));
    setTimeDraft(undefined);
    setFeedback(`Reminder time saved as ${match[1]}:${match[2]}.`);
    setFeedbackError(false);
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
      <RouteHead title="Reminder settings" description="Choose collection reminder timing and follow-up alerts for this place." path="/reminder-settings" private />
      <View style={[styles.page, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.separator }]}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
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

          {feedback ? <InlineNotice title={feedback} tone={feedbackError ? 'danger' : 'success'} /> : null}

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
                  aria-checked={placePreferences.reminderDayOffset === value}
                  aria-disabled={!placePreferences.enabled}
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
                  aria-checked={placePreferences.reminderHour === hour && placePreferences.reminderMinute === 0}
                  aria-disabled={!placePreferences.enabled}
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
            <View style={[styles.directTime, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <View style={styles.rowCopy}>
                <Text style={[styles.timeTitle, { color: theme.text }]}>Enter a time</Text>
                <Text style={[styles.toggleDetail, { color: theme.secondaryText }]}>24-hour format, HH:MM</Text>
              </View>
              <TextInput
                accessibilityLabel="Reminder time in 24-hour format"
                editable={placePreferences.enabled}
                inputMode="numeric"
                maxLength={5}
                onBlur={commitTimeInput}
                onChangeText={setTimeDraft}
                onSubmitEditing={commitTimeInput}
                style={[styles.timeInput, { borderColor: theme.separator, color: theme.text }]}
                value={timeInput}
              />
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
                  <Pressable aria-checked={placePreferences.wasteTypes[type]} accessibilityRole="switch" accessibilityState={{ checked: placePreferences.wasteTypes[type] }} key={type} onPress={() => changeWasteType(type)} style={[styles.binRow, { borderBottomColor: theme.separator }]}>
                    <View style={[styles.dot, { backgroundColor: collectionMeta[type].colour }]} />
                    <Text style={[styles.binLabel, { color: theme.text }]}>{collectionMeta[type].label}</Text>
                    <ToggleIndicator value={placePreferences.wasteTypes[type]} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Next scheduled reminders</Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              {collections
                .filter((collection) => placePreferences.wasteTypes[collection.wasteType])
                .slice(0, 3)
                .map((collection, index) => (
                  <View key={collection.id} style={[styles.previewRow, index < 2 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                    <Ionicons color={theme.accent} name="notifications-outline" size={19} />
                    <View style={styles.rowCopy}>
                      <Text style={[styles.toggleTitle, { color: theme.text }]}>{collectionMeta[collection.wasteType].label}</Text>
                      <Text style={[styles.toggleDetail, { color: theme.secondaryText }]}>{collection.date} · {timeInput} · {placePreferences.reminderDayOffset ? 'day before' : 'collection day'}</Text>
                    </View>
                  </View>
                ))}
              {!collections.length ? <Text style={[styles.previewEmpty, { color: theme.secondaryText }]}>No verified collections are available to preview yet.</Text> : null}
            </View>
            <Text style={[styles.timezone, { color: theme.secondaryText }]}>Times use {Intl.DateTimeFormat().resolvedOptions().timeZone || 'your device time zone'} and follow daylight-saving changes. Collection reminders are scheduled locally; council service alerts arrive separately when supported.</Text>
            <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={[styles.settingsLink, { backgroundColor: theme.accentSoft }]}>
              <Ionicons color={theme.accent} name="settings-outline" size={19} /><Text style={[styles.settingsLinkText, { color: theme.accent }]}>Open device notification settings</Text>
            </Pressable>
          </View>
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
  directTime: { minHeight: 70, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeInput: { width: 90, minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, textAlign: 'center', fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '700' },
  binRow: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5 },
  binLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  previewRow: { minHeight: 64, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewEmpty: { padding: 14, fontSize: 13, lineHeight: 19 },
  timezone: { fontSize: 12.5, lineHeight: 18 },
  settingsLink: { minHeight: 48, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  settingsLinkText: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.45 },
});

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { WasteIcon } from '@/components/bin-glyph';
import { RouteHead } from '@/components/route-head';
import { collectionDisplayMeta, collectionMeta, dayDifference, formatCollectionDate, sortCollections, wasteTypes } from '@/lib/data';
import { appFonts } from '@/lib/design-system';
import { AppTheme, useAppTheme } from '@/lib/theme';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import {
  downloadCollectionCalendar,
  collectionReminderMessage,
  collectionSubscriptionUrl,
  shareCollectionSchedule,
} from '@/lib/schedule-tools';
import { WasteType } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useOnlineStatus } from '@/lib/use-online-status';
import { useProductState } from '@/lib/use-product-state';
import { useWeeklyBinPalette } from '@/lib/use-weekly-bin-palette';

export default function ScheduleScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const {
    collections,
    activeAddress,
    sourceStatus,
    collectionDataState,
    lastError,
    changeNotice,
    refreshing,
    refreshCollections,
  } = useAppData();
  const { outcomeFor } = useProductState();
  const [calendarWasteTypes, setCalendarWasteTypes] = useState<WasteType[]>([...wasteTypes]);
  const online = useOnlineStatus();
  const upcoming = sortCollections(collections).filter((collection) => dayDifference(collection.date) >= 0);
  const weeklyBin = useWeeklyBinPalette(collections);
  const grouped = upcoming.reduce<Record<string, typeof collections>>((result, collection) => {
    result[collection.date] = [...(result[collection.date] ?? []), collection];
    return result;
  }, {});
  const exactAddressRequired = activeAddress
    ? requiresExactCouncilAddress(activeAddress.providerId, activeAddress.councilAddressId)
    : false;

  async function shareSchedule() {
    if (!activeAddress || !upcoming.length) return;
    await shareCollectionSchedule(upcoming, activeAddress);
  }

  function exportCalendar() {
    if (!activeAddress || !upcoming.length) return;
    const selected = upcoming.filter((collection) => calendarWasteTypes.includes(collection.wasteType));
    const url = downloadCollectionCalendar(selected, activeAddress);
    if (url) void Linking.openURL(url);
  }

  function exportOneCollection(collection: typeof upcoming[number]) {
    if (!activeAddress) return;
    const url = downloadCollectionCalendar([collection], activeAddress);
    if (url) void Linking.openURL(url);
  }

  async function copySubscription() {
    if (!activeAddress) return;
    await Clipboard.setStringAsync(collectionSubscriptionUrl(activeAddress, calendarWasteTypes));
    Alert.alert('Live calendar link copied', 'Paste it into a calendar app that supports subscribed calendars. It checks the council source when refreshed.');
  }

  async function copyNextReminder() {
    if (!activeAddress || !upcoming.length) return;
    await Clipboard.setStringAsync(collectionReminderMessage(upcoming, activeAddress));
    Alert.alert('Reminder copied', 'The next collection message is ready to paste into a household chat.');
  }

  function toggleCalendarWasteType(type: WasteType) {
    setCalendarWasteTypes((current) => (
      current.includes(type)
        ? current.length === 1 ? current : current.filter((item) => item !== type)
        : [...current, type]
    ));
  }

  const statusText = !online
    ? upcoming.length
      ? 'Offline · showing your saved council dates'
      : 'You’re offline · reconnect to check your council'
    : collectionDataState === 'cached'
      ? `Showing saved dates · ${lastError ?? 'the latest check did not complete'}`
      : collectionDataState === 'error'
        ? `Couldn’t verify · ${lastError ?? 'try again in a moment'}`
        : sourceStatus;

  return (
    <AppShell activeRoute="/schedule">
      <RouteHead
        title="Collection Schedule"
        description="View upcoming verified bin collections for your saved UK address."
        path="/schedule"
      />
      <View style={styles.page}>
        <SafeAreaView
          edges={['top']}
          style={[
            styles.safe,
            {
              backgroundColor: weeklyBin.background,
              borderBottomColor: weeklyBin.accent ? weeklyBin.background : theme.separator,
            },
          ]}>
          <Text style={[styles.kicker, { color: weeklyBin.foreground }]}>Schedule</Text>
          <Text style={[styles.title, { color: weeklyBin.foreground }]}>Upcoming collections</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/places')}
            style={({ pressed }) => [
              styles.addressPill,
              { backgroundColor: weeklyBin.control },
              pressed && styles.pressed,
            ]}>
            <Ionicons color={weeklyBin.accent ? weeklyBin.foreground : theme.accent} name="location" size={16} />
            <Text numberOfLines={1} style={[styles.address, { color: weeklyBin.accent ? weeklyBin.foreground : theme.accent }]}>
              {activeAddress ? `${activeAddress.label} · ${activeAddress.postcode}` : 'Add an address'}
            </Text>
            <Ionicons color={weeklyBin.accent ? weeklyBin.foreground : theme.accent} name="chevron-down" size={14} />
          </Pressable>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {!activeAddress ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons color={theme.accent} name="location-outline" size={30} /></View>
              <Text style={styles.emptyTitle}>Add your address first</Text>
              <Text style={styles.emptyCopy}>Your postcode connects this schedule to the correct council and property.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/places')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Add an address</Text>
                <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
              </Pressable>
            </View>
          ) : exactAddressRequired ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons color={theme.accent} name="home-outline" size={30} /></View>
              <Text style={styles.emptyTitle}>Choose your exact property</Text>
              <Text style={styles.emptyCopy}>This council needs a property match before it can return the correct collection round.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/places')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Choose property</Text>
                <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={[styles.statusLine, (!online || collectionDataState === 'cached' || collectionDataState === 'error') && styles.statusLineWarning]}>
                {refreshing
                  ? <ActivityIndicator color={theme.accent} />
                  : <Ionicons color={!online || collectionDataState === 'cached' || collectionDataState === 'error' ? theme.warning : theme.accent} name={!online ? 'cloud-offline-outline' : 'checkmark-circle-outline'} size={21} />}
                <Text accessibilityLiveRegion="polite" style={styles.statusText}>{refreshing ? 'Checking the live council source…' : statusText}</Text>
              </View>

              {changeNotice ? (
                <View accessibilityLiveRegion="polite" style={styles.changeNotice}>
                  <Ionicons color={theme.warning} name="alert-circle-outline" size={22} />
                  <View style={styles.changeCopy}>
                    <Text style={styles.changeTitle}>Collection date changed</Text>
                    <Text style={styles.changeBody}>{changeNotice.replace(/^Collection date changed · /, '')}</Text>
                  </View>
                </View>
              ) : null}

              {Object.entries(grouped).map(([date, dayCollections]) => {
                const diff = dayDifference(date);
                return (
                  <View key={date} style={styles.dateSection}>
                    <View style={styles.dateHeader}>
                      <View>
                    <Text style={styles.dateLabel}>{diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : formatCollectionDate(date, 'day')}</Text>
                        <Text style={styles.dateLong}>{formatCollectionDate(date, 'weekday')}</Text>
                      </View>
                      <View style={[styles.dayStamp, diff === 0 && styles.dayStampToday]}>
                        <Text style={[styles.dayStampText, diff === 0 && styles.dayStampTextToday]}>{formatCollectionDate(date, 'dateNumber')}</Text>
                      </View>
                    </View>
                    <View style={styles.collectionsCard}>
                      {dayCollections.map((collection, index) => {
                        const meta = collectionDisplayMeta(collection);
                        const outcome = outcomeFor(activeAddress.id, collection);
                        return (
                          <View key={collection.id} style={[styles.collectionRow, index !== dayCollections.length - 1 && styles.collectionBorder]}>
                            <View style={[styles.iconCircle, { backgroundColor: meta.tint }]}><WasteIcon colour={meta.colour} type={collection.wasteType} /></View>
                            <View style={styles.rowCopy}>
                              <Text style={styles.rowTitle}>{meta.label}</Text>
                              <Text style={styles.rowInfo}>
                                {outcome?.status === 'collected'
                                  ? 'Confirmed collected'
                                  : outcome?.status === 'missed'
                                    ? 'Marked as missed'
                                    : outcome?.status === 'put-out'
                                      ? 'Marked as put out'
                                      : diff === 0
                                        ? 'Collection day'
                                        : diff === 1
                                          ? 'Put it out tonight'
                                          : 'Put it out the night before'}
                              </Text>
                            </View>
                            <View style={[styles.statusDot, { backgroundColor: meta.colour }]} />
                            <Pressable
                              accessibilityLabel={`Add ${meta.label} on ${formatCollectionDate(collection.date, 'weekday')} to calendar`}
                              accessibilityRole="button"
                              onPress={() => exportOneCollection(collection)}
                              style={styles.rowCalendar}>
                              <Ionicons color={theme.accent} name="calendar-outline" size={19} />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              {!upcoming.length ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}><Ionicons color={theme.accent} name="calendar-clear-outline" size={30} /></View>
                  <Text style={styles.emptyTitle}>{collectionDataState === 'error' ? 'Council check unavailable' : 'No verified dates yet'}</Text>
                  <Text style={styles.emptyCopy}>{online ? 'Keep this address saved and try the live council check again.' : 'Reconnect to check for collection dates.'}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: refreshing || !online }}
                    disabled={refreshing || !online}
                    onPress={() => void refreshCollections()}
                    style={({ pressed }) => [styles.primaryButton, (!online || refreshing) && styles.disabled, pressed && styles.pressed]}>
                    {refreshing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Check again</Text>}
                  </Pressable>
                </View>
              ) : (
                <>
                <View style={styles.calendarOptions}>
                  <Text style={styles.calendarTitle}>Calendar bin types</Text>
                  <ScrollView
                    contentContainerStyle={styles.calendarTypes}
                    horizontal
                    showsHorizontalScrollIndicator={false}>
                    {wasteTypes
                      .filter((type) => upcoming.some((collection) => collection.wasteType === type))
                      .map((type) => {
                        const selected = calendarWasteTypes.includes(type);
                        return (
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            key={type}
                            onPress={() => toggleCalendarWasteType(type)}
                            style={[styles.calendarType, selected && styles.calendarTypeSelected]}>
                            <View style={[styles.statusDot, { backgroundColor: collectionMeta[type].colour }]} />
                            <Text style={[styles.calendarTypeText, selected && styles.calendarTypeTextSelected]}>
                              {collectionMeta[type].label}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </ScrollView>
                </View>
                <View style={styles.actionsCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: refreshing || !online }}
                    disabled={refreshing || !online}
                    onPress={() => void refreshCollections()}
                    style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
                    <Ionicons color={theme.accent} name="refresh" size={21} />
                    <Text style={styles.actionText}>{refreshing ? 'Refreshing…' : 'Refresh council dates'}</Text>
                    <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={shareSchedule} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
                    <Ionicons color={theme.accent} name="share-outline" size={21} />
                    <Text style={styles.actionText}>Share this schedule</Text>
                    <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void copyNextReminder()} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
                    <Ionicons color={theme.accent} name="copy-outline" size={21} />
                    <Text style={styles.actionText}>Copy next collection reminder</Text>
                    <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={exportCalendar} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
                    <Ionicons color={theme.accent} name="calendar-outline" size={21} />
                    <Text style={styles.actionText}>Add to calendar (.ics)</Text>
                    <Ionicons color={theme.tertiaryText} name="download-outline" size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void copySubscription()} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
                    <Ionicons color={theme.accent} name="link-outline" size={21} />
                    <Text style={styles.actionText}>Copy live calendar link</Text>
                    <Ionicons color={theme.tertiaryText} name="copy-outline" size={18} />
                  </Pressable>
                </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </AppShell>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  safe: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  kicker: { fontFamily: appFonts.text, fontSize: 13, fontWeight: '700' },
  title: { color: theme.text, fontFamily: appFonts.display, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1.05, marginTop: 3 },
  addressPill: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', maxWidth: '100%', gap: 6, backgroundColor: theme.accentSoft, borderRadius: 15, paddingHorizontal: 11, marginTop: 12 },
  address: { color: theme.accent, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  content: { padding: 18, paddingBottom: 122, gap: 24 },
  statusLine: { borderRadius: 16, padding: 14, backgroundColor: theme.accentSoft, flexDirection: 'row', gap: 10, alignItems: 'center' },
  statusLineWarning: { backgroundColor: `${theme.warning}14` },
  statusText: { flex: 1, color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  changeNotice: { borderRadius: 14, padding: 14, backgroundColor: `${theme.warning}14`, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: `${theme.warning}45` },
  changeCopy: { flex: 1 },
  changeTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
  changeBody: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 3, fontWeight: '600' },
  dateSection: { gap: 10 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  dateLabel: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.1, fontWeight: '700' },
  dateLong: { color: theme.text, fontFamily: appFonts.display, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.45, marginTop: 2 },
  dayStamp: { height: 44, width: 44, borderRadius: 14, backgroundColor: theme.groupedBackground, alignItems: 'center', justifyContent: 'center' },
  dayStampToday: { backgroundColor: theme.accent },
  dayStampText: { color: theme.text, fontFamily: appFonts.rounded, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dayStampTextToday: { color: '#FFFFFF' },
  collectionsCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, overflow: 'hidden' },
  collectionRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 12 },
  collectionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  iconCircle: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { color: theme.text, fontSize: 15, fontWeight: '800' },
  rowInfo: { color: theme.secondaryText, fontSize: 12.5, marginTop: 3, fontWeight: '600' },
  statusDot: { height: 8, width: 8, borderRadius: 4 },
  rowCalendar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -9 },
  emptyState: { borderRadius: 16, padding: 22, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, alignItems: 'center' },
  emptyIcon: { height: 54, width: 54, borderRadius: 18, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 13 },
  emptyCopy: { color: theme.secondaryText, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  primaryButton: { minHeight: 52, alignSelf: 'stretch', borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  calendarOptions: { gap: 9 },
  calendarTitle: { color: theme.secondaryText, fontSize: 13, fontWeight: '600', paddingHorizontal: 3 },
  calendarTypes: { flexDirection: 'row', gap: 8, paddingRight: 3 },
  calendarType: { minHeight: 44, borderRadius: 12, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface },
  calendarTypeSelected: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  calendarTypeText: { color: theme.secondaryText, fontSize: 12.5, fontWeight: '600' },
  calendarTypeTextSelected: { color: theme.accent, fontWeight: '700' },
  actionsCard: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, overflow: 'hidden' },
  actionRow: { minHeight: 56, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  actionText: { flex: 1, color: theme.text, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  });
}

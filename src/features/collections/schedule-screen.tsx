import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { WasteIcon } from '@/components/bin-glyph';
import { CouncilNotices } from '@/components/council-notices';
import { InlineNotice, ResidentEmptyState, ResidentScreenHeader } from '@/components/resident-layout';
import { RouteHead } from '@/components/route-head';
import {
  type ScheduleItem,
  type ScheduleSection,
  scheduleDateKey,
  scheduleMonthCells,
  scheduleMonthLabel,
  scheduleWeekDays,
} from '@/features/collections/schedule-model';
import { createScheduleStyles } from '@/features/collections/schedule-styles';
import {
  collectionDisplayMeta,
  collectionMeta,
  dayDifference,
  formatCollectionDate,
  sortCollections,
  wasteTypes,
} from '@/lib/data';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import {
  collectionReminderMessage,
  collectionSubscriptionUrl,
  downloadCollectionCalendar,
  shareCollectionSchedule,
} from '@/lib/schedule-tools';
import { useAppTheme } from '@/lib/theme';
import { type Collection, type SavedAddress, type WasteType } from '@/lib/types';
import { useAdaptiveLayout } from '@/lib/use-adaptive-layout';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';
import { useOnlineStatus } from '@/lib/use-online-status';
import { useProductState } from '@/lib/use-product-state';

export function ScheduleScreen() {
  const theme = useAppTheme();
  const adaptive = useAdaptiveLayout();
  const styles = createScheduleStyles(theme, adaptive.mode !== 'compact');
  const {
    activeAddress,
    addresses,
    changeNotice,
    collectionDataState,
    collections,
    lastError,
    refreshing,
    refreshCollections,
    schedulesByAddressId,
    sourceStatus,
  } = useAppData();
  const { outcomeFor } = useProductState();
  const online = useOnlineStatus();
  const councilProfile = useCouncilProfile(activeAddress?.providerId);
  const [calendarWasteTypes, setCalendarWasteTypes] = useState<WasteType[]>([...wasteTypes]);
  const [viewMode, setViewMode] = useState<'place' | 'all'>('place');
  const [selectedDateValue, setSelectedDateValue] = useState<string>();
  const [showCalendarTools, setShowCalendarTools] = useState(false);
  const [calendarFeedback, setCalendarFeedback] = useState<string>();

  const upcoming = sortCollections(collections).filter((collection) => dayDifference(collection.date) >= 0);
  const activeItems: ScheduleItem[] = upcoming.map((collection) => ({ collection, address: activeAddress }));
  const allItems: ScheduleItem[] = addresses.flatMap((address) => (
    sortCollections(schedulesByAddressId[address.id]?.collections ?? [])
      .filter((collection) => dayDifference(collection.date) >= 0)
      .map((collection) => ({ collection, address }))
  )).sort((left, right) => left.collection.date.localeCompare(right.collection.date));
  const availableItems = viewMode === 'all' ? allItems : activeItems;
  const cycleDates = [...new Set(availableItems.map(({ collection }) => collection.date))].slice(0, 4);
  const cycleItems = availableItems.filter(({ collection }) => cycleDates.includes(collection.date));
  const sections: ScheduleSection[] = cycleDates.map((date) => ({
    title: date,
    data: cycleItems.filter(({ collection }) => collection.date === date),
  }));
  const selectedDate = selectedDateValue && availableItems.some(({ collection }) => collection.date === selectedDateValue)
    ? selectedDateValue
    : availableItems[0]?.collection.date;
  const selectedItems = availableItems.filter(({ collection }) => collection.date === selectedDate);
  const cells = scheduleMonthCells(selectedDate ?? scheduleDateKey(new Date()));
  const datesWithCollections = new Set(availableItems.map(({ collection }) => collection.date));
  const exactAddressRequired = activeAddress
    ? requiresExactCouncilAddress(activeAddress.providerId, activeAddress.councilAddressId)
    : false;

  const statusText = !online
    ? upcoming.length
      ? 'Offline · showing your saved council dates'
      : 'You’re offline · reconnect to check your council'
    : collectionDataState === 'cached'
      ? `Showing saved dates · ${lastError ?? 'the latest check did not complete'}`
      : collectionDataState === 'error'
        ? `Couldn’t verify · ${lastError ?? 'try again in a moment'}`
        : sourceStatus;

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

  function exportOneCollection(collection: Collection, address?: SavedAddress) {
    const place = address ?? activeAddress;
    if (!place) return;
    const url = downloadCollectionCalendar([collection], place);
    if (url) void Linking.openURL(url);
  }

  async function copySubscription() {
    if (!activeAddress) return;
    await Clipboard.setStringAsync(collectionSubscriptionUrl(activeAddress, calendarWasteTypes));
    setCalendarFeedback('Live calendar link copied. Paste it into a calendar app that supports subscriptions.');
  }

  async function copyNextReminder() {
    if (!activeAddress || !upcoming.length) return;
    await Clipboard.setStringAsync(collectionReminderMessage(upcoming, activeAddress));
    setCalendarFeedback('The next collection reminder was copied for your household chat.');
  }

  function toggleCalendarWasteType(type: WasteType) {
    setCalendarWasteTypes((current) => (
      current.includes(type)
        ? current.length === 1 ? current : current.filter((item) => item !== type)
        : [...current, type]
    ));
  }

  function collectionStatus(item: ScheduleItem) {
    const outcome = outcomeFor(item.address?.id ?? activeAddress?.id, item.collection);
    const diff = dayDifference(item.collection.date);
    if (outcome?.status === 'collected') return 'Confirmed collected';
    if (outcome?.status === 'missed') return 'Marked as missed';
    if (outcome?.status === 'put-out') return 'Marked as put out';
    if (diff === 0) return 'Collection day';
    if (diff === 1) return 'Put it out tonight';
    return 'Put it out the night before';
  }

  function renderCollectionRow(item: ScheduleItem, last = false) {
    const meta = collectionDisplayMeta(item.collection);
    return (
      <View
        key={`${item.address?.id ?? activeAddress?.id}-${item.collection.id}`}
        style={[styles.collectionRow, !last && styles.collectionBorder]}>
        <View style={[styles.iconCircle, { backgroundColor: meta.tint }]}>
          <WasteIcon colour={meta.colour} type={item.collection.wasteType} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{meta.label}</Text>
          {viewMode === 'all' && item.address ? <Text style={styles.placeLabel}>{item.address.label}</Text> : null}
          <Text style={styles.rowInfo}>{collectionStatus(item)}</Text>
        </View>
        <View accessibilityElementsHidden style={[styles.statusDot, { backgroundColor: meta.colour }]} />
        <Pressable
          accessibilityLabel={`Add ${meta.label} on ${formatCollectionDate(item.collection.date, 'weekday')} to calendar`}
          accessibilityRole="button"
          onPress={() => exportOneCollection(item.collection, item.address)}
          style={styles.rowCalendar}>
          <Ionicons color={theme.accent} name="calendar-outline" size={19} />
        </Pressable>
      </View>
    );
  }

  const placePicker = addresses.length > 1 ? (
    <View accessibilityLabel="Schedule place filter" accessibilityRole="tablist" style={styles.viewPicker}>
      {([['place', 'This place'], ['all', 'All places']] as const).map(([value, label]) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: viewMode === value }}
          key={value}
          onPress={() => setViewMode(value)}
          style={[styles.viewOption, viewMode === value && styles.viewOptionSelected]}>
          <Text style={[styles.viewOptionText, viewMode === value && styles.viewOptionTextSelected]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  ) : null;

  const sourceStatusView = (
    <View style={styles.statusStack}>
      <View style={[styles.statusLine, (!online || collectionDataState === 'cached' || collectionDataState === 'error') && styles.statusLineWarning]}>
        {refreshing
          ? <ActivityIndicator color={theme.accent} />
          : <Ionicons color={!online || collectionDataState === 'cached' || collectionDataState === 'error' ? theme.warning : theme.accent} name={!online ? 'cloud-offline-outline' : 'checkmark-circle-outline'} size={21} />}
        <Text accessibilityLiveRegion="polite" style={styles.statusText}>{refreshing ? 'Checking the live council source…' : statusText}</Text>
      </View>
      {changeNotice ? (
        <InlineNotice
          body={`${changeNotice.replace(/^Collection date changed · /, '')} Your reminders use the latest verified schedule.`}
          title="Collection date changed"
          tone="warning"
        />
      ) : null}
      {calendarFeedback ? <InlineNotice title={calendarFeedback} tone="success" /> : null}
    </View>
  );

  const calendarTypeFilters = (
    <View style={styles.calendarOptions}>
      <Text style={styles.calendarTitle}>Calendar bin types</Text>
      <View style={styles.calendarTypes}>
        {wasteTypes
          .filter((type) => cycleItems.some(({ collection }) => collection.wasteType === type))
          .map((type) => {
            const selected = calendarWasteTypes.includes(type);
            return (
              <Pressable
                aria-checked={selected}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={type}
                onPress={() => toggleCalendarWasteType(type)}
                style={[styles.calendarType, selected && styles.calendarTypeSelected]}>
                <View style={[styles.statusDot, { backgroundColor: collectionMeta[type].colour }]} />
                <Text style={[styles.calendarTypeText, selected && styles.calendarTypeTextSelected]}>{collectionMeta[type].label}</Text>
              </Pressable>
            );
          })}
      </View>
    </View>
  );

  const calendarActions = (
    <View style={styles.actionsCard}>
      <Pressable accessibilityRole="button" onPress={() => void shareSchedule()} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
        <Ionicons color={theme.accent} name="share-outline" size={21} /><Text style={styles.actionText}>Share this schedule</Text><Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void copyNextReminder()} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
        <Ionicons color={theme.accent} name="copy-outline" size={21} /><Text style={styles.actionText}>Copy next reminder</Text><Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={exportCalendar} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
        <Ionicons color={theme.accent} name="calendar-outline" size={21} /><Text style={styles.actionText}>Add to calendar (.ics)</Text><Ionicons color={theme.tertiaryText} name="download-outline" size={18} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void copySubscription()} style={({ pressed }) => [styles.actionRow, styles.actionRowLast, pressed && styles.pressed]}>
        <Ionicons color={theme.accent} name="link-outline" size={21} /><Text style={styles.actionText}>Copy live calendar link</Text><Ionicons color={theme.tertiaryText} name="copy-outline" size={18} />
      </Pressable>
    </View>
  );

  const compactHeader = (
    <View style={styles.listHeader}>
      <CouncilNotices placement="schedule" profile={councilProfile} />
      {placePicker}
      {sourceStatusView}
    </View>
  );

  const compactFooter = cycleItems.length ? (
    <View style={styles.listFooter}>
      {calendarTypeFilters}
      <Text style={styles.cycleFootnote}>Showing the next four collection dates{viewMode === 'all' ? ' across your saved places' : ''}.</Text>
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
        <Pressable accessibilityRole="button" onPress={() => setShowCalendarTools(true)} style={({ pressed }) => [styles.actionRow, styles.actionRowLast, pressed && styles.pressed]}>
          <Ionicons color={theme.accent} name="calendar-outline" size={21} /><Text style={styles.actionText}>Calendar and sharing</Text><Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <AppShell activeRoute="/schedule">
      <RouteHead title="Collection Schedule" description="View upcoming verified bin collections for your saved UK address." path="/schedule" private />
      <View style={styles.page}>
        <ResidentScreenHeader
          action={(
            <Pressable accessibilityLabel="Manage places" accessibilityRole="button" onPress={() => router.push('/places')} style={styles.headerButton}>
              <Ionicons color={theme.accent} name="location-outline" size={22} />
            </Pressable>
          )}
          kicker="Schedule"
          subtitle={activeAddress ? `${activeAddress.label} · ${activeAddress.postcode}` : 'Add a place to see verified council dates.'}
          title={adaptive.mode === 'compact' ? 'Next four collections' : 'Collection calendar'}
        />

        {!activeAddress || exactAddressRequired ? (
          <ScrollView contentContainerStyle={styles.emptyContent}>
            <ResidentEmptyState
              action={(
                <Pressable accessibilityRole="button" onPress={() => router.push('/places')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>{activeAddress ? 'Choose property' : 'Add an address'}</Text>
                  <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
                </Pressable>
              )}
              body={activeAddress ? 'This council needs a property match before it can return the correct collection round.' : 'Your postcode connects this schedule to the correct council and property.'}
              icon={activeAddress ? 'home-outline' : 'location-outline'}
              title={activeAddress ? 'Choose your exact property' : 'Add your address first'}
            />
          </ScrollView>
        ) : adaptive.mode === 'compact' ? (
          <SectionList
            contentContainerStyle={styles.agendaContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={(
              <ResidentEmptyState
                action={(
                  <Pressable accessibilityRole="button" disabled={!online || refreshing} onPress={() => void refreshCollections()} style={({ pressed }) => [styles.primaryButton, (!online || refreshing) && styles.disabled, pressed && styles.pressed]}>
                    {refreshing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Check again</Text>}
                  </Pressable>
                )}
                body={online ? 'Keep this address saved and try the live council check again.' : 'Reconnect to check for collection dates.'}
                icon="calendar-clear-outline"
                title={collectionDataState === 'error' ? 'Council check unavailable' : 'No verified dates yet'}
              />
            )}
            ListFooterComponent={compactFooter}
            ListHeaderComponent={compactHeader}
            renderItem={({ item, index, section }) => renderCollectionRow(item, index === section.data.length - 1)}
            renderSectionHeader={({ section }) => {
              const diff = dayDifference(section.title);
              return (
                <View style={styles.compactSectionHeader}>
                  <View>
                    <Text style={styles.dateLabel}>{diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : formatCollectionDate(section.title, 'day')}</Text>
                    <Text accessibilityRole="header" style={styles.dateLong}>{formatCollectionDate(section.title, 'weekday')}</Text>
                  </View>
                  <View style={[styles.dayStamp, diff === 0 && styles.dayStampToday]}>
                    <Text style={[styles.dayStampText, diff === 0 && styles.dayStampTextToday]}>{formatCollectionDate(section.title, 'dateNumber')}</Text>
                  </View>
                </View>
              );
            }}
            sections={sections}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled
          />
        ) : (
          <View style={styles.desktopWorkspace}>
            <ScrollView contentContainerStyle={styles.calendarColumn} showsVerticalScrollIndicator={false} style={styles.calendarPane}>
              <CouncilNotices placement="schedule" profile={councilProfile} />
              {placePicker}
              {sourceStatusView}
              <View style={styles.monthCard}>
                <View style={styles.monthHeader}>
                  <View>
                    <Text style={styles.sectionKicker}>Verified dates</Text>
                    <Text accessibilityRole="header" style={styles.monthTitle}>{scheduleMonthLabel(selectedDate ?? scheduleDateKey(new Date()))}</Text>
                  </View>
                  <Text style={styles.monthHint}>Select a marked date</Text>
                </View>
                <View style={styles.weekHeader}>{scheduleWeekDays.map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
                <View style={styles.monthGrid}>
                  {cells.map((cell) => {
                    const hasCollection = datesWithCollections.has(cell.key);
                    const selected = selectedDate === cell.key;
                    return (
                      <Pressable
                        accessibilityLabel={`${formatCollectionDate(cell.key, 'weekday')}${hasCollection ? ', collection scheduled' : ', no verified collection'}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !hasCollection, selected }}
                        disabled={!hasCollection}
                        key={cell.key}
                        onPress={() => setSelectedDateValue(cell.key)}
                        style={[styles.dayCell, !cell.inMonth && styles.dayCellOutside, selected && styles.dayCellSelected]}>
                        <Text style={[styles.dayCellText, !cell.inMonth && styles.dayCellTextOutside, selected && styles.dayCellTextSelected]}>{cell.number}</Text>
                        {hasCollection ? <View style={[styles.collectionMarker, selected && styles.collectionMarkerSelected]} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <ScrollView contentContainerStyle={styles.detailColumn} showsVerticalScrollIndicator={false} style={styles.detailPane}>
              <View style={styles.detailHeading}>
                <Text style={styles.sectionKicker}>Selected day</Text>
                <Text accessibilityRole="header" style={styles.detailTitle}>{selectedDate ? formatCollectionDate(selectedDate, 'weekday') : 'No collection selected'}</Text>
                <Text style={styles.detailSubtitle}>{viewMode === 'all' ? 'Across your saved places' : activeAddress.label}</Text>
              </View>
              {selectedItems.length ? (
                <View style={styles.collectionsCard}>{selectedItems.map((item, index) => renderCollectionRow(item, index === selectedItems.length - 1))}</View>
              ) : (
                <ResidentEmptyState body="Choose a marked date in the calendar to see its verified collections." icon="calendar-outline" title="No collection on this date" />
              )}
              {adaptive.mode === 'medium' ? <>{calendarTypeFilters}{calendarActions}</> : null}
            </ScrollView>

            {adaptive.mode === 'wide' ? (
              <ScrollView contentContainerStyle={styles.contextColumn} showsVerticalScrollIndicator={false} style={styles.contextPane}>
                <Text style={styles.sectionKicker}>Calendar tools</Text>
                <Text style={styles.contextTitle}>Keep the household in sync</Text>
                <Text style={styles.contextBody}>Tools use {activeAddress.label} and only the bin types selected below.</Text>
                {calendarTypeFilters}
                {calendarActions}
                <Pressable accessibilityRole="button" disabled={!online || refreshing} onPress={() => void refreshCollections()} style={styles.refreshButton}>
                  {refreshing ? <ActivityIndicator color={theme.accent} /> : <Ionicons color={theme.accent} name="refresh" size={19} />}
                  <Text style={styles.refreshButtonText}>{refreshing ? 'Refreshing…' : 'Refresh council dates'}</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        )}

        <Modal animationType="slide" onRequestClose={() => setShowCalendarTools(false)} presentationStyle="pageSheet" visible={showCalendarTools}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.sheetPage}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderButton} />
              <Text style={styles.sheetTitle}>Calendar and sharing</Text>
              <Pressable accessibilityLabel="Close calendar and sharing" accessibilityRole="button" onPress={() => setShowCalendarTools(false)} style={styles.sheetHeaderButton}>
                <Ionicons color={theme.accent} name="close" size={24} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Text style={styles.contextBody}>These tools use {activeAddress?.label ?? 'the selected place'} and the selected bin types.</Text>
              {calendarActions}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </View>
    </AppShell>
  );
}

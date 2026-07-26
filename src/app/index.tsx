import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { BinGlyph, WasteIcon } from '@/components/bin-glyph';
import { RouteHead } from '@/components/route-head';
import { isUkPostcode } from '@/lib/council-provider';
import { deriveCollectionLifecycle } from '@/lib/collection-lifecycle';
import { evaluateMissedReportEligibility } from '@/lib/council-reporting';
import {
  collectionDisplayMeta,
  contrastTextForColour,
  dayDifference,
  formatCollectionDate,
  hasSourceCollectionColour,
  primaryCollectionForDate,
  sortCollections,
} from '@/lib/data';
import { appFonts } from '@/lib/design-system';
import { AppTheme, useAppTheme } from '@/lib/theme';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import { shareCollectionReminder } from '@/lib/schedule-tools';
import { Collection } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useOnlineStatus } from '@/lib/use-online-status';
import { useProductState } from '@/lib/use-product-state';

function collectionAnswer(collections: Collection[]) {
  const labels = collections.map((collection) => collectionDisplayMeta(collection).label);
  if (labels.length <= 2) return labels.join(' + ');
  return `${labels[0]} + ${labels.length - 1} more`;
}

export default function HomeScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const {
    addresses,
    activeAddress,
    collections,
    sourceStatus,
    collectionDataState,
    lastError,
    completedDate,
    changeNotice,
    disruptions,
    ready,
    refreshing,
    setActiveAddress,
    refreshCollections,
    markCollectionDateComplete,
  } = useAppData();
  const {
    onboarding,
    ready: productReady,
    reports,
    reminderPreferencesFor,
    outcomeFor,
    markCollection,
    updatePlaceReminders,
  } = useProductState();
  const online = useOnlineStatus();
  const [postcode, setPostcode] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [reportReferenceCopied, setReportReferenceCopied] = useState(false);

  const upcoming = sortCollections(collections).filter((collection) => dayDifference(collection.date) >= 0);
  const todayCollections = upcoming.filter((collection) => dayDifference(collection.date) === 0);
  const tonightCollections = upcoming.filter((collection) => dayDifference(collection.date) === 1);
  const actionCollections = tonightCollections.length ? tonightCollections : todayCollections;
  const actionDate = actionCollections[0]?.date;
  const next = upcoming[0];
  const nextDayCollections = next ? upcoming.filter((collection) => collection.date === next.date) : [];
  const primaryNextCollection = primaryCollectionForDate(nextDayCollections);
  const primaryNextMeta = primaryNextCollection ? collectionDisplayMeta(primaryNextCollection) : undefined;
  const usesCouncilBinColour = hasSourceCollectionColour(primaryNextCollection);
  const nextCardForeground = usesCouncilBinColour && primaryNextMeta
    ? contrastTextForColour(primaryNextMeta.colour)
    : theme.text;
  const nextCardSecondary = usesCouncilBinColour
    ? nextCardForeground === '#FFFFFF'
      ? 'rgba(255,255,255,0.80)'
      : 'rgba(15,42,58,0.72)'
    : theme.secondaryText;
  const nextCardMark = usesCouncilBinColour
    ? nextCardForeground === '#FFFFFF'
      ? 'rgba(255,255,255,0.16)'
      : 'rgba(15,42,58,0.10)'
    : undefined;
  const heroColour = usesCouncilBinColour && primaryNextMeta
    ? primaryNextMeta.colour
    : theme.hero;
  const heroForeground = usesCouncilBinColour
    ? contrastTextForColour(heroColour)
    : theme.heroText;
  const heroSecondary = usesCouncilBinColour
    ? heroForeground === '#FFFFFF'
      ? 'rgba(255,255,255,0.78)'
      : 'rgba(15,42,58,0.72)'
    : theme.heroSecondary;
  const heroAccent = usesCouncilBinColour
    ? heroForeground === '#FFFFFF'
      ? 'rgba(255,255,255,0.88)'
      : 'rgba(15,42,58,0.82)'
    : '#64B5FF';
  const heroControl = heroForeground === '#FFFFFF'
    ? 'rgba(255,255,255,0.14)'
    : 'rgba(15,42,58,0.10)';
  const heroOrb = heroForeground === '#FFFFFF'
    ? 'rgba(15,42,58,0.14)'
    : 'rgba(255,255,255,0.22)';
  const soonest = upcoming.slice(0, 3);
  const daysAway = next ? dayDifference(next.date) : null;
  const exactAddressRequired = activeAddress
    ? requiresExactCouncilAddress(activeAddress.providerId, activeAddress.councilAddressId)
    : false;
  const actionOutcomes = actionCollections.map((collection) => outcomeFor(activeAddress?.id, collection));
  const placeReminders = reminderPreferencesFor(activeAddress?.id);
  const actionReport = reports.find((report) => (
    report.addressId === activeAddress?.id
    && actionCollections.some((collection) => collection.id === report.collectionId)
    && report.status !== 'cancelled'
  ));
  const actionDisruption = disruptions.find((alert) => (
    alert.addressId === activeAddress?.id
    && new Date(alert.startsAt) <= new Date()
    && (!alert.endsAt || new Date(alert.endsAt) >= new Date())
  ));
  const completed = Boolean(
    actionDate
    && (
      completedDate === actionDate
      || (actionOutcomes.length > 0 && actionOutcomes.every((outcome) => outcome?.status === 'put-out'))
    )
  );
  const actionEligibility = activeAddress && actionCollections[0]
    ? evaluateMissedReportEligibility(activeAddress, actionCollections[0])
    : undefined;
  const lifecycle = actionCollections[0]
    ? deriveCollectionLifecycle(
        actionCollections[0],
        actionOutcomes[0],
        disruptions.filter((alert) => alert.addressId === activeAddress?.id),
        new Date(),
        actionEligibility
          ? { eligibleAfter: actionEligibility.eligibleAfter, reason: actionEligibility.reason }
          : undefined,
      )
    : undefined;

  function continueWithPostcode() {
    if (!isUkPostcode(postcode)) {
      setPostcodeError('Enter a full UK postcode, for example M1 1AE.');
      return;
    }
    setPostcodeError('');
    router.push({ pathname: '/places', params: { postcode: postcode.trim() } });
  }

  function refreshOrChooseAddress() {
    if (!activeAddress || exactAddressRequired) {
      router.push('/places');
      return;
    }
    void refreshCollections();
  }

  async function markBinsOut() {
    if (!actionDate || !activeAddress) return;
    markCollectionDateComplete(actionDate);
    actionCollections.forEach((collection) => markCollection(activeAddress, collection, 'put-out'));
    if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function confirmCollected() {
    if (!activeAddress) return;
    actionCollections.forEach((collection) => markCollection(activeAddress, collection, 'collected'));
    if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function reportMissed() {
    const collection = actionCollections[0];
    if (!collection) return;
    router.push({ pathname: '/report-missed', params: { collectionId: collection.id } });
  }

  function markBroughtIn() {
    if (!activeAddress) return;
    actionCollections.forEach((collection) => markCollection(activeAddress, collection, 'brought-in'));
  }

  async function shareActionCollection() {
    if (!activeAddress || !actionCollections.length) return;
    await shareCollectionReminder(actionCollections, activeAddress);
  }

  function remindMeLater() {
    if (!activeAddress) return;
    const nextHour = Math.min(new Date().getHours() + 1, 23);
    updatePlaceReminders(activeAddress.id, {
      enabled: true,
      secondReminder: true,
      secondReminderHour: nextHour,
    });
  }

  async function copyActionReportReference() {
    if (!actionReport) return;
    await Clipboard.setStringAsync(actionReport.councilReference || actionReport.localTrackingId);
    setReportReferenceCopied(true);
  }

  function sourceSummary() {
    if (!online) return collections.length ? 'Offline · showing your saved council dates' : 'You’re offline · reconnect to verify collection dates';
    if (collectionDataState === 'refreshing') return `Checking ${activeAddress?.councilName ?? 'your council'}…`;
    if (collectionDataState === 'cached') return `Showing saved dates · ${lastError ?? 'the latest check did not complete'}`;
    if (collectionDataState === 'error') return `Couldn’t verify · ${lastError ?? 'try again in a moment'}`;
    if (collectionDataState === 'empty') return 'No verified dates have been returned for this address yet.';
    return sourceStatus;
  }

  if (!ready || !productReady) {
    return (
      <AppShell activeRoute="/">
        <RouteHead
          title="Today"
          description="See which bin goes out tonight using verified collection dates for your address."
          path="/"
        />
        <View accessibilityLiveRegion="polite" style={styles.loadingPage}>
          <ActivityIndicator color={theme.accent} />
          <Text style={styles.loadingText}>Opening your saved schedule…</Text>
        </View>
      </AppShell>
    );
  }

  if (!activeAddress && !onboarding.completed && !onboarding.skipped) {
    return <Redirect href="/onboarding" />;
  }

  if (!activeAddress) {
    return (
      <AppShell activeRoute="/">
        <RouteHead
          title="Today"
          description="Find verified UK bin collection dates for your address."
          path="/"
        />
        <View style={styles.page}>
          <LinearGradient colors={[theme.hero, theme.hero]} style={styles.setupHero}>
            <SafeAreaView edges={['top']}>
              <Text style={styles.eyebrow}>What Bin Is It Tonight?</Text>
              <Text style={styles.setupTitle}>Find your collection dates.</Text>
              <Text style={styles.setupSubtitle}>Add one UK postcode and we’ll check its live council source.</Text>
            </SafeAreaView>
          </LinearGradient>
          <ScrollView contentContainerStyle={styles.setupContent} keyboardShouldPersistTaps="handled">
            <View style={styles.setupCard}>
              <Text style={styles.fieldLabel}>UK postcode</Text>
              <TextInput
                accessibilityLabel="UK postcode"
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={(value) => {
                  setPostcode(value);
                  if (postcodeError) setPostcodeError('');
                }}
                onSubmitEditing={continueWithPostcode}
                placeholder="e.g. M1 1AE"
                placeholderTextColor={theme.tertiaryText}
                returnKeyType="go"
                style={[styles.input, postcodeError && styles.inputError]}
                value={postcode}
              />
              {postcodeError ? (
                <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{postcodeError}</Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={continueWithPostcode}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Continue</Text>
                <Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
              </Pressable>
              <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>OR</Text><View style={styles.orLine} /></View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/places')}
                style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
                <Ionicons color={theme.accent} name="locate-outline" size={20} />
                <Text style={styles.locationButtonText}>Use my current location</Text>
              </Pressable>
            </View>
            <View style={styles.privacyLine}>
              <Ionicons color={theme.secondaryText} name="shield-checkmark-outline" size={18} />
              <Text style={styles.privacyText}>Your location is used once. Your saved address stays on this device.</Text>
            </View>
          </ScrollView>
        </View>
      </AppShell>
    );
  }

  const heroTitle = exactAddressRequired
    ? 'Choose your exact address'
    : collectionDataState === 'error'
      ? 'We couldn’t verify your dates'
      : tonightCollections.length
        ? collectionAnswer(tonightCollections)
        : todayCollections.length
          ? 'Collection day is today'
          : next
            ? 'Nothing goes out tonight'
            : 'No verified dates yet';
  const heroSubtitle = exactAddressRequired
    ? 'Your council needs the property, not only the postcode, to find the correct round.'
    : tonightCollections.length
      ? `Collection is tomorrow, ${formatCollectionDate(tonightCollections[0].date, 'weekday')}.`
      : todayCollections.length
        ? 'These bins were due out before 7am today.'
        : next
          ? `Next collection: ${formatCollectionDate(next.date, 'weekday')}.`
          : collectionDataState === 'error'
            ? 'Your saved address is safe. Try the live council check again.'
            : 'Check the live council source to load this address.';

  return (
    <>
      <AppShell activeRoute="/">
        <RouteHead
          title="Today"
          description="See which bin goes out tonight using verified collection dates for your address."
          path="/"
        />
        <View style={styles.page}>
          <LinearGradient colors={[heroColour, heroColour]} nativeID="today-hero" style={styles.hero}>
            <SafeAreaView edges={['top']}>
              <View style={styles.heroTop}>
                <View style={styles.heroBrand}>
                  <Text style={[styles.eyebrow, { color: heroAccent }]}>What Bin Is It Tonight?</Text>
                  <Text accessibilityLiveRegion="polite" style={[styles.greeting, { color: heroForeground }]}>{heroTitle}</Text>
                </View>
                <View style={styles.heroActions}>
                  <Pressable
                    accessibilityLabel="Manage addresses"
                    accessibilityRole="button"
                    onPress={() => setShowAddressPicker(true)}
                    style={({ pressed }) => [styles.addressButton, { backgroundColor: heroControl }, pressed && styles.pressed]}>
                    <Ionicons color={heroForeground} name="location-outline" size={21} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Open settings"
                    accessibilityRole="button"
                    onPress={() => router.push('/settings')}
                    style={({ pressed }) => [styles.addressButton, { backgroundColor: heroControl }, pressed && styles.pressed]}>
                    <Ionicons color={heroForeground} name="settings-outline" size={21} />
                  </Pressable>
                </View>
              </View>

              <View accessibilityLiveRegion="polite" style={styles.heroInfoRow}>
                <View style={styles.heroInfoCopy}>
                  <Pressable
                    accessibilityLabel="Choose saved address"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setShowAddressPicker(true)}
                    style={({ pressed }) => [styles.addressLine, pressed && styles.pressed]}>
                    <Ionicons color={heroSecondary} name="home-outline" size={17} />
                    <Text numberOfLines={1} style={[styles.addressText, { color: heroSecondary }]}>{activeAddress.label}</Text>
                    <Ionicons color={heroSecondary} name="chevron-down" size={15} />
                  </Pressable>
                  <Text style={[styles.answerSubtitle, { color: heroSecondary }]}>{heroSubtitle}</Text>
                </View>
                <View style={[styles.countdownOrb, { backgroundColor: heroOrb, borderColor: heroAccent }]}>
                  <Text style={[styles.countdownNumber, { color: heroForeground }]}>
                    {tonightCollections.length ? 'TONIGHT' : daysAway === null ? '—' : daysAway}
                  </Text>
                  {!tonightCollections.length && daysAway !== null ? (
                    <Text style={[styles.countdownCaption, { color: heroAccent }]}>{daysAway === 1 ? 'DAY' : 'DAYS'}</Text>
                  ) : null}
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {exactAddressRequired ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/places')} style={({ pressed }) => [styles.setupRequiredCard, pressed && styles.pressed]}>
                <View style={styles.actionIcon}><Ionicons color="#FFFFFF" name="home-outline" size={23} /></View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>Select your property</Text>
                  <Text style={styles.cardBody}>This prevents dates from the wrong collection round.</Text>
                </View>
                <Ionicons color={theme.secondaryText} name="arrow-forward" size={20} />
              </Pressable>
            ) : actionCollections.length ? (
              <View style={[styles.actionCard, completed && styles.actionCardComplete]}>
                <View style={styles.actionHeader}>
                  <View>
                    <Text style={styles.sectionKicker}>{tonightCollections.length ? 'TONIGHT' : 'Collection status'}</Text>
                    <Text style={styles.actionTitle}>{lifecycle?.title ?? formatCollectionDate(actionDate!, 'weekday')}</Text>
                  </View>
                  {lifecycle?.stage === 'collected' || completed ? <Ionicons color={theme.success} name="checkmark-circle" size={30} /> : null}
                </View>
                {lifecycle ? <Text style={styles.lifecycleDetail}>{lifecycle.detail}</Text> : null}
                <View style={styles.actionBins}>
                  {actionCollections.map((collection) => {
                    const meta = collectionDisplayMeta(collection);
                    return (
                      <View key={collection.id} style={styles.actionBinRow}>
                        <View style={[styles.iconDisc, { backgroundColor: meta.tint }]}>
                          <WasteIcon colour={meta.colour} type={collection.wasteType} />
                        </View>
                        <Text style={styles.actionBinName}>{meta.label}</Text>
                      </View>
                    );
                  })}
                </View>
                {lifecycle?.canMarkPutOut || completed ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: completed }}
                    disabled={completed}
                    onPress={markBinsOut}
                    style={({ pressed }) => [styles.completeButton, completed && styles.completeButtonDone, pressed && styles.pressed]}>
                    <Ionicons color={completed ? theme.accent : '#FFFFFF'} name={completed ? 'checkmark-circle' : 'arrow-up-circle-outline'} size={20} />
                    <Text accessibilityLiveRegion="polite" style={[styles.completeButtonText, completed && styles.completeButtonTextDone]}>
                      {completed ? 'Marked as out' : 'I’ve put it out'}
                    </Text>
                  </Pressable>
                ) : null}
                {lifecycle?.stage === 'before' ? (
                  <>
                    {!placeReminders.enabled ? (
                      <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
                        <Ionicons color={theme.accent} name="notifications-outline" size={19} />
                        <Text style={styles.secondaryActionText}>Enable reminder</Text>
                      </Pressable>
                    ) : null}
                    <View style={styles.quickActions}>
                      {tonightCollections.length ? (
                        <Pressable accessibilityRole="button" onPress={remindMeLater} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
                          <Ionicons color={theme.accent} name="alarm-outline" size={18} />
                          <Text style={styles.quickActionText}>Remind me later</Text>
                        </Pressable>
                      ) : null}
                      <Pressable accessibilityRole="button" onPress={() => router.push('/schedule')} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
                        <Ionicons color={theme.accent} name="calendar-outline" size={18} />
                        <Text style={styles.quickActionText}>Schedule</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => void shareActionCollection()} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
                        <Ionicons color={theme.accent} name="share-outline" size={18} />
                        <Text style={styles.quickActionText}>Share</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => router.push('/guide')} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
                        <Ionicons color={theme.accent} name="search-outline" size={18} />
                        <Text style={styles.quickActionText}>Bin guide</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
                {lifecycle?.stage === 'collected' && actionOutcomes[0]?.status !== 'brought-in' ? (
                  <Pressable accessibilityRole="button" onPress={markBroughtIn} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
                    <Ionicons color={theme.accent} name="return-down-back-outline" size={19} />
                    <Text style={styles.secondaryActionText}>Mark bin as brought in</Text>
                  </Pressable>
                ) : null}
                {actionDisruption && lifecycle?.stage !== 'missed' ? (
                  <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(actionDisruption.sourceUrl)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}>
                    <Ionicons color={theme.accent} name="megaphone-outline" size={19} />
                    <Text style={styles.secondaryActionText}>View council update</Text>
                  </Pressable>
                ) : null}
                {lifecycle?.stage === 'missed' ? (
                  <View style={styles.quickActions}>
                    <Pressable accessibilityRole="button" onPress={() => router.push('/reports')} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
                      <Ionicons color={theme.accent} name="document-text-outline" size={18} />
                      <Text style={styles.quickActionText}>{actionReport ? 'View report' : 'Reports'}</Text>
                    </Pressable>
                    {actionReport ? (
                      <Pressable accessibilityRole="button" onPress={() => void copyActionReportReference()} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
                        <Ionicons color={theme.accent} name={reportReferenceCopied ? 'checkmark-outline' : 'copy-outline'} size={18} />
                        <Text style={styles.quickActionText}>{reportReferenceCopied ? 'Copied' : 'Copy reference'}</Text>
                      </Pressable>
                    ) : null}
                    {actionReport ? (
                      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(actionReport.officialServiceUrl)} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
                        <Ionicons color={theme.accent} name="open-outline" size={18} />
                        <Text style={styles.quickActionText}>Council website</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {lifecycle?.canConfirmCollected && lifecycle.stage !== 'missed' ? (
                  <View style={styles.outcomeActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={confirmCollected}
                      style={({ pressed }) => [styles.collectedButton, pressed && styles.pressed]}>
                      <Ionicons color="#FFFFFF" name="checkmark-circle-outline" size={19} />
                      <Text style={styles.completeButtonText}>It was collected</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !lifecycle.canReportMissed }}
                      disabled={!lifecycle.canReportMissed}
                      onPress={reportMissed}
                      style={({ pressed }) => [styles.missedButton, !lifecycle.canReportMissed && styles.actionDisabled, pressed && styles.pressed]}>
                      <Ionicons color={theme.danger} name="alert-circle-outline" size={19} />
                      <Text style={styles.missedButtonText}>No, it was missed</Text>
                    </Pressable>
                  </View>
                ) : null}
                {lifecycle?.blockedReason ? <Text style={styles.blockedReason}>{lifecycle.blockedReason}</Text> : null}
              </View>
            ) : next ? (
              <Pressable
                accessibilityLabel={`Open schedule for ${collectionDisplayMeta(next).label}`}
                accessibilityRole="button"
                onPress={() => router.push('/schedule')}
                style={({ pressed }) => [
                  styles.collectionCard,
                  usesCouncilBinColour && primaryNextMeta && {
                    backgroundColor: primaryNextMeta.colour,
                    borderColor: primaryNextMeta.colour,
                  },
                  pressed && styles.pressed,
                ]}>
                <View
                  style={[
                    styles.collectionColour,
                    {
                      backgroundColor: usesCouncilBinColour
                        ? nextCardForeground
                        : primaryNextMeta?.colour ?? collectionDisplayMeta(next).colour,
                    },
                  ]}
                />
                <View style={[styles.collectionBinMark, nextCardMark ? { backgroundColor: nextCardMark } : null]}>
                  <BinGlyph
                    colour={usesCouncilBinColour ? nextCardForeground : primaryNextMeta?.colour ?? collectionDisplayMeta(next).colour}
                    size={36}
                  />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.cardKicker, { color: nextCardSecondary }]}>Next collection</Text>
                  <Text style={[styles.cardTitle, { color: nextCardForeground }]}>{nextDayCollections.map((collection) => collectionDisplayMeta(collection).label).join(' + ')}</Text>
                  <Text style={[styles.cardBody, { color: nextCardSecondary }]}>{formatCollectionDate(next.date, 'weekday')}</Text>
                </View>
                <Ionicons color={usesCouncilBinColour ? nextCardForeground : theme.tertiaryText} name="chevron-forward" size={20} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={refreshing || !online}
                onPress={refreshOrChooseAddress}
                style={({ pressed }) => [styles.emptySchedule, pressed && styles.pressed]}>
                <Ionicons color={online ? theme.accent : theme.secondaryText} name={online ? 'calendar-outline' : 'cloud-offline-outline'} size={26} />
                <View style={styles.emptyScheduleCopy}>
                  <Text style={styles.emptyScheduleTitle}>{collectionDataState === 'error' ? 'Council check unavailable' : 'No verified dates for this place'}</Text>
                  <Text style={styles.emptyScheduleBody}>{online ? 'Tap to check the live council source again.' : 'Reconnect to check for collection dates.'}</Text>
                </View>
                <Ionicons color={theme.tertiaryText} name="arrow-forward" size={19} />
              </Pressable>
            )}

            <Pressable
              accessibilityLabel="Refresh verified collection data"
              accessibilityRole="button"
              accessibilityState={{ disabled: refreshing || !online }}
              disabled={refreshing || !online}
              onPress={refreshOrChooseAddress}
              style={({ pressed }) => [styles.sourceLine, pressed && styles.pressed]}>
              {refreshing
                ? <ActivityIndicator color={theme.accent} />
                : <Ionicons color={online ? theme.accent : theme.secondaryText} name={online ? 'checkmark-circle-outline' : 'cloud-offline-outline'} size={20} />}
              <Text accessibilityLiveRegion="polite" numberOfLines={3} style={styles.sourceText}>{sourceSummary()}</Text>
              <Ionicons color={theme.secondaryText} name="refresh" size={18} />
            </Pressable>

            {changeNotice ? (
              <View accessibilityLiveRegion="polite" style={styles.changeNotice}>
                <View style={styles.changeIcon}><Ionicons color={theme.warning} name="alert-circle-outline" size={21} /></View>
                <View style={styles.changeCopy}>
                  <Text style={styles.changeTitle}>Your council changed a date</Text>
                  <Text style={styles.changeBody}>{changeNotice.replace(/^Collection date changed · /, '')}</Text>
                  <Text style={styles.changeFoot}>Your reminders have been updated to the latest verified schedule.</Text>
                </View>
              </View>
            ) : null}

            {soonest.length ? (
              <>
                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={styles.sectionKicker}>Coming up</Text>
                    <Text style={styles.sectionTitle}>Next collections</Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/schedule')} style={styles.linkButton}>
                    <Text style={styles.linkText}>Full schedule</Text>
                    <Ionicons color={theme.accent} name="arrow-forward" size={16} />
                  </Pressable>
                </View>
                <View style={styles.scheduleList}>
                  {soonest.map((collection) => {
                    const meta = collectionDisplayMeta(collection);
                    const diff = dayDifference(collection.date);
                    return (
                      <View key={collection.id} style={styles.scheduleRow}>
                        <View style={styles.dayBlock}>
                          <Text style={styles.dayName}>{diff === 0 ? 'Today' : formatCollectionDate(collection.date, 'day')}</Text>
                          <Text style={styles.dayNumber}>{formatCollectionDate(collection.date, 'dateNumber')}</Text>
                        </View>
                        <View style={[styles.iconDisc, { backgroundColor: meta.tint }]}>
                          <WasteIcon colour={meta.colour} type={collection.wasteType} />
                        </View>
                        <View style={styles.rowCopy}>
                          <Text style={styles.rowTitle}>{meta.label}</Text>
                          <Text style={styles.rowBody}>{diff === 1 ? 'Tomorrow' : formatCollectionDate(collection.date, 'short')}</Text>
                        </View>
                        <View style={[styles.dot, { backgroundColor: meta.colour }]} />
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Pressable accessibilityRole="button" onPress={() => router.push('/guide')} style={({ pressed }) => [styles.guideShortcut, pressed && styles.pressed]}>
              <View style={styles.guideIcon}><Ionicons color={theme.heroText} name="search" size={22} /></View>
              <View style={styles.guideCopy}>
                <Text style={styles.guideTitle}>Where does this item go?</Text>
                <Text style={styles.guideBody}>Search the recycling guide or find a nearby drop-off.</Text>
              </View>
              <Ionicons color={theme.heroSecondary} name="arrow-forward" size={20} />
            </Pressable>
          </ScrollView>
        </View>
      </AppShell>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowAddressPicker(false)}
        presentationStyle="pageSheet"
        visible={showAddressPicker}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.pickerPage}>
          <View style={styles.pickerHeader}>
            <View>
              <Text style={styles.modalKicker}>Current place</Text>
              <Text style={styles.modalTitle}>Choose an address</Text>
            </View>
            <Pressable accessibilityLabel="Close address picker" accessibilityRole="button" onPress={() => setShowAddressPicker(false)} style={styles.modalClose}>
              <Ionicons color={theme.text} name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.pickerContent}>
            <View style={styles.pickerList}>
              {addresses.map((address) => {
                const active = address.id === activeAddress.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={address.id}
                    onPress={() => {
                      setActiveAddress(address.id);
                      setShowAddressPicker(false);
                    }}
                    style={({ pressed }) => [styles.pickerRow, active && styles.pickerRowActive, pressed && styles.pressed]}>
                    <View style={[styles.pickerIcon, active && styles.pickerIconActive]}>
                      <Ionicons color={active ? '#FFFFFF' : theme.accent} name={active ? 'home' : 'home-outline'} size={21} />
                    </View>
                    <View style={styles.pickerCopy}>
                      <Text style={styles.pickerTitle}>{address.label}</Text>
                      <Text style={styles.pickerBody}>{address.line1} · {address.postcode}</Text>
                    </View>
                    {active ? <Ionicons color={theme.accent} name="checkmark-circle" size={23} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => { setShowAddressPicker(false); router.push('/places'); }} style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}>
              <Ionicons color={theme.accent} name="add-circle-outline" size={21} />
              <Text style={styles.manageButtonText}>Add or manage addresses</Text>
              <Ionicons color={theme.secondaryText} name="chevron-forward" size={19} />
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: theme.background },
  loadingText: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 15, fontWeight: '600' },
  setupHero: { paddingHorizontal: 22, paddingBottom: 30, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  setupTitle: { color: theme.heroText, fontFamily: appFonts.display, fontSize: 36, lineHeight: 40, fontWeight: '700', letterSpacing: -1.15, marginTop: 7, maxWidth: 350 },
  setupSubtitle: { color: theme.heroSecondary, fontSize: 15, lineHeight: 21, fontWeight: '500', marginTop: 10, maxWidth: 340 },
  setupContent: { padding: 18, paddingBottom: 122, gap: 17 },
  setupCard: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, padding: 18, gap: 12 },
  fieldLabel: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.35, fontWeight: '700' },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: theme.separator, color: theme.text, paddingHorizontal: 15, backgroundColor: theme.elevated, fontSize: 17, fontWeight: '700' },
  inputError: { borderColor: theme.danger },
  errorText: { color: theme.danger, fontSize: 13, lineHeight: 18, fontWeight: '600', marginTop: -5 },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { height: StyleSheet.hairlineWidth, flex: 1, backgroundColor: theme.separator },
  orText: { color: theme.tertiaryText, fontSize: 12, fontWeight: '700' },
  locationButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: theme.accentSoft },
  locationButtonText: { color: theme.accent, fontSize: 15, fontWeight: '700' },
  privacyLine: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingHorizontal: 5 },
  privacyText: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, flex: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 16, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 4 },
  heroBrand: { flex: 1, paddingRight: 8 },
  heroActions: { flexDirection: 'row', gap: 8 },
  eyebrow: { color: '#64B5FF', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.45, fontWeight: '700' },
  greeting: { color: theme.heroText, fontFamily: appFonts.display, fontSize: 32, lineHeight: 37, fontWeight: '700', letterSpacing: -0.95, marginTop: 2 },
  addressButton: { height: 44, width: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  heroInfoRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 },
  heroInfoCopy: { flex: 1, minWidth: 0 },
  addressLine: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  addressText: { color: theme.heroSecondary, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  answerSubtitle: { color: theme.heroSecondary, fontSize: 15, lineHeight: 20, fontWeight: '500', maxWidth: 300, marginTop: 2 },
  countdownOrb: { height: 72, width: 72, borderRadius: 36, borderWidth: 1, borderColor: 'rgba(100,181,255,0.52)', backgroundColor: 'rgba(2,13,23,0.22)', alignItems: 'center', justifyContent: 'center' },
  countdownNumber: { color: '#D7ECFF', fontFamily: appFonts.rounded, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.4, textAlign: 'center' },
  countdownCaption: { color: '#8CC8FF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 1 },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 120, gap: 20 },
  setupRequiredCard: { minHeight: 92, backgroundColor: theme.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, flexDirection: 'row', alignItems: 'center', padding: 15, gap: 13 },
  actionIcon: { height: 46, width: 46, borderRadius: 15, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  actionCard: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, padding: 17, gap: 14, shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  actionCardComplete: { backgroundColor: theme.accentSoft, borderColor: theme.separator },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionTitle: { color: theme.text, fontFamily: appFonts.display, fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.5, marginTop: 3 },
  lifecycleDetail: { color: theme.secondaryText, fontSize: 13.5, lineHeight: 19, marginTop: -5 },
  actionBins: { gap: 10 },
  actionBinRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 11 },
  actionBinName: { color: theme.text, fontSize: 16, fontWeight: '700' },
  completeButton: { minHeight: 52, backgroundColor: theme.accent, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  completeButtonDone: { backgroundColor: theme.accentSoft },
  completeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  completeButtonTextDone: { color: theme.accent },
  outcomeActions: { gap: 9 },
  quickActions: { flexDirection: 'row', gap: 8 },
  quickAction: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: theme.groupedBackground, alignItems: 'center', justifyContent: 'center', gap: 4 },
  quickActionText: { color: theme.accent, fontSize: 12, fontWeight: '700' },
  secondaryAction: { minHeight: 48, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryActionText: { color: theme.accent, fontSize: 14, fontWeight: '700' },
  collectedButton: { minHeight: 50, backgroundColor: theme.accent, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  missedButton: { minHeight: 50, backgroundColor: theme.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  missedButtonText: { color: theme.danger, fontSize: 16, fontWeight: '700' },
  actionDisabled: { opacity: 0.45 },
  blockedReason: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  collectionCard: { overflow: 'hidden', minHeight: 94, backgroundColor: theme.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, flexDirection: 'row', alignItems: 'center', paddingRight: 16, shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  collectionColour: { width: 7, alignSelf: 'stretch', marginRight: 13 },
  collectionBinMark: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, marginLeft: 12 },
  cardKicker: { color: theme.secondaryText, fontSize: 12, fontWeight: '700', letterSpacing: 0.35, marginBottom: 4 },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  cardBody: { color: theme.secondaryText, fontSize: 13, marginTop: 4, fontWeight: '500', lineHeight: 18 },
  emptySchedule: { minHeight: 88, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.separator, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyScheduleCopy: { flex: 1 },
  emptyScheduleTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  emptyScheduleBody: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 3 },
  sourceLine: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  sourceText: { flex: 1, color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  changeNotice: { borderRadius: 14, backgroundColor: `${theme.warning}14`, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: `${theme.warning}45` },
  changeIcon: { height: 40, width: 40, borderRadius: 14, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  changeCopy: { flex: 1 },
  changeTitle: { color: theme.text, fontSize: 14.5, fontWeight: '700' },
  changeBody: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 3, fontWeight: '600' },
  changeFoot: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 5 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionKicker: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.9, fontWeight: '700' },
  sectionTitle: { color: theme.text, fontFamily: appFonts.display, fontSize: 24, lineHeight: 29, fontWeight: '700', letterSpacing: -0.65, marginTop: 3 },
  linkButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 3 },
  linkText: { color: theme.accent, fontSize: 13, fontWeight: '800' },
  scheduleList: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, overflow: 'hidden' },
  scheduleRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator, gap: 11 },
  dayBlock: { width: 42, alignItems: 'center' },
  dayName: { color: theme.secondaryText, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  dayNumber: { color: theme.text, fontFamily: appFonts.rounded, fontSize: 21, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.4, marginTop: 1 },
  iconDisc: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  rowBody: { color: theme.secondaryText, fontSize: 12.5, fontWeight: '500', marginTop: 2 },
  dot: { height: 8, width: 8, borderRadius: 4 },
  guideShortcut: { backgroundColor: theme.hero, borderRadius: 16, minHeight: 82, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  guideIcon: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent },
  guideCopy: { flex: 1 },
  guideTitle: { color: theme.heroText, fontSize: 15, fontWeight: '700' },
  guideBody: { color: theme.heroSecondary, fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: '500' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  pickerPage: { flex: 1, backgroundColor: theme.background },
  pickerHeader: { backgroundColor: theme.surface, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  modalKicker: { color: theme.accent, fontSize: 12, letterSpacing: 0.9, fontWeight: '700' },
  modalTitle: { color: theme.text, fontFamily: appFonts.display, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.75, marginTop: 3 },
  modalClose: { height: 44, width: 44, borderRadius: 22, backgroundColor: theme.elevated, alignItems: 'center', justifyContent: 'center' },
  pickerContent: { padding: 18, paddingBottom: 30, gap: 16 },
  pickerList: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, overflow: 'hidden' },
  pickerRow: { minHeight: 82, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  pickerRowActive: { backgroundColor: theme.accentSoft },
  pickerIcon: { height: 42, width: 42, borderRadius: 15, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  pickerIconActive: { backgroundColor: theme.accent },
  pickerCopy: { flex: 1 },
  pickerTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  pickerBody: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  manageButton: { minHeight: 54, backgroundColor: theme.accentSoft, borderRadius: 16, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  manageButtonText: { flex: 1, color: theme.accent, fontSize: 15, fontWeight: '700' },
  });
}

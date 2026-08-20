import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import {
  SavedPlacesStrip,
  TodayAddressPicker,
  TodayContextPane,
  TodayHero,
  TodayPrimaryPane,
  TodaySetup,
} from '@/features/collections/today-sections';
import { createTodayStyles } from '@/features/collections/today-styles';
import { isUkPostcode } from '@/lib/council-provider';
import { deriveCollectionLifecycle } from '@/lib/collection-lifecycle';
import { evaluateMissedReportEligibility, residentReportingRule } from '@/lib/council-reporting';
import {
  collectionDisplayMeta,
  contrastTextForColour,
  dayDifference,
  formatCollectionDate,
  hasSourceCollectionColour,
  primaryCollectionForDate,
  safeCollectionHeroColour,
  sortCollections,
} from '@/lib/data';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import { requestCouncilConnection, requestedCouncilConnections } from '@/lib/resident-council-links';
import { residentAlertsForProfile } from '@/lib/resident-alerts';
import { useAppTheme } from '@/lib/theme';
import { type Collection } from '@/lib/types';
import { useAdaptiveLayout } from '@/lib/use-adaptive-layout';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';
import { useHouseholdSharing } from '@/lib/use-household-sharing';
import { useOnlineStatus } from '@/lib/use-online-status';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useProductState } from '@/lib/use-product-state';
import { useSubscription } from '@/lib/use-subscription';

function collectionAnswer(collections: Collection[]) {
  const labels = collections.map((collection) => collectionDisplayMeta(collection).label);
  if (labels.length === 1) return labels[0];
  return `${labels.length === 2 ? 'Two' : labels.length} bins go out tonight`;
}

export function TodayScreen() {
  const theme = useAppTheme();
  const adaptive = useAdaptiveLayout();
  const styles = createTodayStyles(theme, adaptive.mode);
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
    councilNotices,
  } = useProductState();
  const online = useOnlineStatus();
  const analytics = usePilotAnalytics();
  const subscription = useSubscription();
  const householdState = useHouseholdSharing();
  const councilProfile = useCouncilProfile(activeAddress?.providerId);
  const reportingRule = residentReportingRule(councilProfile);
  const missedCollectionEnabled = councilProfile?.featureFlags?.missedCollection !== false;
  const residentAlerts = residentAlertsForProfile(councilProfile)
    .filter((alert) => !councilNotices.archivedAtById[alert.id]);
  const unreadAlertCount = residentAlerts.filter((alert) => !councilNotices.readAtById[alert.id]).length;
  const [postcode, setPostcode] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [reportReferenceCopied, setReportReferenceCopied] = useState(false);
  const [councilRequested, setCouncilRequested] = useState(false);
  const [requestingCouncil, setRequestingCouncil] = useState(false);
  const [councilRequestError, setCouncilRequestError] = useState<string>();
  const shownCollectionAnswer = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void requestedCouncilConnections().then((requests) => {
      if (active) setCouncilRequested(Boolean(activeAddress?.providerId && requests[activeAddress.providerId]));
    });
    return () => { active = false; };
  }, [activeAddress?.providerId]);

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
    ? nextCardForeground === '#FFFFFF' ? 'rgba(255,255,255,0.80)' : 'rgba(15,42,58,0.72)'
    : theme.secondaryText;
  const nextCardMark = usesCouncilBinColour
    ? nextCardForeground === '#FFFFFF' ? 'rgba(255,255,255,0.16)' : 'rgba(15,42,58,0.10)'
    : undefined;
  const heroColour = usesCouncilBinColour && primaryNextMeta
    ? safeCollectionHeroColour(primaryNextMeta.colour, theme.hero)
    : theme.hero;
  const heroForeground = usesCouncilBinColour ? contrastTextForColour(heroColour) : theme.heroText;
  const heroSecondary = usesCouncilBinColour
    ? heroForeground === '#FFFFFF' ? 'rgba(255,255,255,0.78)' : 'rgba(15,42,58,0.72)'
    : theme.heroSecondary;
  const heroAccent = usesCouncilBinColour
    ? heroForeground === '#FFFFFF' ? 'rgba(255,255,255,0.88)' : 'rgba(15,42,58,0.82)'
    : '#64B5FF';
  const heroControl = heroForeground === '#FFFFFF' ? 'rgba(255,255,255,0.14)' : 'rgba(15,42,58,0.10)';
  const heroOrb = heroForeground === '#FFFFFF' ? 'rgba(15,42,58,0.14)' : 'rgba(255,255,255,0.22)';
  const soonest = upcoming.slice(0, 3);
  const daysAway = next ? dayDifference(next.date) : null;
  const exactAddressRequired = activeAddress
    ? requiresExactCouncilAddress(activeAddress.providerId, activeAddress.councilAddressId)
    : false;
  const actionOutcomes = actionCollections.map((collection) => outcomeFor(activeAddress?.id, collection));
  const activeHousehold = subscription.isPlus
    ? householdState.households.find((household) => household.councilProviderId === activeAddress?.providerId)
    : undefined;
  const householdAssignment = activeHousehold && actionCollections[0]
    ? activeHousehold.actions.find((action) => action.action === 'assigned'
      && action.collectionDate === actionCollections[0].date
      && action.wasteType === actionCollections[0].wasteType)
    : undefined;
  const assignedMember = activeHousehold?.members.find((member) => member.id === householdAssignment?.responsibleUserId);
  const placeReminders = reminderPreferencesFor(activeAddress?.id);
  const actionReport = reports.find((report) => report.addressId === activeAddress?.id
    && actionCollections.some((collection) => collection.id === report.collectionId)
    && report.status !== 'cancelled');
  const actionDisruption = disruptions.find((alert) => alert.addressId === activeAddress?.id
    && new Date(alert.startsAt) <= new Date()
    && (!alert.endsAt || new Date(alert.endsAt) >= new Date()));
  const completed = Boolean(actionDate && (completedDate === actionDate
    || (actionOutcomes.length > 0 && actionOutcomes.every((outcome) => outcome?.status === 'put-out'))));
  const actionEligibility = activeAddress && actionCollections[0]
    ? evaluateMissedReportEligibility(activeAddress, actionCollections[0], new Date(), reportingRule)
    : undefined;
  const lifecycle = actionCollections[0]
    ? deriveCollectionLifecycle(
        actionCollections[0],
        actionOutcomes[0],
        disruptions.filter((alert) => alert.addressId === activeAddress?.id),
        new Date(),
        actionEligibility ? { eligibleAfter: actionEligibility.eligibleAfter, reason: actionEligibility.reason } : undefined,
      )
    : undefined;

  useEffect(() => {
    if (!activeAddress?.providerId || !next) return;
    const key = `${activeAddress.id}:${next.id}`;
    if (shownCollectionAnswer.current === key) return;
    shownCollectionAnswer.current = key;
    analytics.track('collection_answer_shown', {
      councilId: activeAddress.providerId,
      outcome: 'success',
      context: next.wasteType,
    });
  }, [activeAddress, analytics, next]);

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
    if (activeHousehold) {
      void Promise.all(actionCollections.map((collection) => householdState.recordAction({
        householdId: activeHousehold.id,
        collectionDate: collection.date,
        wasteType: collection.wasteType,
        action: 'put-out',
      }))).catch(() => undefined);
    }
    analytics.track('bin_marked_out', {
      councilId: activeAddress.providerId,
      outcome: 'confirmed',
      context: actionCollections[0]?.wasteType,
      metricValue: actionCollections.length,
    });
    if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function confirmCollected() {
    if (!activeAddress) return;
    actionCollections.forEach((collection) => markCollection(activeAddress, collection, 'collected'));
    if (activeHousehold) {
      void Promise.all(actionCollections.map((collection) => householdState.recordAction({
        householdId: activeHousehold.id,
        collectionDate: collection.date,
        wasteType: collection.wasteType,
        action: 'collected',
      }))).catch(() => undefined);
    }
    analytics.track('collection_outcome_confirmed', {
      councilId: activeAddress.providerId,
      outcome: 'confirmed',
      context: actionCollections[0]?.wasteType,
      metricValue: actionCollections.length,
    });
    if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function reportMissed() {
    const collection = actionCollections[0];
    if (!collection) return;
    analytics.track('missed_report_started', {
      councilId: activeAddress?.providerId,
      outcome: 'opened',
      context: collection.wasteType,
    });
    router.push({ pathname: '/report-missed', params: { collectionId: collection.id } });
  }

  function markBroughtIn() {
    if (!activeAddress) return;
    actionCollections.forEach((collection) => markCollection(activeAddress, collection, 'brought-in'));
    if (activeHousehold) {
      void Promise.all(actionCollections.map((collection) => householdState.recordAction({
        householdId: activeHousehold.id,
        collectionDate: collection.date,
        wasteType: collection.wasteType,
        action: 'brought-in',
      }))).catch(() => undefined);
    }
  }

  async function copyActionReportReference() {
    if (!actionReport) return;
    await Clipboard.setStringAsync(actionReport.councilReference || actionReport.localTrackingId);
    setReportReferenceCopied(true);
  }

  async function requestCouncil() {
    if (!activeAddress?.providerId || councilRequested) return;
    setRequestingCouncil(true);
    setCouncilRequestError(undefined);
    try {
      await requestCouncilConnection(activeAddress.providerId, true);
      setCouncilRequested(true);
    } catch (caught) {
      setCouncilRequestError(caught instanceof Error ? caught.message : 'Your council request could not be saved.');
    } finally {
      setRequestingCouncil(false);
    }
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
    return <AppShell activeRoute="/"><RouteHead title="Today" description="See which bin goes out tonight using verified collection dates for your address." path="/" /><View accessibilityLiveRegion="polite" style={styles.loadingPage}><ActivityIndicator color={theme.accent} /><Text style={styles.loadingText}>Opening your saved schedule…</Text></View></AppShell>;
  }
  if (!activeAddress && !onboarding.completed && !onboarding.skipped) return <Redirect href="/onboarding" />;
  if (!activeAddress) {
    return <AppShell activeRoute="/"><RouteHead title="Today" description="Find verified UK bin collection dates for your address." path="/" /><TodaySetup error={postcodeError} onChange={(value) => { setPostcode(value); if (postcodeError) setPostcodeError(''); }} onContinue={continueWithPostcode} postcode={postcode} styles={styles} theme={theme} /></AppShell>;
  }

  const heroTitle = exactAddressRequired
    ? 'Choose your exact address'
    : collectionDataState === 'error'
      ? 'We couldn’t verify your dates'
      : tonightCollections.length
        ? collectionAnswer(tonightCollections)
        : todayCollections.length ? 'Collection day is today' : next ? 'Nothing goes out tonight' : 'No verified dates yet';
  const heroSubtitle = exactAddressRequired
    ? 'Your council needs the property, not only the postcode, to find the correct round.'
    : tonightCollections.length
      ? `Collection is tomorrow, ${formatCollectionDate(tonightCollections[0].date, 'weekday')}.`
      : todayCollections.length
        ? 'These bins were due out before 7am today.'
        : next
          ? `Next collection: ${formatCollectionDate(next.date, 'weekday')}.`
          : collectionDataState === 'error' ? 'Your saved address is safe. Try the live council check again.' : 'Check the live council source to load this address.';

  return (
    <>
      <AppShell activeRoute="/">
        <RouteHead title="Today" description="See which bin goes out tonight using verified collection dates for your address." path="/" />
        <View style={styles.page}>
          <TodayHero activeAddress={activeAddress} daysAway={daysAway} heroAccent={heroAccent} heroColour={heroColour} heroControl={heroControl} heroForeground={heroForeground} heroOrb={heroOrb} heroSecondary={heroSecondary} heroSubtitle={heroSubtitle} heroTitle={heroTitle} onChooseAddress={() => setShowAddressPicker(true)} styles={styles} tonight={Boolean(tonightCollections.length)} unreadAlertCount={unreadAlertCount} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SavedPlacesStrip activeAddress={activeAddress} addresses={addresses} mode={adaptive.mode} onSelect={setActiveAddress} styles={styles} theme={theme} />
            <View style={styles.dashboard}>
              <TodayPrimaryPane
                actionCollections={actionCollections} actionDate={actionDate} actionDisruption={actionDisruption} actionOutcomes={actionOutcomes} actionReport={actionReport}
                activeAddress={activeAddress} assignedMemberName={assignedMember?.displayName} canRequestCouncil={Boolean(councilProfile && ['unsupported', 'council-link-only'].includes(councilProfile.coverageStatus))}
                changeNotice={changeNotice} collectionDataState={collectionDataState} completed={completed} councilRequestError={councilRequestError} councilRequested={councilRequested}
                exactAddressRequired={exactAddressRequired} lifecycle={lifecycle} missedCollectionEnabled={missedCollectionEnabled} next={next} nextCardForeground={nextCardForeground} nextCardMark={nextCardMark} nextCardSecondary={nextCardSecondary} nextDayCollections={nextDayCollections}
                online={online} onBroughtIn={markBroughtIn} onConfirmCollected={confirmCollected} onCopyReference={() => void copyActionReportReference()} onMarkOut={() => void markBinsOut()} onRefresh={refreshOrChooseAddress} onReportMissed={reportMissed} onRequestCouncil={() => void requestCouncil()}
                placeRemindersEnabled={placeReminders.enabled} primaryNextColour={primaryNextMeta?.colour} refreshing={refreshing} reportReferenceCopied={reportReferenceCopied} requestingCouncil={requestingCouncil}
                showHousehold={Boolean(activeHousehold)} sourceSummary={sourceSummary()} styles={styles} theme={theme} tonight={Boolean(tonightCollections.length)} usesCouncilBinColour={usesCouncilBinColour}
              />
              <TodayContextPane placeRemindersEnabled={placeReminders.enabled} soonest={soonest} styles={styles} theme={theme} />
            </View>
          </ScrollView>
        </View>
      </AppShell>
      <TodayAddressPicker activeAddress={activeAddress} addresses={addresses} onClose={() => setShowAddressPicker(false)} onSelect={(id) => { setActiveAddress(id); setShowAddressPicker(false); }} styles={styles} theme={theme} visible={showAddressPicker} />
    </>
  );
}

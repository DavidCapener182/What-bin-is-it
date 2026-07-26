import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { CollectionBadge } from '@/components/collection-badge';
import { RouteHead } from '@/components/route-head';
import { isUkPostcode } from '@/lib/council-provider';
import {
  collectionDisplayMeta,
  dayDifference,
  formatCollectionDate,
  sortCollections,
} from '@/lib/data';
import { appColours, appFonts } from '@/lib/design-system';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import { Collection } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { useOnlineStatus } from '@/lib/use-online-status';

function collectionAnswer(collections: Collection[]) {
  if (collections.length === 1) return `${collectionDisplayMeta(collections[0]).label} goes out tonight`;
  return `${collections.length} bins go out tonight`;
}

export default function HomeScreen() {
  const {
    addresses,
    activeAddress,
    collections,
    sourceStatus,
    collectionDataState,
    lastError,
    completedDate,
    changeNotice,
    ready,
    refreshing,
    setActiveAddress,
    refreshCollections,
    markCollectionDateComplete,
  } = useAppData();
  const online = useOnlineStatus();
  const [postcode, setPostcode] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  const upcoming = sortCollections(collections).filter((collection) => dayDifference(collection.date) >= 0);
  const todayCollections = upcoming.filter((collection) => dayDifference(collection.date) === 0);
  const tonightCollections = upcoming.filter((collection) => dayDifference(collection.date) === 1);
  const actionCollections = tonightCollections.length ? tonightCollections : todayCollections;
  const actionDate = actionCollections[0]?.date;
  const next = upcoming[0];
  const nextDayCollections = next ? upcoming.filter((collection) => collection.date === next.date) : [];
  const soonest = upcoming.slice(0, 3);
  const daysAway = next ? dayDifference(next.date) : null;
  const exactAddressRequired = activeAddress
    ? requiresExactCouncilAddress(activeAddress.providerId, activeAddress.councilAddressId)
    : false;
  const completed = Boolean(actionDate && completedDate === actionDate);

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
    if (!actionDate) return;
    markCollectionDateComplete(actionDate);
    if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function sourceSummary() {
    if (!online) return collections.length ? 'Offline · showing your saved council dates' : 'You’re offline · reconnect to verify collection dates';
    if (collectionDataState === 'refreshing') return `Checking ${activeAddress?.councilName ?? 'your council'}…`;
    if (collectionDataState === 'cached') return `Showing saved dates · ${lastError ?? 'the latest check did not complete'}`;
    if (collectionDataState === 'error') return `Couldn’t verify · ${lastError ?? 'try again in a moment'}`;
    if (collectionDataState === 'empty') return 'No verified dates have been returned for this address yet.';
    return sourceStatus;
  }

  if (!ready) {
    return (
      <AppShell activeRoute="/">
        <RouteHead
          title="Today"
          description="See which bin goes out tonight using verified collection dates for your address."
          path="/"
        />
        <View accessibilityLiveRegion="polite" style={styles.loadingPage}>
          <ActivityIndicator color={appColours.brand} />
          <Text style={styles.loadingText}>Opening your saved schedule…</Text>
        </View>
      </AppShell>
    );
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
          <LinearGradient colors={['#071A2B', '#0B2A3B', '#103B4B']} style={styles.setupHero}>
            <SafeAreaView edges={['top']}>
              <Text style={styles.eyebrow}>WHAT BIN IS IT TONIGHT?</Text>
              <Text style={styles.setupTitle}>Find your collection dates.</Text>
              <Text style={styles.setupSubtitle}>Add one UK postcode and we’ll check its live council source.</Text>
            </SafeAreaView>
          </LinearGradient>
          <ScrollView contentContainerStyle={styles.setupContent} keyboardShouldPersistTaps="handled">
            <View style={styles.setupCard}>
              <Text style={styles.fieldLabel}>UK POSTCODE</Text>
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
                placeholderTextColor="#7A9092"
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
                <Ionicons color={appColours.brand} name="locate-outline" size={20} />
                <Text style={styles.locationButtonText}>Use my current location</Text>
              </Pressable>
            </View>
            <View style={styles.privacyLine}>
              <Ionicons color="#58777A" name="shield-checkmark-outline" size={18} />
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
          <LinearGradient colors={['#071A2B', '#0B2A3B', '#103B4B']} style={styles.hero}>
            <SafeAreaView edges={['top']}>
              <View style={styles.heroTop}>
                <View style={styles.heroBrand}>
                  <Text style={styles.eyebrow}>WHAT BIN IS IT TONIGHT?</Text>
                  <Text style={styles.greeting}>Tonight</Text>
                </View>
                <Pressable
                  accessibilityLabel="Manage addresses"
                  accessibilityRole="button"
                  onPress={() => setShowAddressPicker(true)}
                  style={({ pressed }) => [styles.addressButton, pressed && styles.pressed]}>
                  <Ionicons color="#E8FFF5" name="location-outline" size={21} />
                </Pressable>
              </View>

              <Pressable
                accessibilityLabel="Choose saved address"
                accessibilityRole="button"
                onPress={() => setShowAddressPicker(true)}
                style={({ pressed }) => [styles.addressLine, pressed && styles.pressed]}>
                <Ionicons color="#8CE1BF" name="home-outline" size={17} />
                <Text numberOfLines={1} style={styles.addressText}>{activeAddress.label}</Text>
                <Ionicons color="#8CE1BF" name="chevron-down" size={15} />
              </Pressable>

              <View accessibilityLiveRegion="polite" style={styles.answerRow}>
                <View style={styles.answerCopy}>
                  <Text style={styles.nextKicker}>{exactAddressRequired ? 'ADDRESS SETUP' : 'YOUR ANSWER'}</Text>
                  <Text style={styles.answerTitle}>{heroTitle}</Text>
                  <Text style={styles.answerSubtitle}>{heroSubtitle}</Text>
                  {tonightCollections.length ? (
                    <View style={styles.nextTypes}>
                      {tonightCollections.map((collection) => (
                        <CollectionBadge collection={collection} key={collection.id} />
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={styles.countdownOrb}>
                  <Text style={styles.countdownNumber}>
                    {tonightCollections.length ? 'TONIGHT' : daysAway === null ? '—' : daysAway}
                  </Text>
                  {!tonightCollections.length && daysAway !== null ? (
                    <Text style={styles.countdownCaption}>{daysAway === 1 ? 'DAY' : 'DAYS'}</Text>
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
                <Ionicons color="#5F7F82" name="arrow-forward" size={20} />
              </Pressable>
            ) : actionCollections.length ? (
              <View style={[styles.actionCard, completed && styles.actionCardComplete]}>
                <View style={styles.actionHeader}>
                  <View>
                    <Text style={styles.sectionKicker}>{tonightCollections.length ? 'PUT OUT TONIGHT' : 'DUE TODAY'}</Text>
                    <Text style={styles.actionTitle}>{formatCollectionDate(actionDate!, 'weekday')}</Text>
                  </View>
                  {completed ? <Ionicons color="#087A70" name="checkmark-circle" size={30} /> : null}
                </View>
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: completed }}
                  disabled={completed}
                  onPress={markBinsOut}
                  style={({ pressed }) => [styles.completeButton, completed && styles.completeButtonDone, pressed && styles.pressed]}>
                  <Ionicons color={completed ? '#087A70' : '#FFFFFF'} name={completed ? 'checkmark-circle' : 'checkmark'} size={20} />
                  <Text accessibilityLiveRegion="polite" style={[styles.completeButtonText, completed && styles.completeButtonTextDone]}>
                    {completed ? 'Marked as out' : 'I’ve put it out'}
                  </Text>
                </Pressable>
              </View>
            ) : next ? (
              <Pressable
                accessibilityLabel={`Open schedule for ${collectionDisplayMeta(next).label}`}
                accessibilityRole="button"
                onPress={() => router.push('/schedule')}
                style={({ pressed }) => [styles.collectionCard, pressed && styles.pressed]}>
                <View style={[styles.collectionColour, { backgroundColor: collectionDisplayMeta(next).colour }]} />
                <BinGlyph colour={collectionDisplayMeta(next).colour} size={36} />
                <View style={styles.cardCopy}>
                  <Text style={styles.cardKicker}>NEXT COLLECTION</Text>
                  <Text style={styles.cardTitle}>{nextDayCollections.map((collection) => collectionDisplayMeta(collection).label).join(' + ')}</Text>
                  <Text style={styles.cardBody}>{formatCollectionDate(next.date, 'weekday')}</Text>
                </View>
                <Ionicons color="#5F7F82" name="chevron-forward" size={20} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={refreshing || !online}
                onPress={refreshOrChooseAddress}
                style={({ pressed }) => [styles.emptySchedule, pressed && styles.pressed]}>
                <Ionicons color="#0A746A" name={online ? 'calendar-outline' : 'cloud-offline-outline'} size={26} />
                <View style={styles.emptyScheduleCopy}>
                  <Text style={styles.emptyScheduleTitle}>{collectionDataState === 'error' ? 'Council check unavailable' : 'No verified dates for this place'}</Text>
                  <Text style={styles.emptyScheduleBody}>{online ? 'Tap to check the live council source again.' : 'Reconnect to check for collection dates.'}</Text>
                </View>
                <Ionicons color="#5F7F82" name="arrow-forward" size={19} />
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
                ? <ActivityIndicator color={appColours.brand} />
                : <Ionicons color={online ? appColours.brand : '#6D8084'} name={online ? 'checkmark-circle-outline' : 'cloud-offline-outline'} size={20} />}
              <Text accessibilityLiveRegion="polite" numberOfLines={3} style={styles.sourceText}>{sourceSummary()}</Text>
              <Ionicons color="#6E8789" name="refresh" size={18} />
            </Pressable>

            {changeNotice ? (
              <View accessibilityLiveRegion="polite" style={styles.changeNotice}>
                <View style={styles.changeIcon}><Ionicons color="#8C571E" name="alert-circle-outline" size={21} /></View>
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
                    <Text style={styles.sectionKicker}>COMING UP</Text>
                    <Text style={styles.sectionTitle}>Next collections</Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/schedule')} style={styles.linkButton}>
                    <Text style={styles.linkText}>Full schedule</Text>
                    <Ionicons color={appColours.brand} name="arrow-forward" size={16} />
                  </Pressable>
                </View>
                <View style={styles.scheduleList}>
                  {soonest.map((collection) => {
                    const meta = collectionDisplayMeta(collection);
                    const diff = dayDifference(collection.date);
                    return (
                      <View key={collection.id} style={styles.scheduleRow}>
                        <View style={styles.dayBlock}>
                          <Text style={styles.dayName}>{diff === 0 ? 'TODAY' : formatCollectionDate(collection.date, 'day')}</Text>
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
              <View style={styles.guideIcon}><Ionicons color="#F3FFF9" name="search" size={22} /></View>
              <View style={styles.guideCopy}>
                <Text style={styles.guideTitle}>Where does this item go?</Text>
                <Text style={styles.guideBody}>Search the recycling guide or find a nearby drop-off.</Text>
              </View>
              <Ionicons color="#A6DCCE" name="arrow-forward" size={20} />
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
              <Text style={styles.modalKicker}>CURRENT PLACE</Text>
              <Text style={styles.modalTitle}>Choose an address</Text>
            </View>
            <Pressable accessibilityLabel="Close address picker" accessibilityRole="button" onPress={() => setShowAddressPicker(false)} style={styles.modalClose}>
              <Ionicons color="#31575C" name="close" size={22} />
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
                      <Ionicons color={active ? '#FFFFFF' : appColours.brand} name={active ? 'home' : 'home-outline'} size={21} />
                    </View>
                    <View style={styles.pickerCopy}>
                      <Text style={styles.pickerTitle}>{address.label}</Text>
                      <Text style={styles.pickerBody}>{address.line1} · {address.postcode}</Text>
                    </View>
                    {active ? <Ionicons color={appColours.brand} name="checkmark-circle" size={23} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => { setShowAddressPicker(false); router.push('/places'); }} style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}>
              <Ionicons color={appColours.brand} name="add-circle-outline" size={21} />
              <Text style={styles.manageButtonText}>Add or manage addresses</Text>
              <Ionicons color="#688184" name="chevron-forward" size={19} />
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: appColours.background },
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: appColours.background },
  loadingText: { color: '#536F73', fontFamily: appFonts.text, fontSize: 15, fontWeight: '600' },
  setupHero: { paddingHorizontal: 22, paddingBottom: 30, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  setupTitle: { color: '#F6FFF9', fontFamily: appFonts.display, fontSize: 36, lineHeight: 40, fontWeight: '700', letterSpacing: -1.15, marginTop: 7, maxWidth: 350 },
  setupSubtitle: { color: '#B7DCCF', fontSize: 15, lineHeight: 21, fontWeight: '500', marginTop: 10, maxWidth: 340 },
  setupContent: { padding: 18, paddingBottom: 122, gap: 17 },
  setupCard: { backgroundColor: appColours.card, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, padding: 18, gap: 12, shadowColor: '#142329', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  fieldLabel: { color: '#526F72', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.75, fontWeight: '700' },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#C9D6D1', color: '#153A40', paddingHorizontal: 15, backgroundColor: '#FBFCFA', fontSize: 17, fontWeight: '700' },
  inputError: { borderColor: '#B34840' },
  errorText: { color: '#9F3832', fontSize: 13, lineHeight: 18, fontWeight: '600', marginTop: -5 },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: appColours.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { height: StyleSheet.hairlineWidth, flex: 1, backgroundColor: '#D9E1DD' },
  orText: { color: '#718587', fontSize: 12, fontWeight: '700' },
  locationButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#E5F3ED' },
  locationButtonText: { color: appColours.brand, fontSize: 15, fontWeight: '700' },
  privacyLine: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingHorizontal: 5 },
  privacyText: { color: '#587175', fontSize: 13, lineHeight: 18, flex: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 27, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  heroBrand: { flex: 1 },
  eyebrow: { color: '#8CE1BF', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 1.05, fontWeight: '700' },
  greeting: { color: '#F6FFF9', fontFamily: appFonts.display, fontSize: 32, lineHeight: 37, fontWeight: '700', letterSpacing: -0.95, marginTop: 2 },
  addressButton: { height: 46, width: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  addressLine: { marginTop: 18, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '88%', marginBottom: -7 },
  addressText: { color: '#B6E9D2', fontSize: 15, fontWeight: '600', flexShrink: 1 },
  answerRow: { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 15 },
  answerCopy: { flex: 1 },
  nextKicker: { color: '#89BDAA', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.95, fontWeight: '700' },
  answerTitle: { color: '#FFFFFF', fontFamily: appFonts.display, fontSize: 27, lineHeight: 31, fontWeight: '700', letterSpacing: -0.7, marginTop: 6 },
  answerSubtitle: { color: '#C3DFD5', fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 7, maxWidth: 300 },
  nextTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  countdownOrb: { height: 92, width: 92, borderRadius: 46, borderWidth: 1, borderColor: 'rgba(164,255,214,0.44)', backgroundColor: 'rgba(2,13,23,0.22)', alignItems: 'center', justifyContent: 'center' },
  countdownNumber: { color: '#B9FFD8', fontFamily: appFonts.rounded, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.4, textAlign: 'center' },
  countdownCaption: { color: '#8CE1BF', fontSize: 12, fontWeight: '800', letterSpacing: 1.05, marginTop: 2 },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 120, gap: 20 },
  setupRequiredCard: { minHeight: 92, backgroundColor: appColours.card, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, flexDirection: 'row', alignItems: 'center', padding: 15, gap: 13 },
  actionIcon: { height: 46, width: 46, borderRadius: 15, backgroundColor: appColours.brand, alignItems: 'center', justifyContent: 'center' },
  actionCard: { backgroundColor: appColours.card, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, padding: 17, gap: 14, shadowColor: '#142329', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  actionCardComplete: { backgroundColor: '#F0FAF5', borderColor: '#B9DCD0' },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionTitle: { color: '#14323B', fontFamily: appFonts.display, fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.5, marginTop: 3 },
  actionBins: { gap: 10 },
  actionBinRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 11 },
  actionBinName: { color: '#17373E', fontSize: 16, fontWeight: '700' },
  completeButton: { minHeight: 52, backgroundColor: appColours.brand, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  completeButtonDone: { backgroundColor: '#DFF1E9' },
  completeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  completeButtonTextDone: { color: appColours.brand },
  collectionCard: { overflow: 'hidden', minHeight: 94, backgroundColor: appColours.card, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, flexDirection: 'row', alignItems: 'center', paddingRight: 16, shadowColor: '#142329', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  collectionColour: { width: 7, alignSelf: 'stretch', marginRight: 13 },
  cardCopy: { flex: 1, marginLeft: 12 },
  cardKicker: { color: '#657F82', fontSize: 12, fontWeight: '700', letterSpacing: 0.65, marginBottom: 4 },
  cardTitle: { color: '#102B35', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  cardBody: { color: '#5C7378', fontSize: 13, marginTop: 4, fontWeight: '500', lineHeight: 18 },
  emptySchedule: { minHeight: 88, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#AFC7BD', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyScheduleCopy: { flex: 1 },
  emptyScheduleTitle: { color: '#173F44', fontSize: 15, fontWeight: '700' },
  emptyScheduleBody: { color: '#5D777A', fontSize: 13, lineHeight: 18, marginTop: 3 },
  sourceLine: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  sourceText: { flex: 1, color: '#536F73', fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  changeNotice: { borderRadius: 18, backgroundColor: '#F8EDD9', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8CFAC' },
  changeIcon: { height: 40, width: 40, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  changeCopy: { flex: 1 },
  changeTitle: { color: '#673F18', fontSize: 14.5, fontWeight: '700' },
  changeBody: { color: '#765128', fontSize: 13, lineHeight: 18, marginTop: 3, fontWeight: '600' },
  changeFoot: { color: '#735B3F', fontSize: 12, lineHeight: 17, marginTop: 5 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionKicker: { color: '#617E80', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.9, fontWeight: '700' },
  sectionTitle: { color: '#14323B', fontFamily: appFonts.display, fontSize: 24, lineHeight: 29, fontWeight: '700', letterSpacing: -0.65, marginTop: 3 },
  linkButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 3 },
  linkText: { color: appColours.brand, fontSize: 13, fontWeight: '800' },
  scheduleList: { backgroundColor: appColours.card, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, overflow: 'hidden' },
  scheduleRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E9E5', gap: 11 },
  dayBlock: { width: 42, alignItems: 'center' },
  dayName: { color: '#617E80', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  dayNumber: { color: '#15323B', fontFamily: appFonts.rounded, fontSize: 21, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.4, marginTop: 1 },
  iconDisc: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#12313A', fontSize: 15, fontWeight: '700' },
  rowBody: { color: '#60787C', fontSize: 12.5, fontWeight: '500', marginTop: 2 },
  dot: { height: 8, width: 8, borderRadius: 4 },
  guideShortcut: { backgroundColor: '#204B48', borderRadius: 19, minHeight: 82, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  guideIcon: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D8375' },
  guideCopy: { flex: 1 },
  guideTitle: { color: '#F3FFF9', fontSize: 15, fontWeight: '700' },
  guideBody: { color: '#B8D8CC', fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: '500' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  pickerPage: { flex: 1, backgroundColor: appColours.background },
  pickerHeader: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE5E0' },
  modalKicker: { color: appColours.brand, fontSize: 12, letterSpacing: 0.9, fontWeight: '700' },
  modalTitle: { color: '#14323B', fontFamily: appFonts.display, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.75, marginTop: 3 },
  modalClose: { height: 44, width: 44, borderRadius: 22, backgroundColor: '#E8EFEB', alignItems: 'center', justifyContent: 'center' },
  pickerContent: { padding: 18, paddingBottom: 30, gap: 16 },
  pickerList: { backgroundColor: appColours.card, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, overflow: 'hidden' },
  pickerRow: { minHeight: 82, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E9E5' },
  pickerRowActive: { backgroundColor: '#F0FAF5' },
  pickerIcon: { height: 42, width: 42, borderRadius: 15, backgroundColor: '#E4F3ED', alignItems: 'center', justifyContent: 'center' },
  pickerIconActive: { backgroundColor: appColours.brand },
  pickerCopy: { flex: 1 },
  pickerTitle: { color: '#163B41', fontSize: 15, fontWeight: '700' },
  pickerBody: { color: '#5E777B', fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  manageButton: { minHeight: 54, backgroundColor: '#E2F2EB', borderRadius: 16, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  manageButtonText: { flex: 1, color: appColours.brand, fontSize: 15, fontWeight: '700' },
});

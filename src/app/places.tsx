import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import {
  fetchCouncilAddresses,
  isUkPostcode,
  lookupNearestPostcode,
  lookupPostcode,
  ResolvedPlace,
} from '@/lib/council-provider';
import { appFonts } from '@/lib/design-system';
import { AppTheme, useAppTheme } from '@/lib/theme';
import { getDeviceCoordinates } from '@/lib/device-location';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import { shareSavedPlace } from '@/lib/schedule-tools';
import { CouncilAddressOption, SavedAddress } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';

type AddressChoice = {
  place: ResolvedPlace;
  addresses: CouncilAddressOption[];
};

function savedPlaceSummary(address: SavedAddress) {
  return address.line1.trim().toLowerCase() === address.councilName.trim().toLowerCase()
    ? address.postcode
    : `${address.line1} · ${address.postcode}`;
}

export default function PlacesScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const params = useLocalSearchParams<{ postcode?: string }>();
  const { addresses, activeAddress, addAddress, removeAddress, setActiveAddress, refreshCollections, refreshing } = useAppData();
  const initialPostcode = typeof params.postcode === 'string' ? params.postcode : '';
  const initialLookupHandled = useRef(false);
  const [postcode, setPostcode] = useState(initialPostcode);
  const [lookupMode, setLookupMode] = useState<'postcode' | 'location'>();
  const [showAdd, setShowAdd] = useState(false);
  const [addressChoice, setAddressChoice] = useState<AddressChoice>();
  const [selectingAddressId, setSelectingAddressId] = useState<string>();
  const [resolvingExactAddress, setResolvingExactAddress] = useState(false);
  const exactAddressRequired = activeAddress
    ? requiresExactCouncilAddress(activeAddress.providerId, activeAddress.councilAddressId)
    : false;
  const showPostcodeForm = showAdd || addresses.length === 0;

  async function saveResolvedPlace(result: ResolvedPlace, exactAddress?: CouncilAddressOption) {
    if (result.providerId === 'lad-e08000011' && !exactAddress) {
      throw new Error('Choose your exact Knowsley address so the council can identify the correct collection round.');
    }
    const outcome = await addAddress({
      label: addresses.length === 0 ? 'Home' : result.councilName ?? 'Saved place',
      line1: exactAddress?.line1 ?? result.line1,
      postcode: exactAddress?.postcode ?? result.postcode,
      councilName: result.councilName ?? 'Council not matched',
      providerId: result.providerId ?? 'unconnected',
      councilAddressId: exactAddress?.id,
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setPostcode('');
    setShowAdd(false);
    setAddressChoice(undefined);
    Alert.alert(
      outcome.verified ? 'Collection dates updated' : 'Place found',
      outcome.verified
        ? `${exactAddress?.postcode ?? result.postcode} is now active. ${outcome.message}`
        : `${exactAddress?.postcode ?? result.postcode} is now active. No collection date will be shown until its council source returns a verified result. ${outcome.message}`,
    );
  }

  async function continueWithResolvedPlace(result: ResolvedPlace) {
    if (result.providerId && result.providerId !== 'unconnected') {
      const councilAddresses = await fetchCouncilAddresses(result.postcode, result.providerId);
      if (councilAddresses.length === 1) {
        await saveResolvedPlace(result, councilAddresses[0]);
        return;
      }
      if (councilAddresses.length > 1) {
        setAddressChoice({ place: result, addresses: councilAddresses });
        setShowAdd(false);
        return;
      }
    }
    await saveResolvedPlace(result);
  }

  async function addPlace(postcodeValue = postcode) {
    if (!isUkPostcode(postcodeValue)) {
      Alert.alert('Add a full postcode', 'Enter a postcode such as M1 1AE to find its local authority.');
      return;
    }
    setLookupMode('postcode');
    try {
      const result = await lookupPostcode(postcodeValue);
      await continueWithResolvedPlace(result);
    } catch (error) {
      Alert.alert('Could not add this place', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setLookupMode(undefined);
    }
  }

  useEffect(() => {
    if (initialLookupHandled.current || !initialPostcode || !isUkPostcode(initialPostcode)) return;
    initialLookupHandled.current = true;
    setShowAdd(true);
    void addPlace(initialPostcode);
    // The incoming postcode is a one-time continuation from Today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPostcode]);

  function confirmRemoveAddress(address: SavedAddress) {
    Alert.alert(
      `Remove ${address.label}?`,
      `${address.line1} and its saved collection dates will be removed from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeAddress(address.id) },
      ],
    );
  }

  async function useCurrentLocation() {
    setLookupMode('location');
    try {
      const coordinates = await getDeviceCoordinates();
      const result = await lookupNearestPostcode(coordinates.latitude, coordinates.longitude);
      await continueWithResolvedPlace(result);
    } catch (error) {
      Alert.alert('Could not use your location', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setLookupMode(undefined);
    }
  }

  async function selectExactAddress(address: CouncilAddressOption) {
    if (!addressChoice) return;
    setSelectingAddressId(address.id);
    try {
      await saveResolvedPlace(addressChoice.place, address);
    } catch (error) {
      Alert.alert('Could not check this address', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setSelectingAddressId(undefined);
    }
  }

  async function refreshOrCompleteAddress() {
    if (!activeAddress) return;
    if (!exactAddressRequired) {
      await refreshCollections();
      return;
    }
    setResolvingExactAddress(true);
    try {
      await continueWithResolvedPlace({
        postcode: activeAddress.postcode,
        line1: activeAddress.line1,
        councilName: activeAddress.councilName,
        providerId: activeAddress.providerId,
        latitude: activeAddress.latitude,
        longitude: activeAddress.longitude,
      });
    } catch (error) {
      Alert.alert('Could not find this property', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setResolvingExactAddress(false);
    }
  }

  return (
    <>
      <AppShell activeRoute="/settings">
        <RouteHead
          title="Manage Places"
          description="Add, choose or remove saved addresses used for verified UK bin collection dates."
          path="/places"
        />
        <View style={styles.page}>
          <SafeAreaView edges={['top']} style={styles.safe}>
            <Text style={styles.kicker}>Addresses</Text>
            <Text style={styles.title}>Manage places</Text>
            <Text style={styles.subtitle}>Choose the addresses whose live council dates you want to keep.</Text>
          </SafeAreaView>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityLabel="Use my current location"
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(lookupMode) }}
              disabled={Boolean(lookupMode)}
              onPress={useCurrentLocation}
              style={({ pressed }) => [styles.locationCard, pressed && styles.pressed, lookupMode && styles.disabled]}>
              <View style={styles.locationIcon}>
                {lookupMode === 'location'
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Ionicons color="#FFFFFF" name="locate" size={21} />}
              </View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationTitle}>{lookupMode === 'location' ? 'Finding your postcode…' : 'Use my current location'}</Text>
                <Text style={styles.locationBody}>Find your postcode and local council automatically.</Text>
              </View>
              <Ionicons color={theme.heroSecondary} name="arrow-forward" size={18} />
            </Pressable>

            {showPostcodeForm ? (
              <View style={styles.addPanel}>
                <View style={styles.addHeader}>
                  <View style={styles.addHeaderCopy}>
                    <Text style={styles.addTitle}>{addresses.length === 0 ? 'Enter your postcode' : 'Add a new place'}</Text>
                    <Text style={styles.addDescription}>Find the council, then choose your exact property where required.</Text>
                  </View>
                  {addresses.length > 0 && <Pressable accessibilityLabel="Close add place form" accessibilityRole="button" onPress={() => setShowAdd(false)} hitSlop={8}><Ionicons color={theme.secondaryText} name="close" size={20} /></Pressable>}
                </View>
                <Text style={styles.fieldLabel}>UK postcode</Text>
                <TextInput accessibilityLabel="UK postcode" autoCapitalize="characters" autoCorrect={false} onSubmitEditing={() => void addPlace()} placeholder="e.g. M1 1AE" placeholderTextColor={theme.tertiaryText} returnKeyType="search" value={postcode} onChangeText={setPostcode} style={styles.input} />
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(lookupMode) }} disabled={Boolean(lookupMode)} onPress={() => void addPlace()} style={({ pressed }) => [styles.addButton, pressed && styles.pressed, lookupMode && styles.disabled]}>
                  {lookupMode === 'postcode' ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.addButtonText}>Find my collection dates</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={18} /></>}
                </Pressable>
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setShowAdd(true)} style={({ pressed }) => [styles.newPlace, pressed && styles.pressed]}>
                <View style={styles.plus}><Ionicons color={theme.accent} name="add" size={22} /></View>
                <View><Text style={styles.newPlaceTitle}>Add another place</Text><Text style={styles.newPlaceCopy}>Use a UK postcode</Text></View>
              </Pressable>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Saved places</Text>
              <Text style={styles.count}>{addresses.length} {addresses.length === 1 ? 'place' : 'places'}</Text>
            </View>
            <View style={styles.placeList}>
              {addresses.length === 0 ? (
                <View style={styles.emptyPlaces}>
                  <Ionicons color={theme.accent} name="location-outline" size={22} />
                  <View style={styles.emptyPlacesCopy}>
                    <Text style={styles.emptyPlacesTitle}>No saved address yet</Text>
                    <Text style={styles.emptyPlacesBody}>Enter your postcode above or use your current location.</Text>
                  </View>
                </View>
              ) : addresses.map((address, index) => {
                const active = address.id === activeAddress?.id;
                return (
                  <ReanimatedSwipeable
                    friction={2}
                    key={address.id}
                    overshootRight={false}
                    renderRightActions={() => (
                      <Pressable
                        accessibilityLabel={`Remove ${address.label}`}
                        accessibilityRole="button"
                        onPress={() => confirmRemoveAddress(address)}
                        style={({ pressed }) => [styles.removeAction, pressed && styles.removeActionPressed]}>
                        <Ionicons color="#FFFFFF" name="trash-outline" size={21} />
                        <Text style={styles.removeActionText}>Remove</Text>
                      </Pressable>
                    )}
                    rightThreshold={44}>
                    <Pressable accessibilityLabel={`Use ${address.label}, ${address.postcode}`} accessibilityHint="Swipe left to reveal the remove action" accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setActiveAddress(address.id)} style={({ pressed }) => [styles.placeCard, index !== addresses.length - 1 && styles.placeBorder, active && styles.placeActive, pressed && styles.pressed]}>
                      <View style={[styles.homeIcon, active && styles.homeIconActive]}><Ionicons color={active ? theme.heroText : theme.accent} name={active ? 'home' : 'home-outline'} size={20} /></View>
                      <View style={styles.placeCopy}>
                        <View style={styles.labelRow}><Text style={styles.placeLabel}>{address.label}</Text>{active && <View style={styles.activePill}><Text style={styles.activePillText}>Active</Text></View>}</View>
                        <Text style={styles.placeAddress}>{savedPlaceSummary(address)}</Text>
                        <Text style={styles.council}>{address.councilName}</Text>
                      </View>
                      {active ? <Ionicons color={theme.accent} name="checkmark-circle" size={22} /> : <Ionicons color={theme.tertiaryText} name="chevron-forward" size={19} />}
                    </Pressable>
                  </ReanimatedSwipeable>
                );
              })}
            </View>
            {addresses.length > 0 && <View style={styles.swipeHint}><Ionicons color={theme.secondaryText} name="swap-horizontal-outline" size={15} /><Text style={styles.swipeHintText}>Swipe an address left to remove it.</Text></View>}

            <Pressable accessibilityRole="button" accessibilityState={{ disabled: refreshing || resolvingExactAddress || !activeAddress }} onPress={refreshOrCompleteAddress} disabled={refreshing || resolvingExactAddress || !activeAddress} style={({ pressed }) => [styles.syncCard, pressed && styles.pressed, (refreshing || resolvingExactAddress || !activeAddress) && styles.disabled]}>
              {refreshing || resolvingExactAddress ? <ActivityIndicator color={theme.accent} /> : <Ionicons color={theme.accent} name={exactAddressRequired ? 'home-outline' : 'cloud-download-outline'} size={22} />}
              <View style={styles.syncCopy}>
                <Text style={styles.syncTitle}>{resolvingExactAddress ? 'Finding your property…' : refreshing ? 'Checking your source…' : exactAddressRequired ? 'Choose exact address' : 'Refresh collection dates'}</Text>
                <Text style={styles.syncBody}>{exactAddressRequired ? 'Required to match your property to the correct collection round.' : 'Uses the selected place and its council provider.'}</Text>
              </View>
              <Ionicons color={theme.accent} name="arrow-forward" size={17} />
            </Pressable>
            {activeAddress ? (
              <Pressable accessibilityRole="button" onPress={() => void shareSavedPlace(activeAddress)} style={({ pressed }) => [styles.sharePlace, pressed && styles.pressed]}>
                <Ionicons color={theme.accent} name="share-outline" size={20} />
                <View style={styles.syncCopy}>
                  <Text style={styles.sharePlaceTitle}>Share this place</Text>
                  <Text style={styles.sharePlaceBody}>Send the selected address and council to another household member.</Text>
                </View>
                <Ionicons color={theme.tertiaryText} name="chevron-forward" size={17} />
              </Pressable>
            ) : null}

            <View style={styles.note}><Ionicons color={theme.secondaryText} name="shield-checkmark-outline" size={17} /><Text style={styles.noteText}>Your location is used once to find the nearest postcode and is not tracked. Your selected address stays on this device. Collection dates are shown only when returned by the council source.</Text></View>
          </ScrollView>
        </View>
      </AppShell>

      <Modal animationType="slide" onRequestClose={() => setAddressChoice(undefined)} presentationStyle="pageSheet" visible={Boolean(addressChoice)}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.addressModal}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalKicker}>Exact property required</Text>
              <Text style={styles.modalTitle}>Choose your address</Text>
              <Text style={styles.modalBody}>A postcode can contain many collection rounds. Select the property the council should check for {addressChoice?.place.postcode}.</Text>
            </View>
            <Pressable accessibilityLabel="Close address list" accessibilityRole="button" hitSlop={8} onPress={() => setAddressChoice(undefined)} style={styles.modalClose}>
              <Ionicons color={theme.text} name="close" size={21} />
            </Pressable>
          </View>
          <FlatList
            contentContainerStyle={styles.addressList}
            data={addressChoice?.addresses ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                accessibilityLabel={`Use ${item.line1}`}
                accessibilityRole="button"
                disabled={Boolean(selectingAddressId)}
                onPress={() => selectExactAddress(item)}
                style={({ pressed }) => [styles.addressOption, pressed && styles.pressed, selectingAddressId && styles.disabled]}>
                <View style={styles.addressOptionIcon}><Ionicons color={theme.accent} name="home-outline" size={19} /></View>
                <View style={styles.addressOptionCopy}>
                  <Text style={styles.addressOptionTitle}>{item.line1}</Text>
                  <Text style={styles.addressOptionPostcode}>{item.postcode}</Text>
                </View>
                {selectingAddressId === item.id
                  ? <ActivityIndicator color={theme.accent} />
                  : <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  safe: { backgroundColor: theme.surface, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 22 },
  kicker: { color: theme.accent, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.6, fontWeight: '700' },
  title: { color: theme.text, fontFamily: appFonts.display, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1.05, marginTop: 3 },
  subtitle: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 18, marginTop: 7, maxWidth: 310, fontWeight: '500' },
  content: { padding: 18, paddingBottom: 120, gap: 17 },
  locationCard: { minHeight: 79, borderRadius: 16, paddingHorizontal: 15, backgroundColor: theme.hero, flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationIcon: { height: 42, width: 42, borderRadius: 15, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1 },
  locationTitle: { color: theme.heroText, fontSize: 14, fontWeight: '700' },
  locationBody: { color: theme.heroSecondary, fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 },
  sectionTitle: { color: theme.text, fontSize: 14, fontWeight: '800' },
  count: { color: theme.secondaryText, fontSize: 12, fontWeight: '700' },
  placeList: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, overflow: 'hidden' },
  emptyPlaces: { minHeight: 84, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyPlacesCopy: { flex: 1 },
  emptyPlacesTitle: { color: theme.text, fontSize: 13.5, fontWeight: '700' },
  emptyPlacesBody: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  placeCard: { minHeight: 91, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  placeActive: { backgroundColor: theme.accentSoft },
  homeIcon: { height: 42, width: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft },
  homeIconActive: { backgroundColor: theme.accent },
  placeCopy: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  placeLabel: { color: theme.text, fontSize: 14.5, fontWeight: '700', letterSpacing: -0.15 },
  activePill: { backgroundColor: theme.accentSoft, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  activePillText: { color: theme.accent, fontSize: 12, fontWeight: '700' },
  placeAddress: { color: theme.secondaryText, fontSize: 12.5, marginTop: 4, fontWeight: '600' },
  council: { color: theme.secondaryText, fontSize: 12, marginTop: 3 },
  removeAction: { width: 92, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: theme.danger },
  removeActionPressed: { backgroundColor: theme.danger, opacity: 0.86 },
  removeActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8, paddingHorizontal: 4 },
  swipeHintText: { color: theme.secondaryText, fontSize: 12, fontWeight: '600' },
  syncCard: { borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: theme.accentSoft },
  syncCopy: { flex: 1 },
  syncTitle: { color: theme.text, fontSize: 13.5, fontWeight: '700' },
  syncBody: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: '500' },
  sharePlace: { minHeight: 62, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sharePlaceTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
  sharePlaceBody: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 2 },
  addPanel: { backgroundColor: theme.surface, padding: 17, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, gap: 12 },
  addHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  addHeaderCopy: { flex: 1 },
  addTitle: { color: theme.text, fontFamily: appFonts.display, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.4 },
  addDescription: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  fieldLabel: { color: theme.secondaryText, fontSize: 12, letterSpacing: 0.5, fontWeight: '700', marginTop: 5 },
  input: { height: 47, borderRadius: 12, borderWidth: 1, borderColor: theme.separator, color: theme.text, paddingHorizontal: 13, backgroundColor: theme.elevated, fontSize: 15, fontWeight: '700' },
  addButton: { height: 46, borderRadius: 13, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 2 },
  addButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  newPlace: { minHeight: 79, borderRadius: 14, borderWidth: 1.5, borderColor: theme.separator, borderStyle: 'dashed', alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 15 },
  plus: { height: 37, width: 37, borderRadius: 13, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  newPlaceTitle: { color: theme.text, fontSize: 13.5, fontWeight: '700' },
  newPlaceCopy: { color: theme.secondaryText, fontSize: 12.5, marginTop: 3 },
  note: { paddingHorizontal: 5, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteText: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, flex: 1 },
  addressModal: { flex: 1, backgroundColor: theme.background },
  modalHeader: { backgroundColor: theme.surface, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.separator },
  modalHeaderCopy: { flex: 1 },
  modalKicker: { color: theme.accent, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.6, fontWeight: '700' },
  modalTitle: { color: theme.text, fontFamily: appFonts.display, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8, marginTop: 3 },
  modalBody: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 7, maxWidth: 320 },
  modalClose: { height: 36, width: 36, borderRadius: 18, backgroundColor: theme.elevated, alignItems: 'center', justifyContent: 'center' },
  addressList: { padding: 16, paddingBottom: 30 },
  addressOption: { minHeight: 70, backgroundColor: theme.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, marginBottom: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  addressOptionIcon: { height: 39, width: 39, borderRadius: 13, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  addressOptionCopy: { flex: 1 },
  addressOptionTitle: { color: theme.text, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  addressOptionPostcode: { color: theme.secondaryText, fontSize: 12, marginTop: 3, fontWeight: '600' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
  });
}

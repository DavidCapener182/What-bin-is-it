import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import {
  fetchCouncilAddresses,
  isUkPostcode,
  lookupNearestPostcode,
  lookupPostcode,
  ResolvedPlace,
} from '@/lib/council-provider';
import { councilDirectoryCounts } from '@/lib/council-directory';
import { getDeviceCoordinates } from '@/lib/device-location';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
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
  const { addresses, activeAddress, addAddress, removeAddress, setActiveAddress, refreshCollections, refreshing } = useAppData();
  const [postcode, setPostcode] = useState('');
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

  async function addPlace() {
    if (!isUkPostcode(postcode)) {
      Alert.alert('Add a full postcode', 'Enter a postcode such as M1 1AE to find its local authority.');
      return;
    }
    setLookupMode('postcode');
    try {
      const result = await lookupPostcode(postcode);
      await continueWithResolvedPlace(result);
    } catch (error) {
      Alert.alert('Could not add this place', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setLookupMode(undefined);
    }
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
      <AppShell activeRoute="/places">
        <View style={styles.page}>
          <SafeAreaView edges={['top']} style={styles.safe}>
            <Text style={styles.kicker}>YOUR ADDRESSES</Text>
            <Text style={styles.title}>Places</Text>
            <Text style={styles.subtitle}>Home, family, or that one friend who always forgets bin day.</Text>
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
              <Ionicons color="#A9DDCA" name="arrow-forward" size={18} />
            </Pressable>

            {showPostcodeForm ? (
              <View style={styles.addPanel}>
                <View style={styles.addHeader}>
                  <View>
                    <Text style={styles.addTitle}>{addresses.length === 0 ? 'Enter your postcode' : 'Add a new place'}</Text>
                    <Text style={styles.addDescription}>Find the council, then choose your exact property where required.</Text>
                  </View>
                  {addresses.length > 0 && <Pressable accessibilityLabel="Close add place form" accessibilityRole="button" onPress={() => setShowAdd(false)} hitSlop={8}><Ionicons color="#5D777B" name="close" size={20} /></Pressable>}
                </View>
                <Text style={styles.fieldLabel}>UK POSTCODE</Text>
                <TextInput accessibilityLabel="UK postcode" autoCapitalize="characters" autoCorrect={false} onSubmitEditing={addPlace} placeholder="e.g. M1 1AE" placeholderTextColor="#90A1A1" returnKeyType="search" value={postcode} onChangeText={setPostcode} style={styles.input} />
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(lookupMode) }} disabled={Boolean(lookupMode)} onPress={addPlace} style={({ pressed }) => [styles.addButton, pressed && styles.pressed, lookupMode && styles.disabled]}>
                  {lookupMode === 'postcode' ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.addButtonText}>Find my collection dates</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={18} /></>}
                </Pressable>
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setShowAdd(true)} style={({ pressed }) => [styles.newPlace, pressed && styles.pressed]}>
                <View style={styles.plus}><Ionicons color="#0D756A" name="add" size={22} /></View>
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
                  <Ionicons color="#0E756B" name="location-outline" size={22} />
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
                        onPress={() => removeAddress(address.id)}
                        style={({ pressed }) => [styles.removeAction, pressed && styles.removeActionPressed]}>
                        <Ionicons color="#FFFFFF" name="trash-outline" size={21} />
                        <Text style={styles.removeActionText}>Remove</Text>
                      </Pressable>
                    )}
                    rightThreshold={44}>
                    <Pressable accessibilityLabel={`Use ${address.label}, ${address.postcode}`} accessibilityHint="Swipe left to reveal the remove action" accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setActiveAddress(address.id)} style={({ pressed }) => [styles.placeCard, index !== addresses.length - 1 && styles.placeBorder, active && styles.placeActive, pressed && styles.pressed]}>
                      <View style={[styles.homeIcon, active && styles.homeIconActive]}><Ionicons color={active ? '#E8FFF5' : '#0E756B'} name={active ? 'home' : 'home-outline'} size={20} /></View>
                      <View style={styles.placeCopy}>
                        <View style={styles.labelRow}><Text style={styles.placeLabel}>{address.label}</Text>{active && <View style={styles.activePill}><Text style={styles.activePillText}>ACTIVE</Text></View>}</View>
                        <Text style={styles.placeAddress}>{savedPlaceSummary(address)}</Text>
                        <Text style={styles.council}>{address.councilName}</Text>
                      </View>
                      {active ? <Ionicons color="#0E756B" name="checkmark-circle" size={22} /> : <Ionicons color="#8AA0A1" name="chevron-forward" size={19} />}
                    </Pressable>
                  </ReanimatedSwipeable>
                );
              })}
            </View>
            {addresses.length > 0 && <View style={styles.swipeHint}><Ionicons color="#748B8C" name="swap-horizontal-outline" size={15} /><Text style={styles.swipeHintText}>Swipe an address left to remove it.</Text></View>}

            <Pressable accessibilityRole="button" accessibilityState={{ disabled: refreshing || resolvingExactAddress || !activeAddress }} onPress={refreshOrCompleteAddress} disabled={refreshing || resolvingExactAddress || !activeAddress} style={({ pressed }) => [styles.syncCard, pressed && styles.pressed, (refreshing || resolvingExactAddress || !activeAddress) && styles.disabled]}>
              {refreshing || resolvingExactAddress ? <ActivityIndicator color="#0B7168" /> : <Ionicons color="#0B7168" name={exactAddressRequired ? 'home-outline' : 'cloud-download-outline'} size={22} />}
              <View style={styles.syncCopy}>
                <Text style={styles.syncTitle}>{resolvingExactAddress ? 'Finding your property…' : refreshing ? 'Checking your source…' : exactAddressRequired ? 'Choose exact address' : 'Refresh collection dates'}</Text>
                <Text style={styles.syncBody}>{exactAddressRequired ? 'Required to match your property to the correct collection round.' : 'Uses the selected place and its council provider.'}</Text>
              </View>
              <Ionicons color="#0B7168" name="arrow-forward" size={17} />
            </Pressable>

            <View style={styles.directoryCard}>
              <View style={styles.directoryIcon}><Ionicons color="#926023" name="map-outline" size={19} /></View>
              <View style={styles.directoryCopy}><Text style={styles.directoryTitle}>UK council directory</Text><Text style={styles.directoryBody}>{councilDirectoryCounts.England + councilDirectoryCounts.Scotland + councilDirectoryCounts.Wales + councilDirectoryCounts['Northern Ireland']} local authorities mapped from your postcode.</Text></View>
            </View>

            <View style={styles.note}><Ionicons color="#648485" name="shield-checkmark-outline" size={17} /><Text style={styles.noteText}>Your location is used once to find the nearest postcode and is not tracked. Your selected address stays on this device. Collection dates are shown only when returned by the council source.</Text></View>
          </ScrollView>
        </View>
      </AppShell>

      <Modal animationType="slide" onRequestClose={() => setAddressChoice(undefined)} presentationStyle="pageSheet" visible={Boolean(addressChoice)}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.addressModal}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalKicker}>EXACT PROPERTY REQUIRED</Text>
              <Text style={styles.modalTitle}>Choose your address</Text>
              <Text style={styles.modalBody}>A postcode can contain many collection rounds. Select the property the council should check for {addressChoice?.place.postcode}.</Text>
            </View>
            <Pressable accessibilityLabel="Close address list" accessibilityRole="button" hitSlop={8} onPress={() => setAddressChoice(undefined)} style={styles.modalClose}>
              <Ionicons color="#335B5D" name="close" size={21} />
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
                <View style={styles.addressOptionIcon}><Ionicons color="#0D756A" name="home-outline" size={19} /></View>
                <View style={styles.addressOptionCopy}>
                  <Text style={styles.addressOptionTitle}>{item.line1}</Text>
                  <Text style={styles.addressOptionPostcode}>{item.postcode}</Text>
                </View>
                {selectingAddressId === item.id
                  ? <ActivityIndicator color="#0D756A" />
                  : <Ionicons color="#789092" name="chevron-forward" size={18} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F4EE' },
  safe: { backgroundColor: '#FFFFFF', paddingTop: 14, paddingHorizontal: 20, paddingBottom: 22 },
  kicker: { color: '#1D7A70', fontSize: 10, letterSpacing: 1.55, fontWeight: '900' },
  title: { color: '#14323B', fontFamily: 'Georgia', fontSize: 30, letterSpacing: -0.8, marginTop: 6 },
  subtitle: { color: '#627B7E', fontSize: 12.5, lineHeight: 18, marginTop: 7, maxWidth: 310, fontWeight: '500' },
  content: { padding: 18, paddingBottom: 120, gap: 17 },
  locationCard: { minHeight: 79, borderRadius: 19, paddingHorizontal: 15, backgroundColor: '#174D49', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#142329', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  locationIcon: { height: 42, width: 42, borderRadius: 15, backgroundColor: '#0D8375', alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1 },
  locationTitle: { color: '#F4FFF9', fontSize: 14, fontWeight: '900' },
  locationBody: { color: '#B9DACE', fontSize: 11, lineHeight: 15, marginTop: 3, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 },
  sectionTitle: { color: '#2A4A50', fontSize: 14, fontWeight: '800' },
  count: { color: '#7C9192', fontSize: 11.5, fontWeight: '700' },
  placeList: { backgroundColor: '#FFFFFF', borderRadius: 19, overflow: 'hidden', shadowColor: '#1B363A', shadowOpacity: 0.07, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  emptyPlaces: { minHeight: 84, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyPlacesCopy: { flex: 1 },
  emptyPlacesTitle: { color: '#1B3B42', fontSize: 13.5, fontWeight: '900' },
  emptyPlacesBody: { color: '#728789', fontSize: 11, marginTop: 4 },
  placeCard: { minHeight: 91, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4EBE6' },
  placeActive: { backgroundColor: '#F2FBF6' },
  homeIcon: { height: 42, width: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4F3ED' },
  homeIconActive: { backgroundColor: '#0B7469' },
  placeCopy: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  placeLabel: { color: '#1B3B42', fontSize: 14.5, fontWeight: '900' },
  activePill: { backgroundColor: '#D2F0DF', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  activePillText: { color: '#0A6D55', fontSize: 8, letterSpacing: 0.7, fontWeight: '900' },
  placeAddress: { color: '#657D80', fontSize: 11.5, marginTop: 4, fontWeight: '600' },
  council: { color: '#7B9292', fontSize: 10.5, marginTop: 3 },
  removeAction: { width: 92, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#B4413B' },
  removeActionPressed: { backgroundColor: '#94342F' },
  removeActionText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8, paddingHorizontal: 4 },
  swipeHintText: { color: '#748B8C', fontSize: 10.5, fontWeight: '600' },
  syncCard: { borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#E3F3EB' },
  syncCopy: { flex: 1 },
  syncTitle: { color: '#174247', fontSize: 13.5, fontWeight: '900' },
  syncBody: { color: '#5C7C7C', fontSize: 11, marginTop: 3, fontWeight: '500' },
  directoryCard: { borderRadius: 17, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FAEEDC' },
  directoryIcon: { height: 36, width: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  directoryCopy: { flex: 1 },
  directoryTitle: { color: '#573C1E', fontSize: 13.5, fontWeight: '900' },
  directoryBody: { color: '#866841', fontSize: 10.5, marginTop: 3, lineHeight: 14, fontWeight: '600' },
  addPanel: { backgroundColor: '#FFFFFF', padding: 17, borderRadius: 19, gap: 12, shadowColor: '#1B363A', shadowOpacity: 0.07, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  addHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  addTitle: { color: '#14383E', fontFamily: 'Georgia', fontSize: 19 },
  addDescription: { color: '#738789', fontSize: 11.5, marginTop: 4 },
  fieldLabel: { color: '#547677', fontSize: 9, letterSpacing: 1.25, fontWeight: '900', marginTop: 5 },
  input: { height: 47, borderRadius: 12, borderWidth: 1, borderColor: '#D7E1DB', color: '#163C40', paddingHorizontal: 13, backgroundColor: '#FBFCFA', fontSize: 15, fontWeight: '700' },
  addButton: { height: 46, borderRadius: 13, backgroundColor: '#0B7469', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 2 },
  addButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '900' },
  newPlace: { minHeight: 79, borderRadius: 18, borderWidth: 1.5, borderColor: '#B7D3C7', borderStyle: 'dashed', alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 15 },
  plus: { height: 37, width: 37, borderRadius: 13, backgroundColor: '#DDF0E7', alignItems: 'center', justifyContent: 'center' },
  newPlaceTitle: { color: '#1A4549', fontSize: 13.5, fontWeight: '900' },
  newPlaceCopy: { color: '#6C8587', fontSize: 11.5, marginTop: 3 },
  note: { paddingHorizontal: 5, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteText: { color: '#718585', fontSize: 10.5, lineHeight: 15, flex: 1 },
  addressModal: { flex: 1, backgroundColor: '#F4F4EE' },
  modalHeader: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E5ECE7' },
  modalHeaderCopy: { flex: 1 },
  modalKicker: { color: '#1D7A70', fontSize: 9.5, letterSpacing: 1.4, fontWeight: '900' },
  modalTitle: { color: '#14323B', fontFamily: 'Georgia', fontSize: 28, letterSpacing: -0.7, marginTop: 5 },
  modalBody: { color: '#667F81', fontSize: 11.5, lineHeight: 16, marginTop: 7, maxWidth: 320 },
  modalClose: { height: 36, width: 36, borderRadius: 18, backgroundColor: '#EDF3EF', alignItems: 'center', justifyContent: 'center' },
  addressList: { padding: 16, paddingBottom: 30 },
  addressOption: { minHeight: 70, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#17353A', shadowOpacity: 0.05, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  addressOptionIcon: { height: 39, width: 39, borderRadius: 13, backgroundColor: '#E3F2EC', alignItems: 'center', justifyContent: 'center' },
  addressOptionCopy: { flex: 1 },
  addressOptionTitle: { color: '#173D43', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  addressOptionPostcode: { color: '#72888A', fontSize: 10.5, marginTop: 3, fontWeight: '600' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
});

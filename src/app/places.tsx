import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import {
  isUkPostcode,
  lookupNearestPostcode,
  lookupPostcode,
  ResolvedPlace,
} from '@/lib/council-provider';
import { councilDirectoryCounts } from '@/lib/council-directory';
import { getDeviceCoordinates } from '@/lib/device-location';
import { useAppData } from '@/lib/use-app-data';

export default function PlacesScreen() {
  const { addresses, activeAddress, addAddress, setActiveAddress, refreshCollections, refreshing } = useAppData();
  const [postcode, setPostcode] = useState('');
  const [lookupMode, setLookupMode] = useState<'postcode' | 'location'>();
  const [showAdd, setShowAdd] = useState(false);

  async function saveResolvedPlace(result: ResolvedPlace) {
    const outcome = await addAddress({
      label: result.councilName ?? 'New place',
      line1: result.line1,
      postcode: result.postcode,
      councilName: result.councilName ?? 'Council not matched',
      providerId: result.providerId ?? 'unconnected',
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setPostcode('');
    setShowAdd(false);
    Alert.alert(
      outcome.verified ? 'Collection dates updated' : 'Place found',
      outcome.verified
        ? `${result.postcode} is now active. ${outcome.message}`
        : `${result.postcode} is now active and any dates from your previous place have been cleared. ${outcome.message}`,
    );
  }

  async function addPlace() {
    if (!isUkPostcode(postcode)) {
      Alert.alert('Add a full postcode', 'Enter a postcode such as M1 1AE to find its local authority.');
      return;
    }
    setLookupMode('postcode');
    try {
      const result = await lookupPostcode(postcode);
      await saveResolvedPlace(result);
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
      await saveResolvedPlace(result);
    } catch (error) {
      Alert.alert('Could not use your location', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setLookupMode(undefined);
    }
  }

  return (
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

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved places</Text>
            <Text style={styles.count}>{addresses.length} {addresses.length === 1 ? 'place' : 'places'}</Text>
          </View>
          <View style={styles.placeList}>
            {addresses.map((address, index) => {
              const active = address.id === activeAddress?.id;
              return (
                <Pressable accessibilityLabel={`Use ${address.label}, ${address.postcode}`} accessibilityRole="button" accessibilityState={{ selected: active }} key={address.id} onPress={() => setActiveAddress(address.id)} style={({ pressed }) => [styles.placeCard, index !== addresses.length - 1 && styles.placeBorder, active && styles.placeActive, pressed && styles.pressed]}>
                  <View style={[styles.homeIcon, active && styles.homeIconActive]}><Ionicons color={active ? '#E8FFF5' : '#0E756B'} name={active ? 'home' : 'home-outline'} size={20} /></View>
                  <View style={styles.placeCopy}>
                    <View style={styles.labelRow}><Text style={styles.placeLabel}>{address.label}</Text>{active && <View style={styles.activePill}><Text style={styles.activePillText}>ACTIVE</Text></View>}</View>
                    <Text style={styles.placeAddress}>{address.line1} · {address.postcode}</Text>
                    <Text style={styles.council}>{address.councilName}</Text>
                  </View>
                  {active ? <Ionicons color="#0E756B" name="checkmark-circle" size={22} /> : <Ionicons color="#8AA0A1" name="chevron-forward" size={19} />}
                </Pressable>
              );
            })}
          </View>

          <Pressable accessibilityRole="button" accessibilityState={{ disabled: refreshing }} onPress={refreshCollections} disabled={refreshing} style={({ pressed }) => [styles.syncCard, pressed && styles.pressed, refreshing && styles.disabled]}>
            {refreshing ? <ActivityIndicator color="#0B7168" /> : <Ionicons color="#0B7168" name="cloud-download-outline" size={22} />}
            <View style={styles.syncCopy}><Text style={styles.syncTitle}>{refreshing ? 'Checking your source…' : 'Refresh collection dates'}</Text><Text style={styles.syncBody}>Uses the selected place and its council provider.</Text></View>
            <Ionicons color="#0B7168" name="arrow-forward" size={17} />
          </Pressable>

          <View style={styles.directoryCard}>
            <View style={styles.directoryIcon}><Ionicons color="#926023" name="map-outline" size={19} /></View>
            <View style={styles.directoryCopy}><Text style={styles.directoryTitle}>UK council directory</Text><Text style={styles.directoryBody}>{councilDirectoryCounts.England + councilDirectoryCounts.Scotland + councilDirectoryCounts.Wales + councilDirectoryCounts['Northern Ireland']} local authorities mapped from your postcode.</Text></View>
          </View>

          {showAdd ? (
            <View style={styles.addPanel}>
              <View style={styles.addHeader}><View><Text style={styles.addTitle}>Add a new place</Text><Text style={styles.addDescription}>We use your postcode to find the local authority.</Text></View><Pressable accessibilityLabel="Close add place form" accessibilityRole="button" onPress={() => setShowAdd(false)} hitSlop={8}><Ionicons color="#5D777B" name="close" size={20} /></Pressable></View>
              <Text style={styles.fieldLabel}>UK POSTCODE</Text>
              <TextInput accessibilityLabel="UK postcode" autoCapitalize="characters" autoCorrect={false} onSubmitEditing={addPlace} placeholder="e.g. M1 1AE" placeholderTextColor="#90A1A1" returnKeyType="search" value={postcode} onChangeText={setPostcode} style={styles.input} />
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(lookupMode) }} disabled={Boolean(lookupMode)} onPress={addPlace} style={({ pressed }) => [styles.addButton, pressed && styles.pressed, lookupMode && styles.disabled]}>
                {lookupMode === 'postcode' ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.addButtonText}>Find this place</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={18} /></>}
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setShowAdd(true)} style={({ pressed }) => [styles.newPlace, pressed && styles.pressed]}>
              <View style={styles.plus}><Ionicons color="#0D756A" name="add" size={22} /></View>
              <View><Text style={styles.newPlaceTitle}>Add another place</Text><Text style={styles.newPlaceCopy}>Use a UK postcode</Text></View>
            </Pressable>
          )}

          <View style={styles.note}><Ionicons color="#648485" name="shield-checkmark-outline" size={17} /><Text style={styles.noteText}>Your location is used once to find the nearest postcode and is not tracked. Saved places stay on this device.</Text></View>
        </ScrollView>
      </View>
    </AppShell>
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
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
});

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { collectionMeta } from '@/lib/data';
import { fetchNearbyServices } from '@/lib/council-provider';
import { appColours, appFonts } from '@/lib/design-system';
import { GuideDestination, GuideItem, guideItemCount, searchGuide } from '@/lib/household-guide';
import { recyclingMaterialsLabel } from '@/lib/recycling-materials';
import { CouncilService } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';

type FindMode = 'guide' | 'services';

const destinationLabel: Record<GuideDestination, string> = {
  general: 'General waste', recycling: 'Mixed recycling', garden: 'Garden waste', food: 'Food caddy', other: 'Council bin', service: 'Find a service', check: 'Check locally',
};

function destinationColour(destination: GuideDestination) {
  if (destination === 'check') return { colour: '#A26B22', tint: '#F9EEDC' };
  if (destination === 'service') return { colour: '#7A4E92', tint: '#F0E6F5' };
  return collectionMeta[destination];
}

function GuideResult({ item, expanded, onPress }: { item: GuideItem; expanded: boolean; onPress: () => void }) {
  const colour = destinationColour(item.destination);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={({ pressed }) => [styles.guideItem, expanded && styles.guideItemOpen, pressed && styles.pressed]}>
      <View style={[styles.guideIcon, { backgroundColor: colour.tint }]}><Ionicons color={colour.colour} name={item.icon as keyof typeof Ionicons.glyphMap} size={22} /></View>
      <View style={styles.guideCopy}>
        <Text style={styles.guideName}>{item.name}</Text>
        <Text style={[styles.destination, { color: colour.colour }]}>{destinationLabel[item.destination]}</Text>
        {expanded && <><Text style={styles.guideHeading}>{item.heading}</Text><Text style={styles.guideDetail}>{item.detail}</Text><View style={styles.localNote}><Ionicons color="#638383" name="information-circle-outline" size={14} /><Text style={styles.localNoteText}>Rules vary by council — check before collection day.</Text></View></>}
      </View>
      <Ionicons color="#789092" name={expanded ? 'chevron-up' : 'chevron-down'} size={18} />
    </Pressable>
  );
}

function serviceIcon(type: CouncilService['type']) {
  if (type === 'recycling-centre') return 'car-outline';
  if (type === 'reuse') return 'heart-outline';
  if (type === 'collection') return 'cube-outline';
  return 'refresh-circle-outline';
}

function serviceTypeLabel(type: CouncilService['type']) {
  if (type === 'recycling-centre') return 'Household waste recycling centre';
  if (type === 'reuse') return 'Reuse service';
  if (type === 'collection') return 'Collection service';
  return 'Recycling point';
}

export default function FindScreen() {
  const { activeAddress } = useAppData();
  const [mode, setMode] = useState<FindMode>('guide');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | undefined>();
  const [services, setServices] = useState<CouncilService[] | undefined>();
  const [finding, setFinding] = useState(false);

  const results = searchGuide(query);

  async function findServices() {
    if (!activeAddress) return;
    setFinding(true);
    try {
      setServices(await fetchNearbyServices(activeAddress));
    } catch (error) {
      Alert.alert('Could not find local services', error instanceof Error ? error.message : 'Please try again in a moment.');
    } finally {
      setFinding(false);
    }
  }

  function openDirections(service: CouncilService) {
    const query = encodeURIComponent(`${service.latitude},${service.longitude}`);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  }

  return (
    <AppShell activeRoute="/find">
      <View style={styles.page}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <Text style={styles.kicker}>SORT IT OUT</Text>
          <Text style={styles.title}>What goes where?</Text>
          <Text style={styles.subtitle}>A little less guesswork on bin night.</Text>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.modePicker}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'guide' }} onPress={() => setMode('guide')} style={[styles.mode, mode === 'guide' && styles.modeActive]}><Ionicons color={mode === 'guide' ? appColours.brand : '#688184'} name="search-outline" size={17} /><Text style={[styles.modeText, mode === 'guide' && styles.modeTextActive]}>Bin guide</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'services' }} onPress={() => setMode('services')} style={[styles.mode, mode === 'services' && styles.modeActive]}><Ionicons color={mode === 'services' ? appColours.brand : '#688184'} name="map-outline" size={17} /><Text style={[styles.modeText, mode === 'services' && styles.modeTextActive]}>Local services</Text></Pressable>
          </View>

          {mode === 'guide' ? (
            <>
              <View style={styles.searchBox}><Ionicons color="#4A7475" name="search" size={19} /><TextInput autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" onChangeText={(value) => { setQuery(value); setSelected(undefined); }} placeholder={`Search ${guideItemCount}+ household items…`} placeholderTextColor="#8DA0A0" returnKeyType="search" style={styles.input} value={query} /></View>
              {!query && <View style={styles.chips}><Text style={styles.chipsLabel}>POPULAR</Text>{['Batteries', 'Pizza box', 'Vapes', 'Mattress'].map((chip) => <Pressable key={chip} onPress={() => setQuery(chip)} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></Pressable>)}</View>}
              <View style={styles.guideHeader}><View><Text style={styles.sectionKicker}>{query ? `${results.length} ${results.length === 1 ? 'MATCH' : 'MATCHES'}` : `${guideItemCount} ITEMS COVERED`}</Text><Text style={styles.sectionTitle}>{query ? 'Here’s the best route' : 'Common things at home'}</Text></View><View style={styles.checkPill}><Ionicons color="#9B6725" name="alert-circle-outline" size={14} /><Text style={styles.checkText}>CHECK LOCAL</Text></View></View>
              <View style={styles.guideList}>{results.map((item) => <GuideResult expanded={selected === item.id} item={item} key={item.id} onPress={() => setSelected(selected === item.id ? undefined : item.id)} />)}</View>
              {results.length === 0 && <View style={styles.empty}><Ionicons color="#729092" name="search-outline" size={28} /><Text style={styles.emptyTitle}>We don’t know that one yet</Text><Text style={styles.emptyText}>Try a shorter name, or use Local services for unusual, hazardous or bulky items.</Text></View>}
            </>
          ) : (
            <>
              <View style={styles.servicesHero}><View style={styles.servicesMark}><Ionicons color="#F9FFF8" name="location" size={23} /></View><View style={styles.servicesCopy}><Text style={styles.servicesTitle}>Council tips & drop-offs</Text><Text style={styles.servicesText}>Find recycling sites and household-waste services near your saved place.</Text></View></View>
              <View style={styles.locationLine}><Ionicons color="#0A746A" name="location-outline" size={18} /><View style={styles.locationCopy}><Text style={styles.locationLabel}>SEARCHING AROUND</Text><Text style={styles.locationName}>{activeAddress ? `${activeAddress.label} · ${activeAddress.postcode}` : 'Add a place first'}</Text></View></View>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: finding || !activeAddress }} disabled={finding || !activeAddress} onPress={findServices} style={({ pressed }) => [styles.findButton, pressed && styles.pressed, (finding || !activeAddress) && styles.disabled]}>{finding ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="locate" size={18} /><Text style={styles.findButtonText}>{services ? 'Search again' : 'Find nearby services'}</Text></>}</Pressable>
              <View style={styles.servicesNote}><Ionicons color="#657F81" name="information-circle-outline" size={16} /><Text style={styles.servicesNoteText}>The app asks only when you tap search. Council gateway results take priority; otherwise nearby OpenStreetMap sites are shown. Always check opening times and accepted waste before travelling.</Text></View>
              {services ? <View style={styles.serviceResults}>{services.length ? <><View style={styles.guideHeader}><View><Text style={styles.sectionKicker}>NEARBY OPTIONS</Text><Text style={styles.sectionTitle}>Take it to the right place</Text></View><Text style={styles.resultCount}>{services.length} found</Text></View>{services.map((service) => <Pressable accessibilityLabel={`Open directions to ${service.name}`} accessibilityRole="link" key={service.id} onPress={() => openDirections(service)} style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}><View style={styles.serviceIcon}><Ionicons color="#0E776D" name={serviceIcon(service.type)} size={23} /></View><View style={styles.serviceCopy}><Text style={styles.serviceName}>{service.name}</Text><Text style={styles.serviceType}>{serviceTypeLabel(service.type)}</Text>{service.address && <Text numberOfLines={2} style={styles.serviceAddress}>{service.address}</Text>}<Text style={[styles.serviceMaterials, !service.materials?.length && styles.serviceMaterialsUnknown]}>{recyclingMaterialsLabel(service.materials)}</Text><Text style={styles.serviceMeta}>{service.distanceKm !== undefined ? `${service.distanceKm.toFixed(1)} km away` : 'Directions available'} · {service.source === 'council' ? 'Council source' : 'Map data'}</Text></View><Ionicons color="#0D776B" name="navigate-outline" size={20} /></Pressable>)}</> : <View style={styles.empty}><Ionicons color="#729092" name="map-outline" size={28} /><Text style={styles.emptyTitle}>Nothing nearby was found</Text><Text style={styles.emptyText}>Try again later, or use your council’s website to check their household waste site list.</Text></View>}</View> : null}
            </>
          )}
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: appColours.background },
  safe: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 21, borderBottomWidth: 1, borderBottomColor: '#E6EDE7' },
  kicker: { color: '#B16E28', fontFamily: appFonts.text, fontSize: 10.5, letterSpacing: 1.15, fontWeight: '700' },
  title: { color: '#14323B', fontFamily: appFonts.display, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1.05, marginTop: 3 },
  subtitle: { color: '#667E80', fontSize: 12.5, marginTop: 6, fontWeight: '500' },
  content: { padding: 18, paddingBottom: 122, gap: 17 },
  modePicker: { flexDirection: 'row', padding: 3, backgroundColor: '#E1E7E3', borderRadius: 12, gap: 2 },
  mode: { flex: 1, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  modeActive: { backgroundColor: '#FFFFFF', shadowColor: '#12323A', shadowOpacity: 0.11, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  modeText: { color: '#667F82', fontFamily: appFonts.text, fontSize: 13, fontWeight: '600' },
  modeTextActive: { color: appColours.brand, fontWeight: '700' },
  searchBox: { height: 51, borderRadius: 16, backgroundColor: appColours.card, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, paddingHorizontal: 14, alignItems: 'center', flexDirection: 'row', gap: 9, shadowColor: '#16353A', shadowOpacity: 0.045, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  input: { color: '#193A3F', fontSize: 14, fontWeight: '600', flex: 1, height: '100%' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: -5 },
  chipsLabel: { color: '#74898B', fontSize: 9, letterSpacing: 0.9, fontWeight: '700', marginRight: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#FAEEDB' },
  chipText: { color: '#8B5C21', fontSize: 10.5, fontWeight: '800' },
  guideHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  sectionKicker: { color: '#6C8787', fontFamily: appFonts.text, fontSize: 10.5, letterSpacing: 1.05, fontWeight: '700' },
  sectionTitle: { color: '#17383E', fontFamily: appFonts.display, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.45, marginTop: 2 },
  checkPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, backgroundColor: '#F9EEDC' },
  checkText: { color: '#956526', fontSize: 8, letterSpacing: 0.45, fontWeight: '700' },
  guideList: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, overflow: 'hidden', backgroundColor: appColours.card, shadowColor: '#15343A', shadowOpacity: 0.045, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  guideItem: { minHeight: 68, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5ECE7' },
  guideItemOpen: { alignItems: 'flex-start', paddingTop: 14, paddingBottom: 15, backgroundColor: '#FBFEFC' },
  guideIcon: { height: 39, width: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  guideCopy: { flex: 1 },
  guideName: { color: '#1E4146', fontSize: 13.5, fontWeight: '700' },
  destination: { fontSize: 10.5, marginTop: 3, fontWeight: '800' },
  guideHeading: { color: '#274A4E', fontSize: 12, fontWeight: '700', marginTop: 10 },
  guideDetail: { color: '#617B7D', fontSize: 11.5, lineHeight: 16, marginTop: 3, fontWeight: '500' },
  localNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 9, backgroundColor: '#EDF4EF', borderRadius: 8, padding: 7 },
  localNoteText: { color: '#638083', fontSize: 9.5, lineHeight: 13, flex: 1, fontWeight: '600' },
  empty: { borderRadius: 18, padding: 23, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BED1C7', alignItems: 'center' },
  emptyTitle: { color: '#436267', fontSize: 13.5, fontWeight: '700', marginTop: 8 },
  emptyText: { color: '#718789', fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 4, maxWidth: 255 },
  servicesHero: { borderRadius: 20, minHeight: 106, padding: 16, backgroundColor: '#204A47', flexDirection: 'row', alignItems: 'center', gap: 12 },
  servicesMark: { height: 44, width: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C76F34' },
  servicesCopy: { flex: 1 },
  servicesTitle: { color: '#F3FFF8', fontSize: 15, fontWeight: '700' },
  servicesText: { color: '#B6D4C6', fontSize: 11, lineHeight: 15, marginTop: 4, fontWeight: '500' },
  locationLine: { minHeight: 59, borderRadius: 16, paddingHorizontal: 13, backgroundColor: '#E3F1EB', flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationCopy: { flex: 1 },
  locationLabel: { color: '#478078', fontSize: 9.5, letterSpacing: 0.9, fontWeight: '700' },
  locationName: { color: '#15454A', fontSize: 12.5, marginTop: 3, fontWeight: '800' },
  findButton: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, flexDirection: 'row', backgroundColor: '#0B756A' },
  findButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  servicesNote: { flexDirection: 'row', gap: 7, paddingHorizontal: 4, alignItems: 'flex-start' },
  servicesNoteText: { flex: 1, color: '#718789', fontSize: 10, lineHeight: 14 },
  serviceResults: { gap: 10 },
  resultCount: { color: '#57797A', fontSize: 10.5, fontWeight: '800' },
  serviceCard: { minHeight: 112, padding: 13, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, backgroundColor: appColours.card, flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#17353A', shadowOpacity: 0.045, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  serviceIcon: { height: 40, width: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2F2EB' },
  serviceCopy: { flex: 1 },
  serviceName: { color: '#1B4146', fontSize: 13, fontWeight: '700' },
  serviceType: { color: '#0A756B', fontSize: 10.5, marginTop: 3, fontWeight: '800' },
  serviceAddress: { color: '#6C8486', fontSize: 10.5, lineHeight: 14, marginTop: 3, fontWeight: '600' },
  serviceMaterials: { color: '#315A5C', fontSize: 10.5, lineHeight: 14, marginTop: 5, fontWeight: '700' },
  serviceMaterialsUnknown: { color: '#7B8987', fontWeight: '600' },
  serviceMeta: { color: '#0A756B', fontSize: 9.5, marginTop: 5, fontWeight: '800' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
});

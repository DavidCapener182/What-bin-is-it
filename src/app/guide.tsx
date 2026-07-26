import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { collectionMeta } from '@/lib/data';
import { fetchNearbyServices } from '@/lib/council-provider';
import { bulkyWasteServiceUrl } from '@/lib/council-reporting';
import { appFonts } from '@/lib/design-system';
import { AppTheme, useAppTheme } from '@/lib/theme';
import { GuideDestination, GuideItem, guideItemCount, searchGuide } from '@/lib/household-guide';
import { recyclingMaterialsLabel } from '@/lib/recycling-materials';
import { Collection, CouncilService } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';

type FindMode = 'guide' | 'services';
type ServiceFilter = 'all' | 'nearest' | CouncilService['type'] | 'open' | 'item' | 'council' | 'accessible';

const destinationLabel: Record<GuideDestination, string> = {
  general: 'General waste', recycling: 'Mixed recycling', garden: 'Garden waste', food: 'Food caddy', other: 'Council bin', service: 'Find a service', check: 'Check locally',
};

function destinationColour(destination: GuideDestination, theme: AppTheme) {
  if (destination === 'check') return { colour: theme.warning, tint: theme.groupedBackground };
  if (destination === 'service') return { colour: theme.accent, tint: theme.groupedBackground };
  return collectionMeta[destination];
}

function localDestination(item: GuideItem, collections: Collection[], councilName?: string) {
  if (!['general', 'recycling', 'garden', 'food', 'other'].includes(item.destination)) {
    return councilName ? `Check ${councilName} before using a local service.` : 'Add an address for local guidance.';
  }
  const matching = collections.find((collection) => collection.wasteType === item.destination);
  if (matching) return `Your schedule calls this “${matching.label || destinationLabel[item.destination]}”.`;
  if (item.destination === 'garden' || item.destination === 'food') {
    return `${destinationLabel[item.destination]} is not currently shown in your verified schedule. Check ${councilName ?? 'your council'} before using it.`;
  }
  return `Check ${councilName ?? 'your council'} if the container name or accepted materials differ.`;
}

function GuideResult({
  item,
  expanded,
  onPress,
  collections,
  councilName,
  findService,
  query,
}: {
  item: GuideItem;
  expanded: boolean;
  onPress: () => void;
  collections: Collection[];
  councilName?: string;
  findService: (item: GuideItem) => void;
  query: string;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const colour = destinationColour(item.destination, theme);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={({ pressed }) => [styles.guideItem, expanded && styles.guideItemOpen, pressed && styles.pressed]}>
      <View style={[styles.guideIcon, { backgroundColor: theme.groupedBackground }]}><Ionicons color={colour.colour} name={item.icon as keyof typeof Ionicons.glyphMap} size={22} /></View>
      <View style={styles.guideCopy}>
        <Text style={styles.guideName}>
          {(() => {
            const needle = query.trim();
            const index = needle ? item.name.toLowerCase().indexOf(needle.toLowerCase()) : -1;
            if (index < 0) return item.name;
            return <>
              {item.name.slice(0, index)}
              <Text style={styles.highlight}>{item.name.slice(index, index + needle.length)}</Text>
              {item.name.slice(index + needle.length)}
            </>;
          })()}
        </Text>
        <Text style={[styles.destination, { color: colour.colour }]}>{destinationLabel[item.destination]}</Text>
        {expanded && <>
          <Text style={styles.guideHeading}>What to do</Text>
          <Text style={styles.guideDetail}>{item.heading}</Text>
          <Text style={styles.guideHeading}>Prepare it</Text>
          <Text style={styles.guideDetail}>{item.detail}</Text>
          <Text style={styles.guideHeading}>Why this route</Text>
          <Text style={styles.guideDetail}>
            {item.destination === 'service'
              ? 'It needs a specialist, retailer, reuse, or council drop-off route rather than a household bin.'
              : item.destination === 'check'
                ? 'UK councils use different collection containers and sorting systems for this material.'
                : `This material is commonly handled through ${destinationLabel[item.destination].toLowerCase()}.`}
          </Text>
          <View style={styles.localNote}><Ionicons color={theme.secondaryText} name="location-outline" size={14} /><Text style={styles.localNoteText}>{localDestination(item, collections, councilName)}</Text></View>
          {item.destination === 'service' || item.destination === 'check' ? (
            <Pressable accessibilityRole="button" onPress={() => findService(item)} style={styles.inlineServiceButton}>
              <Ionicons color={theme.accent} name="map-outline" size={17} />
              <Text style={styles.inlineServiceText}>Find a nearby service</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({
              pathname: '/report-incorrect',
              params: { issue: 'guide-problem', detail: `Guide item: ${item.name}` },
            })}
            style={styles.inlineServiceButton}>
            <Ionicons color={theme.accent} name="flag-outline" size={17} />
            <Text style={styles.inlineServiceText}>Report incorrect guidance</Text>
          </Pressable>
        </>}
      </View>
      <Ionicons color={theme.tertiaryText} name={expanded ? 'chevron-up' : 'chevron-down'} size={18} />
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

function serviceAcceptsItem(service: CouncilService, item: GuideItem | undefined) {
  if (!item || !service.materials?.length) return false;
  const materialText = service.materials.join(' ').toLowerCase();
  return [item.name, ...item.aliases]
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .some((token) => token.length > 3 && materialText.includes(token));
}

export default function GuideScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { activeAddress, collections } = useAppData();
  const [mode, setMode] = useState<FindMode>('guide');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | undefined>();
  const [services, setServices] = useState<CouncilService[] | undefined>();
  const [finding, setFinding] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [serviceItem, setServiceItem] = useState<GuideItem | undefined>();
  const [recent, setRecent] = useState<string[]>([]);
  const modeRefs = useRef<(React.ElementRef<typeof Pressable> | null)[]>([]);

  const results = searchGuide(query);
  const filteredServices = services?.filter((service) => {
    if (serviceFilter === 'all') return true;
    if (serviceFilter === 'nearest') return true;
    if (serviceFilter === 'open') return service.isOpenNow === true;
    if (serviceFilter === 'item') return serviceAcceptsItem(service, serviceItem);
    if (serviceFilter === 'council') return service.councilOperated === true;
    if (serviceFilter === 'accessible') return service.wheelchairAccessible === true;
    return service.type === serviceFilter;
  });
  const visibleServices = serviceFilter === 'nearest'
    ? filteredServices?.slice(0, 10)
    : filteredServices;

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
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    void Linking.openURL(url);
  }

  function selectGuideItem(item: GuideItem) {
    setSelected(selected === item.id ? undefined : item.id);
    setRecent((current) => [item.name, ...current.filter((name) => name !== item.name)].slice(0, 4));
  }

  function switchToServices(item?: GuideItem) {
    setServiceItem(item);
    if (item) setServiceFilter('item');
    setMode('services');
    if (activeAddress && !services) void findServices();
  }

  return (
    <AppShell activeRoute="/guide">
      <RouteHead
        title="Recycling Guide"
        description="Search household items to see whether they belong in a bin or need a local recycling service."
        path="/guide"
      />
      <View style={styles.page}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <Text style={styles.kicker}>Guide</Text>
          <Text style={styles.title}>What are you throwing away?</Text>
          <Text style={styles.subtitle}>Search the recycling guide or find a verified local service.</Text>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View accessibilityLabel="Guide section" accessibilityRole="tablist" style={styles.modePicker}>
            {(['guide', 'services'] as const).map((value, index) => (
              <Pressable
                {...(Platform.OS === 'web' ? {
                  'aria-controls': value === 'guide' ? 'guide-panel' : 'services-panel',
                  'aria-selected': mode === value,
                  tabIndex: mode === value ? 0 : -1,
                  onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const nextIndex = event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 1
                        : (index + (event.key === 'ArrowRight' ? 1 : -1) + 2) % 2;
                    const nextMode = nextIndex === 0 ? 'guide' : 'services';
                    setMode(nextMode);
                    modeRefs.current[nextIndex]?.focus();
                  },
                  } : {})}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === value }}
                key={value}
                onPress={() => setMode(value)}
                ref={(element) => { modeRefs.current[index] = element; }}
                style={[styles.mode, mode === value && styles.modeActive]}>
                <Ionicons color={mode === value ? theme.accent : theme.secondaryText} name={value === 'guide' ? 'search-outline' : 'map-outline'} size={17} />
                <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value === 'guide' ? 'Bin guide' : 'Local services'}</Text>
              </Pressable>
            ))}
          </View>

          {mode === 'guide' ? (
            <>
            <View nativeID="guide-panel" style={styles.panel}>
              <View style={styles.searchBox}><Ionicons color={theme.secondaryText} name="search" size={19} /><TextInput accessibilityLabel="Search household items" autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" onChangeText={(value) => { setQuery(value); setSelected(undefined); }} placeholder={`Search ${guideItemCount}+ household items…`} placeholderTextColor={theme.tertiaryText} returnKeyType="search" style={styles.input} value={query} /></View>
              {!query && <View style={styles.chips}><Text style={styles.chipsLabel}>Popular</Text>{['Batteries', 'Pizza box', 'Vapes', 'Mattress'].map((chip) => <Pressable accessibilityLabel={`Search for ${chip}`} accessibilityRole="button" key={chip} onPress={() => setQuery(chip)} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></Pressable>)}</View>}
              {!query && recent.length ? <View style={styles.chips}><Text style={styles.chipsLabel}>Recent</Text>{recent.map((chip) => <Pressable accessibilityLabel={`Search again for ${chip}`} accessibilityRole="button" key={chip} onPress={() => setQuery(chip)} style={styles.recentChip}><Text style={styles.recentChipText}>{chip}</Text></Pressable>)}</View> : null}
              <View accessibilityLiveRegion="polite" style={styles.guideHeader}><View><Text style={styles.sectionKicker}>{query ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : `${guideItemCount} items`}</Text><Text style={styles.sectionTitle}>{query ? 'Best route' : 'Common household items'}</Text></View><View style={styles.checkPill}><Ionicons color={theme.warning} name="alert-circle-outline" size={14} /><Text style={styles.checkText}>Check locally</Text></View></View>
              <View style={styles.guideList}>{results.map((item) => <GuideResult collections={collections} councilName={activeAddress?.councilName} expanded={selected === item.id} findService={switchToServices} item={item} key={item.id} onPress={() => selectGuideItem(item)} query={query} />)}</View>
              {results.length === 0 && <View style={styles.empty}><Ionicons color={theme.tertiaryText} name="search-outline" size={28} /><Text style={styles.emptyTitle}>We don’t know that one yet</Text><Text style={styles.emptyText}>Try a shorter name, or use Local services for unusual, hazardous or bulky items.</Text></View>}
            </View>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" nativeID="services-panel" style={styles.hiddenPanel} />
            </>
          ) : (
            <>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" nativeID="guide-panel" style={styles.hiddenPanel} />
            <View nativeID="services-panel" style={styles.panel}>
              <View style={styles.servicesHero}><View style={styles.servicesMark}><Ionicons color="#F9FFF8" name="location" size={23} /></View><View style={styles.servicesCopy}><Text style={styles.servicesTitle}>Council tips & drop-offs</Text><Text style={styles.servicesText}>Find recycling sites and household-waste services near your saved place.</Text></View></View>
              {serviceItem ? <View style={styles.itemContext}><Ionicons color={theme.accent} name={serviceItem.icon as keyof typeof Ionicons.glyphMap} size={20} /><View style={styles.servicesCopy}><Text style={styles.itemContextTitle}>Looking for: {serviceItem.name}</Text><Text style={styles.itemContextText}>“Item accepted” only includes sites whose source explicitly lists a matching material.</Text></View><Pressable accessibilityLabel="Clear item filter" accessibilityRole="button" onPress={() => { setServiceItem(undefined); setServiceFilter('all'); }} style={styles.clearItem}><Ionicons color={theme.secondaryText} name="close" size={18} /></Pressable></View> : null}
              <View style={styles.locationLine}><Ionicons color={theme.accent} name="location-outline" size={18} /><View style={styles.locationCopy}><Text style={styles.locationLabel}>Searching around</Text><Text style={styles.locationName}>{activeAddress ? `${activeAddress.label} · ${activeAddress.postcode}` : 'Add a place first'}</Text></View></View>
              <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(bulkyWasteServiceUrl)} style={styles.bulkyCard}><View style={styles.bulkyIcon}><Ionicons color="#FFFFFF" name="bed-outline" size={22} /></View><View style={styles.servicesCopy}><Text style={styles.bulkyTitle}>Book a bulky-waste collection</Text><Text style={styles.bulkyText}>Use the official service to find your council’s collection route for furniture and large items.</Text></View><Ionicons color="#FFFFFF" name="open-outline" size={18} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: finding || !activeAddress }} disabled={finding || !activeAddress} onPress={findServices} style={({ pressed }) => [styles.findButton, pressed && styles.pressed, (finding || !activeAddress) && styles.disabled]}>{finding ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="locate" size={18} /><Text style={styles.findButtonText}>{services ? 'Search again' : 'Find nearby services'}</Text></>}</Pressable>
              <View style={styles.servicesNote}><Ionicons color={theme.secondaryText} name="information-circle-outline" size={16} /><Text style={styles.servicesNoteText}>The app searches only when you tap the button. Council listings are used where available, with nearby map results as a fallback. Check opening times and accepted waste before travelling.</Text></View>
              {services ? <><ScrollView horizontal contentContainerStyle={styles.filterRow} showsHorizontalScrollIndicator={false}>{([
                ['all', 'All'],
                ['nearest', 'Nearest'],
                ['open', 'Open now'],
                ['recycling-centre', 'Centres'],
                ['recycling-point', 'Recycling points'],
                ...(serviceItem ? [['item', 'Item accepted'] as const] : []),
                ['council', 'Council-operated'],
                ['accessible', 'Wheelchair accessible'],
                ['reuse', 'Reuse'],
                ['collection', 'Collections'],
              ] as const).map(([value, label]) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: serviceFilter === value }} key={value} onPress={() => setServiceFilter(value)} style={[styles.filter, serviceFilter === value && styles.filterActive]}><Text style={[styles.filterText, serviceFilter === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</ScrollView><View style={styles.serviceResults}>{visibleServices?.length ? <><View style={styles.guideHeader}><View><Text style={styles.sectionKicker}>Nearby options</Text><Text style={styles.sectionTitle}>Take it to the right place</Text></View><Text style={styles.resultCount}>{visibleServices.length} found</Text></View>{visibleServices.map((service) => <View key={service.id} style={styles.serviceCard}><View style={styles.serviceIcon}><Ionicons color={theme.accent} name={serviceIcon(service.type)} size={23} /></View><View style={styles.serviceCopy}><Text style={styles.serviceName}>{service.name}</Text><Text style={styles.serviceType}>{serviceTypeLabel(service.type)}</Text>{service.address && <Text numberOfLines={2} style={styles.serviceAddress}>{service.address}</Text>}{service.openingHours ? <Text style={styles.serviceHours}>{service.isOpenNow ? 'Open now · ' : 'Opening hours · '}{service.openingHours}</Text> : null}<Text style={[styles.serviceMaterials, !service.materials?.length && styles.serviceMaterialsUnknown]}>{recyclingMaterialsLabel(service.materials)}</Text>{service.operator ? <Text style={styles.serviceOperator}>{service.operator}{service.councilOperated ? ' · Council-operated' : ''}</Text> : null}{service.wheelchairAccessible !== undefined ? <Text style={styles.serviceOperator}>{service.wheelchairAccessible ? 'Wheelchair accessible' : 'Not marked wheelchair accessible'}</Text> : null}<Text style={styles.serviceMeta}>{service.distanceKm !== undefined ? `${(service.distanceKm * 0.621371).toFixed(1)} miles away` : 'Directions available'} · {service.source === 'council' ? 'Council source' : 'Map data'}</Text><View style={styles.serviceActions}><Pressable accessibilityLabel={`Open directions to ${service.name}`} accessibilityRole="link" onPress={() => openDirections(service)} style={styles.serviceAction}><Ionicons color={theme.accent} name="navigate-outline" size={17} /><Text style={styles.serviceActionText}>Directions</Text></Pressable>{service.website ? <Pressable accessibilityLabel={`Open website for ${service.name}`} accessibilityRole="link" onPress={() => void Linking.openURL(service.website!)} style={styles.serviceAction}><Ionicons color={theme.accent} name="open-outline" size={17} /><Text style={styles.serviceActionText}>View details</Text></Pressable> : null}<Pressable accessibilityLabel={`Report incorrect information for ${service.name}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/report-incorrect', params: { issue: 'service-problem', detail: `Local service: ${service.name}` } })} style={styles.serviceAction}><Ionicons color={theme.accent} name="flag-outline" size={17} /><Text style={styles.serviceActionText}>Report</Text></Pressable></View></View></View>)}</> : <View style={styles.empty}><Ionicons color={theme.tertiaryText} name="options-outline" size={28} /><Text style={styles.emptyTitle}>No verified matches for this filter</Text><Text style={styles.emptyText}>The source has not listed a matching service. Choose another filter or check the council website before travelling.</Text></View>}</View></> : null}
            </View>
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
  safe: { backgroundColor: theme.surface, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 21, borderBottomWidth: 1, borderBottomColor: theme.separator },
  kicker: { color: theme.accent, fontFamily: appFonts.text, fontSize: 13, letterSpacing: 0, fontWeight: '700' },
  title: { color: theme.text, fontFamily: appFonts.display, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1.05, marginTop: 3 },
  subtitle: { color: theme.secondaryText, fontSize: 12.5, marginTop: 6, fontWeight: '500' },
  content: { padding: 18, paddingBottom: 122, gap: 17 },
  panel: { gap: 17 },
  hiddenPanel: { display: 'none' },
  modePicker: { flexDirection: 'row', padding: 3, backgroundColor: theme.groupedBackground, borderRadius: 12, gap: 2 },
  mode: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  modeActive: { backgroundColor: theme.surface, shadowColor: '#000000', shadowOpacity: 0.11, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  modeText: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 13, fontWeight: '600' },
  modeTextActive: { color: theme.accent, fontWeight: '700' },
  searchBox: { height: 51, borderRadius: 16, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, paddingHorizontal: 14, alignItems: 'center', flexDirection: 'row', gap: 9 },
  input: { color: theme.text, fontSize: 14, fontWeight: '600', flex: 1, height: '100%' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: -5 },
  chipsLabel: { color: theme.secondaryText, fontSize: 12, letterSpacing: 0.25, fontWeight: '700', marginRight: 2 },
  chip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 14, backgroundColor: theme.accentSoft },
  chipText: { color: theme.accent, fontSize: 12, fontWeight: '800' },
  recentChip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface },
  recentChipText: { color: theme.text, fontSize: 12, fontWeight: '700' },
  guideHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  sectionKicker: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.85, fontWeight: '700' },
  sectionTitle: { color: theme.text, fontFamily: appFonts.display, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.45, marginTop: 2 },
  checkPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, backgroundColor: `${theme.warning}14` },
  checkText: { color: theme.warning, fontSize: 12, fontWeight: '700' },
  guideList: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, overflow: 'hidden', backgroundColor: theme.surface },
  guideItem: { minHeight: 68, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  guideItemOpen: { alignItems: 'flex-start', paddingTop: 14, paddingBottom: 15, backgroundColor: theme.elevated },
  guideIcon: { height: 39, width: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  guideCopy: { flex: 1 },
  guideName: { color: theme.text, fontSize: 13.5, fontWeight: '700' },
  highlight: { color: theme.accent, fontWeight: '800' },
  destination: { fontSize: 12, marginTop: 3, fontWeight: '800' },
  guideHeading: { color: theme.text, fontSize: 12, fontWeight: '700', marginTop: 10 },
  guideDetail: { color: theme.secondaryText, fontSize: 13, lineHeight: 18, marginTop: 3, fontWeight: '500' },
  localNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 9, backgroundColor: theme.groupedBackground, borderRadius: 8, padding: 7 },
  localNoteText: { color: theme.secondaryText, fontSize: 12, lineHeight: 16, flex: 1, fontWeight: '600' },
  inlineServiceButton: { minHeight: 44, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  inlineServiceText: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  empty: { borderRadius: 18, padding: 23, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.separator, alignItems: 'center' },
  emptyTitle: { color: theme.text, fontSize: 13.5, fontWeight: '700', marginTop: 8 },
  emptyText: { color: theme.secondaryText, fontSize: 13, textAlign: 'center', lineHeight: 18, marginTop: 4, maxWidth: 270 },
  servicesHero: { borderRadius: 16, minHeight: 106, padding: 16, backgroundColor: theme.hero, flexDirection: 'row', alignItems: 'center', gap: 12 },
  servicesMark: { height: 44, width: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent },
  servicesCopy: { flex: 1 },
  servicesTitle: { color: theme.heroText, fontSize: 15, fontWeight: '700' },
  servicesText: { color: theme.heroSecondary, fontSize: 12.5, lineHeight: 17, marginTop: 4, fontWeight: '500' },
  locationLine: { minHeight: 59, borderRadius: 16, paddingHorizontal: 13, backgroundColor: theme.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationCopy: { flex: 1 },
  locationLabel: { color: theme.secondaryText, fontSize: 12, letterSpacing: 0.25, fontWeight: '700' },
  locationName: { color: theme.text, fontSize: 12.5, marginTop: 3, fontWeight: '800' },
  itemContext: { minHeight: 68, borderRadius: 14, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemContextTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
  itemContextText: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 2 },
  clearItem: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bulkyCard: { minHeight: 92, borderRadius: 16, backgroundColor: theme.accent, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  bulkyIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  bulkyTitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  bulkyText: { color: '#D7E9F8', fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  findButton: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, flexDirection: 'row', backgroundColor: theme.accent },
  findButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  servicesNote: { flexDirection: 'row', gap: 7, paddingHorizontal: 4, alignItems: 'flex-start' },
  servicesNoteText: { flex: 1, color: theme.secondaryText, fontSize: 12, lineHeight: 17 },
  serviceResults: { gap: 10 },
  filterRow: { gap: 8 },
  filter: { minHeight: 44, paddingHorizontal: 13, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
  filterActive: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  filterText: { color: theme.secondaryText, fontSize: 12.5, fontWeight: '700' },
  filterTextActive: { color: theme.accent },
  resultCount: { color: theme.secondaryText, fontSize: 12, fontWeight: '800' },
  serviceCard: { minHeight: 112, padding: 13, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  serviceIcon: { height: 40, width: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft },
  serviceCopy: { flex: 1 },
  serviceName: { color: theme.text, fontSize: 13, fontWeight: '700' },
  serviceType: { color: theme.accent, fontSize: 12, marginTop: 3, fontWeight: '800' },
  serviceAddress: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 3, fontWeight: '600' },
  serviceHours: { color: theme.success, fontSize: 12, lineHeight: 17, marginTop: 5, fontWeight: '700' },
  serviceMaterials: { color: theme.text, fontSize: 12, lineHeight: 17, marginTop: 5, fontWeight: '700' },
  serviceMaterialsUnknown: { color: theme.tertiaryText, fontWeight: '600' },
  serviceOperator: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 4, fontWeight: '600' },
  serviceMeta: { color: theme.accent, fontSize: 12, marginTop: 5, fontWeight: '800' },
  serviceActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, marginTop: 10 },
  serviceAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  serviceActionText: { color: theme.accent, fontSize: 12.5, fontWeight: '700' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  });
}

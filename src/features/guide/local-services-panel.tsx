import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { InlineNotice, ResidentEmptyState } from '@/components/resident-layout';
import { recyclingMaterialsLabel } from '@/lib/recycling-materials';
import { type AppTheme, useAppTheme } from '@/lib/theme';
import { type CouncilService, type SavedAddress } from '@/lib/types';
import { type GuideItem } from '@/lib/household-guide';

export type ServiceFilter = 'all' | 'nearest' | CouncilService['type'] | 'open' | 'item' | 'council' | 'accessible';

const serviceFilters = [
  ['all', 'All'],
  ['nearest', 'Nearest'],
  ['open', 'Open now'],
  ['recycling-centre', 'Centres'],
  ['recycling-point', 'Recycling points'],
  ['council', 'Council-operated'],
  ['accessible', 'Wheelchair accessible'],
  ['reuse', 'Reuse'],
  ['collection', 'Collections'],
] as const;

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

export function LocalServicesPanel({
  activeAddress,
  clearItem,
  error,
  finding,
  onFind,
  onOpenDirections,
  serviceFilter,
  serviceItem,
  services,
  setServiceFilter,
}: {
  activeAddress?: SavedAddress;
  clearItem: () => void;
  error?: string;
  finding: boolean;
  onFind: () => void;
  onOpenDirections: (service: CouncilService) => void;
  serviceFilter: ServiceFilter;
  serviceItem?: GuideItem;
  services?: CouncilService[];
  setServiceFilter: (filter: ServiceFilter) => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const visibleServices = services
    ?.filter((service) => {
      if (serviceFilter === 'all' || serviceFilter === 'nearest') return true;
      if (serviceFilter === 'open') return service.isOpenNow === true;
      if (serviceFilter === 'item') return serviceAcceptsItem(service, serviceItem);
      if (serviceFilter === 'council') return service.councilOperated === true;
      if (serviceFilter === 'accessible') return service.wheelchairAccessible === true;
      return service.type === serviceFilter;
    })
    .slice()
    .sort((left, right) => {
      if (serviceFilter === 'nearest') return (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity);
      const rank = (service: CouncilService) => service.councilOperated
        ? 0
        : service.type === 'reuse'
          ? 1
          : service.source === 'council'
            ? 2
            : 3;
      return rank(left) - rank(right) || (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity);
    })
    .slice(0, serviceFilter === 'nearest' ? 10 : undefined);

  return (
    <View nativeID="services-panel" style={styles.panel}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons color="#FFFFFF" name="location" size={23} /></View>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.heroTitle}>Council tips & drop-offs</Text>
          <Text style={styles.heroBody}>Find recycling sites and household-waste services near your saved place.</Text>
        </View>
      </View>
      {serviceItem ? (
        <View style={styles.itemContext}>
          <Ionicons color={theme.accent} name={serviceItem.icon as keyof typeof Ionicons.glyphMap} size={20} />
          <View style={styles.copy}>
            <Text style={styles.itemTitle}>Looking for: {serviceItem.name}</Text>
            <Text style={styles.itemBody}>“Item accepted” only includes sites whose source explicitly lists a matching material.</Text>
          </View>
          <Pressable accessibilityLabel="Clear item filter" accessibilityRole="button" onPress={clearItem} style={styles.iconButton}><Ionicons color={theme.secondaryText} name="close" size={19} /></Pressable>
        </View>
      ) : null}
      <View style={styles.locationLine}>
        <Ionicons color={theme.accent} name="location-outline" size={18} />
        <View style={styles.copy}>
          <Text style={styles.locationLabel}>Searching around</Text>
          <Text style={styles.locationName}>{activeAddress ? `${activeAddress.label} · ${activeAddress.postcode}` : 'Add a place first'}</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/bulky-booking' as Href)} style={({ pressed }) => [styles.bulkyCard, pressed && styles.pressed]}>
        <View style={styles.bulkyIcon}><Ionicons color="#FFFFFF" name="bed-outline" size={22} /></View>
        <View style={styles.copy}><Text style={styles.bulkyTitle}>Book a bulky-waste collection</Text><Text style={styles.bulkyBody}>Compare the official council route, reuse options and approved paid partners.</Text></View>
        <Ionicons color="#FFFFFF" name="chevron-forward" size={18} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: finding || !activeAddress }} disabled={finding || !activeAddress} onPress={onFind} style={({ pressed }) => [styles.findButton, (finding || !activeAddress) && styles.disabled, pressed && styles.pressed]}>
        {finding ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="locate" size={18} /><Text style={styles.findButtonText}>{services ? 'Search again' : 'Find nearby services'}</Text></>}
      </Pressable>
      {error ? <InlineNotice body={error} title="Could not find local services" tone="danger" /> : null}
      <InlineNotice body="The app searches only when you ask. Council listings come first, with nearby map results as a fallback. Check opening times and accepted waste before travelling." title="About these results" />

      {services ? (
        <>
          <View accessibilityLabel="Service filters" style={styles.filters}>
            {[...serviceFilters, ...(serviceItem ? [['item', 'Item accepted'] as const] : [])].map(([value, label]) => (
              <Pressable aria-checked={serviceFilter === value} accessibilityRole="radio" accessibilityState={{ checked: serviceFilter === value }} key={value} onPress={() => setServiceFilter(value)} style={[styles.filter, serviceFilter === value && styles.filterActive]}>
                <Text style={[styles.filterText, serviceFilter === value && styles.filterTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View accessibilityLiveRegion="polite" style={styles.resultsHeader}>
            <View><Text style={styles.kicker}>Nearby options</Text><Text accessibilityRole="header" style={styles.title}>Take it to the right place</Text></View>
            <Text style={styles.count}>{visibleServices?.length ?? 0} found</Text>
          </View>
          {visibleServices?.length ? visibleServices.map((service) => (
            <ServiceCard key={service.id} onOpenDirections={onOpenDirections} service={service} />
          )) : (
            <ResidentEmptyState body="The source has not listed a matching service. Choose another filter or check the council website before travelling." icon="options-outline" title="No verified matches for this filter" />
          )}
        </>
      ) : null}
    </View>
  );
}

function ServiceCard({ onOpenDirections, service }: { onOpenDirections: (service: CouncilService) => void; service: CouncilService }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.serviceCard}>
      <View style={styles.serviceIcon}><Ionicons color={theme.accent} name={serviceIcon(service.type)} size={23} /></View>
      <View style={styles.copy}>
        <Text style={styles.serviceName}>{service.name}</Text>
        <Text style={styles.serviceType}>{serviceTypeLabel(service.type)}</Text>
        {service.address ? <Text style={styles.serviceBody}>{service.address}</Text> : null}
        {service.openingHours ? <Text style={styles.serviceHours}>{service.isOpenNow ? 'Open now · ' : 'Opening hours · '}{service.openingHours}</Text> : null}
        <Text style={[styles.serviceMaterials, !service.materials?.length && styles.serviceMaterialsUnknown]}>{recyclingMaterialsLabel(service.materials)}</Text>
        {service.operator ? <Text style={styles.serviceBody}>{service.operator}{service.councilOperated ? ' · Council-operated' : ''}</Text> : null}
        {service.wheelchairAccessible !== undefined ? <Text style={styles.serviceBody}>{service.wheelchairAccessible ? 'Wheelchair accessible' : 'Not marked wheelchair accessible'}</Text> : null}
        <Text style={styles.serviceMeta}>{service.distanceKm !== undefined ? `${(service.distanceKm * 0.621371).toFixed(1)} miles away` : 'Directions available'} · {service.source === 'council' ? 'Council source' : 'Map data'}</Text>
        <View style={styles.serviceActions}>
          <Pressable accessibilityLabel={`Open directions to ${service.name}`} accessibilityRole="link" onPress={() => onOpenDirections(service)} style={styles.serviceAction}><Ionicons color={theme.accent} name="navigate-outline" size={17} /><Text style={styles.serviceActionText}>Directions</Text></Pressable>
          {service.website ? <Pressable accessibilityLabel={`Open website for ${service.name}`} accessibilityRole="link" onPress={() => void Linking.openURL(service.website!)} style={styles.serviceAction}><Ionicons color={theme.accent} name="open-outline" size={17} /><Text style={styles.serviceActionText}>View details</Text></Pressable> : null}
          <Pressable accessibilityLabel={`Report incorrect information for ${service.name}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/report-incorrect', params: { issue: 'service-problem', detail: `Local service: ${service.name}` } })} style={styles.serviceAction}><Ionicons color={theme.accent} name="flag-outline" size={17} /><Text style={styles.serviceActionText}>Report</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    panel: { gap: 14 },
    hero: { borderRadius: 16, minHeight: 108, padding: 16, backgroundColor: theme.hero, flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroIcon: { height: 44, width: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentFill },
    copy: { flex: 1, minWidth: 0 },
    heroTitle: { color: theme.heroText, fontSize: 16, lineHeight: 21, fontWeight: '700' },
    heroBody: { color: theme.heroSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
    itemContext: { minHeight: 72, borderRadius: 14, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
    itemTitle: { color: theme.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    itemBody: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 2 },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    locationLine: { minHeight: 62, borderRadius: 14, paddingHorizontal: 13, backgroundColor: theme.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 10 },
    locationLabel: { color: theme.secondaryText, fontSize: 12, lineHeight: 16, fontWeight: '700' },
    locationName: { color: theme.text, fontSize: 13, lineHeight: 18, marginTop: 2, fontWeight: '800' },
    bulkyCard: { minHeight: 92, borderRadius: 16, backgroundColor: theme.accentFill, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
    bulkyIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
    bulkyTitle: { color: '#FFFFFF', fontSize: 14.5, lineHeight: 20, fontWeight: '700' },
    bulkyBody: { color: '#D7E9F8', fontSize: 12.5, lineHeight: 17, marginTop: 3 },
    findButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, flexDirection: 'row', backgroundColor: theme.accentFill },
    findButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filter: { minHeight: 44, paddingHorizontal: 13, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
    filterActive: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
    filterText: { color: theme.secondaryText, fontSize: 12.5, fontWeight: '700' },
    filterTextActive: { color: theme.accent },
    resultsHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
    kicker: { color: theme.secondaryText, fontSize: 12, lineHeight: 16, fontWeight: '700' },
    title: { color: theme.text, fontSize: 21, lineHeight: 26, fontWeight: '700', marginTop: 2 },
    count: { color: theme.secondaryText, fontSize: 12, lineHeight: 16, fontWeight: '800' },
    serviceCard: { minHeight: 118, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    serviceIcon: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft },
    serviceName: { color: theme.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    serviceType: { color: theme.accent, fontSize: 12, lineHeight: 17, marginTop: 3, fontWeight: '800' },
    serviceBody: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
    serviceHours: { color: theme.success, fontSize: 12.5, lineHeight: 18, marginTop: 5, fontWeight: '700' },
    serviceMaterials: { color: theme.text, fontSize: 12.5, lineHeight: 18, marginTop: 5, fontWeight: '700' },
    serviceMaterialsUnknown: { color: theme.tertiaryText, fontWeight: '600' },
    serviceMeta: { color: theme.accent, fontSize: 12, lineHeight: 17, marginTop: 5, fontWeight: '800' },
    serviceActions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, marginTop: 8 },
    serviceAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
    serviceActionText: { color: theme.accent, fontSize: 12.5, fontWeight: '700' },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.5 },
  });
}

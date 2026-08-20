import { Ionicons } from '@expo/vector-icons';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { CouncilNotices } from '@/components/council-notices';
import { GuideDetail } from '@/components/guide-detail';
import { ResidentScreenHeader } from '@/components/resident-layout';
import { RouteHead } from '@/components/route-head';
import { CouncilProfile, fetchNearbyServices } from '@/lib/council-provider';
import { useAppTheme } from '@/lib/theme';
import { GuideItem, guideItemCount, guideItems, searchGuide } from '@/lib/household-guide';
import { CouncilService } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useCouncilProfile } from '@/lib/use-council-profile';
import { useProductState } from '@/lib/use-product-state';
import { recordPartnerConversion } from '@/lib/resident-council-links';
import { useAdaptiveLayout } from '@/lib/use-adaptive-layout';
import { GuideResultRow } from '@/features/guide/guide-result-row';
import { LocalServicesPanel, type ServiceFilter } from '@/features/guide/local-services-panel';
import { GuideModePicker, type GuideMode } from '@/features/guide/guide-mode-picker';
import { createGuideScreenStyles } from '@/features/guide/guide-screen-styles';

export default function GuideScreen() {
  const theme = useAppTheme();
  const adaptive = useAdaptiveLayout();
  const styles = createGuideScreenStyles(theme);
  const params = useLocalSearchParams<{ item?: string; mode?: string }>();
  const requestedServiceItem = params.item ? guideItems.find((item) => item.id === params.item) : undefined;
  const { activeAddress, collections } = useAppData();
  const analytics = usePilotAnalytics();
  const { savedGuideItemIds, showSponsoredServices, toggleSavedGuideItem } = useProductState();
  const [mode, setMode] = useState<GuideMode>(params.mode === 'services' ? 'services' : 'guide');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | undefined>();
  const [services, setServices] = useState<CouncilService[] | undefined>();
  const [finding, setFinding] = useState(false);
  const [serviceError, setServiceError] = useState<string>();
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>(requestedServiceItem ? 'item' : 'all');
  const [serviceItem, setServiceItem] = useState<GuideItem | undefined>(requestedServiceItem);
  const [recent, setRecent] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const councilProfile = useCouncilProfile(activeAddress?.providerId);

  const activeCouncilProfile = councilProfile?.providerId === activeAddress?.providerId
    ? councilProfile
    : undefined;
  const localGuidanceEnabled = activeCouncilProfile?.featureFlags?.recyclingGuide !== false;
  const results = searchGuide(query).map((item) => {
    const localRule = localGuidanceEnabled ? activeCouncilProfile?.guidance?.[item.id] : undefined;
    return localRule ? { ...item, ...localRule } : item;
  }).filter((item) => !showSavedOnly || savedGuideItemIds.includes(item.id));
  const councilGuidanceConnected = localGuidanceEnabled && (
    activeCouncilProfile?.capabilities.guidance === 'council-configured'
    || activeCouncilProfile?.capabilities.guidance === 'partner-feed'
  );
  async function findServices() {
    if (!activeAddress) return;
    setFinding(true);
    setServiceError(undefined);
    try {
      const found = await fetchNearbyServices(activeAddress);
      setServices(found);
      analytics.track('local_services_succeeded', {
        councilId: activeAddress.providerId,
        outcome: 'success',
        metricValue: Math.min(1000, found.length),
      });
    } catch (error) {
      analytics.track('local_services_failed', {
        councilId: activeAddress.providerId,
        outcome: 'failure',
        reasonCode: 'unavailable',
      });
      setServiceError(error instanceof Error ? error.message : 'Please try again in a moment.');
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
    if (adaptive.mode === 'compact') {
      router.push(`/guide/${item.id}` as Href);
    } else {
      setSelected(item.id);
    }
    setRecent((current) => [item.name, ...current.filter((name) => name !== item.name)].slice(0, 4));
    analytics.track('guide_result_selected', {
      councilId: activeAddress?.providerId,
      context: item.destination,
      outcome: 'success',
    });
    if (showSponsoredServices) {
      activeCouncilProfile?.partners
        ?.filter((partner) => partner.itemKeys.includes(item.id))
        .forEach((partner) => {
          void recordPartnerConversion(partner.id, 'listing-viewed');
          analytics.track('partner_listing_viewed', {
            councilId: activeAddress?.providerId,
            context: 'partner',
            outcome: 'success',
          });
        });
    }
  }

  function recordGuideSearch() {
    if (!query.trim()) return;
    analytics.track(results.length ? 'guide_search_matched' : 'guide_search_no_match', {
      councilId: activeAddress?.providerId,
      outcome: results.length ? 'matched' : 'no-match',
      metricValue: Math.min(1000, results.length),
    });
  }

  function switchToServices(item?: GuideItem) {
    setServiceItem(item);
    if (item) setServiceFilter('item');
    setMode('services');
    if (activeAddress && !services) void findServices();
  }

  function openPartner(
    partner: NonNullable<CouncilProfile['partners']>[number],
    item: GuideItem,
  ) {
    if (partner.category === 'bulky-waste') {
      router.push({ pathname: '/bulky-booking', params: { item: item.id, partner: partner.id } });
      return;
    }
    void recordPartnerConversion(partner.id, 'website-opened');
    analytics.track('partner_external_opened', {
      councilId: activeAddress?.providerId,
      context: 'partner',
      outcome: 'success',
    });
    void Linking.openURL(partner.serviceUrl);
  }

  const selectedItem = results.find((item) => item.id === selected);
  const selectedPartners = showSponsoredServices && activeCouncilProfile?.featureFlags?.partnerServices
    ? activeCouncilProfile.partners?.filter((partner) => partner.itemKeys.includes(selected ?? ''))
    : undefined;
  const modePicker = <GuideModePicker mode={mode} onChange={setMode} />;
  const guideListHeader = (
    <View nativeID="guide-panel" style={styles.listHeader}>
      <CouncilNotices placement="guide" profile={activeCouncilProfile} />
      {modePicker}
      <View style={styles.searchBox}>
        <Ionicons color={theme.secondaryText} name="search" size={19} />
        <TextInput
          accessibilityLabel="Search household items"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={(value) => { setQuery(value); setSelected(undefined); }}
          onSubmitEditing={recordGuideSearch}
          placeholder={`Search ${guideItemCount}+ household items…`}
          placeholderTextColor={theme.tertiaryText}
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
      </View>
      <View style={[styles.guidanceSource, { backgroundColor: councilGuidanceConnected ? theme.accentSoft : theme.surface }]}>
        <Ionicons color={councilGuidanceConnected ? theme.accent : theme.warning} name={councilGuidanceConnected ? 'checkmark-circle-outline' : 'information-circle-outline'} size={19} />
        <View style={styles.guidanceSourceCopy}>
          <Text style={styles.guidanceSourceTitle}>
            {councilGuidanceConnected
              ? `${activeAddress?.councilName ?? activeCouncilProfile?.councilName} guidance connected`
              : activeAddress
                ? `UK guidance · ${activeAddress.councilName} rules not connected`
                : 'UK guidance · add a place for council rules'}
          </Text>
          <Text style={styles.guidanceSourceDetail}>
            {councilGuidanceConnected
              ? `Rules were checked ${activeCouncilProfile?.reviewedAt}. Container names come from this council profile.`
              : 'Use “Check locally” where collection rules differ between authorities.'}
          </Text>
        </View>
        {activeCouncilProfile?.guidanceSourceUrl ? (
          <Pressable accessibilityLabel="Open official council recycling guidance" accessibilityRole="link" onPress={() => void Linking.openURL(activeCouncilProfile.guidanceSourceUrl!)} style={styles.sourceLink}>
            <Ionicons color={theme.accent} name="open-outline" size={18} />
          </Pressable>
        ) : null}
      </View>
      {!query ? (
        <View style={styles.chips}><Text style={styles.chipsLabel}>Popular</Text>{['Batteries', 'Pizza box', 'Vapes', 'Mattress'].map((chip) => <Pressable accessibilityLabel={`Search for ${chip}`} accessibilityRole="button" key={chip} onPress={() => setQuery(chip)} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></Pressable>)}</View>
      ) : null}
      {!query && recent.length ? (
        <View style={styles.chips}><Text style={styles.chipsLabel}>Recent</Text>{recent.map((chip) => <Pressable accessibilityLabel={`Search again for ${chip}`} accessibilityRole="button" key={chip} onPress={() => setQuery(chip)} style={styles.recentChip}><Text style={styles.recentChipText}>{chip}</Text></Pressable>)}</View>
      ) : null}
      <View style={styles.chips}>
        <Text style={styles.chipsLabel}>View</Text>
        <Pressable aria-checked={showSavedOnly} accessibilityRole="checkbox" accessibilityState={{ checked: showSavedOnly }} onPress={() => setShowSavedOnly((current) => !current)} style={[styles.recentChip, showSavedOnly && styles.savedChipActive]}>
          <Text style={[styles.recentChipText, showSavedOnly && styles.savedChipText]}>Saved · {savedGuideItemIds.length}</Text>
        </Pressable>
      </View>
      <View accessibilityLiveRegion="polite" style={styles.guideHeader}>
        <View><Text style={styles.sectionKicker}>{query ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : `${guideItemCount} items`}</Text><Text accessibilityRole="header" style={styles.sectionTitle}>{query ? 'Best route' : 'Common household items'}</Text></View>
        <View style={styles.checkPill}><Ionicons color={theme.warning} name="alert-circle-outline" size={14} /><Text style={styles.checkText}>Check locally</Text></View>
      </View>
    </View>
  );
  const guideList = (
    <FlatList
      contentContainerStyle={styles.guideContent}
      data={results}
      initialNumToRender={12}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(item) => item.id}
      ListEmptyComponent={(
        <View style={styles.empty}><Ionicons color={theme.tertiaryText} name="search-outline" size={28} /><Text style={styles.emptyTitle}>We don’t know that one yet</Text><Text style={styles.emptyText}>Try a shorter name, or use Local services for unusual, hazardous or bulky items.</Text></View>
      )}
      ListHeaderComponent={guideListHeader}
      maxToRenderPerBatch={12}
      renderItem={({ item }) => (
        <GuideResultRow
          item={item}
          onOpen={() => selectGuideItem(item)}
          query={query}
          saved={savedGuideItemIds.includes(item.id)}
          toggleSaved={() => toggleSavedGuideItem(item.id)}
        />
      )}
      showsVerticalScrollIndicator={false}
      windowSize={7}
    />
  );

  return (
    <AppShell activeRoute="/guide">
      <RouteHead
        title="Recycling Guide"
        description="Search household items to see whether they belong in a bin or need a local recycling service."
        path="/guide"
      />
      <View style={styles.page}>
        <ResidentScreenHeader kicker="Guide" subtitle="Search the recycling guide or find a verified local service." title="What are you throwing away?" />
        {mode === 'guide' ? (
          <View style={styles.workspace}>
            <View style={[styles.masterPane, adaptive.mode === 'compact' && styles.masterPaneCompact]}>{guideList}</View>
            {adaptive.mode !== 'compact' ? (
              <GuideDetail
                closeAction={() => setSelected(undefined)}
                collections={collections}
                councilName={activeAddress?.councilName}
                findService={(item) => { setSelected(undefined); switchToServices(item); }}
                item={selectedItem}
                openPartner={openPartner}
                partners={selectedPartners}
                saved={Boolean(selected && savedGuideItemIds.includes(selected))}
                toggleSaved={() => { if (selected) toggleSavedGuideItem(selected); }}
              />
            ) : null}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" nativeID="services-panel" style={styles.hiddenPanel} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.servicesContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <CouncilNotices placement="guide" profile={activeCouncilProfile} />
            {modePicker}
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" nativeID="guide-panel" style={styles.hiddenPanel} />
            <LocalServicesPanel
              activeAddress={activeAddress}
              clearItem={() => { setServiceItem(undefined); setServiceFilter('all'); }}
              error={serviceError}
              finding={finding}
              onFind={() => void findServices()}
              onOpenDirections={openDirections}
              serviceFilter={serviceFilter}
              serviceItem={serviceItem}
              services={services}
              setServiceFilter={setServiceFilter}
            />
          </ScrollView>
        )}
      </View>
    </AppShell>
  );
}

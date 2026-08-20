import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { GuideDetail } from '@/components/guide-detail';
import { RouteHead } from '@/components/route-head';
import { type CouncilProfile } from '@/lib/council-provider';
import { guideItems, type GuideItem } from '@/lib/household-guide';
import { recordPartnerConversion } from '@/lib/resident-council-links';
import { useAppTheme } from '@/lib/theme';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useProductState } from '@/lib/use-product-state';

export default function GuideItemScreen() {
  const theme = useAppTheme();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { activeAddress, collections } = useAppData();
  const profile = useCouncilProfile(activeAddress?.providerId);
  const analytics = usePilotAnalytics();
  const { savedGuideItemIds, showSponsoredServices, toggleSavedGuideItem } = useProductState();
  const baseItem = guideItems.find((candidate) => candidate.id === itemId);
  const localRule = baseItem && profile?.featureFlags?.recyclingGuide !== false ? profile?.guidance?.[baseItem.id] : undefined;
  const item = baseItem ? { ...baseItem, ...localRule } : undefined;
  const partners = item && showSponsoredServices && profile?.featureFlags?.partnerServices
    ? profile.partners?.filter((partner) => partner.itemKeys.includes(item.id))
    : undefined;

  function findService(selectedItem: GuideItem) {
    router.replace({ pathname: '/guide', params: { item: selectedItem.id, mode: 'services' } });
  }

  function openPartner(partner: NonNullable<CouncilProfile['partners']>[number], selectedItem: GuideItem) {
    if (partner.category === 'bulky-waste') {
      router.push({ pathname: '/bulky-booking', params: { item: selectedItem.id, partner: partner.id } });
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

  return (
    <AppShell activeRoute="/guide">
      <RouteHead
        description={item ? `Disposal and preparation guidance for ${item.name}.` : 'Household recycling guidance.'}
        path={item ? `/guide/${item.id}` : '/guide'}
        private
        title={item?.name ?? 'Guide item'}
      />
      {item ? (
        <GuideDetail
          closeAction={() => router.back()}
          collections={collections}
          councilName={activeAddress?.councilName}
          findService={findService}
          item={item}
          openPartner={openPartner}
          partners={partners}
          saved={savedGuideItemIds.includes(item.id)}
          toggleSaved={() => toggleSavedGuideItem(item.id)}
          variant="page"
        />
      ) : (
        <View style={[styles.missing, { backgroundColor: theme.background }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Guide item not found</Text>
          <Text style={[styles.body, { color: theme.secondaryText }]}>It may have moved or the link may be out of date.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/guide')} style={[styles.button, { backgroundColor: theme.accentFill }]}><Text style={styles.buttonText}>Back to Guide</Text></Pressable>
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  button: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 18 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { BulkyBookingItemKey, BulkyBookingStatus, getBulkyBookingStatus, startBulkyBooking } from '@/lib/bulky-bookings';
import { appFonts } from '@/lib/design-system';
import { useAppTheme } from '@/lib/theme';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';

const bulkyItems: { key: BulkyBookingItemKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'sofa', label: 'Sofa', icon: 'bed-outline' },
  { key: 'mattress', label: 'Mattress', icon: 'layers-outline' },
  { key: 'bed-frame', label: 'Bed frame', icon: 'grid-outline' },
  { key: 'furniture', label: 'Furniture', icon: 'home-outline' },
  { key: 'large-appliance', label: 'Large appliance', icon: 'cube-outline' },
  { key: 'other-bulky-item', label: 'Other item', icon: 'ellipsis-horizontal-circle-outline' },
];

function money(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

export default function BulkyBookingScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { activeAddress } = useAppData();
  const profile = useCouncilProfile(activeAddress?.providerId);
  const params = useLocalSearchParams<{ booking?: string; reference?: string }>();
  const [itemKey, setItemKey] = useState<BulkyBookingItemKey>('mattress');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState<string>();
  const [booking, setBooking] = useState<BulkyBookingStatus>();
  const [statusError, setStatusError] = useState<string>();
  const partners = profile?.providerId === activeAddress?.providerId
    && profile?.featureFlags?.bulkyWasteBooking
    ? profile?.partners?.filter((partner) => partner.category === 'bulky-waste' && partner.bookingMode !== undefined)
    : undefined;

  useEffect(() => {
    if (params.booking !== 'success' || !params.reference) return;
    let active = true;
    void getBulkyBookingStatus(params.reference)
      .then((result) => { if (active) setBooking(result); })
      .catch((error) => { if (active) setStatusError(error instanceof Error ? error.message : 'The booking is still being confirmed.'); });
    return () => { active = false; };
  }, [params.booking, params.reference]);

  async function begin(partnerId?: string) {
    if (!activeAddress?.providerId) {
      router.push('/places');
      return;
    }
    setBusy(partnerId ?? 'official');
    try {
      const result = await startBulkyBooking({
        councilProviderId: activeAddress.providerId,
        itemKey,
        quantity,
        partnerId,
      });
      await Linking.openURL(result.url);
    } catch (error) {
      Alert.alert('Booking could not be opened', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <AppShell activeRoute="/bulky-booking">
      <RouteHead title="Bulky-waste booking" description="Compare official and approved bulky-waste collection options." path="/bulky-booking" />
      <View style={styles.page}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <Pressable accessibilityLabel="Back to Guide" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><Ionicons color={theme.accent} name="chevron-back" size={25} /></Pressable>
          <Text style={styles.headerTitle}>Bulky collection</Text>
          <View style={styles.headerButton} />
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Text style={styles.kicker}>BOOK THE RIGHT SERVICE</Text>
            <Text style={styles.title}>What needs collecting?</Text>
            <Text style={styles.subtitle}>The official council route always appears first. Paid services are clearly labelled and only count as revenue after a real booking is confirmed.</Text>
          </View>

          {params.booking === 'success' ? (
            <View accessibilityLiveRegion="polite" style={styles.successCard}>
              <Ionicons color={theme.success} name="checkmark-circle" size={28} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{booking?.status === 'confirmed' ? 'Booking confirmed' : 'Payment received'}</Text>
                <Text style={styles.cardBody}>{booking ? `${booking.partnerName ?? 'Your provider'} · ${booking.reference}` : statusError ?? 'We are waiting for the signed payment confirmation.'}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Item</Text>
            <View style={styles.itemGrid}>{bulkyItems.map((item) => {
              const selected = item.key === itemKey;
              return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={item.key} onPress={() => setItemKey(item.key)} style={[styles.item, selected && styles.itemSelected]}><Ionicons color={selected ? theme.accent : theme.secondaryText} name={item.icon} size={21} /><Text style={[styles.itemText, selected && styles.itemTextSelected]}>{item.label}</Text></Pressable>;
            })}</View>
            <View style={styles.quantityRow}><View><Text style={styles.cardTitle}>How many?</Text><Text style={styles.cardBody}>Use one booking for up to 20 items.</Text></View><View style={styles.stepper}><Pressable accessibilityLabel="Remove one item" accessibilityRole="button" disabled={quantity === 1} onPress={() => setQuantity((value) => Math.max(1, value - 1))} style={styles.stepButton}><Ionicons color={quantity === 1 ? theme.tertiaryText : theme.accent} name="remove" size={20} /></Pressable><Text style={styles.quantity}>{quantity}</Text><Pressable accessibilityLabel="Add one item" accessibilityRole="button" disabled={quantity === 20} onPress={() => setQuantity((value) => Math.min(20, value + 1))} style={styles.stepButton}><Ionicons color={quantity === 20 ? theme.tertiaryText : theme.accent} name="add" size={20} /></Pressable></View></View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Collection options</Text>
            <View style={styles.officialCard}>
              <View style={styles.optionIcon}><Ionicons color={theme.accent} name="business-outline" size={23} /></View>
              <View style={styles.flex}><Text style={styles.optionEyebrow}>OFFICIAL COUNCIL SERVICE</Text><Text style={styles.cardTitle}>{activeAddress?.councilName ?? 'Find your council service'}</Text><Text style={styles.cardBody}>The council’s own booking route and price. What Bin does not take commission from this option.</Text></View>
              <Pressable accessibilityRole="link" disabled={Boolean(busy)} onPress={() => void begin()} style={styles.optionButton}>{busy === 'official' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.optionButtonText}>Continue</Text>}</Pressable>
            </View>

            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/guide', params: { q: itemKey } })} style={styles.reuseCard}>
              <View style={styles.optionIcon}><Ionicons color={theme.success} name="heart-outline" size={23} /></View>
              <View style={styles.flex}><Text style={styles.optionEyebrow}>REUSE FIRST</Text><Text style={styles.cardTitle}>Donate an item in usable condition</Text><Text style={styles.cardBody}>Check charity, reuse and retailer take-back options before paying for disposal.</Text></View><Ionicons color={theme.tertiaryText} name="chevron-forward" size={19} />
            </Pressable>

            {partners?.map((partner) => (
              <View key={partner.id} style={styles.partnerCard}>
                <View style={styles.optionIcon}><Ionicons color={theme.accent} name="car-outline" size={23} /></View>
                <View style={styles.flex}><Text style={styles.sponsored}>{partner.disclosureLabel}</Text><Text style={styles.cardTitle}>{partner.name}</Text><Text style={styles.cardBody}>{partner.description}</Text>{partner.bookingPricePence ? <Text style={styles.price}>{money(partner.bookingPricePence * quantity)}</Text> : <Text style={styles.cardBody}>Price confirmed by provider</Text>}</View>
                <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={() => void begin(partner.id)} style={styles.optionButton}>{busy === partner.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.optionButtonText}>{partner.bookingMode === 'stripe-connect' ? 'Book & pay' : 'Book'}</Text>}</Pressable>
              </View>
            ))}
            {!partners?.length ? <View style={styles.noPartners}><Ionicons color={theme.secondaryText} name="shield-checkmark-outline" size={20} /><Text style={styles.noPartnersText}>No paid bulky-waste partner is approved for this council yet. Only the official and reuse routes are shown.</Text></View> : null}
          </View>

          <View style={styles.privacyCard}><Ionicons color={theme.secondaryText} name="lock-closed-outline" size={19} /><Text style={styles.privacyText}>What Bin records an anonymous booking reference, item type and booking outcome. We do not copy your name, contact details, postcode or collection address into our booking ledger. Stripe or your chosen provider collects the details needed to fulfil the booking.</Text></View>
        </ScrollView>
      </View>
    </AppShell>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    header: { minHeight: 56, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surface, borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth },
    headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: theme.text, fontFamily: appFonts.text, fontSize: 17, fontWeight: '700' },
    content: { paddingBottom: 118 },
    intro: { paddingHorizontal: 20, paddingTop: 27, paddingBottom: 22, gap: 7 },
    kicker: { color: theme.accent, fontFamily: appFonts.text, fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
    title: { color: theme.text, fontFamily: appFonts.display, fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -1 },
    subtitle: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 15, lineHeight: 21 },
    section: { paddingHorizontal: 16, paddingBottom: 24, gap: 11 },
    sectionLabel: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 13, fontWeight: '700', marginLeft: 4 },
    itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    item: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, backgroundColor: theme.surface },
    itemSelected: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    itemText: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 14, fontWeight: '600' },
    itemTextSelected: { color: theme.accent },
    quantityRow: { minHeight: 76, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 16, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    stepper: { height: 38, flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: theme.groupedBackground },
    stepButton: { width: 42, height: 38, alignItems: 'center', justifyContent: 'center' },
    quantity: { minWidth: 30, color: theme.text, textAlign: 'center', fontFamily: appFonts.text, fontSize: 16, fontWeight: '700' },
    officialCard: { padding: 14, borderRadius: 17, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.accent, flexDirection: 'row', alignItems: 'center', gap: 11 },
    reuseCard: { padding: 14, borderRadius: 17, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, flexDirection: 'row', alignItems: 'center', gap: 11 },
    partnerCard: { padding: 14, borderRadius: 17, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, flexDirection: 'row', alignItems: 'center', gap: 11 },
    optionIcon: { width: 46, height: 46, borderRadius: 13, backgroundColor: theme.groupedBackground, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1, gap: 3 },
    optionEyebrow: { color: theme.accent, fontFamily: appFonts.text, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
    sponsored: { color: theme.warning, fontFamily: appFonts.text, fontSize: 10, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
    cardTitle: { color: theme.text, fontFamily: appFonts.text, fontSize: 16, lineHeight: 20, fontWeight: '700' },
    cardBody: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 13, lineHeight: 18 },
    price: { color: theme.text, fontFamily: appFonts.text, fontSize: 15, fontWeight: '800', marginTop: 3 },
    optionButton: { minWidth: 76, minHeight: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    optionButtonText: { color: '#FFFFFF', fontFamily: appFonts.text, fontSize: 13, fontWeight: '700' },
    noPartners: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 14, borderRadius: 14, backgroundColor: theme.groupedBackground },
    noPartnersText: { flex: 1, color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 13, lineHeight: 18 },
    privacyCard: { marginHorizontal: 16, marginBottom: 24, padding: 15, borderRadius: 16, backgroundColor: theme.groupedBackground, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    privacyText: { flex: 1, color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 12, lineHeight: 18 },
    successCard: { marginHorizontal: 16, marginBottom: 20, padding: 15, borderRadius: 16, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.success, flexDirection: 'row', alignItems: 'center', gap: 11 },
  });
}

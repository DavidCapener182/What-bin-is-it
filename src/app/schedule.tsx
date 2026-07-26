import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { WasteIcon } from '@/components/bin-glyph';
import { RouteHead } from '@/components/route-head';
import { collectionDisplayMeta, dayDifference, formatCollectionDate, sortCollections } from '@/lib/data';
import { appColours, appFonts } from '@/lib/design-system';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import { useAppData } from '@/lib/use-app-data';
import { useOnlineStatus } from '@/lib/use-online-status';

export default function ScheduleScreen() {
  const {
    collections,
    activeAddress,
    sourceStatus,
    collectionDataState,
    lastError,
    changeNotice,
    refreshing,
    refreshCollections,
  } = useAppData();
  const online = useOnlineStatus();
  const upcoming = sortCollections(collections).filter((collection) => dayDifference(collection.date) >= 0);
  const grouped = upcoming.reduce<Record<string, typeof collections>>((result, collection) => {
    result[collection.date] = [...(result[collection.date] ?? []), collection];
    return result;
  }, {});
  const exactAddressRequired = activeAddress
    ? requiresExactCouncilAddress(activeAddress.providerId, activeAddress.councilAddressId)
    : false;

  async function shareSchedule() {
    if (!activeAddress || !upcoming.length) return;
    const lines = upcoming.slice(0, 8).map((collection) => (
      `${formatCollectionDate(collection.date, 'weekday')}: ${collectionDisplayMeta(collection).label}`
    ));
    await Share.share({
      title: `Bin collections for ${activeAddress.label}`,
      message: [`Bin collections for ${activeAddress.label}`, ...lines, '', 'Shared from What Bin Is It Tonight?'].join('\n'),
    });
  }

  const statusText = !online
    ? upcoming.length
      ? 'Offline · showing your saved council dates'
      : 'You’re offline · reconnect to check your council'
    : collectionDataState === 'cached'
      ? `Showing saved dates · ${lastError ?? 'the latest check did not complete'}`
      : collectionDataState === 'error'
        ? `Couldn’t verify · ${lastError ?? 'try again in a moment'}`
        : sourceStatus;

  return (
    <AppShell activeRoute="/schedule">
      <RouteHead
        title="Collection Schedule"
        description="View upcoming verified bin collections for your saved UK address."
        path="/schedule"
      />
      <View style={styles.page}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <Text style={styles.kicker}>YOUR SCHEDULE</Text>
          <Text style={styles.title}>Upcoming collections</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/places')}
            style={({ pressed }) => [styles.addressPill, pressed && styles.pressed]}>
            <Ionicons color="#297C72" name="location" size={16} />
            <Text numberOfLines={1} style={styles.address}>
              {activeAddress ? `${activeAddress.label} · ${activeAddress.postcode}` : 'Add an address'}
            </Text>
            <Ionicons color="#297C72" name="chevron-down" size={14} />
          </Pressable>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {!activeAddress ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons color={appColours.brand} name="location-outline" size={30} /></View>
              <Text style={styles.emptyTitle}>Add your address first</Text>
              <Text style={styles.emptyCopy}>Your postcode connects this schedule to the correct council and property.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/places')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Add an address</Text>
                <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
              </Pressable>
            </View>
          ) : exactAddressRequired ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons color={appColours.brand} name="home-outline" size={30} /></View>
              <Text style={styles.emptyTitle}>Choose your exact property</Text>
              <Text style={styles.emptyCopy}>This council needs a property match before it can return the correct collection round.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/places')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Choose property</Text>
                <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={[styles.statusLine, (!online || collectionDataState === 'cached' || collectionDataState === 'error') && styles.statusLineWarning]}>
                {refreshing
                  ? <ActivityIndicator color={appColours.brand} />
                  : <Ionicons color={!online || collectionDataState === 'cached' || collectionDataState === 'error' ? '#986321' : appColours.brand} name={!online ? 'cloud-offline-outline' : 'checkmark-circle-outline'} size={21} />}
                <Text accessibilityLiveRegion="polite" style={styles.statusText}>{refreshing ? 'Checking the live council source…' : statusText}</Text>
              </View>

              {changeNotice ? (
                <View accessibilityLiveRegion="polite" style={styles.changeNotice}>
                  <Ionicons color="#8C571E" name="alert-circle-outline" size={22} />
                  <View style={styles.changeCopy}>
                    <Text style={styles.changeTitle}>Collection date changed</Text>
                    <Text style={styles.changeBody}>{changeNotice.replace(/^Collection date changed · /, '')}</Text>
                  </View>
                </View>
              ) : null}

              {Object.entries(grouped).map(([date, dayCollections]) => {
                const diff = dayDifference(date);
                return (
                  <View key={date} style={styles.dateSection}>
                    <View style={styles.dateHeader}>
                      <View>
                        <Text style={styles.dateLabel}>{diff === 0 ? 'TODAY' : diff === 1 ? 'TOMORROW' : formatCollectionDate(date, 'day')}</Text>
                        <Text style={styles.dateLong}>{formatCollectionDate(date, 'weekday')}</Text>
                      </View>
                      <View style={[styles.dayStamp, diff === 0 && styles.dayStampToday]}>
                        <Text style={[styles.dayStampText, diff === 0 && styles.dayStampTextToday]}>{formatCollectionDate(date, 'dateNumber')}</Text>
                      </View>
                    </View>
                    <View style={styles.collectionsCard}>
                      {dayCollections.map((collection, index) => {
                        const meta = collectionDisplayMeta(collection);
                        return (
                          <View key={collection.id} style={[styles.collectionRow, index !== dayCollections.length - 1 && styles.collectionBorder]}>
                            <View style={[styles.iconCircle, { backgroundColor: meta.tint }]}><WasteIcon colour={meta.colour} type={collection.wasteType} /></View>
                            <View style={styles.rowCopy}>
                              <Text style={styles.rowTitle}>{meta.label}</Text>
                              <Text style={styles.rowInfo}>{diff === 0 ? 'Collection day' : diff === 1 ? 'Put it out tonight' : 'Put it out the night before'}</Text>
                            </View>
                            <View style={[styles.statusDot, { backgroundColor: meta.colour }]} />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              {!upcoming.length ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}><Ionicons color={appColours.brand} name="calendar-clear-outline" size={30} /></View>
                  <Text style={styles.emptyTitle}>{collectionDataState === 'error' ? 'Council check unavailable' : 'No verified dates yet'}</Text>
                  <Text style={styles.emptyCopy}>{online ? 'Keep this address saved and try the live council check again.' : 'Reconnect to check for collection dates.'}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: refreshing || !online }}
                    disabled={refreshing || !online}
                    onPress={() => void refreshCollections()}
                    style={({ pressed }) => [styles.primaryButton, (!online || refreshing) && styles.disabled, pressed && styles.pressed]}>
                    {refreshing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Check again</Text>}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actionsCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: refreshing || !online }}
                    disabled={refreshing || !online}
                    onPress={() => void refreshCollections()}
                    style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
                    <Ionicons color={appColours.brand} name="refresh" size={21} />
                    <Text style={styles.actionText}>{refreshing ? 'Refreshing…' : 'Refresh council dates'}</Text>
                    <Ionicons color="#6D8588" name="chevron-forward" size={18} />
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={shareSchedule} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
                    <Ionicons color={appColours.brand} name="share-outline" size={21} />
                    <Text style={styles.actionText}>Share this schedule</Text>
                    <Ionicons color="#6D8588" name="chevron-forward" size={18} />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: appColours.background },
  safe: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE6E1' },
  kicker: { color: '#1E7B70', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 1, fontWeight: '700' },
  title: { color: '#14323B', fontFamily: appFonts.display, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1.05, marginTop: 3 },
  addressPill: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', maxWidth: '100%', gap: 6, backgroundColor: '#E8F5EF', borderRadius: 15, paddingHorizontal: 11, marginTop: 12 },
  address: { color: '#276B65', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  content: { padding: 18, paddingBottom: 122, gap: 24 },
  statusLine: { borderRadius: 16, padding: 14, backgroundColor: '#E3F2EC', flexDirection: 'row', gap: 10, alignItems: 'center' },
  statusLineWarning: { backgroundColor: '#F8EDD9' },
  statusText: { flex: 1, color: '#3E6667', fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  changeNotice: { borderRadius: 16, padding: 14, backgroundColor: '#F8EDD9', flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8CFAC' },
  changeCopy: { flex: 1 },
  changeTitle: { color: '#673F18', fontSize: 14, fontWeight: '700' },
  changeBody: { color: '#765128', fontSize: 13, lineHeight: 18, marginTop: 3, fontWeight: '600' },
  dateSection: { gap: 10 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  dateLabel: { color: '#507A78', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.85, fontWeight: '700' },
  dateLong: { color: '#14323B', fontFamily: appFonts.display, fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.45, marginTop: 2 },
  dayStamp: { height: 44, width: 44, borderRadius: 14, backgroundColor: '#E2EAE5', alignItems: 'center', justifyContent: 'center' },
  dayStampToday: { backgroundColor: appColours.brand },
  dayStampText: { color: '#315B5C', fontFamily: appFonts.rounded, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dayStampTextToday: { color: '#FFFFFF' },
  collectionsCard: { backgroundColor: appColours.card, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, overflow: 'hidden', shadowColor: '#1B363A', shadowOpacity: 0.045, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  collectionRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 12 },
  collectionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E3E9E5' },
  iconCircle: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#18343A', fontSize: 15, fontWeight: '800' },
  rowInfo: { color: '#5E777B', fontSize: 12.5, marginTop: 3, fontWeight: '600' },
  statusDot: { height: 8, width: 8, borderRadius: 4 },
  emptyState: { borderRadius: 21, padding: 22, backgroundColor: appColours.card, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, alignItems: 'center' },
  emptyIcon: { height: 54, width: 54, borderRadius: 18, backgroundColor: '#E3F2EC', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#23464B', fontSize: 18, fontWeight: '700', marginTop: 13 },
  emptyCopy: { color: '#60797C', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  primaryButton: { minHeight: 52, alignSelf: 'stretch', borderRadius: 14, backgroundColor: appColours.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  actionsCard: { backgroundColor: appColours.card, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, overflow: 'hidden' },
  actionRow: { minHeight: 56, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E3E9E5' },
  actionText: { flex: 1, color: '#22464A', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
});

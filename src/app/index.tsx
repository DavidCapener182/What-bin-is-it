import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { BinGlyph, WasteIcon } from '@/components/bin-glyph';
import { CollectionBadge } from '@/components/collection-badge';
import { collectionMeta, dayDifference, formatCollectionDate, getNextCollection, wasteTypes } from '@/lib/data';
import { useAppData } from '@/lib/use-app-data';

export default function HomeScreen() {
  const { activeAddress, collections, sourceStatus, refreshing, refreshCollections } = useAppData();
  const next = getNextCollection(collections);
  const daysAway = next ? dayDifference(next.date) : null;
  const soonest = collections.slice(0, 3);

  return (
    <AppShell activeRoute="/">
      <View style={styles.page}>
        <LinearGradient colors={['#071A2B', '#0B2A3B', '#103B4B']} style={styles.hero}>
          <SafeAreaView edges={['top']}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.eyebrow}>GOOD MORNING</Text>
                <Text style={styles.greeting}>Keep the kerb clear.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change address"
                onPress={() => router.push('/places')}
                style={({ pressed }) => [styles.addressButton, pressed && styles.pressed]}>
                <Ionicons color="#E8FFF5" name="location-outline" size={18} />
              </Pressable>
            </View>

            <Pressable onPress={() => router.push('/places')} style={({ pressed }) => [styles.addressLine, pressed && styles.pressed]}>
              <Ionicons color="#8CE1BF" name="home-outline" size={15} />
              <Text numberOfLines={1} style={styles.addressText}>{activeAddress?.label ?? 'Add your address'}</Text>
              <Ionicons color="#8CE1BF" name="chevron-down" size={14} />
            </Pressable>

            <View style={styles.nextRow}>
              <View style={styles.nextCopy}>
                <Text style={styles.nextKicker}>NEXT COLLECTION</Text>
                <Text style={styles.nextDate}>{next ? formatCollectionDate(next.date, 'weekday') : 'No collection found'}</Text>
                {next && (
                  <View style={styles.nextTypes}>
                    <CollectionBadge wasteType={next.wasteType} />
                    {collections[1] && dayDifference(collections[1].date) === daysAway ? (
                      <CollectionBadge wasteType={collections[1].wasteType} />
                    ) : null}
                  </View>
                )}
              </View>
              <View style={styles.countdownOrb}>
                <Text style={styles.countdownNumber}>{daysAway === 0 ? 'TODAY' : daysAway === 1 ? '1' : daysAway ?? '—'}</Text>
                {daysAway !== 0 && <Text style={styles.countdownCaption}>{daysAway === 1 ? 'DAY' : 'DAYS'}</Text>}
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {next ? (
            <Pressable onPress={() => router.push('/calendar')} style={({ pressed }) => [styles.collectionCard, pressed && styles.pressed]}>
              <View style={[styles.collectionColour, { backgroundColor: collectionMeta[next.wasteType].colour }]} />
              <BinGlyph colour={collectionMeta[next.wasteType].colour} size={36} />
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{collectionMeta[next.wasteType].label} bin</Text>
                <Text style={styles.cardBody}>{daysAway === 0 ? 'Put it out before 7am today.' : `Put it out by 7am · ${formatCollectionDate(next.date, 'short')}`}</Text>
              </View>
              <Ionicons color="#71909B" name="chevron-forward" size={20} />
            </Pressable>
          ) : null}

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionKicker}>THE WEEK AHEAD</Text>
              <Text style={styles.sectionTitle}>What goes out?</Text>
            </View>
            <Pressable onPress={() => router.push('/calendar')} style={styles.linkButton}>
              <Text style={styles.linkText}>Calendar</Text>
              <Ionicons color="#0C7568" name="arrow-forward" size={15} />
            </Pressable>
          </View>

          <View style={styles.scheduleList}>
            {soonest.map((collection) => {
              const meta = collectionMeta[collection.wasteType];
              const diff = dayDifference(collection.date);
              return (
                <View key={collection.id} style={styles.scheduleRow}>
                  <View style={styles.dayBlock}>
                    <Text style={styles.dayName}>{diff === 0 ? 'TODAY' : formatCollectionDate(collection.date, 'day')}</Text>
                    <Text style={styles.dayNumber}>{formatCollectionDate(collection.date, 'dateNumber')}</Text>
                  </View>
                  <View style={[styles.iconDisc, { backgroundColor: meta.tint }]}>
                    <WasteIcon colour={meta.colour} type={collection.wasteType} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{meta.label}</Text>
                    <Text style={styles.rowBody}>{diff === 0 ? 'Set out before 7am' : diff === 1 ? 'Tomorrow' : formatCollectionDate(collection.date, 'short')}</Text>
                  </View>
                  <View style={[styles.dot, { backgroundColor: meta.colour }]} />
                </View>
              );
            })}
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionKicker}>YOUR BINS</Text>
              <Text style={styles.sectionTitle}>Collection guide</Text>
            </View>
          </View>
          <View style={styles.guideGrid}>
            {wasteTypes.map((type) => {
              const meta = collectionMeta[type];
              return (
                <View key={type} style={[styles.guideCard, { backgroundColor: meta.tint }]}>
                  <WasteIcon colour={meta.colour} type={type} />
                  <Text style={styles.guideTitle}>{meta.label}</Text>
                  <Text style={styles.guideDescription}>{meta.example}</Text>
                </View>
              );
            })}
          </View>

          <Pressable onPress={() => router.push('/find' as Href)} style={({ pressed }) => [styles.findCard, pressed && styles.pressed]}>
            <View style={styles.findIcon}><Ionicons color="#EDFFF8" name="search" size={21} /></View>
            <View style={styles.findCopy}><Text style={styles.findTitle}>Not sure where it goes?</Text><Text style={styles.findBody}>Search the bin guide or find a nearby council tip.</Text></View>
            <Ionicons color="#9FDECB" name="arrow-forward" size={20} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={refreshing}
            onPress={refreshCollections}
            style={({ pressed }) => [styles.sourceCard, pressed && styles.pressed, refreshing && styles.disabled]}>
            <View style={styles.sourceIcon}><Ionicons color="#0A6C61" name="sync-outline" size={19} /></View>
            <View style={styles.sourceCopy}>
              <Text style={styles.sourceTitle}>{refreshing ? 'Refreshing your schedule…' : 'Collection source'}</Text>
              <Text style={styles.sourceBody}>{sourceStatus}</Text>
            </View>
            <Ionicons color="#71909B" name="chevron-forward" size={19} />
          </Pressable>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F4EE' },
  hero: { paddingHorizontal: 20, paddingBottom: 28, borderBottomLeftRadius: 34, borderBottomRightRadius: 34 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  eyebrow: { color: '#8CE1BF', fontSize: 10, letterSpacing: 1.55, fontWeight: '800' },
  greeting: { color: '#F6FFF9', fontSize: 28, fontFamily: 'Georgia', letterSpacing: -0.8, marginTop: 3 },
  addressButton: { height: 40, width: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  addressLine: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', maxWidth: '85%' },
  addressText: { color: '#B6E9D2', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  nextRow: { marginTop: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  nextCopy: { flex: 1 },
  nextKicker: { color: '#89BDAA', fontSize: 10, letterSpacing: 1.4, fontWeight: '800' },
  nextDate: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', letterSpacing: -0.6, marginTop: 5 },
  nextTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  countdownOrb: { height: 90, width: 90, borderRadius: 45, borderWidth: 1, borderColor: 'rgba(164,255,214,0.44)', backgroundColor: 'rgba(2,13,23,0.22)', alignItems: 'center', justifyContent: 'center' },
  countdownNumber: { color: '#B9FFD8', fontSize: 24, fontWeight: '900', letterSpacing: -0.7 },
  countdownCaption: { color: '#8CE1BF', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 1 },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 120, gap: 24 },
  collectionCard: { overflow: 'hidden', minHeight: 88, backgroundColor: '#FFFFFF', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingRight: 16, shadowColor: '#142329', shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  collectionColour: { width: 7, alignSelf: 'stretch', marginRight: 13 },
  cardCopy: { flex: 1, marginLeft: 12 },
  cardTitle: { color: '#102B35', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  cardBody: { color: '#61737A', fontSize: 12.5, marginTop: 4, fontWeight: '500' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionKicker: { color: '#758D8D', fontSize: 10, letterSpacing: 1.4, fontWeight: '800' },
  sectionTitle: { color: '#14323B', fontFamily: 'Georgia', fontSize: 24, letterSpacing: -0.55, marginTop: 4 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  linkText: { color: '#0C7568', fontSize: 13, fontWeight: '800' },
  scheduleList: { backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  scheduleRow: { minHeight: 77, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7ECE8', gap: 11 },
  dayBlock: { width: 42, alignItems: 'center' },
  dayName: { color: '#758D8D', fontSize: 8, fontWeight: '900', letterSpacing: 0.45 },
  dayNumber: { color: '#15323B', fontFamily: 'Georgia', fontSize: 21, marginTop: 1 },
  iconDisc: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#12313A', fontSize: 14.5, fontWeight: '800' },
  rowBody: { color: '#6D8084', fontSize: 12, fontWeight: '500', marginTop: 2 },
  dot: { height: 8, width: 8, borderRadius: 4 },
  guideGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  guideCard: { width: '48.4%', minHeight: 116, borderRadius: 17, padding: 14, gap: 8 },
  guideTitle: { color: '#18333C', fontSize: 13.5, fontWeight: '800', marginTop: 1 },
  guideDescription: { color: '#597178', fontSize: 11, fontWeight: '500', lineHeight: 15 },
  findCard: { backgroundColor: '#204B48', borderRadius: 19, minHeight: 75, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  findIcon: { height: 38, width: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D8375' },
  findCopy: { flex: 1 },
  findTitle: { color: '#F3FFF9', fontSize: 14, fontWeight: '900' },
  findBody: { color: '#B4D4C8', fontSize: 11, marginTop: 3, fontWeight: '600' },
  sourceCard: { backgroundColor: '#E4F2EC', borderRadius: 18, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 11 },
  sourceIcon: { height: 36, width: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  sourceCopy: { flex: 1 },
  sourceTitle: { color: '#10363A', fontSize: 13, fontWeight: '800' },
  sourceBody: { color: '#547179', fontSize: 11.5, fontWeight: '500', marginTop: 3 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
});

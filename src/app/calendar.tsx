import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { WasteIcon } from '@/components/bin-glyph';
import { collectionMeta, dayDifference, formatCollectionDate } from '@/lib/data';
import { useAppData } from '@/lib/use-app-data';

export default function CalendarScreen() {
  const { collections, activeAddress } = useAppData();
  const grouped = collections.reduce<Record<string, typeof collections>>((result, collection) => {
    result[collection.date] = [...(result[collection.date] ?? []), collection];
    return result;
  }, {});

  return (
    <AppShell activeRoute="/calendar">
      <View style={styles.page}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <Text style={styles.kicker}>YOUR SCHEDULE</Text>
          <Text style={styles.title}>Collection calendar</Text>
          <View style={styles.addressPill}>
            <Ionicons color="#297C72" name="location" size={14} />
            <Text numberOfLines={1} style={styles.address}>{activeAddress?.label ?? 'No saved address'} · {activeAddress?.postcode}</Text>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.legend}>
            <View style={styles.legendIcon}><Ionicons color="#0E6D63" name="information-circle-outline" size={21} /></View>
            <Text style={styles.legendText}>Dates update from your council source when the national gateway is connected.</Text>
          </View>

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
                    const meta = collectionMeta[collection.wasteType];
                    return (
                      <View key={collection.id} style={[styles.collectionRow, index !== dayCollections.length - 1 && styles.collectionBorder]}>
                        <View style={[styles.iconCircle, { backgroundColor: meta.tint }]}><WasteIcon colour={meta.colour} type={collection.wasteType} /></View>
                        <View style={styles.rowCopy}>
                          <Text style={styles.rowTitle}>{meta.label}</Text>
                          <Text style={styles.rowInfo}>{diff === 0 ? 'Set out before 7am' : 'Set out by 7am'}</Text>
                        </View>
                        <View style={[styles.status, { backgroundColor: meta.colour }]} />
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <View style={styles.endCard}>
            <Ionicons color="#7E9697" name="calendar-clear-outline" size={25} />
            <Text style={styles.endTitle}>More dates will appear here</Text>
            <Text style={styles.endCopy}>Your schedule rolls forward automatically as new council data arrives.</Text>
          </View>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F4EE' },
  safe: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E9EEE9' },
  kicker: { color: '#1E7B70', fontSize: 10, letterSpacing: 1.55, fontWeight: '900' },
  title: { color: '#14323B', fontFamily: 'Georgia', fontSize: 30, letterSpacing: -0.8, marginTop: 6 },
  addressPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', maxWidth: '100%', gap: 5, backgroundColor: '#E8F5EF', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginTop: 12 },
  address: { color: '#277068', fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
  content: { padding: 18, paddingBottom: 122, gap: 24 },
  legend: { borderRadius: 16, padding: 13, backgroundColor: '#E3F2EC', flexDirection: 'row', gap: 10, alignItems: 'center' },
  legendIcon: { height: 29, width: 29, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  legendText: { flex: 1, color: '#4F7371', fontSize: 11.5, lineHeight: 16, fontWeight: '600' },
  dateSection: { gap: 10 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  dateLabel: { color: '#507A78', fontSize: 10, letterSpacing: 1.3, fontWeight: '900' },
  dateLong: { color: '#14323B', fontFamily: 'Georgia', fontSize: 20, letterSpacing: -0.3, marginTop: 3 },
  dayStamp: { height: 39, width: 39, borderRadius: 13, backgroundColor: '#E2EAE5', alignItems: 'center', justifyContent: 'center' },
  dayStampToday: { backgroundColor: '#0D7369' },
  dayStampText: { color: '#315B5C', fontSize: 16, fontWeight: '900' },
  dayStampTextToday: { color: '#FFFFFF' },
  collectionsCard: { backgroundColor: '#FFFFFF', borderRadius: 19, overflow: 'hidden', shadowColor: '#1B363A', shadowOpacity: 0.07, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  collectionRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 12 },
  collectionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E3E9E5' },
  iconCircle: { height: 40, width: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#18343A', fontSize: 14.5, fontWeight: '800' },
  rowInfo: { color: '#708486', fontSize: 11.5, marginTop: 3, fontWeight: '600' },
  status: { height: 8, width: 8, borderRadius: 4 },
  endCard: { marginTop: -2, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C7D5CE', borderRadius: 18, padding: 20, alignItems: 'center' },
  endTitle: { color: '#426164', fontSize: 13.5, fontWeight: '800', marginTop: 9 },
  endCopy: { color: '#718586', fontSize: 11.5, textAlign: 'center', lineHeight: 16, marginTop: 4, maxWidth: 230 },
});

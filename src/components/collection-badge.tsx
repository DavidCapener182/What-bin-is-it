import { StyleSheet, Text, View } from 'react-native';

import { collectionMeta } from '@/lib/data';
import { WasteType } from '@/lib/types';

export function CollectionBadge({ wasteType }: { wasteType: WasteType }) {
  const meta = collectionMeta[wasteType];
  return (
    <View style={[styles.badge, { backgroundColor: meta.tint, borderColor: meta.colour }]}>
      <View style={[styles.dot, { backgroundColor: meta.colour }]} />
      <Text style={styles.label}>{meta.shortLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { height: 25, borderRadius: 13, paddingHorizontal: 9, alignItems: 'center', flexDirection: 'row', gap: 5, borderWidth: 1 },
  dot: { height: 6, width: 6, borderRadius: 3 },
  label: { color: '#183A3D', fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
});

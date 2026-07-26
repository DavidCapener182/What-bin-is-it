import { StyleSheet, Text, View } from 'react-native';

import { collectionDisplayMeta } from '@/lib/data';
import { Collection } from '@/lib/types';

export function CollectionBadge({ collection }: { collection: Pick<Collection, 'wasteType' | 'label' | 'colour'> }) {
  const meta = collectionDisplayMeta(collection);
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
  label: { color: '#183A3D', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});

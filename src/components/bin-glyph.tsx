import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { WasteType } from '@/lib/types';

export function BinGlyph({ colour, size = 34 }: { colour: string; size?: number }) {
  return <Ionicons color={colour} name="trash-bin" size={size} />;
}

export function WasteIcon({ colour, type }: { colour: string; type: WasteType }) {
  const icon: Record<WasteType, keyof typeof Ionicons.glyphMap> = {
    general: 'trash-bin',
    recycling: 'refresh-circle',
    garden: 'leaf',
    food: 'nutrition',
  };
  return (
    <View style={styles.icon}>
      <Ionicons color={colour} name={icon[type]} size={23} />
    </View>
  );
}

const styles = StyleSheet.create({ icon: { alignItems: 'center', justifyContent: 'center' } });

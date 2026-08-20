import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { collectionTextColour } from '@/lib/data';
import { type GuideDestination, type GuideItem } from '@/lib/household-guide';
import { type AppTheme, useAppTheme } from '@/lib/theme';

const destinationLabel: Record<GuideDestination, string> = {
  general: 'General waste',
  recycling: 'Mixed recycling',
  garden: 'Garden waste',
  food: 'Food caddy',
  other: 'Council bin',
  service: 'Find a service',
  check: 'Check locally',
};

function destinationColour(destination: GuideDestination, theme: AppTheme) {
  if (destination === 'check') return theme.warning;
  if (destination === 'service') return theme.accent;
  return collectionTextColour(destination, theme.mode);
}

export function GuideResultRow({
  item,
  onOpen,
  query,
  saved,
  toggleSaved,
}: {
  item: GuideItem;
  onOpen: () => void;
  query: string;
  saved: boolean;
  toggleSaved: () => void;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const colour = destinationColour(item.destination, theme);
  const needle = query.trim();
  const index = needle ? item.name.toLowerCase().indexOf(needle.toLowerCase()) : -1;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityHint="Opens disposal and preparation guidance"
        accessibilityLabel={`${item.name}. ${destinationLabel[item.destination]}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <View style={styles.icon}><Ionicons color={colour} name={item.icon as keyof typeof Ionicons.glyphMap} size={22} /></View>
        <View style={styles.copy}>
          <Text style={styles.name}>
            {index < 0 ? item.name : <>{item.name.slice(0, index)}<Text style={styles.highlight}>{item.name.slice(index, index + needle.length)}</Text>{item.name.slice(index + needle.length)}</>}
          </Text>
          <Text style={[styles.destination, { color: colour }]}>{destinationLabel[item.destination]}</Text>
        </View>
        <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
      </Pressable>
      <Pressable
        accessibilityLabel={saved ? `Remove ${item.name} from saved items` : `Save ${item.name}`}
        accessibilityRole="button"
        accessibilityState={{ selected: saved }}
        onPress={toggleSaved}
        style={({ pressed }) => [styles.save, pressed && styles.pressed]}>
        <Ionicons color={saved ? theme.accent : theme.secondaryText} name={saved ? 'bookmark' : 'bookmark-outline'} size={20} />
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: { minHeight: 70, flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator, backgroundColor: theme.surface },
    main: { flex: 1, minHeight: 70, paddingLeft: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
    save: { width: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
    icon: { height: 40, width: 40, borderRadius: 13, backgroundColor: theme.groupedBackground, alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1, minWidth: 0 },
    name: { color: theme.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
    highlight: { color: theme.accent, fontWeight: '800' },
    destination: { fontSize: 12, lineHeight: 17, marginTop: 3, fontWeight: '800' },
    pressed: { opacity: 0.7 },
  });
}

import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { appFonts, platformShadow } from '@/lib/design-system';
import { useAppTheme } from '@/lib/theme';

export type GuideMode = 'guide' | 'services';

export function GuideModePicker({
  mode,
  onChange,
}: {
  mode: GuideMode;
  onChange: (mode: GuideMode) => void;
}) {
  const theme = useAppTheme();
  const modeRefs = useRef<(React.ElementRef<typeof Pressable> | null)[]>([]);

  return (
    <View accessibilityLabel="Guide section" accessibilityRole="tablist" style={[styles.picker, { backgroundColor: theme.groupedBackground }]}>
      {(['guide', 'services'] as const).map((value, index) => {
        const selected = mode === value;
        return (
          <Pressable
            {...(Platform.OS === 'web' ? {
              'aria-controls': value === 'guide' ? 'guide-panel' : 'services-panel',
              'aria-selected': selected,
              tabIndex: selected ? 0 : -1,
              onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const nextIndex = event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + 2) % 2;
                onChange(nextIndex === 0 ? 'guide' : 'services');
                modeRefs.current[nextIndex]?.focus();
              },
            } : {})}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={value}
            onPress={() => onChange(value)}
            ref={(element) => { modeRefs.current[index] = element; }}
            style={[
              styles.option,
              selected && {
                backgroundColor: theme.surface,
                ...platformShadow('0 2px 4px rgba(0, 0, 0, 0.11)', {
                  shadowColor: '#000000',
                  shadowOpacity: 0.11,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }),
              },
            ]}>
            <Ionicons color={selected ? theme.accent : theme.secondaryText} name={value === 'guide' ? 'search-outline' : 'map-outline'} size={17} />
            <Text style={[styles.label, { color: selected ? theme.accent : theme.secondaryText }, selected && styles.labelSelected]}>
              {value === 'guide' ? 'Bin guide' : 'Local services'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { flexDirection: 'row', padding: 3, borderRadius: 12, gap: 2 },
  option: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  label: { fontFamily: appFonts.text, fontSize: 13, fontWeight: '600' },
  labelSelected: { fontWeight: '700' },
});

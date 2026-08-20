import { Platform, StyleSheet, Switch, View } from 'react-native';

import { nonInteractiveStyle } from '@/lib/design-system';
import { useAppTheme } from '@/lib/theme';

export function ToggleIndicator({ value }: { value: boolean }) {
  const theme = useAppTheme();

  if (Platform.OS !== 'web') {
    return (
      <Switch
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={nonInteractiveStyle}
        trackColor={{ false: theme.tertiaryText, true: theme.accent }}
        value={value}
      />
    );
  }

  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.track, { backgroundColor: value ? theme.accentFill : theme.tertiaryText }]}
    >
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: 42, height: 26, borderRadius: 13, padding: 2 },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  thumbOn: { transform: [{ translateX: 16 }] },
});

import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { settingsStyles as styles } from '@/features/settings/settings-styles';
import { ToggleIndicator } from '@/components/toggle-indicator';
import { useAppTheme } from '@/lib/theme';

export function SettingsRow({ icon, title, detail, onPress, danger = false }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { borderBottomColor: theme.separator }, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? `${theme.danger}16` : theme.accentSoft }]}><Ionicons color={danger ? theme.danger : theme.accent} name={icon} size={20} /></View>
      <View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: danger ? theme.danger : theme.text }]}>{title}</Text><Text style={[styles.rowDetail, { color: theme.secondaryText }]}>{detail}</Text></View>
      <Ionicons color={theme.tertiaryText} name="chevron-forward" size={18} />
    </Pressable>
  );
}

export function SettingsToggleRow({ title, detail, value, onChange, disabled = false }: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable aria-checked={value} aria-disabled={disabled} accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} style={({ pressed }) => [styles.toggleRow, { borderBottomColor: theme.separator }, pressed && styles.pressed, disabled && styles.disabled]}>
      <View style={styles.rowCopy}><Text style={[styles.toggleTitle, { color: theme.text }]}>{title}</Text><Text style={[styles.toggleDetail, { color: theme.secondaryText }]}>{detail}</Text></View>
      <ToggleIndicator value={value} />
    </Pressable>
  );
}

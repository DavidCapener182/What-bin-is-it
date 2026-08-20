import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { reportStatusLabels } from '@/features/reports/missed-collection-report-card';
import { reportsStyles as styles } from '@/features/reports/reports-styles';
import { formatCollectionDate } from '@/lib/data';
import { useAppTheme } from '@/lib/theme';
import { type MissedCollectionReport } from '@/lib/types';

export function MissedCollectionReportRow({
  detail,
  isCompact,
  isSelected,
  onPress,
  report,
}: {
  detail?: ReactNode;
  isCompact: boolean;
  isSelected: boolean;
  onPress: () => void;
  report: MissedCollectionReport;
}) {
  const theme = useAppTheme();
  const status = reportStatusLabels[report.status];

  return (
    <View style={styles.rowGroup}>
      <Pressable
        accessibilityHint={isCompact ? 'Shows this report’s full tracking actions below' : 'Shows this report’s full tracking actions in the detail pane'}
        accessibilityLabel={`${report.binLabel}, ${formatCollectionDate(report.collectionDate, 'weekday')}, ${status}`}
        accessibilityRole="button"
        accessibilityState={isCompact ? { expanded: isSelected } : { selected: isSelected }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.reportRow,
          {
            backgroundColor: isSelected ? theme.accentSoft : theme.surface,
            borderColor: isSelected ? theme.accent : theme.separator,
          },
          pressed && styles.pressed,
        ]}>
        <View style={[styles.reportIcon, { backgroundColor: isSelected ? theme.surface : theme.accentSoft }]}>
          <Ionicons color={theme.accent} name="document-text-outline" size={21} />
        </View>
        <View style={styles.rowCopy}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>{report.binLabel}</Text>
          <Text numberOfLines={1} style={[styles.rowMeta, { color: theme.secondaryText }]}>
            {formatCollectionDate(report.collectionDate, 'weekday')} · {report.postcode}
          </Text>
          {!isSelected ? <Text numberOfLines={1} style={[styles.rowStatus, { color: theme.accent }]}>{status}</Text> : null}
        </View>
        <Ionicons color={theme.tertiaryText} name={isCompact && isSelected ? 'chevron-down' : 'chevron-forward'} size={18} />
      </Pressable>
      {detail ? (
        <View accessibilityLiveRegion="polite" style={styles.compactDetail}>
          <Text accessibilityRole="header" style={[styles.detailHeading, { color: theme.text }]}>Report details</Text>
          {detail}
        </View>
      ) : null}
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { appFonts, platformShadow } from '@/lib/design-system';
import { AppTheme, useAppTheme } from '@/lib/theme';
import { useAppData } from '@/lib/use-app-data';
import { buildCollectionWidgetSnapshot } from '@/widgets/widget-data';

export function HomeScreenWidgetCard() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const { activeAddress, collections } = useAppData();
  const snapshot = buildCollectionWidgetSnapshot(activeAddress, collections);
  const native = Platform.OS === 'ios' || Platform.OS === 'android';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Home Screen widgets</Text>
      <View style={styles.card}>
        <View style={styles.introRow}>
          <View style={styles.icon}>
            <Ionicons color={theme.accent} name="apps-outline" size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>
              {native ? 'What Bin Tonight? widget' : 'Native widget preview'}
            </Text>
            <Text style={styles.text}>
              {native
                ? 'Long-press your Home Screen, choose Add Widget or Widgets, then search for What Bin Tonight?.'
                : 'Web apps cannot appear in the iOS or Android widget gallery. This widget is included in the native App Store and Google Play builds.'}
            </Text>
          </View>
        </View>

        <View
          accessibilityLabel={`${snapshot.headline}. ${snapshot.detail}`}
          style={[styles.preview, { backgroundColor: snapshot.binColour }]}>
          <View style={styles.previewCopy}>
            <Text style={[styles.previewKicker, { color: snapshot.secondaryColour }]}>
              {snapshot.kicker}
            </Text>
            <Text numberOfLines={2} style={[styles.previewHeadline, { color: snapshot.foregroundColour }]}>
              {snapshot.headline}
            </Text>
            <Text numberOfLines={1} style={[styles.previewDetail, { color: snapshot.secondaryColour }]}>
              {snapshot.detail}
            </Text>
          </View>
          <View style={styles.previewSide}>
            <Text style={[styles.previewCountdown, { color: snapshot.foregroundColour }]}>
              {snapshot.countdown}
            </Text>
            <Text numberOfLines={1} style={[styles.previewAddress, { color: snapshot.secondaryColour }]}>
              {snapshot.addressLabel}
            </Text>
          </View>
        </View>

        <View style={styles.noteRow}>
          <Ionicons color={theme.success} name="checkmark-circle-outline" size={17} />
          <Text style={styles.noteText}>
            Uses the selected address, verified council dates and the main bin colour. Small and medium sizes are included.
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: { gap: 9 },
    sectionLabel: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.35, fontWeight: '700', paddingHorizontal: 2 },
    card: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, overflow: 'hidden' },
    introRow: { minHeight: 88, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
    icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1 },
    title: { color: theme.text, fontFamily: appFonts.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.15 },
    text: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: '500' },
    preview: { minHeight: 122, marginHorizontal: 14, marginBottom: 14, borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, ...platformShadow('0 5px 10px rgba(0, 0, 0, 0.13)', { shadowColor: '#000000', shadowOpacity: 0.13, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 }) },
    previewCopy: { flex: 1, minWidth: 0, gap: 3 },
    previewKicker: { fontSize: 10, letterSpacing: 0.5, fontWeight: '800' },
    previewHeadline: { fontFamily: appFonts.rounded, fontSize: 19, lineHeight: 22, letterSpacing: -0.45, fontWeight: '800' },
    previewDetail: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
    previewSide: { width: 72, alignItems: 'flex-end', gap: 4 },
    previewCountdown: { fontFamily: appFonts.rounded, fontSize: 13, fontWeight: '800', textAlign: 'right' },
    previewAddress: { maxWidth: 72, fontSize: 11, fontWeight: '700', textAlign: 'right' },
    noteRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator, minHeight: 54, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    noteText: { color: theme.secondaryText, flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  });
}

import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CouncilProfile } from '@/lib/council-provider';
import { AppTheme, useAppTheme } from '@/lib/theme';

export type CouncilNoticePlacement = 'home' | 'schedule' | 'guide';

export function CouncilNotices({
  profile,
  placement,
}: {
  profile?: CouncilProfile;
  placement: CouncilNoticePlacement;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const announcements = (profile?.announcements ?? [])
    .filter((item) => item.placements.includes(placement))
    .slice(0, 3);
  const disruptions = (profile?.disruptions ?? []).slice(0, 2);
  if (!announcements.length && !disruptions.length) return null;
  return (
    <View accessibilityLabel="Council service updates" style={styles.group}>
      <View style={styles.heading}>
        <Ionicons color={theme.accent} name="radio-outline" size={18} />
        <Text style={styles.headingText}>Updates from {profile?.branding?.displayName ?? profile?.councilName ?? 'your council'}</Text>
      </View>
      {disruptions.map((item) => (
        <Pressable
          accessibilityRole={item.sourceUrl ? 'link' : undefined}
          key={`disruption-${item.id}`}
          onPress={item.sourceUrl ? () => void Linking.openURL(item.sourceUrl!) : undefined}
          style={({ pressed }) => [styles.notice, styles.disruption, pressed && styles.pressed]}>
          <View style={styles.noticeIcon}><Ionicons color={theme.warning} name="warning-outline" size={20} /></View>
          <View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.body}>{item.residentInstruction}</Text></View>
          {item.sourceUrl ? <Ionicons color={theme.secondaryText} name="open-outline" size={17} /> : null}
        </Pressable>
      ))}
      {announcements.map((item) => (
        <Pressable
          accessibilityRole={item.sourceUrl ? 'link' : undefined}
          key={`announcement-${item.id}`}
          onPress={item.sourceUrl ? () => void Linking.openURL(item.sourceUrl!) : undefined}
          style={({ pressed }) => [styles.notice, item.severity === 'critical' && styles.disruption, pressed && styles.pressed]}>
          <View style={styles.noticeIcon}><Ionicons color={item.severity === 'critical' ? theme.warning : theme.accent} name={item.kind === 'education' ? 'bulb-outline' : 'megaphone-outline'} size={20} /></View>
          <View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.body}>{item.body}</Text></View>
          {item.sourceUrl ? <Ionicons color={theme.secondaryText} name="open-outline" size={17} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    group: { gap: 8 },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 3 },
    headingText: { color: theme.secondaryText, fontSize: 12.5, fontWeight: '700' },
    notice: {
      minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14,
      borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator,
      borderRadius: 15, backgroundColor: theme.surface,
    },
    disruption: { borderColor: `${theme.warning}55`, backgroundColor: `${theme.warning}10` },
    noticeIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: theme.groupedBackground },
    copy: { flex: 1 },
    title: { color: theme.text, fontSize: 14, fontWeight: '800' },
    body: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: '600' },
    pressed: { opacity: .7 },
  });
}

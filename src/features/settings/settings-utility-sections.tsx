import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Text, View } from 'react-native';

import { SettingsCategory } from '@/features/settings/settings-model';
import { SettingsRow, SettingsToggleRow } from '@/features/settings/settings-primitives';
import { settingsStyles as styles } from '@/features/settings/settings-styles';
import { useAppTheme } from '@/lib/theme';

export function SettingsUtilitySections({
  analyticsEnabled,
  clearAnalytics,
  confirmClear,
  councilName,
  lastVerifiedAt,
  refreshCollections,
  setAnalyticsEnabled,
  setShowSponsoredServices,
  showSponsoredServices,
  shows,
  sourceStatus,
}: {
  analyticsEnabled: boolean;
  clearAnalytics: () => void;
  confirmClear: () => void;
  councilName?: string;
  lastVerifiedAt?: string;
  refreshCollections: () => void;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setShowSponsoredServices: (enabled: boolean) => void;
  showSponsoredServices: boolean;
  shows: (category: SettingsCategory) => boolean;
  sourceStatus: string;
}) {
  const theme = useAppTheme();
  return (
    <>
      <View style={[styles.section, !shows('privacy') && styles.hidden]}>
        <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Collection data and privacy</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          <SettingsRow detail={councilName ?? 'Add an address to connect its council'} icon="business-outline" onPress={() => router.push('/schedule')} title="Council" />
          <SettingsRow detail={lastVerifiedAt ? new Date(lastVerifiedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : sourceStatus} icon="refresh-outline" onPress={refreshCollections} title="Refresh verified dates" />
          <SettingsRow detail="See how council dates, locations and report routes are sourced" icon="server-outline" onPress={() => router.push('/data-sources')} title="View data sources" />
          <SettingsToggleRow detail="Optional app-improvement events, such as lookup success or failure; council resident counting is separate" onChange={setAnalyticsEnabled} title="Help improve local bin services" value={analyticsEnabled} />
          <SettingsToggleRow detail="Show clearly labelled council-approved services after free council and reuse options" onChange={setShowSponsoredServices} title="Show sponsored local services" value={showSponsoredServices} />
          <View style={styles.privacyRow}><Ionicons color={theme.accent} name="lock-closed-outline" size={20} /><Text style={[styles.privacyText, { color: theme.secondaryText }]}>Saved places, local report tracking, and preferences stay on this device. A separate random installation ID and council identifier provide automatic resident totals without sending your postcode, address, property reference, account or email.</Text></View>
          <SettingsRow detail="Delete optional app-improvement events while keeping saved places and the separate council resident count" icon="shield-checkmark-outline" onPress={clearAnalytics} title="Erase app-improvement evidence" />
          <SettingsRow danger detail="Remove all local addresses, schedules, reports and preferences" icon="trash-outline" onPress={confirmClear} title="Clear all app data" />
        </View>
      </View>

      <View style={[styles.section, !shows('help') && styles.hidden]}>
        <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>Help and feedback</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          <SettingsRow detail="Wrong date, bin, address or council in the app" icon="flag-outline" onPress={() => router.push('/report-incorrect')} title="Report incorrect app information" />
          <SettingsRow detail="Help with using the app" icon="help-circle-outline" onPress={() => router.push({ pathname: '/support', params: { topic: 'app-help' } })} title="Help" />
          <SettingsRow detail="Tell us about a crash or feature that did not work" icon="bug-outline" onPress={() => router.push({ pathname: '/support', params: { topic: 'app-problem' } })} title="Report an app problem" />
          <SettingsRow detail="Request another household item or search term" icon="add-circle-outline" onPress={() => router.push({ pathname: '/support', params: { topic: 'guide-item' } })} title="Suggest an item" />
          <SettingsRow detail="Open the support form" icon="mail-outline" onPress={() => router.push('/support')} title="Contact support" />
        </View>
      </View>

      <View style={[styles.section, !shows('help') && styles.hidden]}>
        <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>For organisations</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}><SettingsRow detail="Council pilots, housing providers and managed-property plans" icon="business-outline" onPress={() => router.push('/partners')} title="Council and property partnerships" /></View>
      </View>

      <View style={[styles.section, !shows('about') && styles.hidden]}>
        <Text style={[styles.sectionLabel, { color: theme.secondaryText }]}>About</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          <View style={styles.about}><Text style={[styles.aboutName, { color: theme.text }]}>What Bin Is It Tonight?</Text><Text style={[styles.aboutDetail, { color: theme.secondaryText }]}>Version 1.1.0 · Verified council dates only</Text></View>
          <SettingsRow detail="How local information is stored and requested" icon="lock-closed-outline" onPress={() => router.push('/privacy')} title="Privacy" />
          <SettingsRow detail="Important limits and safe-use information" icon="document-outline" onPress={() => router.push('/terms')} title="Terms" />
          <SettingsRow detail="Council, postcode, report and map providers" icon="server-outline" onPress={() => router.push('/data-sources')} title="Data sources" />
          <SettingsRow detail="Recorded incidents, components and council coverage" icon="pulse-outline" onPress={() => router.push('/status' as Href)} title="Service status" />
        </View>
      </View>
    </>
  );
}

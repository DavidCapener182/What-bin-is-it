import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppShell } from '@/components/app-shell';
import { PwaSettingsCard } from '@/components/pwa-settings-card';
import { councilGatewayConfigured } from '@/lib/council-provider';
import { collectionMeta, wasteTypes } from '@/lib/data';
import { appColours, appFonts } from '@/lib/design-system';
import { requestNotificationPermission } from '@/lib/notifications';
import { WasteType } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';

const times = [{ hour: 18, label: '6pm' }, { hour: 19, label: '7pm' }, { hour: 20, label: '8pm' }];

export default function SettingsScreen() {
  const { preferences, addresses, updatePreferences, toggleWasteType } = useAppData();
  const [busy, setBusy] = useState(false);
  const gatewayConfigured = councilGatewayConfigured;

  async function changeNotifications(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const permission = await requestNotificationPermission();
        if (!permission.granted) {
          Alert.alert('Notifications are off', permission.reason);
          return;
        }
      }
      updatePreferences({ enabled: next });
    } catch {
      Alert.alert('Could not update reminders', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function changeTime(hour: number) {
    updatePreferences({ reminderHour: hour });
  }

  function changeWasteType(type: WasteType) {
    toggleWasteType(type);
  }

  return (
    <AppShell activeRoute="/settings">
      <View style={styles.page}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <Text style={styles.kicker}>MAKE IT YOURS</Text>
          <Text style={styles.title}>Settings</Text>
        </SafeAreaView>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PwaSettingsCard />
          <View style={styles.reminderHero}>
            <View style={styles.bell}><Ionicons color="#ECFFF5" name="notifications" size={24} /></View>
            <View style={styles.heroCopy}><Text style={styles.heroTitle}>Never miss bin day</Text><Text style={styles.heroText}>{addresses.length ? 'We’ll remind you before verified collections across every saved address.' : 'Add an address and verified council dates to start reminders.'}</Text></View>
            <Switch disabled={busy} value={preferences.enabled} onValueChange={changeNotifications} thumbColor="#FFFFFF" trackColor={{ false: '#839C9E', true: '#34C759' }} />
          </View>

          <View style={styles.section}><Text style={styles.sectionLabel}>REMINDER TIME</Text><View style={styles.timePicker}>{times.map((time) => <Pressable accessibilityRole="button" accessibilityState={{ selected: preferences.reminderHour === time.hour, disabled: busy }} disabled={busy} key={time.hour} onPress={() => changeTime(time.hour)} style={[styles.timeOption, preferences.reminderHour === time.hour && styles.timeOptionActive]}><Text style={[styles.timeText, preferences.reminderHour === time.hour && styles.timeTextActive]}>{time.label}</Text></Pressable>)}</View></View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WHICH BINS?</Text>
            <View style={styles.settingCard}>
              {wasteTypes.map((type, index) => {
                const meta = collectionMeta[type];
                return (
                  <View key={type} style={[styles.binSetting, index !== wasteTypes.length - 1 && styles.binBorder]}>
                    <View style={[styles.typeDot, { backgroundColor: meta.colour }]} />
                    <Text style={styles.binLabel}>{meta.label}</Text>
                    <Switch accessibilityLabel={`${meta.label} reminders`} disabled={busy} value={preferences.wasteTypes[type]} onValueChange={() => changeWasteType(type)} thumbColor="#FFFFFF" trackColor={{ false: '#CFDBD8', true: '#34C759' }} />
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COLLECTION DATA</Text>
            <View style={styles.settingCard}>
              <View style={styles.infoRow}><View style={[styles.roundIcon, { backgroundColor: '#E4F3ED' }]}><Ionicons color="#0A736A" name={gatewayConfigured ? 'cloud-done-outline' : 'cloud-offline-outline'} size={19} /></View><View style={styles.infoCopy}><Text style={styles.infoTitle}>Council data gateway</Text><Text style={styles.infoText}>{gatewayConfigured ? 'Provider endpoint is configured for this build' : 'Connect a provider endpoint in build settings'}</Text></View><View style={[styles.pendingPill, gatewayConfigured && styles.connectedPill]}><Text style={[styles.pendingText, gatewayConfigured && styles.connectedText]}>{gatewayConfigured ? 'READY' : 'SETUP'}</Text></View></View>
              <View style={styles.dataLine}><Ionicons color="#6E888A" name="lock-closed-outline" size={14} /><Text style={styles.dataText}>Your postcode is used to find council addresses. Only the selected council property ID is sent when checking live dates.</Text></View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <View style={styles.settingCard}>
              <View style={styles.aboutRow}><Text style={styles.aboutLabel}>App</Text><Text style={styles.aboutValue}>What Bin Is It Tonight? · 1.0.0</Text></View>
              <View style={styles.aboutRow}><Text style={styles.aboutLabel}>Platform</Text><Text style={styles.aboutValue}>{Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'Web app'}</Text></View>
            </View>
          </View>
          <Text style={styles.footer}>Built to make collection day simple.</Text>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: appColours.background },
  safe: { backgroundColor: '#FFFFFF', paddingTop: 14, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E8EEEA' },
  kicker: { color: '#1D7A70', fontFamily: appFonts.text, fontSize: 10.5, letterSpacing: 1.15, fontWeight: '700' },
  title: { color: '#14323B', fontFamily: appFonts.display, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1.05, marginTop: 3 },
  content: { padding: 18, paddingBottom: 122, gap: 23 },
  reminderHero: { minHeight: 100, backgroundColor: '#092D39', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { height: 43, width: 43, borderRadius: 15, backgroundColor: '#0B756A', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#F1FFF8', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  heroText: { color: '#A7D5C4', fontSize: 11, lineHeight: 15, marginTop: 4, fontWeight: '500' },
  section: { gap: 9 },
  sectionLabel: { color: '#6C8587', fontFamily: appFonts.text, fontSize: 10.5, letterSpacing: 1.05, fontWeight: '700', paddingHorizontal: 2 },
  timePicker: { flexDirection: 'row', backgroundColor: '#E1E7E3', padding: 3, borderRadius: 12, gap: 2 },
  timeOption: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  timeOptionActive: { backgroundColor: '#FFFFFF', shadowColor: '#12323A', shadowOpacity: 0.11, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  timeText: { color: '#6A8486', fontFamily: appFonts.text, fontSize: 13, fontWeight: '600' },
  timeTextActive: { color: '#0C7168' },
  settingCard: { backgroundColor: appColours.card, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, overflow: 'hidden', shadowColor: '#18333A', shadowOpacity: 0.045, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  binSetting: { height: 57, paddingHorizontal: 15, alignItems: 'center', flexDirection: 'row', gap: 10 },
  binBorder: { borderBottomColor: '#E5ECE7', borderBottomWidth: StyleSheet.hairlineWidth },
  typeDot: { width: 12, height: 12, borderRadius: 6 },
  binLabel: { flex: 1, color: '#1F4146', fontSize: 13.5, fontWeight: '800' },
  infoRow: { padding: 15, flexDirection: 'row', gap: 11, alignItems: 'center' },
  roundIcon: { height: 38, width: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1 },
  infoTitle: { color: '#1D3E43', fontSize: 13.5, fontWeight: '700' },
  infoText: { color: '#718689', fontSize: 10.5, marginTop: 3, fontWeight: '500' },
  pendingPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F9EDD9' },
  pendingText: { color: '#916526', fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  connectedPill: { backgroundColor: '#D2F0DF' },
  connectedText: { color: '#0A6D55' },
  dataLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5ECE7', padding: 13, gap: 7, flexDirection: 'row', alignItems: 'flex-start' },
  dataText: { flex: 1, color: '#6F8587', fontSize: 10.5, lineHeight: 14 },
  aboutRow: { minHeight: 49, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aboutLabel: { color: '#536D70', fontSize: 12.5, fontWeight: '700' },
  aboutValue: { color: '#203F44', fontSize: 12.5, fontWeight: '800' },
  footer: { color: '#849596', textAlign: 'center', fontSize: 11.5, marginTop: -5 },
});

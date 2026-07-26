import { Ionicons } from '@expo/vector-icons';
import { useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getServerWebNotificationStatus,
  getWebNotificationStatus,
  sendTestWebNotification,
  subscribeWebNotificationStatus,
} from '@/lib/notifications.web';
import {
  getPwaServerInstallStatus,
  getPwaInstallStatus,
  installPwa,
  subscribePwaInstallStatus,
} from '@/lib/pwa-install.web';
import { appColours, appFonts } from '@/lib/design-system';

export function PwaSettingsCard() {
  const install = useSyncExternalStore(
    subscribePwaInstallStatus,
    getPwaInstallStatus,
    getPwaServerInstallStatus
  );
  const notifications = useSyncExternalStore(
    subscribeWebNotificationStatus,
    getWebNotificationStatus,
    getServerWebNotificationStatus
  );
  const [busy, setBusy] = useState(false);

  async function handleInstall() {
    setBusy(true);
    try {
      const result = await installPwa();
      if (result.reason) Alert.alert('Add this app', result.reason);
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    try {
      await sendTestWebNotification();
    } catch (error) {
      Alert.alert(
        'Test notification failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  const statusColour = notifications.state === 'error'
    ? '#A74638'
    : notifications.state === 'scheduled'
      ? '#08735F'
      : '#6B7F81';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>APP INSTALLATION</Text>
      <View style={styles.card}>
        <View style={styles.installRow}>
          <View style={[styles.icon, install.installed && styles.iconInstalled]}>
            <Ionicons
              color={install.installed ? '#EFFFF8' : '#0A736A'}
              name={install.installed ? 'checkmark' : 'phone-portrait-outline'}
              size={20}
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{install.installed ? 'Installed as an app' : 'Add to Home Screen'}</Text>
            <Text style={styles.text}>
              {install.installed
                ? 'Standalone mode is active. The app can work offline after its first load.'
                : 'Install it for a full-screen app icon and reliable phone notifications.'}
            </Text>
          </View>
          {!install.installed && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={handleInstall}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text style={styles.actionText}>{install.canInstall ? 'INSTALL' : 'HOW TO'}</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.statusRow}>
          <Ionicons
            color={statusColour}
            name={notifications.state === 'error' ? 'warning-outline' : 'notifications-outline'}
            size={17}
          />
          <Text style={[styles.statusText, { color: statusColour }]}>{notifications.message}</Text>
        </View>
        {notifications.permission === 'granted' && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={handleTest}
            style={({ pressed }) => [styles.testButton, pressed && styles.pressed]}
          >
            <Ionicons color="#0A736A" name="paper-plane-outline" size={16} />
            <Text style={styles.testText}>{busy ? 'Sending…' : 'Send a test notification'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 9 },
  sectionLabel: { color: '#6C8587', fontFamily: appFonts.text, fontSize: 10.5, letterSpacing: 1.05, fontWeight: '700', paddingHorizontal: 2 },
  card: { backgroundColor: appColours.card, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, overflow: 'hidden', shadowColor: '#18333A', shadowOpacity: 0.045, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  installRow: { minHeight: 88, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#E3F3ED', alignItems: 'center', justifyContent: 'center' },
  iconInstalled: { backgroundColor: '#0B756A' },
  copy: { flex: 1 },
  title: { color: '#1D3E43', fontFamily: appFonts.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.15 },
  text: { color: '#718689', fontSize: 10.5, lineHeight: 14, marginTop: 3, fontWeight: '500' },
  action: { backgroundColor: '#E3F3ED', borderRadius: 10, minHeight: 32, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#0A736A', fontFamily: appFonts.text, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  statusRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5ECE7', minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { flex: 1, fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  testButton: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5ECE7', minHeight: 45, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  testText: { color: '#0A736A', fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.64, transform: [{ scale: 0.96 }] },
});

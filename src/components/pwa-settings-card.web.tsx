import { Ionicons } from '@expo/vector-icons';
import { useState, useSyncExternalStore } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  async function handleInstall() {
    if (!install.canInstall) {
      setShowInstallHelp(true);
      return;
    }
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
    <>
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
      <Modal animationType="slide" onRequestClose={() => setShowInstallHelp(false)} presentationStyle="pageSheet" visible={showInstallHelp}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.helpPage}>
          <View style={styles.helpHeader}>
            <View style={styles.helpHeaderCopy}>
              <Text style={styles.helpKicker}>INSTALL THE APP</Text>
              <Text style={styles.helpTitle}>Add What Bin? to your Home Screen</Text>
              <Text style={styles.helpBody}>Install it for a full-screen app icon and reliable bin-night reminders.</Text>
            </View>
            <Pressable accessibilityLabel="Close installation help" accessibilityRole="button" onPress={() => setShowInstallHelp(false)} style={styles.helpClose}>
              <Ionicons color="#31575C" name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.helpContent}>
            {(install.isIos
              ? ['Tap Share in Safari', 'Choose Add to Home Screen', 'Tap Add', 'Open the new What Bin? icon', 'Open Settings and enable reminders']
              : ['Open your browser menu', 'Choose Install app or Add to Home Screen', 'Confirm the installation', 'Open What Bin? from your Home Screen', 'Open Settings and enable reminders']
            ).map((step, index) => (
              <View key={step} style={styles.helpStep}>
                <View style={styles.helpNumber}><Text style={styles.helpNumberText}>{index + 1}</Text></View>
                <Text style={styles.helpStepText}>{step}</Text>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setShowInstallHelp(false)} style={styles.helpDone}>
              <Text style={styles.helpDoneText}>Got it</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 9 },
  sectionLabel: { color: '#5D797C', fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.85, fontWeight: '700', paddingHorizontal: 2 },
  card: { backgroundColor: appColours.card, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: appColours.separator, overflow: 'hidden', shadowColor: '#18333A', shadowOpacity: 0.045, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  installRow: { minHeight: 88, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#E3F3ED', alignItems: 'center', justifyContent: 'center' },
  iconInstalled: { backgroundColor: '#0B756A' },
  copy: { flex: 1 },
  title: { color: '#1D3E43', fontFamily: appFonts.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.15 },
  text: { color: '#5E777B', fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: '500' },
  action: { backgroundColor: '#E3F3ED', borderRadius: 11, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#0A736A', fontFamily: appFonts.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  statusRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5ECE7', minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  testButton: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5ECE7', minHeight: 45, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  testText: { color: '#0A736A', fontSize: 12.5, fontWeight: '700' },
  helpPage: { flex: 1, backgroundColor: '#F3F4F0' },
  helpHeader: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, flexDirection: 'row', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DCE5E0' },
  helpHeaderCopy: { flex: 1 },
  helpKicker: { color: '#087A70', fontSize: 12, letterSpacing: 0.85, fontWeight: '700' },
  helpTitle: { color: '#14323B', fontSize: 27, lineHeight: 33, fontWeight: '700', marginTop: 5 },
  helpBody: { color: '#5C7478', fontSize: 14, lineHeight: 20, marginTop: 7 },
  helpClose: { height: 44, width: 44, borderRadius: 22, backgroundColor: '#E8EFEB', alignItems: 'center', justifyContent: 'center' },
  helpContent: { padding: 18, paddingBottom: 32, gap: 10 },
  helpStep: { minHeight: 62, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(34,61,66,0.12)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  helpNumber: { height: 34, width: 34, borderRadius: 17, backgroundColor: '#E3F3ED', alignItems: 'center', justifyContent: 'center' },
  helpNumberText: { color: '#087A70', fontSize: 15, fontWeight: '800' },
  helpStepText: { color: '#24464B', fontSize: 14, lineHeight: 19, fontWeight: '600', flex: 1 },
  helpDone: { minHeight: 52, borderRadius: 14, backgroundColor: '#087A70', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  helpDoneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.64, transform: [{ scale: 0.96 }] },
});

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getServerWebNotificationStatus,
  getWebNotificationStatus,
  sendTestWebNotification,
  subscribeWebNotificationStatus,
} from '@/lib/notifications.web';
import {
  applyPwaUpdate,
  getPwaServerInstallStatus,
  getPwaInstallStatus,
  installPwa,
  refreshPwaCacheStatus,
  resetPwaCaches,
  subscribePwaInstallStatus,
} from '@/lib/pwa-install.web';
import { appFonts } from '@/lib/design-system';
import { AppTheme, useAppTheme } from '@/lib/theme';

export function PwaSettingsCard() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
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
  const [feedback, setFeedback] = useState<string>();
  const [feedbackIsError, setFeedbackIsError] = useState(false);

  useEffect(() => {
    void refreshPwaCacheStatus().catch(() => undefined);
  }, []);

  function showFeedback(message: string, error = false) {
    setFeedback(message);
    setFeedbackIsError(error);
  }

  async function handleInstall() {
    if (!install.canInstall) {
      setShowInstallHelp(true);
      return;
    }
    setBusy(true);
    try {
      const result = await installPwa();
      if (result.reason) showFeedback(result.reason);
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    try {
      await sendTestWebNotification();
      showFeedback('Test notification requested. Check this device.');
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'The test notification failed. Please try again.', true);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate() {
    setBusy(true);
    try {
      const result = await applyPwaUpdate();
      if (!result.applied) showFeedback(result.reason ?? 'The update could not be applied.', true);
      else showFeedback('Updating the app…');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetCaches() {
    setBusy(true);
    try {
      const result = await resetPwaCaches();
      showFeedback(
        result.cleared
          ? `Offline storage cleared${result.deletedCaches ? ` (${result.deletedCaches} cache${result.deletedCaches === 1 ? '' : 's'})` : ''}. Reload while online to save fresh pages.`
          : result.reason ?? 'Offline storage could not be cleared.',
        !result.cleared,
      );
    } finally {
      setBusy(false);
    }
  }

  const statusColour = notifications.state === 'error'
    ? theme.danger
    : notifications.state === 'scheduled'
      ? theme.success
      : theme.secondaryText;
  const cacheMessage = install.cacheState === 'ready'
    ? `${install.cacheEntries} offline ${install.cacheEntries === 1 ? 'item' : 'items'}${install.cacheVersion ? ` · ${install.cacheVersion}` : ''}`
    : install.cacheState === 'checking' || install.cacheState === 'unknown'
      ? 'Checking offline storage…'
      : install.cacheState === 'cleared'
        ? 'Offline storage is clear'
        : install.cacheState === 'error'
          ? 'Offline storage diagnostics are unavailable'
          : 'Offline storage is not available in this browser';

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>App installation</Text>
        <View style={styles.card}>
        <View style={styles.installRow}>
          <View style={[styles.icon, install.installed && styles.iconInstalled]}>
            <Ionicons
              color={install.installed ? theme.heroText : theme.accent}
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
              <Text style={styles.actionText}>{install.canInstall ? 'Install' : 'How to'}</Text>
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
            <Ionicons color={theme.accent} name="paper-plane-outline" size={16} />
            <Text style={styles.testText}>{busy ? 'Sending…' : 'Send a test notification'}</Text>
          </Pressable>
        )}
        {install.updateAvailable ? (
          <View accessibilityLiveRegion="polite" style={styles.updateRow}>
            <Ionicons color={theme.accent} name="cloud-download-outline" size={20} />
            <View style={styles.copy}>
              <Text style={styles.title}>App update ready</Text>
              <Text style={styles.text}>Apply the verified update, then the app will reopen on the current version.</Text>
            </View>
            <Pressable accessibilityRole="button" disabled={busy} onPress={handleUpdate} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Text style={styles.actionText}>{busy ? 'Working…' : 'Update'}</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.cacheRow}>
          <Ionicons color={install.cacheState === 'error' ? theme.danger : theme.secondaryText} name="archive-outline" size={18} />
          <View style={styles.copy}>
            <Text style={styles.cacheTitle}>Offline storage</Text>
            <Text accessibilityLiveRegion="polite" style={styles.cacheText}>{cacheMessage}</Text>
          </View>
          <Pressable
            accessibilityLabel="Clear offline app storage"
            accessibilityRole="button"
            disabled={busy || install.cacheState === 'unavailable' || install.cacheState === 'checking'}
            onPress={handleResetCaches}
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        </View>
        {feedback ? (
          <View accessibilityLiveRegion={feedbackIsError ? 'assertive' : 'polite'} accessibilityRole={feedbackIsError ? 'alert' : undefined} style={[styles.feedback, { backgroundColor: `${feedbackIsError ? theme.danger : theme.accent}12` }]}>
            <Ionicons color={feedbackIsError ? theme.danger : theme.accent} name={feedbackIsError ? 'alert-circle-outline' : 'information-circle-outline'} size={18} />
            <Text style={[styles.feedbackText, { color: feedbackIsError ? theme.danger : theme.secondaryText }]}>{feedback}</Text>
          </View>
        ) : null}
        </View>
      </View>
      <Modal animationType="slide" onRequestClose={() => setShowInstallHelp(false)} presentationStyle="pageSheet" visible={showInstallHelp}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.helpPage}>
          <View style={styles.helpHeader}>
            <View style={styles.helpHeaderCopy}>
              <Text style={styles.helpKicker}>Install the app</Text>
              <Text style={styles.helpTitle}>Add What Bin? to your Home Screen</Text>
              <Text style={styles.helpBody}>Install it for a full-screen app icon and reliable bin-night reminders.</Text>
            </View>
            <Pressable accessibilityLabel="Close installation help" accessibilityRole="button" onPress={() => setShowInstallHelp(false)} style={styles.helpClose}>
              <Ionicons color={theme.text} name="close" size={22} />
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  section: { gap: 9 },
  sectionLabel: { color: theme.secondaryText, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.35, fontWeight: '700', paddingHorizontal: 2 },
  card: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, overflow: 'hidden' },
  installRow: { minHeight: 88, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconInstalled: { backgroundColor: theme.accentFill },
  copy: { flex: 1 },
  title: { color: theme.text, fontFamily: appFonts.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.15 },
  text: { color: theme.secondaryText, fontSize: 12.5, lineHeight: 17, marginTop: 3, fontWeight: '500' },
  action: { backgroundColor: theme.accentSoft, borderRadius: 11, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: theme.accent, fontFamily: appFonts.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  statusRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator, minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  testButton: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator, minHeight: 45, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  testText: { color: theme.accent, fontSize: 12.5, fontWeight: '700' },
  updateRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator, minHeight: 76, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.accentSoft },
  cacheRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator, minHeight: 66, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cacheTitle: { color: theme.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  cacheText: { color: theme.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 2 },
  resetButton: { minHeight: 44, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  resetText: { color: theme.accent, fontSize: 12.5, fontWeight: '700' },
  feedback: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
  feedbackText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  helpPage: { flex: 1, backgroundColor: theme.background },
  helpHeader: { backgroundColor: theme.surface, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, flexDirection: 'row', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
  helpHeaderCopy: { flex: 1 },
  helpKicker: { color: theme.accent, fontSize: 12, letterSpacing: 0.35, fontWeight: '700' },
  helpTitle: { color: theme.text, fontSize: 27, lineHeight: 33, fontWeight: '700', marginTop: 5 },
  helpBody: { color: theme.secondaryText, fontSize: 14, lineHeight: 20, marginTop: 7 },
  helpClose: { height: 44, width: 44, borderRadius: 22, backgroundColor: theme.elevated, alignItems: 'center', justifyContent: 'center' },
  helpContent: { padding: 18, paddingBottom: 32, gap: 10 },
  helpStep: { minHeight: 62, borderRadius: 16, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  helpNumber: { height: 34, width: 34, borderRadius: 17, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  helpNumberText: { color: theme.accent, fontSize: 15, fontWeight: '800' },
  helpStepText: { color: theme.text, fontSize: 14, lineHeight: 19, fontWeight: '600', flex: 1 },
  helpDone: { minHeight: 52, borderRadius: 14, backgroundColor: theme.accentFill, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  helpDoneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.64, transform: [{ scale: 0.96 }] },
  });
}

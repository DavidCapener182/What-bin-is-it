import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteHead } from '@/components/route-head';
import { appColours, appFonts } from '@/lib/design-system';

export default function OfflineScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <RouteHead
        title="Offline"
        description="What Bin is offline. Reconnect to verify the latest council collection dates."
        path="/offline"
      />
      <View style={styles.icon}><Ionicons color={appColours.brand} name="cloud-offline-outline" size={35} /></View>
      <Text style={styles.kicker}>YOU’RE OFFLINE</Text>
      <Text style={styles.title}>The live council check needs a connection.</Text>
      <Text style={styles.body}>Saved dates remain available in the app. Reconnect before relying on an unverified or changed collection.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Open saved dates</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: appColours.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { height: 64, width: 64, borderRadius: 21, backgroundColor: '#E1F1EA', alignItems: 'center', justifyContent: 'center' },
  kicker: { color: appColours.brand, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.9, fontWeight: '700', marginTop: 18 },
  title: { color: '#14323B', fontFamily: appFonts.display, fontSize: 28, lineHeight: 34, fontWeight: '700', textAlign: 'center', marginTop: 6, maxWidth: 380 },
  body: { color: '#5D777A', fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8, maxWidth: 380 },
  button: { minHeight: 52, minWidth: 220, borderRadius: 14, backgroundColor: appColours.brand, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});

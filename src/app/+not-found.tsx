import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteHead } from '@/components/route-head';
import { appColours, appFonts } from '@/lib/design-system';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <RouteHead
        title="Page Not Found"
        description="The requested What Bin page could not be found."
        path="/404"
      />
      <View style={styles.icon}><Ionicons color={appColours.brand} name="map-outline" size={34} /></View>
      <Text style={styles.kicker}>PAGE NOT FOUND</Text>
      <Text style={styles.title}>That route has gone out with the bins.</Text>
      <Text style={styles.body}>Open Today to see your saved collection answer.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Back to Today</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: appColours.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { height: 64, width: 64, borderRadius: 21, backgroundColor: '#E1F1EA', alignItems: 'center', justifyContent: 'center' },
  kicker: { color: appColours.brand, fontFamily: appFonts.text, fontSize: 12, letterSpacing: 0.9, fontWeight: '700', marginTop: 18 },
  title: { color: '#14323B', fontFamily: appFonts.display, fontSize: 28, lineHeight: 34, fontWeight: '700', textAlign: 'center', marginTop: 6, maxWidth: 360 },
  body: { color: '#5D777A', fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  button: { minHeight: 52, minWidth: 210, borderRadius: 14, backgroundColor: appColours.brand, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
});

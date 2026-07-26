import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteHead } from '@/components/route-head';
import { appFonts } from '@/lib/design-system';
import { AppTheme, useAppTheme } from '@/lib/theme';

export default function NotFoundScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <SafeAreaView style={styles.page}>
      <RouteHead
        title="Page Not Found"
        description="The requested What Bin page could not be found."
        path="/404"
      />
      <View style={styles.icon}><Ionicons color={theme.accent} name="map-outline" size={34} /></View>
      <Text style={styles.kicker}>Page not found</Text>
      <Text style={styles.title}>This page is not available.</Text>
      <Text style={styles.body}>Open Today to see your saved collection information.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Back to Today</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { height: 64, width: 64, borderRadius: 16, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: theme.accent, fontFamily: appFonts.text, fontSize: 13, fontWeight: '700', marginTop: 18 },
  title: { color: theme.text, fontFamily: appFonts.display, fontSize: 28, lineHeight: 34, fontWeight: '700', textAlign: 'center', marginTop: 6, maxWidth: 360 },
  body: { color: theme.secondaryText, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  button: { minHeight: 52, minWidth: 210, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  });
}

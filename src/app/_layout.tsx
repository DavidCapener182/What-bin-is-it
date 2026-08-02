import { ErrorBoundaryProps, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { LaunchSplash } from '@/components/launch-splash';
import { NotificationNavigation } from '@/components/notification-navigation';
import { PwaRegistration } from '@/components/pwa-registration';
import { ThemeSynchronizer } from '@/components/theme-synchronizer';
import { AppDataProvider } from '@/lib/use-app-data';
import { AccountProvider } from '@/lib/use-account';
import { ProductStateProvider } from '@/lib/use-product-state';
import { PilotAnalyticsProvider } from '@/lib/use-pilot-analytics';
import { SubscriptionProvider } from '@/lib/use-subscription';

SplashScreen.setOptions({ duration: 800, fade: true });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PilotAnalyticsProvider>
          <AppDataProvider>
            <ProductStateProvider>
              <AccountProvider>
                <SubscriptionProvider>
                  <ThemeSynchronizer />
                  <PwaRegistration />
                  <NotificationNavigation />
                  <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="schedule" />
                  <Stack.Screen name="guide" />
                  <Stack.Screen name="activity" />
                  <Stack.Screen name="reports" />
                  <Stack.Screen name="report-missed" />
                  <Stack.Screen name="report-incorrect" />
                  <Stack.Screen name="history" />
                  <Stack.Screen name="support" />
                  <Stack.Screen name="partners" />
                  <Stack.Screen name="plus" />
                  <Stack.Screen name="account" />
                  <Stack.Screen name="household" />
                  <Stack.Screen name="privacy" />
                  <Stack.Screen name="terms" />
                  <Stack.Screen name="data-sources" />
                  <Stack.Screen name="status" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="calendar" />
                  <Stack.Screen name="find" />
                  <Stack.Screen name="places" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="offline" />
                  <Stack.Screen name="+not-found" />
                  </Stack>
                  <LaunchSplash />
                </SubscriptionProvider>
              </AccountProvider>
            </ProductStateProvider>
          </AppDataProvider>
        </PilotAnalyticsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const dark = useColorScheme() === 'dark';
  const colours = dark
    ? { background: '#000000', surface: '#1C1C1E', text: '#F5F5F7', secondary: '#AEAEB2', separator: '#38383A', danger: '#FF453A', accent: '#0A84FF' }
    : { background: '#F2F2F7', surface: '#FFFFFF', text: '#1C1C1E', secondary: '#636366', separator: '#D1D1D6', danger: '#D70015', accent: '#007AFF' };
  return (
    <View style={[errorStyles.page, { backgroundColor: colours.background }]}>
      <View style={[errorStyles.card, { backgroundColor: colours.surface, borderColor: colours.separator }]}>
        <Text style={[errorStyles.kicker, { color: colours.danger }]}>App error</Text>
        <Text style={[errorStyles.title, { color: colours.text }]}>The app hit an unexpected problem.</Text>
        <Text style={[errorStyles.body, { color: colours.secondary }]}>Your saved addresses are still on this device. Try opening the screen again.</Text>
        {process.env.NODE_ENV === 'development' ? <Text style={[errorStyles.detail, { color: colours.secondary }]}>{error.message}</Text> : null}
        <Pressable accessibilityRole="button" onPress={retry} style={[errorStyles.button, { backgroundColor: colours.accent }]}>
          <Text style={errorStyles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  page: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 440, borderRadius: 16, padding: 22, borderWidth: StyleSheet.hairlineWidth },
  kicker: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', marginTop: 7 },
  body: { fontSize: 15, lineHeight: 21, marginTop: 9 },
  detail: { fontSize: 12, lineHeight: 17, marginTop: 12 },
  button: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

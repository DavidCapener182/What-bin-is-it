import { ErrorBoundaryProps, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NotificationNavigation } from '@/components/notification-navigation';
import { PwaRegistration } from '@/components/pwa-registration';
import { AppDataProvider } from '@/lib/use-app-data';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppDataProvider>
          <PwaRegistration />
          <NotificationNavigation />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="schedule" />
            <Stack.Screen name="guide" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="find" />
            <Stack.Screen name="places" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="offline" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </AppDataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={errorStyles.page}>
      <View style={errorStyles.card}>
        <Text style={errorStyles.kicker}>SOMETHING WENT WRONG</Text>
        <Text style={errorStyles.title}>The app hit an unexpected problem.</Text>
        <Text style={errorStyles.body}>Your saved addresses are still on this device. Try opening the screen again.</Text>
        {process.env.NODE_ENV === 'development' ? <Text style={errorStyles.detail}>{error.message}</Text> : null}
        <Pressable accessibilityRole="button" onPress={retry} style={errorStyles.button}>
          <Text style={errorStyles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F3F4F0', padding: 20, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 440, borderRadius: 22, backgroundColor: '#FFFFFF', padding: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(34,61,66,0.14)' },
  kicker: { color: '#A74638', fontSize: 12, letterSpacing: 0.85, fontWeight: '700' },
  title: { color: '#14323B', fontSize: 26, lineHeight: 32, fontWeight: '700', marginTop: 7 },
  body: { color: '#5C7478', fontSize: 15, lineHeight: 21, marginTop: 9 },
  detail: { color: '#7A4A45', fontSize: 12, lineHeight: 17, marginTop: 12 },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: '#087A70', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

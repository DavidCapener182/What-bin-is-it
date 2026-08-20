import { Stack } from 'expo-router';

import { useReducedMotionPreference } from '@/lib/use-adaptive-layout';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TodayStackLayout() {
  const reducedMotion = useReducedMotionPreference();

  return (
    <Stack screenOptions={{ animation: reducedMotion ? 'none' : 'fade', headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}

import { StatusBar } from 'expo-status-bar';
import { type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { appLayout, platformShadow } from '@/lib/design-system';
import { useAppTheme } from '@/lib/theme';

type PrimaryRoute = '/' | '/schedule' | '/guide' | '/activity';
type AppRoute = PrimaryRoute | '/reports' | '/settings' | '/reminder-settings' | '/places' | '/history' | '/support' | '/partners' | '/bulky-booking' | '/report-missed' | '/report-incorrect' | '/onboarding';

type AppShellProps = {
  activeRoute: AppRoute;
  children: ReactNode;
  /**
   * Kept for detail routes that previously controlled the shell-owned dock.
   * Navigation now belongs to the Expo Router tab layout, so detail routes are
   * naturally rendered without the primary tab bar.
   */
  hideNavigation?: boolean;
};

export function AppShell({ activeRoute, children }: AppShellProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.shell,
        { backgroundColor: Platform.OS === 'web' ? theme.groupedBackground : theme.background },
      ]}>
      <StatusBar style={activeRoute === '/' || theme.mode === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.frame, { backgroundColor: theme.background }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? appLayout.shellMaxWidth : undefined,
    ...platformShadow('0 0 28px rgba(7, 26, 43, 0.12)', {}),
  },
});

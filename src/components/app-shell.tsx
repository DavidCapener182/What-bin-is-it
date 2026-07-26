import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Href, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appColours, appFonts } from '@/lib/design-system';

type Route = '/' | '/schedule' | '/guide' | '/settings';

const tabs: { route: Route; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { route: '/', label: 'Today', icon: 'home-outline', activeIcon: 'home' },
  { route: '/schedule', label: 'Schedule', icon: 'calendar-outline', activeIcon: 'calendar' },
  { route: '/guide', label: 'Guide', icon: 'search-outline', activeIcon: 'search' },
  { route: '/settings', label: 'Settings', icon: 'options-outline', activeIcon: 'options' },
];

export function AppShell({ activeRoute, children }: { activeRoute: Route; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const dockBottomPadding = Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 10);

  function openTab(route: Route) {
    if (route === activeRoute) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    router.replace(route as Href);
  }

  return (
    <View style={styles.shell}>
      <StatusBar style={activeRoute === '/' ? 'light' : 'dark'} />
      <View style={styles.frame}>
        <View style={styles.screen}>{children}</View>
        <View style={[styles.dock, { paddingBottom: dockBottomPadding }]}>
          <View nativeID="app-material" style={styles.material}>
            <BlurView
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={82}
              style={[StyleSheet.absoluteFill, styles.blur]}
              tint="systemChromeMaterialLight"
            />
            <View accessibilityRole="tablist" style={styles.tabBar}>
              {tabs.map((tab) => {
                const active = tab.route === activeRoute;
                return (
                  <Pressable
                    accessibilityLabel={tab.label}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    key={tab.route}
                    onPress={() => openTab(tab.route)}
                    style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}>
                    <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                      <Ionicons color={active ? appColours.brand : '#657B80'} name={active ? tab.activeIcon : tab.icon} size={22} />
                    </View>
                    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, alignItems: 'center', backgroundColor: Platform.OS === 'web' ? '#DDE7E2' : appColours.background },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 560 : undefined,
    backgroundColor: appColours.background,
    shadowColor: '#071A2B',
    shadowOpacity: Platform.OS === 'web' ? 0.14 : 0,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  screen: { flex: 1 },
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingTop: 10 },
  blur: { pointerEvents: 'none' },
  material: {
    height: 64,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: appColours.material,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#071A2B',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tabBar: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 58, gap: 1 },
  iconWrap: { height: 29, width: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: 'rgba(8,122,112,0.11)' },
  tabLabel: { color: '#657B80', fontFamily: appFonts.text, fontSize: 12, fontWeight: '600', letterSpacing: -0.1 },
  tabLabelActive: { color: appColours.brand, fontWeight: '700' },
  tabPressed: { opacity: 0.62, transform: [{ scale: 0.94 }] },
});

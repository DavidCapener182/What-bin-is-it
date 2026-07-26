import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Route = '/' | '/calendar' | '/find' | '/places' | '/settings';

const tabs: { route: Route; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { route: '/', label: 'Today', icon: 'home-outline', activeIcon: 'home' },
  { route: '/calendar', label: 'Schedule', icon: 'calendar-outline', activeIcon: 'calendar' },
  { route: '/find', label: 'Find', icon: 'search-outline', activeIcon: 'search' },
  { route: '/places', label: 'Places', icon: 'location-outline', activeIcon: 'location' },
  { route: '/settings', label: 'Settings', icon: 'options-outline', activeIcon: 'options' },
];

export function AppShell({ activeRoute, children }: { activeRoute: Route; children: ReactNode }) {
  return (
    <View style={styles.shell}>
      <View style={styles.screen}>{children}</View>
      <View style={styles.dock}>
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const active = tab.route === activeRoute;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={tab.route}
                onPress={() => router.replace(tab.route as Href)}
                style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}>
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                  <Ionicons color={active ? '#E6FFF3' : '#6E858C'} name={active ? tab.activeIcon : tab.icon} size={21} />
                </View>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#F4F4EE' },
  screen: { flex: 1 },
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 15, paddingBottom: Platform.select({ ios: 23, android: 12, default: 12 }), paddingTop: 10, backgroundColor: 'rgba(244,244,238,0.88)' },
  tabBar: { height: 61, backgroundColor: '#08212D', borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, shadowColor: '#071A2B', shadowOpacity: 0.27, shadowRadius: 15, shadowOffset: { width: 0, height: 7 }, elevation: 12 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 54, gap: 2 },
  iconWrap: { height: 27, width: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: '#0D645E' },
  tabLabel: { color: '#809AA1', fontSize: 10, fontWeight: '700' },
  tabLabelActive: { color: '#EBFFF5', fontWeight: '900' },
  tabPressed: { opacity: 0.7 },
});

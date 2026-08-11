import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Href, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appFonts, nonInteractiveStyle, platformShadow } from '@/lib/design-system';
import { reportNeedsResidentAttention, supportReplyNeedsAttention } from '@/lib/activity-attention';
import { residentAlertsForProfile } from '@/lib/resident-alerts';
import { useAppTheme } from '@/lib/theme';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';
import { useProductState } from '@/lib/use-product-state';
import { useResidentSupport } from '@/lib/use-resident-support';

type PrimaryRoute = '/' | '/schedule' | '/guide' | '/activity';
type AppRoute = PrimaryRoute | '/reports' | '/settings' | '/reminder-settings' | '/places' | '/history' | '/support' | '/partners' | '/bulky-booking' | '/report-missed' | '/report-incorrect' | '/onboarding';

const tabs: { route: PrimaryRoute; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { route: '/', label: 'Today', icon: 'home-outline', activeIcon: 'home' },
  { route: '/schedule', label: 'Schedule', icon: 'calendar-outline', activeIcon: 'calendar' },
  { route: '/guide', label: 'Guide', icon: 'search-outline', activeIcon: 'search' },
  { route: '/activity', label: 'Activity', icon: 'notifications-outline', activeIcon: 'notifications' },
];

export function AppShell({
  activeRoute,
  children,
  hideNavigation = false,
}: {
  activeRoute: AppRoute;
  children: ReactNode;
  hideNavigation?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { activeAddress, collections } = useAppData();
  const profile = useCouncilProfile(activeAddress?.providerId);
  const {
    councilNotices,
    reports,
    reportStatusSeenById,
    supportSeenMessageIdByThreadId,
  } = useProductState();
  const support = useResidentSupport();
  const tabRefs = useRef<(React.ElementRef<typeof Pressable> | null)[]>([]);
  const dockBottomPadding = Platform.OS === 'web' ? 0 : Math.max(insets.bottom, 6);
  const primaryActive = tabs.some((tab) => tab.route === activeRoute);
  const currentAlerts = residentAlertsForProfile(profile, collections)
    .filter((alert) => !councilNotices.archivedAtById[alert.id]);
  const unreadAlerts = currentAlerts.filter((alert) => !councilNotices.readAtById[alert.id]).length;
  const actionableReports = reports.filter((report) => (
    (!activeAddress || report.addressId === activeAddress.id)
    && reportNeedsResidentAttention(report, reportStatusSeenById[report.id])
  )).length;
  const unreadSupportReplies = support.threads.filter((thread) => (
    supportReplyNeedsAttention(thread, supportSeenMessageIdByThreadId[thread.id])
  )).length;
  const activityBadge = Math.min(99, unreadAlerts + actionableReports + unreadSupportReplies);

  function openTab(route: PrimaryRoute) {
    if (route === activeRoute) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    router.replace(route as Href);
  }

  return (
    <View style={[styles.shell, { backgroundColor: Platform.OS === 'web' ? theme.groupedBackground : theme.background }]}>
      <StatusBar style={activeRoute === '/' || theme.mode === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.frame, { backgroundColor: theme.background }]}>
        {primaryActive ? tabs.map((tab) => {
          const active = tab.route === activeRoute;
          return (
            <View
              accessibilityElementsHidden={!active}
              importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
              key={tab.route}
              nativeID={`panel-${tab.route.replace('/', '') || 'today'}`}
              style={active ? styles.screen : styles.hiddenPanel}>
              {active ? children : null}
            </View>
          );
        }) : (
          <View nativeID={`panel-${activeRoute.replace('/', '')}`} style={styles.screen}>{children}</View>
        )}
        {!hideNavigation ? (
          <View nativeID="app-dock" style={[styles.dock, { paddingBottom: dockBottomPadding }]}>
            <View nativeID="app-material" style={[styles.material, { backgroundColor: theme.material, borderColor: theme.separator }]}>
            <BlurView
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={82}
              style={[StyleSheet.absoluteFill, styles.blur]}
              tint={theme.mode === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            />
            <View accessibilityLabel="Primary navigation" accessibilityRole="tablist" style={styles.tabBar}>
              {tabs.map((tab, index) => {
                const active = tab.route === activeRoute;
                return (
                  <Pressable
                    {...(Platform.OS === 'web' ? {
                      // React Native Web forwards these WAI-ARIA keyboard semantics.
                      onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
                        event.preventDefault();
                        const nextIndex = event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                        tabRefs.current[nextIndex]?.focus();
                        openTab(tabs[nextIndex].route);
                      },
                      'aria-controls': `panel-${tab.route.replace('/', '') || 'today'}`,
                      'aria-selected': active,
                      tabIndex: active ? 0 : -1,
                    } : {})}
                    accessibilityLabel={tab.label}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    key={tab.route}
                    onPress={() => openTab(tab.route)}
                    ref={(element) => { tabRefs.current[index] = element; }}
                    style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}>
                    <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                      <Ionicons color={active ? theme.accent : theme.secondaryText} name={active ? tab.activeIcon : tab.icon} size={22} />
                      {tab.route === '/activity' && activityBadge ? (
                        <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                          <Text style={styles.badgeText}>{activityBadge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.tabLabel, { color: active ? theme.accent : theme.secondaryText }, active && styles.tabLabelActive]}>{tab.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
            {Platform.OS === 'web' ? (
              <View
                nativeID="app-bottom-safe-area-fill"
                style={[styles.bottomSafeAreaFill, nonInteractiveStyle, { backgroundColor: theme.material }]}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, alignItems: 'center' },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 560 : undefined,
    ...platformShadow('0 0 24px rgba(7, 26, 43, 0.14)', {}),
  },
  screen: { flex: 1 },
  hiddenPanel: { display: 'none' },
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingTop: 6 },
  bottomSafeAreaFill: { position: 'absolute', top: '100%', left: -10, right: -10, height: 96 },
  blur: { pointerEvents: 'none' },
  material: {
    height: 62,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    ...platformShadow('0 8px 20px rgba(7, 26, 43, 0.16)', {
      shadowColor: '#071A2B',
      shadowOpacity: 0.16,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    }),
  },
  tabBar: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 58, gap: 1 },
  iconWrap: { height: 29, width: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -3, right: -4, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 9.5, lineHeight: 12, fontWeight: '800' },
  iconWrapActive: { backgroundColor: 'rgba(0,122,255,0.12)' },
  tabLabel: { fontFamily: appFonts.text, fontSize: 12, fontWeight: '600', letterSpacing: -0.1 },
  tabLabelActive: { fontWeight: '700' },
  tabPressed: { opacity: 0.62, transform: [{ scale: 0.94 }] },
});

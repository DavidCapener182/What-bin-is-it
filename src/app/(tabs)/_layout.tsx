import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import { Tabs, type BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { type ComponentProps, type MouseEvent as ReactMouseEvent } from 'react';
import { Platform, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';

import { reportNeedsResidentAttention, supportReplyNeedsAttention } from '@/lib/activity-attention';
import { appFonts, appLayout, platformShadow } from '@/lib/design-system';
import { residentAlertsForProfile } from '@/lib/resident-alerts';
import { useAdaptiveLayout, useReducedMotionPreference } from '@/lib/use-adaptive-layout';
import { useAppData } from '@/lib/use-app-data';
import { useCouncilProfile } from '@/lib/use-council-profile';
import { useProductState } from '@/lib/use-product-state';
import { useResidentSupport } from '@/lib/use-resident-support';
import { useAppTheme } from '@/lib/theme';

export const unstable_settings = {
  initialRouteName: '(today)',
};

type PrimaryRoute = '/' | '/schedule' | '/guide' | '/activity';

function selectedPrimaryRoute(pathname: string): PrimaryRoute | undefined {
  if (pathname === '/') return '/';
  return (['/schedule', '/guide', '/activity'] as const).find((route) => pathname.startsWith(route));
}

type WebTabKeyEvent = {
  currentTarget: HTMLElement;
  key: string;
  preventDefault: () => void;
};

function handleWebTabKeyDown(event: WebTabKeyEvent) {
  const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key)
    ? -1
    : ['ArrowRight', 'ArrowDown'].includes(event.key)
      ? 1
      : undefined;
  if (direction === undefined && event.key !== 'Home' && event.key !== 'End') return;

  const tablist = event.currentTarget.closest('[role="tablist"]');
  const tabs = Array.from(tablist?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (!tabs.length || currentIndex < 0) return;

  event.preventDefault();
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? tabs.length - 1
      : (currentIndex + (direction ?? 0) + tabs.length) % tabs.length;
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}

function KeyboardTabButton({
  children,
  href,
  hoverEffect: _hoverEffect,
  onPress,
  pressOpacity: _pressOpacity,
  ref: platformPressableRef,
  style,
  ...props
}: BottomTabBarButtonProps) {
  function handlePress(event: ReactMouseEvent<HTMLAnchorElement> | GestureResponderEvent) {
    const browserEvent = event as unknown as {
      altKey?: boolean;
      button?: number;
      ctrlKey?: boolean;
      currentTarget?: { target?: string };
      metaKey?: boolean;
      preventDefault?: () => void;
      shiftKey?: boolean;
    };
    const modified = browserEvent.metaKey
      || browserEvent.altKey
      || browserEvent.ctrlKey
      || browserEvent.shiftKey;
    const leftClick = browserEvent.button === undefined || browserEvent.button === 0;
    const selfTarget = !browserEvent.currentTarget?.target
      || ['', '_self', 'self'].includes(browserEvent.currentTarget.target);

    if (Platform.OS === 'web' && href) {
      if (!modified && leftClick && selfTarget) {
        browserEvent.preventDefault?.();
        onPress?.(event);
      }
      return;
    }
    onPress?.(event);
  }

  return (
    <Pressable
      {...props}
      {...(Platform.OS === 'web' ? {
        href,
        onKeyDown: handleWebTabKeyDown,
        tabIndex: props['aria-selected'] ? 0 : -1,
      } : {})}
      onPress={handlePress}
      ref={platformPressableRef as ComponentProps<typeof Pressable>['ref']}
      style={({ pressed }) => [style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export default function ResidentTabsLayout() {
  const adaptive = useAdaptiveLayout();
  const reducedMotion = useReducedMotionPreference();
  const pathname = usePathname();
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
  const currentAlerts = residentAlertsForProfile(profile, collections)
    .filter((alert) => !councilNotices.archivedAtById[alert.id]);
  const unreadAlerts = currentAlerts
    .filter((alert) => !councilNotices.readAtById[alert.id])
    .length;
  const actionableReports = reports.filter((report) => (
    (!activeAddress || report.addressId === activeAddress.id)
    && reportNeedsResidentAttention(report, reportStatusSeenById[report.id])
  )).length;
  const unreadSupportReplies = support.threads.filter((thread) => (
    supportReplyNeedsAttention(thread, supportSeenMessageIdByThreadId[thread.id])
  )).length;
  const activityBadge = Math.min(99, unreadAlerts + actionableReports + unreadSupportReplies);
  const rail = adaptive.navigationPosition === 'left';

  function hapticOnTabChange(target: PrimaryRoute) {
    if (Platform.OS === 'web' || selectedPrimaryRoute(pathname) === target) return;
    void Haptics.selectionAsync().catch(() => undefined);
  }

  return (
    <Tabs
      backBehavior="history"
      detachInactiveScreens={false}
      screenOptions={{
        animation: reducedMotion ? 'none' : 'fade',
        freezeOnBlur: false,
        headerShown: false,
        lazy: true,
        popToTopOnBlur: false,
        sceneStyle: { backgroundColor: theme.groupedBackground },
        tabBarActiveBackgroundColor: rail ? theme.accentSoft : 'transparent',
        tabBarActiveTintColor: theme.accent,
        tabBarAllowFontScaling: true,
        tabBarButton: (props) => <KeyboardTabButton {...props} />,
        tabBarHideOnKeyboard: true,
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarInactiveTintColor: theme.secondaryText,
        tabBarItemStyle: rail ? styles.railItem : styles.bottomItem,
        tabBarLabelPosition: rail ? 'beside-icon' : 'below-icon',
        tabBarLabelStyle: [
          styles.label,
          rail && adaptive.mode === 'wide' ? styles.wideRailLabel : undefined,
        ],
        tabBarPosition: adaptive.navigationPosition,
        tabBarShowLabel: !rail || adaptive.mode === 'wide',
        tabBarStyle: [
          styles.tabBar,
          rail
            ? {
                borderRightColor: theme.separator,
                minWidth: adaptive.navigationRailWidth,
                width: adaptive.navigationRailWidth,
              }
            : { minHeight: appLayout.compactNavigationHeight, borderTopColor: theme.separator },
          { backgroundColor: theme.material },
        ],
      }}>
      <Tabs.Screen
        name="(today)"
        listeners={{ tabPress: () => hapticOnTabChange('/') }}
        options={{
          tabBarAccessibilityLabel: 'Today tab',
          tabBarButtonTestID: 'primary-tab-today',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color as string} name={focused ? 'home' : 'home-outline'} size={size} />
          ),
          title: 'Today',
        }}
      />
      <Tabs.Screen
        name="schedule"
        listeners={{ tabPress: () => hapticOnTabChange('/schedule') }}
        options={{
          tabBarAccessibilityLabel: 'Schedule tab',
          tabBarButtonTestID: 'primary-tab-schedule',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color as string} name={focused ? 'calendar' : 'calendar-outline'} size={size} />
          ),
          title: 'Schedule',
        }}
      />
      <Tabs.Screen
        name="guide"
        listeners={{ tabPress: () => hapticOnTabChange('/guide') }}
        options={{
          tabBarAccessibilityLabel: 'Guide tab',
          tabBarButtonTestID: 'primary-tab-guide',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color as string} name={focused ? 'search' : 'search-outline'} size={size} />
          ),
          title: 'Guide',
        }}
      />
      <Tabs.Screen
        name="activity"
        listeners={{ tabPress: () => hapticOnTabChange('/activity') }}
        options={{
          tabBarAccessibilityLabel: activityBadge
            ? `Activity tab, ${activityBadge} items need attention`
            : 'Activity tab',
          tabBarBadge: activityBadge || undefined,
          tabBarBadgeStyle: { backgroundColor: theme.danger, color: '#FFFFFF' },
          tabBarButtonTestID: 'primary-tab-activity',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons color={color as string} name={focused ? 'notifications' : 'notifications-outline'} size={size} />
          ),
          title: 'Activity',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    ...platformShadow('0 0 24px rgba(7, 26, 43, 0.12)', {
      shadowColor: '#071A2B',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    }),
  },
  bottomItem: {
    minHeight: 52,
    minWidth: appLayout.minimumTouchTarget,
  },
  railItem: {
    minHeight: 58,
    marginHorizontal: 8,
    marginVertical: 3,
    borderRadius: 14,
  },
  label: {
    fontFamily: appFonts.text,
    fontSize: 11,
    fontWeight: '700',
  },
  wideRailLabel: {
    fontSize: 14,
    textAlign: 'left',
  },
  pressed: {
    opacity: 0.62,
  },
});

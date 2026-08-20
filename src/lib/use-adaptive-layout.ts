import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, useWindowDimensions } from 'react-native';

import { appBreakpoints, appLayout } from '@/lib/design-system';

export type AdaptiveLayoutMode = 'compact' | 'medium' | 'wide';

export type AdaptiveLayout = {
  effectiveWidth: number;
  height: number;
  isLandscape: boolean;
  mode: AdaptiveLayoutMode;
  navigationPosition: 'bottom' | 'left';
  navigationRailWidth: number;
  width: number;
};

export function resolveAdaptiveLayout(
  width: number,
  height: number,
  fontScale = 1,
): AdaptiveLayout {
  const effectiveWidth = width / Math.max(fontScale, 1);
  const mode: AdaptiveLayoutMode = effectiveWidth >= appBreakpoints.wide
    ? 'wide'
    : effectiveWidth >= appBreakpoints.navigationRail
      ? 'medium'
      : 'compact';

  return {
    effectiveWidth,
    height,
    isLandscape: width > height,
    mode,
    navigationPosition: mode === 'compact' ? 'bottom' : 'left',
    navigationRailWidth: mode === 'wide'
      ? appLayout.wideNavigationRailWidth
      : appLayout.mediumNavigationRailWidth,
    width,
  };
}

export function useAdaptiveLayout(): AdaptiveLayout {
  const { fontScale, height, width } = useWindowDimensions();

  return useMemo(
    () => resolveAdaptiveLayout(width, height, fontScale),
    [fontScale, height, width],
  );
}

function reducedMotionSnapshot(): boolean {
  return Platform.OS === 'web'
    && typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (
    Platform.OS !== 'web'
    || typeof window === 'undefined'
    || typeof window.matchMedia !== 'function'
  ) {
    return () => undefined;
  }

  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function useReducedMotionPreference(): boolean {
  const webReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );
  const [nativeReducedMotion, setNativeReducedMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setNativeReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setNativeReducedMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return Platform.OS === 'web' ? webReducedMotion : nativeReducedMotion;
}

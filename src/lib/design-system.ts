import { Platform, type ViewStyle } from 'react-native';

const webSystemFont = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
const webDisplayFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif';
const webRoundedFont = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const appFonts = {
  text: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: webSystemFont,
    default: 'System',
  }),
  display: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: webDisplayFont,
    default: 'System',
  }),
  rounded: Platform.select({
    ios: 'ui-rounded',
    android: 'sans-serif-medium',
    web: webRoundedFont,
    default: 'System',
  }),
};

export const appColours = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  ink: '#1C1C1E',
  secondary: '#636366',
  tertiary: '#6B6B70',
  brand: '#0062CC',
  brandPressed: '#004C9E',
  separator: '#D1D1D6',
  material: 'rgba(249, 249, 251, 0.86)',
};

export const appSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const appRadii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const appBreakpoints = {
  navigationRail: 720,
  desktop: 1024,
  wide: 1280,
} as const;

export const appLayout = {
  shellMaxWidth: 1440,
  compactNavigationHeight: 64,
  mediumNavigationRailWidth: 88,
  wideNavigationRailWidth: 224,
  readableContentMaxWidth: 720,
  residentMasterColumnWidth: 420,
  residentContextColumnWidth: 320,
  residentWideGutter: 32,
  residentMediumGutter: 24,
  residentCompactGutter: 16,
  minimumTouchTarget: 44,
} as const;

export const appMotion = {
  fast: 120,
  standard: 220,
  deliberate: 320,
} as const;

export const nonInteractiveStyle = { pointerEvents: 'none' } satisfies ViewStyle;

export function platformShadow(webBoxShadow: string, nativeShadow: ViewStyle): ViewStyle {
  return Platform.OS === 'web' ? { boxShadow: webBoxShadow } : nativeShadow;
}

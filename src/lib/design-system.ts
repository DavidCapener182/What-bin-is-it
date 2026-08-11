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
  tertiary: '#8E8E93',
  brand: '#007AFF',
  brandPressed: '#0062CC',
  separator: '#D1D1D6',
  material: 'rgba(249, 249, 251, 0.86)',
};

export const nonInteractiveStyle = { pointerEvents: 'none' } satisfies ViewStyle;

export function platformShadow(webBoxShadow: string, nativeShadow: ViewStyle): ViewStyle {
  return Platform.OS === 'web' ? { boxShadow: webBoxShadow } : nativeShadow;
}

import { Platform } from 'react-native';

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
  background: '#F3F4F0',
  card: '#FFFFFF',
  ink: '#102F38',
  secondary: '#63777C',
  tertiary: '#7D9092',
  brand: '#087A70',
  brandPressed: '#06675F',
  separator: 'rgba(34, 61, 66, 0.12)',
  material: 'rgba(249, 251, 249, 0.78)',
};

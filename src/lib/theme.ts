import { useColorScheme } from 'react-native';

import { useProductState } from '@/lib/use-product-state';

const light = {
  mode: 'light' as const,
  background: '#F1F4F8',
  groupedBackground: '#E9EEF5',
  surface: '#FDFEFF',
  elevated: '#FDFEFF',
  text: '#18263B',
  secondaryText: '#536278',
  tertiaryText: '#617087',
  separator: '#CFD9E6',
  accent: '#245BC5',
  accentFill: '#245BC5',
  accentPressed: '#19479F',
  accentSoft: '#E5EDFC',
  success: '#248A3D',
  warning: '#B82D00',
  danger: '#D70015',
  material: '#F7F9FC',
  hero: '#18263B',
  heroText: '#FDFEFF',
  heroSecondary: '#C7D8E7',
};

const dark = {
  mode: 'dark' as const,
  background: '#0D1522',
  groupedBackground: '#18263B',
  surface: '#18263B',
  elevated: '#223249',
  text: '#EFF4FC',
  secondaryText: '#B4C2D6',
  tertiaryText: '#9AAEC8',
  separator: '#34465E',
  accent: '#8DB8FF',
  accentFill: '#2E64CF',
  accentPressed: '#8DB8FF',
  accentSoft: '#203858',
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF7D75',
  material: '#142033',
  hero: '#18263B',
  heroText: '#FDFEFF',
  heroSecondary: '#A8C1D6',
};

export type AppTheme = typeof light | typeof dark;

export function useAppTheme(): AppTheme {
  const system = useColorScheme();
  const { appearance } = useProductState();
  const resolved = appearance === 'system' ? system : appearance;
  return resolved === 'dark' ? dark : light;
}

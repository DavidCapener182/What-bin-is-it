import { useColorScheme } from 'react-native';

import { useProductState } from '@/lib/use-product-state';

const light = {
  mode: 'light' as const,
  background: '#F2F2F7',
  groupedBackground: '#F7F7FA',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  text: '#1C1C1E',
  secondaryText: '#636366',
  tertiaryText: '#8E8E93',
  separator: '#D1D1D6',
  accent: '#007AFF',
  accentPressed: '#0062CC',
  accentSoft: '#E5F1FF',
  success: '#248A3D',
  warning: '#C93400',
  danger: '#D70015',
  material: 'rgba(249,249,251,0.86)',
  hero: '#1C1C1E',
  heroText: '#FFFFFF',
  heroSecondary: '#C7D8E7',
};

const dark = {
  mode: 'dark' as const,
  background: '#000000',
  groupedBackground: '#1C1C1E',
  surface: '#1C1C1E',
  elevated: '#2C2C2E',
  text: '#F5F5F7',
  secondaryText: '#AEAEB2',
  tertiaryText: '#8E8E93',
  separator: '#38383A',
  accent: '#0A84FF',
  accentPressed: '#409CFF',
  accentSoft: '#142C45',
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  material: 'rgba(28,28,30,0.88)',
  hero: '#1C1C1E',
  heroText: '#FFFFFF',
  heroSecondary: '#A8C1D6',
};

export type AppTheme = typeof light | typeof dark;

export function useAppTheme(): AppTheme {
  const system = useColorScheme();
  const { appearance } = useProductState();
  const resolved = appearance === 'system' ? system : appearance;
  return resolved === 'dark' ? dark : light;
}

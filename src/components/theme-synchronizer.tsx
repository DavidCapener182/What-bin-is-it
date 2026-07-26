import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAppTheme } from '@/lib/theme';

export function ThemeSynchronizer() {
  const theme = useAppTheme();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = theme.mode;
      document.documentElement.style.backgroundColor = theme.background;
      document.body.style.backgroundColor = theme.background;
      document
        .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
        .forEach((meta) => {
          meta.content = theme.background;
        });
      return;
    }

    void SystemUI.setBackgroundColorAsync(theme.background);
  }, [theme.background, theme.mode]);

  return null;
}

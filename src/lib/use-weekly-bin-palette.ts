import { contrastTextForColour } from '@/lib/data';
import { useAppTheme } from '@/lib/theme';
import { Collection } from '@/lib/types';
import { colourWithAlpha, nextWeeklyBinAccent } from '@/lib/weekly-bin-accent';

export function useWeeklyBinPalette(collections: Collection[]) {
  const theme = useAppTheme();
  const accent = nextWeeklyBinAccent(collections);
  const foreground = accent ? contrastTextForColour(accent.colour) : theme.text;

  return {
    accent,
    background: accent?.colour ?? theme.surface,
    control: accent ? colourWithAlpha(foreground, 0.14) : theme.accentSoft,
    foreground,
    secondary: accent ? colourWithAlpha(foreground, 0.76) : theme.secondaryText,
  };
}

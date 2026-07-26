import type { HomeScreenWidgetInput } from './home-screen-widget-sync.ts';

export async function syncHomeScreenWidget(_input: HomeScreenWidgetInput) {
  // PWAs cannot publish entries into the iOS or Android system widget gallery.
}

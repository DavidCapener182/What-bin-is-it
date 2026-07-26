import NextCollectionWidget from './NextCollectionWidget.ios.tsx';
import {
  buildCollectionWidgetTimeline,
  type CollectionWidgetTimelineEntry,
} from './widget-data.ts';
import type { HomeScreenWidgetInput } from './home-screen-widget-sync.ts';

export async function syncHomeScreenWidget({
  address,
  collections,
}: HomeScreenWidgetInput) {
  const timeline: CollectionWidgetTimelineEntry[] = buildCollectionWidgetTimeline(
    address,
    collections,
  );
  NextCollectionWidget.updateTimeline(timeline);
}

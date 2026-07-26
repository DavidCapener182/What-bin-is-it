import { requestWidgetUpdate } from 'react-native-android-widget';

import { AndroidNextCollectionWidget } from './AndroidNextCollectionWidget.tsx';
import {
  buildCollectionWidgetSnapshot,
  collectionWidgetName,
} from './widget-data.ts';
import type { HomeScreenWidgetInput } from './home-screen-widget-sync.ts';

export async function syncHomeScreenWidget({
  address,
  collections,
}: HomeScreenWidgetInput) {
  const snapshot = buildCollectionWidgetSnapshot(address, collections);
  await requestWidgetUpdate({
    widgetName: collectionWidgetName,
    renderWidget: (widgetInfo) => (
      <AndroidNextCollectionWidget
        snapshot={snapshot}
        width={widgetInfo.width}
      />
    ),
  });
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { AndroidNextCollectionWidget } from './AndroidNextCollectionWidget.tsx';
import {
  appDataStorageKey,
  buildCollectionWidgetSnapshot,
  widgetStateFromStoredAppData,
} from './widget-data.ts';

export async function androidWidgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === 'WIDGET_DELETED' || props.widgetAction === 'WIDGET_CLICK') return;

  const raw = await AsyncStorage.getItem(appDataStorageKey);
  const state = widgetStateFromStoredAppData(raw);
  const snapshot = buildCollectionWidgetSnapshot(state.address, state.collections);
  props.renderWidget(
    <AndroidNextCollectionWidget
      snapshot={snapshot}
      width={props.widgetInfo.width}
    />,
  );
}

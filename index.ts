import 'expo-router/entry';

import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { androidWidgetTaskHandler } from './src/widgets/android-widget-task-handler.tsx';

if (Platform.OS === 'android') {
  registerWidgetTaskHandler(androidWidgetTaskHandler);
}

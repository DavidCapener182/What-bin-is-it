import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('configures matching iOS and Android next-collection widgets', () => {
  const app = JSON.parse(read('app.json')).expo;
  const packageJson = JSON.parse(read('package.json'));
  const iosPlugin = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-widgets');
  const androidPlugin = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-android-widget');

  assert.equal(packageJson.main, 'index.ts');
  assert.equal(iosPlugin[1].widgets[0].name, 'NextCollectionWidget');
  assert.deepEqual(
    iosPlugin[1].widgets[0].ios.supportedFamilies,
    ['systemSmall', 'systemMedium'],
  );
  assert.equal(androidPlugin[1].widgets[0].name, 'NextCollectionWidget');
  assert.equal(androidPlugin[1].widgets[0].updatePeriodMillis, 1_800_000);
});

test('updates widgets only from the selected persisted council schedule', () => {
  const provider = read('src/lib/use-app-data.tsx');
  const entry = read('index.ts');
  assert.match(provider, /syncHomeScreenWidget\(\{ address: activeAddress, collections \}\)/);
  assert.match(entry, /Platform\.OS === 'android'/);
  assert.match(entry, /registerWidgetTaskHandler\(androidWidgetTaskHandler\)/);
});

test('tells PWA users that browser installs cannot enter the system widget gallery', () => {
  const card = read('src/components/home-screen-widget-card.tsx');
  assert.match(card, /Web apps cannot appear in the iOS or Android widget gallery/);
  assert.match(card, /verified council dates and the main bin colour/);
  assert.doesNotMatch(card, /mock|sample date/i);
});

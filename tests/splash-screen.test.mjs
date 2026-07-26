import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).expo;
const splash = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')?.[1];

test('uses the supplied portrait artwork for the app launch handoff', () => {
  assert.equal(splash.image, './assets/images/launch-splash.png');
  assert.equal(splash.resizeMode, 'cover');
  assert.equal(splash.enableFullScreenImage_legacy, true);
  assert.equal(splash.android.image, './assets/images/splash-icon.png');

  const component = readFileSync(resolve(root, 'src/components/launch-splash.tsx'), 'utf8');
  const layout = readFileSync(resolve(root, 'src/app/_layout.tsx'), 'utf8');
  assert.match(component, /launch-splash\.png/);
  assert.match(component, /resizeMode="cover"/);
  assert.match(layout, /<LaunchSplash \/>/);
});

test('wires the supplied branded icon set to both stores', () => {
  assert.equal(app.icon, './assets/images/app-icon.png');
  assert.equal(app.ios.icon, './assets/images/app-icon.png');
  assert.equal(app.android.icon, './assets/images/android-store-icon.png');
  assert.equal(app.android.adaptiveIcon.foregroundImage, './assets/images/android-icon-foreground.png');
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#FEFDFB');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(readFileSync(resolve(root, 'app.json'), 'utf8')).expo;
const splash = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')?.[1];

test('uses one simple native logo splash with a brief handoff to the first rendered screen', () => {
  assert.equal(splash.backgroundColor, '#F2F2F7');
  assert.equal(splash.image, './assets/images/splash-icon.png');
  assert.equal(splash.imageWidth, 160);
  assert.equal(splash.resizeMode, 'contain');
  assert.equal(splash.enableFullScreenImage_legacy, undefined);
  assert.equal(splash.dark.backgroundColor, '#1C1C1E');
  assert.equal(splash.dark.image, './assets/images/splash-icon-dark.png');

  const layout = readFileSync(resolve(root, 'src/app/_layout.tsx'), 'utf8');
  assert.doesNotMatch(layout, /LaunchSplash/);
  assert.match(layout, /SplashScreen\.setOptions\(\{ duration: 400, fade: true \}\)/);
});

test('wires the supplied branded icon set to both stores', () => {
  assert.equal(app.icon, './assets/images/app-icon.png');
  assert.equal(app.ios.icon, './assets/images/app-icon.png');
  assert.equal(app.android.icon, './assets/images/android-store-icon.png');
  assert.equal(app.android.adaptiveIcon.foregroundImage, './assets/images/android-icon-foreground.png');
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#F2F2F7');
});

test('uses inexact Android reminder fallback and enables predictive back navigation', () => {
  assert.equal(app.android.permissions.includes('android.permission.SCHEDULE_EXACT_ALARM'), false);
  assert.equal(app.android.blockedPermissions.includes('android.permission.SCHEDULE_EXACT_ALARM'), true);
  assert.equal(app.android.blockedPermissions.includes('android.permission.USE_EXACT_ALARM'), true);
  assert.equal(app.android.predictiveBackGestureEnabled, true);
});

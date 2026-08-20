import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const primaryRouteFiles = {
  activity: 'src/app/(tabs)/activity/index.tsx',
  guide: 'src/app/(tabs)/guide/index.tsx',
  schedule: 'src/app/(tabs)/schedule/index.tsx',
  today: 'src/app/(tabs)/(today)/index.tsx',
};
const primaryFeatureFiles = {
  schedule: 'src/features/collections/schedule-screen.tsx',
  today: 'src/features/collections/today-screen.tsx',
};
const primarySupportingFiles = {
  guide: ['src/features/guide/guide-mode-picker.tsx', 'src/features/guide/guide-screen-styles.ts'],
  schedule: ['src/features/collections/schedule-model.ts', 'src/features/collections/schedule-styles.ts'],
  today: ['src/features/collections/today-sections.tsx', 'src/features/collections/today-styles.ts'],
};
const readPrimary = (name) =>
  [primaryRouteFiles[name], primaryFeatureFiles[name], ...(primarySupportingFiles[name] ?? [])]
    .filter(Boolean)
    .map(read)
    .join('\n');

test('uses four primary destinations and keeps place management out of the tab bar', () => {
  const rootLayout = read('src/app/_layout.tsx');
  const tabs = read('src/app/(tabs)/_layout.tsx');
  assert.match(rootLayout, /<Stack\.Screen name="\(tabs\)"/);
  assert.match(rootLayout, /<Stack\.Screen\s+name="places"/);
  assert.match(tabs, /from 'expo-router\/js-tabs'/);
  assert.match(tabs, /name="\(today\)"/);
  assert.match(tabs, /name="schedule"/);
  assert.match(tabs, /name="guide"/);
  assert.match(tabs, /name="activity"/);
  assert.doesNotMatch(tabs, /name="places"/);
  assert.equal((tabs.match(/<Tabs\.Screen/g) ?? []).length, 4);
  for (const path of Object.values(primaryRouteFiles)) read(path);
});

test('gives Router and Guide tabs complete keyboard semantics', () => {
  const tabs = read('src/app/(tabs)/_layout.tsx');
  const guide = readPrimary('guide');
  assert.match(tabs, /tabBarAccessibilityLabel/);
  assert.match(tabs, /tabBarButtonTestID/);
  assert.match(tabs, /'aria-selected'/);
  assert.match(tabs, /tabIndex:/);
  assert.match(tabs, /ArrowLeft/);
  assert.match(tabs, /ArrowRight/);
  assert.match(tabs, /event\.key === 'Home'/);
  assert.match(tabs, /event\.key === 'End'/);
  assert.match(guide, /'aria-controls'/);
  assert.match(guide, /'aria-selected'/);
  assert.match(guide, /tabIndex:/);
  assert.match(guide, /ArrowLeft/);
  assert.match(guide, /ArrowRight/);
  assert.match(guide, /nativeID=/);
});

test('today distinguishes setup, tonight, empty, cached and error states without generated dates', () => {
  const today = readPrimary('today');
  assert.match(today, /Find your collection dates\./);
  assert.match(today, /Nothing goes out tonight/);
  assert.match(today, /goes out tonight/);
  assert.match(today, /Showing saved dates/);
  assert.match(today, /We couldn’t verify your dates/);
  assert.doesNotMatch(today, /guideGrid|wasteTypes\.map/);
});

test('upgrades cached schedules once to fetch council bin-colour metadata', () => {
  const provider = read('src/lib/use-app-data.tsx');
  assert.match(provider, /const collectionMetadataVersion = 1/);
  assert.match(provider, /metadataNeedsRefresh/);
  assert.match(provider, /metadataVersion: collectionMetadataVersion/);
});

test('uses the main source-backed bin colour for the Today hero and collection card', () => {
  const today = readPrimary('today');
  assert.match(today, /const heroColour = usesCouncilBinColour/);
  assert.match(today, /safeCollectionHeroColour\(primaryNextMeta\.colour, theme\.hero\)/);
  assert.match(today, /colors=\{\[heroColour, heroColour\]\}/);
  assert.match(today, /contrastTextForColour\(heroColour\)/);
  assert.match(today, /style=\{\[styles\.greeting, \{ color: heroForeground \}\]\}>\{heroTitle\}/);
  assert.doesNotMatch(today, /style=\{\[styles\.greeting, \{ color: heroForeground \}\]\}>Tonight/);
});

test('keeps the Today answer hero compact on a phone viewport', () => {
  const today = readPrimary('today');
  assert.match(today, /nativeID="today-hero"/);
  assert.match(today, /style=\{styles\.heroInfoRow\}/);
  assert.doesNotMatch(today, /style=\{styles\.answerRow\}/);
  assert.match(today, /countdownOrb: \{ height: 72, width: 72, borderRadius: 36/);
});

test('keeps the account form compact and keyboard-safe on shorter phones', () => {
  const account = read('src/app/account.tsx');
  assert.match(account, /automaticallyAdjustKeyboardInsets/);
  assert.match(account, /keyboardDismissMode="on-drag"/);
  assert.match(account, /style=\{styles\.heroCopy\}/);
  assert.match(account, /hero: \{[^}]*flexDirection: 'row'/);
  assert.match(account, /heroTitle: \{[^}]*fontSize: 21/);
  assert.doesNotMatch(account, /A quick, password-free sign in\./);
});

test('uses an adaptive navigation rail and a zoomable 1440px web shell', () => {
  const html = read('src/app/+html.tsx');
  const shell = read('src/components/app-shell.tsx');
  const designSystem = read('src/lib/design-system.ts');
  const tabs = read('src/app/(tabs)/_layout.tsx');
  const rootLayout = read('src/app/_layout.tsx');
  assert.match(html, /height: 100dvh/);
  assert.doesNotMatch(html, /maximum-scale/);
  assert.match(designSystem, /shellMaxWidth: 1440/);
  assert.match(shell, /appLayout\.shellMaxWidth/);
  assert.match(tabs, /tabBarPosition: adaptive\.navigationPosition/);
  assert.match(tabs, /navigationPosition === 'left'/);
  assert.match(tabs, /tabBarLabelPosition: rail \? 'beside-icon' : 'below-icon'/);
  assert.doesNotMatch(tabs, /rail && adaptive\.mode === 'wide' \? 'beside-icon' : 'below-icon'/);
  assert.match(tabs, /tabBarShowLabel: !rail \|\| adaptive\.mode === 'wide'/);
  assert.match(tabs, /minWidth: adaptive\.navigationRailWidth/);
  assert.match(tabs, /width: adaptive\.navigationRailWidth/);
  assert.match(tabs, /animation: reducedMotion \? 'none' : 'fade'/);
  assert.match(rootLayout, /useFonts\(Ionicons\.font\)/);
  assert.match(rootLayout, /if \(!fontsLoaded && !fontError\) return null/);
  assert.match(rootLayout, /animation: reducedMotion \? 'none' : 'slide_from_right'/);
  assert.match(rootLayout, /animation: reducedMotion \? 'none' : 'slide_from_bottom'/);
});

test('keeps the installed iOS web app outside both system safe areas', () => {
  const appConfig = read('app.json');
  const html = read('src/app/+html.tsx');
  assert.match(appConfig, /"barStyle": "default"/);
  assert.match(html, /apple-mobile-web-app-status-bar-style" content="default"/);
  assert.match(html, /@media \(display-mode: standalone\)/);
  assert.match(html, /height: -webkit-fill-available/);
  assert.match(html, /body, #root \{[\s\S]*?height: 100%;[\s\S]*?min-height: 100%;/);
});

test('all main routes provide route-specific metadata', () => {
  const expected = [
    [primaryFeatureFiles.today, 'title="Today"'],
    [primaryFeatureFiles.schedule, 'title="Collection Schedule"'],
    [primaryRouteFiles.guide, 'title="Recycling Guide"'],
    [primaryRouteFiles.activity, 'title="Activity"'],
    ['src/app/places.tsx', 'title="Manage Places"'],
    ['src/app/settings.tsx', 'title="Settings"'],
    ['src/app/reports.tsx', 'title="Missed Collection Reports"'],
    ['src/features/activity/history-screen.tsx', 'title="Activity History"'],
    ['src/app/support.tsx', 'title="Help and Support"'],
    ['src/app/partners.tsx', 'title="Council and Property Partnerships"'],
    ['src/app/onboarding.tsx', 'title="Set Up Your Bin Reminders"'],
    ['src/app/report-missed.tsx', 'title="Report a Missed Collection"'],
    ['src/app/report-incorrect.tsx', 'title="Report Incorrect Information"'],
  ];
  for (const [path, title] of expected) {
    const source = read(path);
    assert.match(source, /<RouteHead/);
    assert.ok(source.includes(title), `${path} is missing ${title}`);
  }
});

test('keeps weekly bin colour on collection meaning rather than utility headers', () => {
  const schedule = readPrimary('schedule');
  const guide = read(primaryRouteFiles.guide);
  const activity = read(primaryRouteFiles.activity);
  for (const source of [schedule, guide, activity]) {
    assert.doesNotMatch(source, /useWeeklyBinPalette/);
    assert.doesNotMatch(source, /weeklyBin\.background/);
  }
});

test('keeps legacy route files as redirects to the canonical names', () => {
  assert.match(read('src/app/calendar.tsx'), /<Redirect href="\/schedule"/);
  assert.match(read('src/app/find.tsx'), /<Redirect href="\/guide"/);
});

test('provides the conventional local web development command', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.equal(
    packageJson.scripts?.dev,
    'EXPO_PUBLIC_COUNCIL_API_BASE=https://what-bin-is-it-tonight.vercel.app/api expo start --web',
  );
});

test('does not request the production service worker from the Expo development server', () => {
  const pwa = read('src/lib/pwa-install.web.ts');
  assert.match(pwa, /process\.env\.NODE_ENV !== 'production'/);
});

test('keeps the installed PWA on the neutral Apple palette and current routes', () => {
  const manifest = JSON.parse(read('public/manifest.json'));
  assert.equal(manifest.theme_color, '#F2F2F7');
  assert.equal(manifest.background_color, '#F2F2F7');
  assert.equal(manifest.orientation, 'any');
  assert.deepEqual(
    manifest.shortcuts.map((shortcut) => shortcut.url),
    ['/', '/schedule', '/guide'],
  );
});

test('consolidates resident activity and keeps the collection cycle compact', () => {
  const schedule = readPrimary('schedule');
  const guide = read(primaryRouteFiles.guide);
  const settings = read('src/app/settings.tsx');
  const layout = read('src/app/_layout.tsx');
  assert.match(schedule, /slice\(0, 4\)/);
  assert.match(schedule, /All places/);
  assert.match(guide, /Saved · \{savedGuideItemIds\.length\}/);
  assert.match(settings, /Household sharing/);
  assert.match(layout, /name="household"/);
});

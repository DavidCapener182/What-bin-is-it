import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const lines = (path) => read(path).split('\n').length;

test('resident primary routes compose feature screens and large collection screens are decomposed', () => {
  const routes = {
    today: 'src/app/(tabs)/(today)/index.tsx',
    schedule: 'src/app/(tabs)/schedule/index.tsx',
  };
  assert.ok(lines(routes.today) <= 12);
  assert.ok(lines(routes.schedule) <= 12);
  assert.match(read(routes.today), /TodayScreen/);
  assert.match(read(routes.schedule), /ScheduleScreen/);
  assert.ok(lines('src/features/collections/today-screen.tsx') < 500);
  assert.ok(lines('src/features/collections/schedule-screen.tsx') < 500);
  assert.match(read('src/features/collections/today-screen.tsx'), /TodayPrimaryPane/);
  assert.match(read('src/features/collections/today-screen.tsx'), /TodayContextPane/);
  assert.match(read('src/features/collections/schedule-screen.tsx'), /scheduleMonthCells/);
  assert.ok(lines('src/app/places.tsx') < 500);
  assert.ok(lines('src/app/support.tsx') < 500);
  assert.ok(lines('src/app/settings.tsx') < 500);
  for (const path of [
    'src/app/(tabs)/guide/index.tsx',
    'src/app/places.tsx',
    'src/app/support.tsx',
    'src/app/settings.tsx',
    'src/app/onboarding.tsx',
    'src/app/reports.tsx',
  ]) assert.ok(lines(path) <= 300, `${path} should remain a route-sized orchestrator`);
  assert.match(read('src/app/places.tsx'), /SavedPlacesList/);
  assert.match(read('src/features/places/saved-places-list.tsx'), /ReanimatedSwipeable/);
  assert.match(read('src/app/support.tsx'), /SupportInbox/);
  assert.match(read('src/features/support/support-inbox.tsx'), /supportTopics/);
  assert.match(read('src/features/support/use-support-controller.ts'), /fetchBoundedResponseJson/);
  assert.match(read('src/features/support/support-model.ts'), /supportStatusLabel/);
});

test('resident growing collections use virtualized lists and adaptive detail panes', () => {
  const schedule = read('src/features/collections/schedule-screen.tsx');
  const guide = read('src/app/(tabs)/guide/index.tsx');
  const activity = read('src/features/activity/activity-inbox.tsx');
  const history = read('src/features/activity/history-screen.tsx');
  const reports = read('src/features/reports/reports-screen.tsx');
  assert.match(schedule, /<SectionList/);
  assert.match(schedule, /desktopWorkspace/);
  assert.match(guide, /<FlatList/);
  assert.match(guide, /GuideDetail/);
  assert.match(read('src/app/(tabs)/guide/[itemId].tsx'), /GuideDetail/);
  assert.match(activity, /<SectionList/);
  assert.match(activity, /ActivityDetail/);
  assert.match(history, /<SectionList/);
  assert.match(history, /ResidentMasterDetail/);
  assert.match(reports, /<FlatList/);
  assert.match(reports, /initialNumToRender=\{12\}/);
  assert.match(reports, /maxToRenderPerBatch=\{12\}/);
  assert.match(reports, /windowSize=\{7\}/);
  assert.match(reports, /ResidentMasterDetail/);
  assert.match(reports, /MissedCollectionReportRow/);
  assert.match(reports, /MissedCollectionReportCard key=\{selected\.id\}/);
  assert.doesNotMatch(reports, /visibleReports\.map/);
  assert.match(read('src/features/reports/missed-collection-report-row.tsx'), /accessibilityState=.*expanded/);
});

test('private resident utility routes emit noindex metadata', () => {
  const head = read('src/components/route-head.tsx');
  assert.match(head, /private\?: boolean/);
  assert.match(head, /name="robots" content="noindex,nofollow,noarchive"/);
  for (const path of [
    'src/app/account.tsx',
    'src/app/bulky-booking.tsx',
    'src/features/activity/history-screen.tsx',
    'src/app/household.tsx',
    'src/app/onboarding.tsx',
    'src/app/places.tsx',
    'src/app/reminder-settings.tsx',
    'src/app/report-incorrect.tsx',
    'src/app/report-missed.tsx',
    'src/app/reports.tsx',
    'src/app/settings.tsx',
    'src/app/support.tsx',
    'src/app/(tabs)/activity/index.tsx',
    'src/features/collections/schedule-screen.tsx',
    'src/app/(tabs)/guide/[itemId].tsx',
  ]) {
    assert.match(read(path), /\bprivate\b/, `${path} should be private`);
  }
});

test('primary setup and settings status use inline announcements and visible actions', () => {
  const onboarding = `${read('src/app/onboarding.tsx')}\n${read('src/features/onboarding/onboarding-steps.tsx')}`;
  const places = `${read('src/app/places.tsx')}\n${read('src/features/places/use-places-controller.ts')}\n${read('src/features/places/saved-places-list.tsx')}`;
  const reminders = read('src/app/reminder-settings.tsx');
  const pwa = read('src/components/pwa-settings-card.web.tsx');
  assert.doesNotMatch(onboarding, /Alert\.alert/);
  assert.match(onboarding, /InlineNotice/);
  assert.match(onboarding, /ResidentSearchField/);
  assert.match(places, /visibleRemove/);
  assert.match(places, /InlineNotice/);
  assert.equal((places.match(/Alert\.alert/g) ?? []).length, 1, 'only destructive place removal uses Alert');
  assert.doesNotMatch(reminders, /Alert\.alert/);
  assert.match(reminders, /accessibilityLiveRegion|InlineNotice/);
  assert.match(reminders, /Reminder time in 24-hour format/);
  assert.doesNotMatch(pwa, /Alert\.alert/);
  assert.match(pwa, /accessibilityLiveRegion/);
});

test('routine resident validation and status use inline live feedback', () => {
  for (const paths of [
    ['src/app/report-incorrect.tsx'],
    ['src/app/bulky-booking.tsx'],
    ['src/app/support.tsx', 'src/features/support/support-inbox.tsx'],
  ]) {
    const source = paths.map(read).join('\n');
    assert.doesNotMatch(source, /Alert\.alert/, `${paths.join(', ')} should not use modal status alerts`);
    assert.match(source, /accessibilityRole="alert"|accessibilityLiveRegion|InlineNotice/);
  }
  assert.equal((`${read('src/app/reports.tsx')}\n${read('src/features/reports/missed-collection-report-card.tsx')}`.match(/Alert\.alert/g) ?? []).length, 1, 'reports retains only destructive cancellation confirmation');
  assert.equal((read('src/app/account.tsx').match(/Alert\.alert/g) ?? []).length, 1, 'account retains only destructive removal confirmation');
  assert.equal((read('src/app/settings.tsx').match(/Alert\.alert/g) ?? []).length, 1, 'settings retains only destructive clear confirmation');
});

test('settings provides category navigation and searchable disclosure', () => {
  const settings = read('src/app/settings.tsx');
  assert.match(settings, /ResidentSearchField/);
  assert.match(settings, /Settings categories/);
  assert.match(settings, /accessibilityRole="tab"/);
  assert.match(settings, /No settings match that search/);
});

test('PWA settings expose verified updates and user-controlled cache diagnostics', () => {
  const card = read('src/components/pwa-settings-card.web.tsx');
  for (const symbol of ['updateAvailable', 'cacheState', 'applyPwaUpdate', 'refreshPwaCacheStatus', 'resetPwaCaches']) {
    assert.match(card, new RegExp(symbol));
  }
  assert.match(card, /App update ready/);
  assert.match(card, /Clear offline app storage/);
});

test('resident gateway responses stay bounded through body consumption', () => {
  const provider = read('src/lib/council-provider.ts');
  const bounded = read('src/lib/bounded-response.ts');
  assert.doesNotMatch(provider, /fetchWithTimeout|response\.json\(/);
  assert.ok((provider.match(/fetchBoundedResponseJson\(/g) ?? []).length >= 6);
  assert.match(bounded, /if \(response\.ok\)[\s\S]*readBoundedResponseJson/);
  assert.match(bounded, /Error pages are not guaranteed to be JSON/);
});

test('web and native notifications share the same exact internal route whitelist', () => {
  const routes = JSON.parse(read('shared/notification-routes.json'));
  assert.deepEqual(routes, ['/', '/activity', '/schedule', '/settings']);
  assert.match(read('scripts/pwa-notification-safety.mjs'), /notification-routes\.json/);
  const native = read('src/components/notification-navigation.native.tsx');
  assert.match(native, /approvedNativeNotificationPath/);
  assert.doesNotMatch(native, /url ===/);
});

test('account export is user-controlled and never writes sensitive JSON to the clipboard', () => {
  const account = read('src/lib/use-account.tsx');
  const presenter = read('src/features/account/account-export.ts');
  assert.doesNotMatch(account, /expo-clipboard|Clipboard\.setStringAsync/);
  assert.match(account, /fetchBoundedResponseJson/);
  assert.match(account, /presentAccountExport/);
  assert.match(presenter, /Share\.share/);
  assert.match(presenter, /new Blob/);
  assert.match(presenter, /URL\.revokeObjectURL/);
});

test('browser account fixtures are explicit, loopback-only, and exercise user-controlled account boundaries', () => {
  const fixture = read('src/features/account/browser-account-fixture.ts');
  const browser = read('tests/browser/resident-journeys.spec.mjs');
  const config = read('tests/browser/playwright.config.mjs');
  assert.match(fixture, /hostname === '127\.0\.0\.1'/);
  assert.match(fixture, /hostname === 'localhost'/);
  assert.match(fixture, /resident-browser-fixture-token/);
  assert.match(browser, /manual postcode and exact-address onboarding/);
  assert.match(browser, /creates and replies in a fixture-only support conversation/);
  assert.match(browser, /account export downloads only after a user action/);
  assert.ok((browser.match(/toHaveScreenshot\(/g) ?? []).length >= 1);
  assert.match(config, /snapshotPathTemplate/);
  assert.doesNotMatch(JSON.parse(read('package.json')).scripts['test:browser:resident'], /update-snapshots/);
});

test('secondary status and source routes expose bounded refresh and build metadata', () => {
  const status = read('src/app/status.tsx');
  const sources = read('src/app/data-sources.tsx');
  const app = JSON.parse(read('app.json'));
  assert.match(status, /fetchBoundedResponseJson/);
  assert.doesNotMatch(status, /response\.json\(/);
  assert.match(status, /setInterval/);
  assert.match(status, /Refresh status/);
  assert.match(status, /Try again/);
  assert.match(status, /accessibilityRole="alert"/);
  assert.match(sources, /contentUpdatedLabel\(\)/);
  assert.doesNotMatch(sources, /updated="\d/);
  assert.match(app.expo.extra.contentUpdatedAt, /^\d{4}-\d{2}-\d{2}$/);
});

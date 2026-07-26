import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('uses four primary destinations and keeps place management out of the tab bar', () => {
  const shell = read('src/components/app-shell.tsx');
  assert.match(shell, /route: '\/schedule', label: 'Schedule'/);
  assert.match(shell, /route: '\/guide', label: 'Guide'/);
  assert.doesNotMatch(shell, /route: '\/places', label: 'Places'/);
  assert.equal((shell.match(/^\s+\{ route:/gm) ?? []).length, 4);
});

test('gives app and Guide tabs complete keyboard and panel semantics', () => {
  const shell = read('src/components/app-shell.tsx');
  const guide = read('src/app/guide.tsx');
  for (const source of [shell, guide]) {
    assert.match(source, /'aria-controls'/);
    assert.match(source, /'aria-selected'/);
    assert.match(source, /tabIndex:/);
    assert.match(source, /ArrowLeft/);
    assert.match(source, /ArrowRight/);
    assert.match(source, /nativeID=/);
  }
});

test('today distinguishes setup, tonight, empty, cached and error states without generated dates', () => {
  const today = read('src/app/index.tsx');
  assert.match(today, /Find your collection dates\./);
  assert.match(today, /Nothing goes out tonight/);
  assert.match(today, /goes out tonight/);
  assert.match(today, /Showing saved dates/);
  assert.match(today, /We couldn’t verify your dates/);
  assert.doesNotMatch(today, /guideGrid|wasteTypes\.map/);
});

test('all main routes provide route-specific metadata', () => {
  const expected = [
    ['src/app/index.tsx', 'title="Today"'],
    ['src/app/schedule.tsx', 'title="Collection Schedule"'],
    ['src/app/guide.tsx', 'title="Recycling Guide"'],
    ['src/app/places.tsx', 'title="Manage Places"'],
    ['src/app/settings.tsx', 'title="Settings"'],
    ['src/app/reports.tsx', 'title="Missed Collection Reports"'],
    ['src/app/history.tsx', 'title="Activity History"'],
    ['src/app/support.tsx', 'title="Help and Support"'],
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
  assert.deepEqual(
    manifest.shortcuts.map((shortcut) => shortcut.url),
    ['/', '/schedule', '/guide'],
  );
});

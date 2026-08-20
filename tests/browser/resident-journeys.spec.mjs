import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 812 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 900 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1440', width: 1440, height: 1000 },
];
const appearances = ['light', 'dark'];
const textSizes = [
  { name: 'standard-text', scale: 1 },
  { name: 'large-text', scale: 1.3 },
];
const fixedNow = new Date('2026-08-20T12:00:00.000Z');

function isoDate(offset) {
  const date = new Date(fixedNow);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function residentState() {
  const home = {
    councilName: 'Test Council',
    id: 'browser-home',
    isPrimary: true,
    label: 'Home',
    line1: '1 Test Street',
    postcode: 'M1 1AE',
    providerId: 'browser-test-council',
  };
  const work = {
    councilName: 'Fixture Borough Council',
    id: 'browser-work',
    isPrimary: false,
    label: 'Work',
    line1: '2 Fixture Road',
    postcode: 'SW1A 1AA',
    providerId: 'browser-fixture-council',
  };
  const homeCollections = [
    { date: isoDate(1), id: 'browser-general', source: 'council', wasteType: 'general' },
    { date: isoDate(4), id: 'browser-recycling', source: 'council', wasteType: 'recycling' },
    { date: isoDate(8), id: 'browser-food', source: 'council', wasteType: 'food' },
    { date: isoDate(11), id: 'browser-garden', source: 'council', wasteType: 'garden' },
  ];
  const workCollections = [
    { date: isoDate(2), id: 'browser-work-general', source: 'council', wasteType: 'general' },
    { date: isoDate(9), id: 'browser-work-recycling', source: 'council', wasteType: 'recycling' },
  ];
  return {
    activeAddressId: home.id,
    addresses: [home, work],
    preferences: {
      enabled: false,
      reminderDayOffset: 1,
      reminderHour: 19,
      reminderMinute: 0,
      wasteTypes: { food: true, garden: true, general: true, other: true, recycling: true },
    },
    schedulesByAddressId: {
      [home.id]: {
        collections: homeCollections,
        lastVerifiedAt: fixedNow.toISOString(),
        metadataVersion: 1,
        sourceStatus: 'Verified test fixture · browser-only local state',
      },
      [work.id]: {
        collections: workCollections,
        lastVerifiedAt: fixedNow.toISOString(),
        metadataVersion: 1,
        sourceStatus: 'Verified test fixture · browser-only local state',
      },
    },
  };
}

function fixtureReport() {
  const now = fixedNow.toISOString();
  return {
    addressId: 'browser-home',
    binLabel: 'General waste',
    collectionDate: isoDate(-1),
    collectionId: 'browser-past-general',
    councilName: 'Test Council',
    createdAt: now,
    details: {
      accessibleToCrew: true,
      attachedNotice: false,
      neighboursCollected: 'unknown',
      putOutOnTime: true,
      stillOutside: true,
    },
    eligibilityCheckedAt: now,
    eligibilityResult: { eligible: true, reason: 'Fixture eligibility only' },
    eligibleAfter: isoDate(-1),
    id: 'browser-report',
    lastCheckedAt: now,
    localTrackingId: 'WB-FIXTURE-001',
    officialServiceUrl: 'https://example.gov.uk/missed-bin',
    postcode: 'M1 1AE',
    propertyAddress: '1 Test Street',
    providerId: 'browser-test-council',
    reportType: 'missed_collection',
    status: 'opened-council-service',
    submissionMethod: 'council-website',
    updatedAt: now,
    wasteType: 'general',
  };
}

function fixtureSupportThread({ residentBody = 'My reminders are one day late.', replyBody } = {}) {
  const messages = [
    { id: 'message-resident-1', sender: 'resident', body: residentBody, createdAt: fixedNow.toISOString() },
    ...(replyBody ? [{ id: 'message-support-1', sender: 'support', body: replyBody, createdAt: fixedNow.toISOString() }] : []),
  ];
  return {
    id: 'browser-support-thread',
    councilName: 'Test Council',
    councilProviderId: 'browser-test-council',
    topic: 'notifications',
    subject: 'Notification timing',
    status: replyBody ? 'waiting-resident' : 'new',
    lastSender: replyBody ? 'support' : 'resident',
    lastMessageAt: fixedNow.toISOString(),
    createdAt: fixedNow.toISOString(),
    updatedAt: fixedNow.toISOString(),
    messages,
  };
}

async function seedResident(page, { appearance = 'light', includeReport = false } = {}) {
  await page.clock.setFixedTime(fixedNow);
  await page.addInitScript(({ appState, productState }) => {
    localStorage.setItem('@what-bin-is-it-tonight/state-v4', JSON.stringify(appState));
    localStorage.setItem('@what-bin-is-it-tonight/product-state-v1', JSON.stringify(productState));
  }, {
    appState: residentState(),
    productState: {
      appearance,
      onboarding: { completed: true, skipped: false },
      reports: includeReport ? [fixtureReport()] : [],
    },
  });
}

async function seedFixtureAccount(page) {
  await page.addInitScript(() => {
    localStorage.setItem('what-bin:e2e-account-fixture-v1', JSON.stringify({
      accessToken: 'resident-browser-fixture-token',
      email: 'resident@example.test',
      userId: 'browser-resident',
    }));
  });
}

async function waitForVisualStability(page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(100);
}

async function mockOnboardingCouncilJourney(page) {
  await page.route('https://api.postcodes.io/postcodes/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        result: {
          postcode: 'M1 1AE',
          admin_district: 'Manchester',
          parish: 'Manchester',
          region: 'North West',
          latitude: 53.4794,
          longitude: -2.2453,
          codes: { admin_district: 'E08000003' },
        },
      }),
    });
  });
  await page.route('**/api/v1/addresses?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        addresses: [
          { id: 'fixture-property-10', line1: '10 Fixture Street', postcode: 'M1 1AE' },
          { id: 'fixture-property-12', line1: '12 Fixture Street', postcode: 'M1 1AE' },
        ],
      }),
    });
  });
  await page.route('**/api/v1/collections', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        councilName: 'Manchester City Council',
        providerId: 'lad-e08000003',
        verifiedAt: fixedNow.toISOString(),
        collections: [
          { date: isoDate(1), wasteType: 'general', label: 'General waste' },
          { date: isoDate(4), wasteType: 'recycling', label: 'Mixed recycling' },
        ],
      }),
    });
  });
}

async function emulateResidentTextSize(page, scale) {
  if (scale === 1) return;
  await page.addInitScript((requestedScale) => {
    const scaled = new WeakSet();
    const scaleText = (root) => {
      const elements = root instanceof Element ? [root, ...root.querySelectorAll('*')] : [...document.querySelectorAll('*')];
      for (const element of elements) {
        if (scaled.has(element) || element.children.length || !element.textContent?.trim()) continue;
        const computed = getComputedStyle(element);
        const fontSize = Number.parseFloat(computed.fontSize);
        const lineHeight = Number.parseFloat(computed.lineHeight);
        if (!Number.isFinite(fontSize) || fontSize < 9) continue;
        scaled.add(element);
        element.setAttribute('data-resident-large-text', 'true');
        element.style.setProperty('font-size', `${Math.min(fontSize * requestedScale, 52)}px`, 'important');
        if (Number.isFinite(lineHeight)) {
          element.style.setProperty('line-height', `${Math.min(lineHeight * requestedScale, 66)}px`, 'important');
        }
      }
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) scaleText(node);
        }
      }
    });
    const start = () => {
      scaleText(document.body);
      observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }, scale);
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

async function expectNamedVisibleButtons(page) {
  const unnamedButtons = await page.locator('[role="button"]:visible').evaluateAll((buttons) => buttons.filter((button) => {
    const label = button.getAttribute('aria-label') || button.textContent || button.getAttribute('title');
    return !label?.trim();
  }).length);
  expect(unnamedButtons).toBe(0);
}

for (const viewport of viewports) {
  for (const appearance of appearances) {
    for (const textSize of textSizes) {
      const caseName = `${viewport.name}px-${appearance}-${textSize.name}`;
      test(`resident shell and primary routes at ${caseName}`, async ({ page }) => {
        test.slow();
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await emulateResidentTextSize(page, textSize.scale);
        await seedResident(page, { appearance });

        await page.goto('/');
        await expect(page.getByText('What Bin Is It Tonight?', { exact: true }).first()).toBeVisible();
        await expect(page.getByText(/goes out tonight|Collection is tomorrow/i).first()).toBeVisible();
        await expectNamedVisibleButtons(page);
        await expectNoHorizontalOverflow(page);

        await page.goto('/schedule');
        await expect(page.getByRole('heading', { name: /Next four collections|Collection calendar/i })).toBeVisible();
        await expect(page.getByText('General waste', { exact: true }).filter({ visible: true }).first()).toBeVisible();
        await expectNamedVisibleButtons(page);
        await expectNoHorizontalOverflow(page);

        await page.goto('/guide');
        const guideSearch = page.getByRole('textbox', { name: 'Search household items' });
        await expect(guideSearch).toBeVisible();
        await guideSearch.fill('glass');
        await expect(page.getByText(/glass/i).first()).toBeVisible();
        await expectNamedVisibleButtons(page);
        await expectNoHorizontalOverflow(page);

        await page.goto('/activity');
        await expect(page.getByRole('heading', { name: 'Your bin timeline' }).first()).toBeVisible();
        await expectNamedVisibleButtons(page);
        await expectNoHorizontalOverflow(page);

        await page.goto('/settings');
        await expect(page.getByText('Offline storage', { exact: true }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Clear offline app storage' })).toBeVisible();
        await expect(page.getByRole('radio', { name: appearance === 'dark' ? 'Dark' : 'Light' })).toBeChecked();
        if (textSize.scale > 1) {
          await expect(page.locator('[data-resident-large-text="true"]').first()).toBeVisible();
        }
        await expectNamedVisibleButtons(page);
        await expectNoHorizontalOverflow(page);
        await waitForVisualStability(page);
        await expect(page).toHaveScreenshot(`settings-${caseName}.png`, { fullPage: true });
      });
    }
  }
}

const visualCases = [
  { name: 'today-320-light-standard', path: '/', width: 320, height: 720, appearance: 'light', scale: 1, ready: (page) => page.getByText('What Bin Is It Tonight?', { exact: true }).first() },
  { name: 'schedule-768-light-large', path: '/schedule', width: 768, height: 900, appearance: 'light', scale: 1.3, ready: (page) => page.getByRole('heading', { name: 'Collection calendar' }) },
  { name: 'settings-1440-light-standard', path: '/settings', width: 1440, height: 1000, appearance: 'light', scale: 1, ready: (page) => page.getByRole('textbox', { name: 'Search settings' }) },
  { name: 'today-320-dark-large', path: '/', width: 320, height: 720, appearance: 'dark', scale: 1.3, ready: (page) => page.getByText('What Bin Is It Tonight?', { exact: true }).first() },
  { name: 'guide-768-dark-standard', path: '/guide', width: 768, height: 900, appearance: 'dark', scale: 1, ready: (page) => page.getByRole('textbox', { name: 'Search household items' }) },
  { name: 'activity-1440-dark-large', path: '/activity', width: 1440, height: 1000, appearance: 'dark', scale: 1.3, ready: (page) => page.getByRole('heading', { name: 'Your bin timeline' }).first() },
];

for (const visual of visualCases) {
  test(`resident visual baseline ${visual.name}`, async ({ page }) => {
    await page.setViewportSize({ width: visual.width, height: visual.height });
    await emulateResidentTextSize(page, visual.scale);
    await seedResident(page, { appearance: visual.appearance });
    await page.goto(visual.path);
    await expect(visual.ready(page)).toBeVisible();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot(`${visual.name}.png`);
  });
}

test('resident completes manual postcode and exact-address onboarding against bounded council fixtures', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.setFixedTime(fixedNow);
  await mockOnboardingCouncilJourney(page);
  await page.goto('/onboarding');
  await page.getByRole('textbox', { name: 'UK postcode' }).fill('M1 1AE');
  await page.getByRole('button', { name: 'Find my collection' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your property' })).toBeVisible();
  const property = page.getByRole('radio', { name: /10 Fixture Street/ });
  await property.click();
  await expect(property).toBeChecked();
  await page.getByRole('button', { name: 'Check collection dates' }).click();
  await expect(page.getByRole('heading', { name: 'Your first collection is ready' })).toBeVisible();
  await expect(page.getByText('General waste', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  const reminders = page.getByRole('switch', { name: /Bin-night reminders/ });
  await reminders.click();
  await expect(reminders).not.toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Choose saved address' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('@what-bin-is-it-tonight/state-v4') ?? '{}');
    return state.addresses?.[0]?.line1;
  })).toBe('10 Fixture Street');
});

test('resident searches the Guide and opens the compact item detail route', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seedResident(page);
  await page.goto('/guide');
  await page.getByRole('textbox', { name: 'Search household items' }).fill('glass bottle');
  const result = page.getByRole('button', { name: 'Glass bottles & jars. Check locally' });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/guide\/glass$/);
  await expect(page.getByRole('heading', { name: 'Glass bottles & jars' })).toBeVisible();
  await expect(page.getByText('Kerbside recycling or bottle bank', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Save this item|Remove from saved items/ })).toBeVisible();
});

test('signed-in resident creates and replies in a fixture-only support conversation', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await seedResident(page);
  await seedFixtureAccount(page);
  let thread = fixtureSupportThread();
  await page.route('**/api/support/threads', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      expect(body.detail).toBe('My reminders are one day late.');
      expect(body.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
      thread = fixtureSupportThread({ residentBody: body.detail, replyBody: 'We are checking the schedule.' });
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ threads: [thread] }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ threads: [] }) });
  });
  await page.route('**/api/support/reply', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.threadId).toBe(thread.id);
    expect(body.detail).toBe('Thanks, that helps.');
    thread = { ...thread, lastSender: 'resident', status: 'in-progress', messages: [...thread.messages, { id: 'message-resident-2', sender: 'resident', body: body.detail, createdAt: fixedNow.toISOString() }] };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ threads: [thread] }) });
  });
  await page.goto('/support');
  await page.getByRole('radio', { name: 'Notifications' }).click();
  await page.getByRole('textbox', { name: 'Support message' }).fill('My reminders are one day late.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Message sent. Replies will appear here in the app.', { exact: true })).toBeVisible();
  await expect(page.getByText('We are checking the schedule.', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Reply to support' }).fill('Thanks, that helps.');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByText('Reply sent.', { exact: true })).toBeVisible();
  await expect(page.getByText('Thanks, that helps.', { exact: true })).toBeVisible();
});

test('fixture account export downloads only after a user action and removal requires explicit confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await seedResident(page);
  await seedFixtureAccount(page);
  await page.route('**/api/account/export', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer resident-browser-fixture-token');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ account: { id: 'browser-resident', email: 'resident@example.test' }, requestId: '11111111-1111-4111-8111-111111111111' }) });
  });
  let removalRequests = 0;
  await page.route('**/api/account/delete', async (route) => {
    removalRequests += 1;
    expect(route.request().headers()['x-bin-confirm-delete']).toBe('remove-what-bin-account');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ removed: true, identityRetained: true }) });
  });
  await page.goto('/account');
  await expect(page.getByText('resident@example.test', { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export account data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('what-bin-account-export-2026-08-20.json');

  page.once('dialog', async (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Remove What Bin account data' }).click();
  await expect.poll(() => removalRequests).toBe(0);
  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove What Bin account data' }).click();
  await expect.poll(() => removalRequests).toBe(1);
  await expect(page.getByText('Continue with email', { exact: true })).toBeVisible();
});

test('resident can change the active place without swipe-only controls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seedResident(page);
  await page.goto('/places');
  const work = page.getByRole('button', { name: 'Use Work, SW1A 1AA' });
  await expect(work).toBeVisible();
  await work.click();
  await expect(page.getByRole('button', { name: 'Use Work, SW1A 1AA', pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { exact: true, name: 'Remove Work' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('resident calendar export is available as a local ICS download', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await seedResident(page);
  await page.goto('/schedule');
  const exportButton = page.getByRole('button', { name: 'Add to calendar (.ics)' }).first();
  await expect(exportButton).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('bin-collections-m1-1ae.ics');
});

test('resident report handoff remains official while status tracking stays local', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await seedResident(page, { includeReport: true });
  await page.goto('/reports');
  await expect(page.getByText('WB-FIXTURE-001', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Official council service' })).toBeVisible();
  await page.getByRole('button', { name: 'I submitted this to the council' }).click();
  await expect(page.getByText('Reported to council', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel local tracking' })).toBeVisible();
});

test('support and account data actions remain behind the verified-account boundary', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seedResident(page);
  await page.goto('/support');
  await expect(page.getByText(/In-app support is not configured in this build|Sign in to message support/)).toBeVisible();
  await page.goto('/account');
  await expect(page.getByText(/Account sign-in is being connected|Continue with email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export account data' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove What Bin account data' })).toHaveCount(0);
});

for (const appearance of appearances) {
  test(`representative resident surfaces meet automated WCAG 2.2 AA rules in ${appearance} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await seedResident(page, { appearance, includeReport: true });
    const surfaces = [
      { path: '/', ready: () => page.getByText('What Bin Is It Tonight?', { exact: true }).first() },
      { path: '/schedule', ready: () => page.getByRole('heading', { name: 'Collection calendar' }) },
      { path: '/guide', ready: () => page.getByRole('textbox', { name: 'Search household items' }) },
      { path: '/activity', ready: () => page.getByRole('heading', { name: 'Your bin timeline' }).first() },
      { path: '/settings', ready: () => page.getByRole('textbox', { name: 'Search settings' }) },
      { path: '/places', ready: () => page.getByText('Manage places', { exact: true }) },
      { path: '/reports', ready: () => page.getByText('WB-FIXTURE-001', { exact: true }) },
      { path: '/support', ready: () => page.getByText(/In-app support is not configured in this build|Sign in to message support/) },
      { path: '/account', ready: () => page.getByText(/Account sign-in is being connected|Continue with email/i) },
    ];

    for (const surface of surfaces) {
      await page.goto(surface.path);
      await expect(surface.ready()).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(result.violations, `${appearance} ${surface.path}: ${JSON.stringify(result.violations, null, 2)}`).toEqual([]);
    }
  });
}

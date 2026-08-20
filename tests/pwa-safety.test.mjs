import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import vm from 'node:vm';

import {
  assertPrecacheBudget,
  buildPrecachePaths,
  PWA_PRECACHE_BUDGET,
  PWA_RUNTIME_CACHE_MAX_ENTRIES,
  privateNavigationPath,
  publicApiResponseCacheable,
  runtimeCacheableAsset,
  runtimeCacheableNavigation,
  runtimeCacheablePublicApi,
} from '../scripts/pwa-cache-safety.mjs';
import {
  APPROVED_NOTIFICATION_ACTIONS,
  APPROVED_NOTIFICATION_PATHS,
  NOTIFICATION_DEFAULTS,
  approvedNotificationPath,
  notificationActionTarget,
  sanitiseNotificationActions,
  sanitiseNotificationPayload,
  serviceWorkerNotificationSafetySource,
} from '../scripts/pwa-notification-safety.mjs';

const execFileAsync = promisify(execFile);

test('notification payloads use bounded fields and exact internal routes', () => {
  for (const route of APPROVED_NOTIFICATION_PATHS) {
    assert.equal(approvedNotificationPath(route), route);
  }
  for (const unsafeRoute of [
    'https://evil.example/schedule',
    '//evil.example/schedule',
    'javascript:alert(1)',
    '/schedule?token=secret',
    '/schedule#fragment',
    '/schedule/',
    '/%73chedule',
    '/account',
    42,
  ]) {
    assert.equal(approvedNotificationPath(unsafeRoute), NOTIFICATION_DEFAULTS.url);
  }

  const payload = sanitiseNotificationPayload({
    title: `${'T'.repeat(90)}\u0000`,
    body: 'B'.repeat(300),
    tag: 'G'.repeat(160),
    url: 'https://evil.example/',
  });
  assert.equal(payload.title.length, 80);
  assert.equal(payload.body.length, 240);
  assert.equal(payload.tag.length, 120);
  assert.equal(payload.url, '/schedule');
  assert.deepEqual(sanitiseNotificationPayload(undefined), NOTIFICATION_DEFAULTS);
});

test('notification actions are reduced to canonical allowlisted commands', () => {
  assert.deepEqual(sanitiseNotificationActions([
    { action: 'open-schedule', title: 'Open an attacker-controlled URL' },
    { action: 'open-schedule' },
    { action: 'unknown-action' },
    { action: 'dismiss', title: '<script>' },
  ]), [
    { action: 'open-schedule', title: APPROVED_NOTIFICATION_ACTIONS['open-schedule'].title },
    { action: 'dismiss', title: APPROVED_NOTIFICATION_ACTIONS.dismiss.title },
  ]);
  assert.equal(notificationActionTarget('open-schedule', '/activity'), '/schedule');
  assert.equal(notificationActionTarget('dismiss', '/activity'), undefined);
  assert.equal(notificationActionTarget('unknown-action', '/activity'), '/activity');
  assert.equal(notificationActionTarget('', 'https://evil.example/'), '/schedule');
});

test('generated notification safety source executes without module closures', () => {
  const context = {};
  vm.runInNewContext(`
    ${serviceWorkerNotificationSafetySource()}
    result = sanitiseNotificationPayload({
      title: 'Verified change',
      body: 'Collection date changed.',
      tag: 'council-change',
      url: 'https://evil.example/account'
    });
  `, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)), {
    title: 'Verified change',
    body: 'Collection date changed.',
    tag: 'council-change',
    url: '/schedule',
    actions: [],
  });
});

test('runtime navigation caching excludes queries, private paths, APIs and other origins', () => {
  const origin = 'https://what-bin-is-it-tonight.vercel.app';
  assert.equal(runtimeCacheableNavigation(`${origin}/schedule`, origin), true);
  assert.equal(runtimeCacheableNavigation(`${origin}/schedule?token=secret`, origin), false);
  assert.equal(runtimeCacheableNavigation(`${origin}/account`, origin), false);
  assert.equal(runtimeCacheableNavigation(`${origin}/account/callback`, origin), false);
  assert.equal(runtimeCacheableNavigation(`${origin}/household?invite=secret`, origin), false);
  assert.equal(runtimeCacheableNavigation(`${origin}/support`, origin), false);
  assert.equal(runtimeCacheableNavigation(`${origin}/api`, origin), false);
  assert.equal(runtimeCacheableNavigation(`${origin}/api/status`, origin), false);
  assert.equal(runtimeCacheableNavigation('https://evil.example/schedule', origin), false);
});

test('runtime asset caching only permits query-free public static files', () => {
  const origin = 'https://what-bin-is-it-tonight.vercel.app';
  for (const pathname of [
    '/_expo/static/js/web/app.js',
    '/assets/app.css',
    '/icons/bin.svg',
    '/fonts/app.woff2',
  ]) {
    assert.equal(runtimeCacheableAsset(`${origin}${pathname}`, origin), true);
  }
  for (const pathname of [
    '/account/avatar.png',
    '/household/export.js',
    '/support/private.css',
    '/assets/app.js?v=secret',
    '/assets/app.js#fragment',
    '/schedule',
    '/schedule.html',
    '/data.json',
    '/api/status.js',
  ]) {
    assert.equal(runtimeCacheableAsset(`${origin}${pathname}`, origin), false);
  }
  assert.equal(runtimeCacheableAsset('https://evil.example/assets/app.js', origin), false);
});

test('public API runtime caching is exact, anonymous and explicitly cacheable', () => {
  const origin = 'https://what-bin-is-it-tonight.vercel.app';
  assert.equal(runtimeCacheablePublicApi(new Request(`${origin}/api/status`), `${origin}/api/status`, origin), true);
  for (const request of [
    new Request(`${origin}/api/status?postcode=FY1`),
    new Request(`${origin}/api/health`),
    new Request(`${origin}/api/status`, { headers: { authorization: 'Bearer secret' } }),
    new Request(`${origin}/api/status`, { headers: { cookie: 'session=secret' } }),
    new Request(`${origin}/api/status`, { method: 'POST' }),
    new Request('https://evil.example/api/status'),
  ]) {
    assert.equal(runtimeCacheablePublicApi(request, request.url, origin), false);
  }
  assert.equal(publicApiResponseCacheable(new Response('ok', {
    headers: { 'cache-control': 'public, max-age=60' },
  })), true);
  assert.equal(publicApiResponseCacheable(new Response('ok')), false);
  assert.equal(publicApiResponseCacheable(new Response('ok', {
    headers: { 'cache-control': 'private, max-age=60' },
  })), false);
  assert.equal(publicApiResponseCacheable(new Response('ok', {
    headers: { 'cache-control': 'public, max-age=60', 'set-cookie': 'secret=value' },
  })), false);
  assert.equal(publicApiResponseCacheable(new Response('no', {
    status: 503,
    headers: { 'cache-control': 'public, max-age=60' },
  })), false);
});

test('generated precache list omits private route HTML and clean paths', () => {
  assert.equal(privateNavigationPath('/account'), true);
  assert.equal(privateNavigationPath('/account/callback'), true);
  assert.equal(privateNavigationPath('/account 3'), true);
  assert.equal(privateNavigationPath('/schedule'), false);
  const paths = buildPrecachePaths([
    'account.html',
    'account/index.html',
    'account 3.html',
    'household.html',
    'household 4.html',
    'support.html',
    'support 5.html',
    'schedule.html',
    'offline.html',
    '_expo/static/js/web/app.js',
  ]);
  assert.deepEqual(paths, [
    '/',
    '/_expo/static/js/web/app.js',
    '/offline',
    '/offline.html',
    '/schedule',
    '/schedule.html',
  ]);
  assert.equal(paths.some((route) => /account|household|support/.test(route)), false);
});

test('precache generation has deterministic URL and byte budgets', () => {
  assert.doesNotThrow(() => assertPrecacheBudget({
    urlCount: PWA_PRECACHE_BUDGET.maximumUrls,
    totalBytes: PWA_PRECACHE_BUDGET.maximumBytes,
  }));
  assert.throws(() => assertPrecacheBudget({
    urlCount: PWA_PRECACHE_BUDGET.maximumUrls + 1,
    totalBytes: 0,
  }), /URL budget exceeded/);
  assert.throws(() => assertPrecacheBudget({
    urlCount: 0,
    totalBytes: PWA_PRECACHE_BUDGET.maximumBytes + 1,
  }), /byte budget exceeded/);
});

test('generated worker template validates push actions and only caches the safe public status API', async () => {
  const source = await readFile(new URL('../scripts/generate-pwa.mjs', import.meta.url), 'utf8');
  assert.match(source, /try \{\s*rawPayload = event\.data\?\.json/);
  assert.match(source, /catch \{\s*\/\/ Malformed or non-JSON push data/);
  assert.match(source, /notificationActionTarget\(/);
  assert.match(source, /actions: payload\.actions/);
  assert.match(source, /runtimeCacheableNavigation\(url, self\.location\.origin\)/);
  assert.match(source, /url\.pathname === '\/api'/);
  assert.match(source, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(source, /runtimeCacheablePublicApi\(request, url, self\.location\.origin\)/);
  assert.match(source, /publicApiResponseCacheable\(response\)/);
  assert.match(source, /type === 'PWA_CACHE_STATUS'/);
  assert.match(source, /type === 'PWA_CLEAR_CACHES'/);
  assert.match(source, /type === 'SKIP_WAITING'/);
});

test('generated worker evaluates and bounds runtime caching for assets and navigations', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'what-bin-worker-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'dist', '_expo', 'static', 'js', 'web'), { recursive: true });
  await writeFile(path.join(directory, 'dist', 'index.html'), '<!doctype html>');
  await writeFile(path.join(directory, 'dist', '_expo', 'static', 'js', 'web', 'app.js'), 'export {};');
  const generator = new URL('../scripts/generate-pwa.mjs', import.meta.url);
  await execFileAsync(process.execPath, [generator.pathname], { cwd: directory });

  const workerSource = await readFile(path.join(directory, 'dist', 'sw.js'), 'utf8');
  const listeners = new Map();
  const cacheBuckets = new Map();
  const requestKey = (request) => (typeof request === 'string' ? request : request.url);
  const cacheFor = (name) => {
    let entries = cacheBuckets.get(name);
    if (!entries) {
      entries = new Map();
      cacheBuckets.set(name, entries);
    }
    return {
      add: async (request) => entries.set(requestKey(request), new Response('precache')),
      delete: async (request) => entries.delete(requestKey(request)),
      keys: async () => [...entries.keys()].map((url) => new Request(url)),
      match: async (request) => entries.get(requestKey(request)),
      put: async (request, response) => entries.set(requestKey(request), response),
    };
  };
  const caches = {
    delete: async (name) => cacheBuckets.delete(name),
    keys: async () => [...cacheBuckets.keys()],
    match: async (request) => {
      for (const name of cacheBuckets.keys()) {
        const match = await cacheFor(name).match(request);
        if (match) return match;
      }
      return undefined;
    },
    open: async (name) => cacheFor(name),
  };
  const origin = 'https://app.example';
  let skipWaitingCalls = 0;
  let fetchImplementation = async () => new Response('network');
  const self = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    clients: {
      claim: async () => undefined,
      matchAll: async () => [],
      openWindow: async () => undefined,
    },
    location: { origin },
    registration: { showNotification: async () => undefined },
    skipWaiting: async () => { skipWaitingCalls += 1; },
  };
  vm.runInNewContext(workerSource, {
    caches,
    console,
    fetch: (request) => fetchImplementation(request),
    Request,
    Response,
    self,
    URL,
  }, { filename: 'generated-sw.js' });

  async function dispatchNonNavigationFetch(pathname) {
    let responsePromise;
    listeners.get('fetch')({
      request: new Request(`${origin}${pathname}`),
      respondWith: (value) => { responsePromise = value; },
    });
    assert.ok(responsePromise, `worker did not handle ${pathname}`);
    return responsePromise;
  }

  async function dispatchNavigationFetch(pathname) {
    let responsePromise;
    listeners.get('fetch')({
      request: {
        method: 'GET',
        mode: 'navigate',
        url: `${origin}${pathname}`,
      },
      respondWith: (value) => { responsePromise = value; },
    });
    assert.ok(responsePromise, `worker did not handle navigation ${pathname}`);
    return responsePromise;
  }

  function dispatchUnclaimedFetch(request) {
    let responsePromise;
    listeners.get('fetch')({
      request,
      respondWith: (value) => { responsePromise = value; },
    });
    return responsePromise;
  }

  await dispatchNonNavigationFetch('/account');
  await dispatchNonNavigationFetch('/assets/app.js?v=cache-bust');
  assert.equal(cacheBuckets.size, 0);

  for (let index = 0; index < PWA_RUNTIME_CACHE_MAX_ENTRIES + 5; index += 1) {
    await dispatchNonNavigationFetch(`/assets/runtime-${index}.js`);
  }
  const runtimeCacheName = [...cacheBuckets.keys()].find((name) => name.endsWith('-runtime'));
  assert.ok(runtimeCacheName);
  const runtimeEntries = cacheBuckets.get(runtimeCacheName);
  assert.equal(runtimeEntries.size, PWA_RUNTIME_CACHE_MAX_ENTRIES);
  assert.equal([...runtimeEntries.keys()].some((url) => url.includes('/account')), false);
  assert.equal([...runtimeEntries.keys()].some((url) => url.includes('cache-bust')), false);
  assert.equal([...runtimeEntries.keys()].some((url) => url.endsWith('/assets/runtime-0.js')), false);

  fetchImplementation = async (request) => {
    if (new URL(request.url).pathname === '/api/status') {
      return new Response('public-status', {
        headers: { 'cache-control': 'public, max-age=60' },
      });
    }
    return new Response('network');
  };
  assert.equal(dispatchUnclaimedFetch(new Request(`${origin}/api/health`)), undefined);
  assert.equal(dispatchUnclaimedFetch(new Request(`${origin}/api/status?secret=value`)), undefined);
  assert.equal(dispatchUnclaimedFetch(new Request(`${origin}/api/status`, {
    headers: { authorization: 'Bearer secret' },
  })), undefined);
  const publicStatus = await dispatchNonNavigationFetch('/api/status');
  assert.equal(await publicStatus.text(), 'public-status');
  const publicApiCacheName = [...cacheBuckets.keys()].find((name) => name.endsWith('-public-api'));
  assert.ok(publicApiCacheName);
  assert.equal(cacheBuckets.get(publicApiCacheName).size, 1);
  fetchImplementation = async () => { throw new Error('offline'); };
  const offlineStatus = await dispatchNonNavigationFetch('/api/status');
  assert.equal(await offlineStatus.text(), 'public-status');

  let statusReply;
  let statusWork;
  listeners.get('message')({
    data: { type: 'PWA_CACHE_STATUS' },
    ports: [{ postMessage: (value) => { statusReply = value; } }],
    waitUntil: (value) => { statusWork = value; },
  });
  await statusWork;
  assert.equal(statusReply.type, 'PWA_CACHE_STATUS');
  assert.match(statusReply.version, /^what-bin-[a-f0-9]{12}$/);
  assert.ok(statusReply.caches.some((cache) => cache.name === publicApiCacheName && cache.entries === 1));

  let clearReply;
  let clearWork;
  listeners.get('message')({
    data: { type: 'PWA_CLEAR_CACHES' },
    ports: [{ postMessage: (value) => { clearReply = value; } }],
    waitUntil: (value) => { clearWork = value; },
  });
  await clearWork;
  assert.equal(clearReply.type, 'PWA_CACHE_CLEARED');
  assert.ok(clearReply.deletedCaches >= 2);
  assert.equal(cacheBuckets.size, 0);

  let updateWork;
  listeners.get('message')({
    data: { type: 'SKIP_WAITING' },
    waitUntil: (value) => { updateWork = value; },
  });
  await updateWork;
  assert.equal(skipWaitingCalls, 1);

  fetchImplementation = async () => new Response('network');
  await dispatchNavigationFetch('/schedule?token=cache-bust');
  for (let index = 0; index < PWA_RUNTIME_CACHE_MAX_ENTRIES + 5; index += 1) {
    await dispatchNavigationFetch(`/public-page-${index}`);
  }
  const refreshedRuntimeEntries = cacheBuckets.get(runtimeCacheName);
  assert.equal(refreshedRuntimeEntries.size, PWA_RUNTIME_CACHE_MAX_ENTRIES);
  assert.equal([...refreshedRuntimeEntries.keys()].some((url) => url.includes('token=cache-bust')), false);
  assert.equal([...refreshedRuntimeEntries.keys()].some((url) => url.endsWith('/public-page-0')), false);
  assert.equal([...refreshedRuntimeEntries.keys()].some((url) => url.endsWith('/public-page-84')), true);
  for (const [name, entries] of cacheBuckets) {
    if (name !== runtimeCacheName) {
      assert.equal([...entries.keys()].some((url) => url.includes('/public-page-')), false);
    }
  }
});

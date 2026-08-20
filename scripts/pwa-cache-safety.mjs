export const PRIVATE_NAVIGATION_PREFIXES = Object.freeze([
  '/account',
  '/household',
  '/support',
]);

export const PWA_PRECACHE_BUDGET = Object.freeze({
  maximumUrls: 400,
  maximumBytes: 40 * 1024 * 1024,
});

export const PWA_RUNTIME_CACHE_MAX_ENTRIES = 80;

export const RUNTIME_CACHEABLE_ASSET_EXTENSIONS = Object.freeze([
  '.css',
  '.ico',
  '.js',
  '.png',
  '.svg',
  '.webp',
  '.woff',
  '.woff2',
]);

export function privateNavigationPath(pathname) {
  return PRIVATE_NAVIGATION_PREFIXES.some((prefix) => {
    if (!pathname.startsWith(prefix)) return false;
    const suffix = pathname.slice(prefix.length);
    return suffix === '' || suffix.startsWith('/') || /^ \d+(?:\/|$)/.test(suffix);
  });
}

export function exportedHtmlRoute(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.endsWith('.html')) return undefined;
  return `/${relativePath.slice(0, -'.html'.length)}`.replace(/\/index$/, '') || '/';
}

export function buildPrecachePaths(relativePaths) {
  const paths = new Set(['/']);
  for (const relativePath of relativePaths) {
    const route = exportedHtmlRoute(relativePath);
    if (route && privateNavigationPath(route)) continue;
    paths.add(`/${relativePath}`);
    if (route) paths.add(route);
  }
  return [...paths].sort();
}

export function runtimeCacheableNavigation(value, expectedOrigin) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(value, expectedOrigin);
  } catch {
    return false;
  }
  return (
    url.origin === expectedOrigin
    && !url.search
    && !url.hash
    && url.pathname !== '/api'
    && !url.pathname.startsWith('/api/')
    && !privateNavigationPath(url.pathname)
  );
}

export function runtimeCacheableAsset(value, expectedOrigin) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(value, expectedOrigin);
  } catch {
    return false;
  }
  const pathname = url.pathname.toLowerCase();
  return (
    url.origin === expectedOrigin
    && !url.search
    && !url.hash
    && pathname !== '/api'
    && !pathname.startsWith('/api/')
    && !privateNavigationPath(pathname)
    && RUNTIME_CACHEABLE_ASSET_EXTENSIONS.some((extension) => pathname.endsWith(extension))
  );
}

export function runtimeCacheablePublicApi(request, value, expectedOrigin) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(value, expectedOrigin);
  } catch {
    return false;
  }
  return request?.method === 'GET'
    && url.origin === expectedOrigin
    && url.pathname === '/api/status'
    && !url.search
    && !url.hash
    && !request.headers?.get?.('authorization')
    && !request.headers?.get?.('cookie');
}

export function publicApiResponseCacheable(response) {
  const cacheControl = response?.headers?.get?.('cache-control') ?? '';
  return Boolean(
    response?.ok
    && /(?:^|,)\s*public(?:\s|,|$)/i.test(cacheControl)
    && !response.headers.get('set-cookie')
  );
}

export async function trimRuntimeCache(cache) {
  const requests = await cache.keys();
  const excess = requests.length - PWA_RUNTIME_CACHE_MAX_ENTRIES;
  if (excess <= 0) return;
  await Promise.all(requests.slice(0, excess).map((request) => cache.delete(request)));
}

export function assertPrecacheBudget({ urlCount, totalBytes }) {
  if (!Number.isSafeInteger(urlCount) || urlCount < 0 || urlCount > PWA_PRECACHE_BUDGET.maximumUrls) {
    throw new Error(`PWA precache URL budget exceeded: ${urlCount}/${PWA_PRECACHE_BUDGET.maximumUrls}.`);
  }
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 0 || totalBytes > PWA_PRECACHE_BUDGET.maximumBytes) {
    throw new Error(`PWA precache byte budget exceeded: ${totalBytes}/${PWA_PRECACHE_BUDGET.maximumBytes}.`);
  }
}

export function serviceWorkerCacheSafetySource() {
  return [
    `const PRIVATE_NAVIGATION_PREFIXES = ${JSON.stringify(PRIVATE_NAVIGATION_PREFIXES)};`,
    `const RUNTIME_CACHEABLE_ASSET_EXTENSIONS = ${JSON.stringify(RUNTIME_CACHEABLE_ASSET_EXTENSIONS)};`,
    `const PWA_RUNTIME_CACHE_MAX_ENTRIES = ${PWA_RUNTIME_CACHE_MAX_ENTRIES};`,
    privateNavigationPath.toString(),
    runtimeCacheableNavigation.toString(),
    runtimeCacheableAsset.toString(),
    runtimeCacheablePublicApi.toString(),
    publicApiResponseCacheable.toString(),
    trimRuntimeCache.toString(),
  ].join('\n\n');
}

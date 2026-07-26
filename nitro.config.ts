import { defineConfig } from 'nitro';

export default defineConfig({
  compatibilityDate: '2026-07-26',
  modules: ['workflow/nitro'],
  preset: 'vercel',
  serverDir: './server',
  publicAssets: [
    {
      baseURL: '/',
      dir: './dist',
      fallthrough: true,
      maxAge: 0,
    },
  ],
  routeRules: {
    '/sw.js': {
      headers: {
        'cache-control': 'no-cache, no-store, must-revalidate',
        'service-worker-allowed': '/',
      },
    },
    '/manifest.json': {
      headers: {
        'cache-control': 'public, max-age=3600',
        'content-type': 'application/manifest+json',
      },
    },
  },
  vercel: {
    entryFormat: 'node',
    functions: {
      maxDuration: 30,
    },
  },
});

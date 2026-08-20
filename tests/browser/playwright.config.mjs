import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.025,
      threshold: 0.25,
    },
  },
  fullyParallel: false,
  outputDir: resolve(root, 'artifacts/playwright/resident'),
  reporter: [['list'], ['html', { open: 'never', outputFolder: resolve(root, 'artifacts/playwright/resident-report') }]],
  snapshotPathTemplate: resolve(root, 'tests/browser/__screenshots__/{arg}{ext}'),
  testDir: '.',
  testIgnore: ['serve-dist.mjs'],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/browser/serve-dist.mjs',
    cwd: root,
    reuseExistingServer: true,
    timeout: 30_000,
    url: 'http://127.0.0.1:4173',
  },
});

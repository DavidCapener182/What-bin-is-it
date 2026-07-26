import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gatewayPath = resolve(root, 'api/_gateway/index.ts');
const nitroRoutePath = resolve(root, 'server/routes/api/v1/[resource].ts');
const nitroConfigSource = readFileSync(resolve(root, 'nitro.config.ts'), 'utf8');
const vercelConfig = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));

test('routes the Nitro Vercel function to the complete council gateway', () => {
  const route = readFileSync(nitroRoutePath, 'utf8');
  assert.match(route, /api\/_gateway\/index\.ts/);
  assert.match(route, /gateway\.fetch\(event\.req\)/);
});

test('the council gateway still accepts the relative path used by the app', () => {
  const invoked = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `
        const gateway = (await import(${JSON.stringify(gatewayPath)})).default;
        const response = await gateway.fetch(new Request(
          'https://what-bin-is-it-tonight.vercel.app/api/v1/addresses?postcode=BAD&providerId=lad-e08000011'
        ));
        if (response.status !== 400) {
          throw new Error('Expected 400, received ' + response.status + ': ' + await response.text());
        }
      `,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(invoked.status, 0, invoked.stderr || invoked.stdout);
});

test('builds a Nitro Vercel output with durable workflows and bundled Expo assets', () => {
  assert.match(nitroConfigSource, /modules:\s*\['workflow\/nitro'\]/);
  assert.match(nitroConfigSource, /preset:\s*'vercel'/);
  assert.match(nitroConfigSource, /serverDir:\s*'\.\/server'/);
  assert.match(nitroConfigSource, /dir:\s*'\.\/dist'/);
  assert.match(nitroConfigSource, /maxDuration:\s*30/);
  assert.equal(vercelConfig.buildCommand, 'npm run build');
  assert.equal(vercelConfig.outputDirectory, undefined);
  assert.equal(vercelConfig.functions, undefined);
});

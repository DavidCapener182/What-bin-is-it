import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = resolve(root, 'api');
const sourceEntryPath = resolve(apiRoot, '_gateway/entry.ts');
const runtimeEntryPath = resolve(apiRoot, 'v1/[resource].js');
const vercelConfig = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));

test('keeps every Vercel gateway module inside the api directory', () => {
  const source = readFileSync(sourceEntryPath, 'utf8');
  const relativeImports = [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]
    .map((match) => match[1]);

  assert.ok(relativeImports.length > 0, 'the Vercel route must import its gateway module');
  for (const specifier of relativeImports) {
    const importedPath = resolve(dirname(sourceEntryPath), specifier);
    assert.equal(
      relative(apiRoot, importedPath).startsWith('..'),
      false,
      `Vercel does not reliably package gateway modules outside /api: ${specifier}`,
    );
  }
});

test('ships a self-contained CommonJS function instead of raw TypeScript gateway files', () => {
  const runtimeSource = readFileSync(runtimeEntryPath, 'utf8');
  assert.doesNotMatch(runtimeSource, /require\(['"]\.\.\/_gateway/);
  assert.doesNotMatch(runtimeSource, /from\s+['"]\.\.\/_gateway/);

  const loaded = spawnSync(
    process.execPath,
    ['-e', `const route = require(${JSON.stringify(runtimeEntryPath)}); if (typeof route.default !== 'function') process.exit(2);`],
    { encoding: 'utf8' },
  );
  assert.equal(loaded.status, 0, loaded.stderr || loaded.stdout);
});

test('accepts the relative request URLs supplied by the Vercel Node runtime', () => {
  const invoked = spawnSync(
    process.execPath,
    ['-e', `
      const route = require(${JSON.stringify(runtimeEntryPath)}).default;
      const response = {
        statusCode: 200,
        headers: {},
        setHeader(name, value) { this.headers[name] = value; },
        end(body) { this.body = body; },
      };
      (async () => {
        await route({
          method: 'GET',
          url: '/api/v1/addresses?postcode=BAD&providerId=lad-e08000011&resource=addresses',
          headers: { host: 'what-bin-is-it-tonight.vercel.app', 'x-forwarded-proto': 'https' },
        }, response);
        if (response.statusCode !== 400) {
          throw new Error('Expected 400, received ' + response.statusCode + ': ' + response.body);
        }
      })().catch((error) => { console.error(error); process.exit(1); });
    `],
    { encoding: 'utf8' },
  );
  assert.equal(invoked.status, 0, invoked.stderr || invoked.stdout);
});

test('configures Vercel to execute the bundled JavaScript gateway', () => {
  assert.equal(
    vercelConfig.functions?.['api/v1/[resource].js']?.maxDuration,
    30,
    'Vercel must execute the self-contained CommonJS bundle with time for live council requests',
  );
});

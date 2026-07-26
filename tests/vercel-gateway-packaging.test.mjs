import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = resolve(root, 'api');
const entryPath = resolve(apiRoot, 'v1/[resource].ts');

test('keeps every Vercel gateway module inside the api directory', () => {
  const source = readFileSync(entryPath, 'utf8');
  const relativeImports = [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]
    .map((match) => match[1]);

  assert.ok(relativeImports.length > 0, 'the Vercel route must import its gateway module');
  for (const specifier of relativeImports) {
    const importedPath = resolve(dirname(entryPath), specifier);
    assert.equal(
      relative(apiRoot, importedPath).startsWith('..'),
      false,
      `Vercel does not reliably package gateway modules outside /api: ${specifier}`,
    );
  }
});

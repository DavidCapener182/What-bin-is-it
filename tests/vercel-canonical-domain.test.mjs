import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));

test('redirects Vercel deployment aliases to the canonical app origin', () => {
  const redirect = config.redirects?.find(
    (candidate) => candidate.destination === 'https://what-bin-is-it-tonight.vercel.app/$1',
  );

  assert.ok(redirect, 'alternate Vercel origins must redirect to the canonical domain');
  assert.equal(redirect.source, '/(.*)');
  assert.deepEqual(redirect.has, [{
    type: 'host',
    value: {
      re: '^what-bin-is-it-tonight(?:-[a-z0-9]+)?-capener182-gmailcoms-projects\\.vercel\\.app$',
    },
  }]);
  assert.deepEqual(redirect.missing, [{ type: 'query', key: 'preview' }]);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));

test('serves Expo static routes without an html extension', () => {
  assert.equal(
    config.cleanUrls,
    true,
    'Expo exports static route HTML, so Vercel must serve clean route URLs',
  );
});

test('keeps the renamed schedule and guide routes backwards compatible', () => {
  assert.ok(config.redirects?.some((redirect) => (
    redirect.source === '/calendar'
    && redirect.destination === '/schedule'
    && redirect.permanent === true
  )));
  assert.ok(config.redirects?.some((redirect) => (
    redirect.source === '/find'
    && redirect.destination === '/guide'
    && redirect.permanent === true
  )));
});

test('adds baseline browser security headers', () => {
  const headers = config.headers?.flatMap((rule) => rule.headers ?? []) ?? [];
  const names = new Set(headers.map((header) => header.key.toLowerCase()));
  for (const name of [
    'content-security-policy',
    'permissions-policy',
    'referrer-policy',
    'strict-transport-security',
    'x-content-type-options',
    'x-frame-options',
  ]) {
    assert.ok(names.has(name), `missing ${name}`);
  }
});

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

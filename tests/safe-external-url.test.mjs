import assert from 'node:assert/strict';
import test from 'node:test';

import { normaliseExternalHttpsUrl } from '../src/lib/safe-external-url.ts';

test('allows only bounded credential-free HTTPS navigation targets', () => {
  assert.equal(normaliseExternalHttpsUrl('https://example.gov.uk/tip'), 'https://example.gov.uk/tip');
  for (const value of [
    'http://example.gov.uk',
    'javascript:alert(1)',
    'whatbinistonight://account',
    'https://user:secret@example.gov.uk',
    'https://example.gov.uk/\r\nattack',
    `https://example.gov.uk/${'x'.repeat(2_100)}`,
  ]) {
    assert.equal(normaliseExternalHttpsUrl(value), undefined);
  }
});

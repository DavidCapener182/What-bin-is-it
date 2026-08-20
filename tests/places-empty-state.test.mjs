import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  'src/app/places.tsx',
  'src/features/places/use-places-controller.ts',
].map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n');

test('shows the postcode form immediately when there are no saved places', () => {
  assert.match(source, /const showPostcodeForm = showAdd \|\| addresses\.length === 0;/);
  assert.match(source, /addresses\.length === 0 \? 'Enter your postcode' : 'Add a new place'/);
});

test('does not tell a first-time user to add another place', () => {
  assert.match(source, /showPostcodeForm \? \(/);
  assert.match(source, /controller\.addresses\.length > 0 \? <Pressable accessibilityLabel="Close add place form"/);
});

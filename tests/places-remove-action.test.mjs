import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'src/app/places.tsx'), 'utf8');

test('uses a gesture-aware remove action and confirms web deletion explicitly', () => {
  assert.match(source, /Pressable as GesturePressable/);
  assert.match(source, /<GesturePressable[\s\S]*onPress=\{\(\) => confirmRemoveAddress\(address\)\}/);
  assert.match(source, /globalThis\.confirm/);
  assert.match(source, /removeAddress\(address\.id\)/);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contrastTextForColour,
  hasSourceCollectionColour,
  primaryCollectionForDate,
} from '../src/lib/data.ts';

function collection(id, wasteType, colour) {
  return {
    id,
    date: '2026-07-31',
    wasteType,
    source: 'council',
    ...(colour ? { colour } : {}),
  };
}

test('uses the main household bin before an accompanying food caddy', () => {
  const food = collection('food', 'food');
  const general = collection('general', 'general', '#7A263A');

  assert.equal(primaryCollectionForDate([food, general]), general);
  assert.equal(hasSourceCollectionColour(general), true);
  assert.equal(hasSourceCollectionColour(food), false);
});

test('keeps source-coloured collection cards readable', () => {
  assert.equal(contrastTextForColour('#7A263A'), '#FFFFFF');
  assert.equal(contrastTextForColour('#6F777D'), '#FFFFFF');
  assert.equal(contrastTextForColour('#F2F2F7'), '#0F2A3A');
});

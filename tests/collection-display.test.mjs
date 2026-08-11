import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectionDisplayMeta,
  contrastTextForColour,
  hasSourceCollectionColour,
  primaryCollectionForDate,
  safeCollectionHeroColour,
  sourceCollectionColour,
} from '../src/lib/data.ts';

function collection(id, wasteType, colour, label) {
  return {
    id,
    date: '2026-07-31',
    wasteType,
    source: 'council',
    ...(colour ? { colour } : {}),
    ...(label ? { label } : {}),
  };
}

test('uses the main household bin before an accompanying food caddy', () => {
  const food = collection('food', 'food');
  const general = collection('general', 'general', '#7A263A');

  assert.equal(primaryCollectionForDate([food, general]), general);
  assert.equal(hasSourceCollectionColour(general), true);
  assert.equal(hasSourceCollectionColour(food), false);
});

test('uses a council-named bin colour without assuming its waste type', () => {
  const brownRecycling = collection(
    'brown-recycling',
    'recycling',
    undefined,
    'Brown recycling bin',
  );

  assert.equal(sourceCollectionColour(brownRecycling), '#8A5A2B');
  assert.equal(hasSourceCollectionColour(brownRecycling), true);
  assert.equal(collectionDisplayMeta(brownRecycling).colour, '#8A5A2B');
  assert.equal(
    hasSourceCollectionColour(collection('plain-recycling', 'recycling', undefined, 'Mixed recycling')),
    false,
  );
});

test('keeps source-coloured collection cards readable', () => {
  assert.equal(contrastTextForColour('#7A263A'), '#FFFFFF');
  assert.equal(contrastTextForColour('#6F777D'), '#FFFFFF');
  assert.equal(contrastTextForColour('#F2F2F7'), '#0F2A3A');
});

test('keeps the source identity while constraining colours used as a full hero surface', () => {
  assert.equal(safeCollectionHeroColour('#7A263A', '#0F2A3A'), '#7A263A');
  assert.equal(safeCollectionHeroColour('#F2F2F2', '#0F2A3A'), '#0F2A3A');
  assert.notEqual(safeCollectionHeroColour('#00FFFF', '#0F2A3A'), '#00FFFF');
  assert.equal(safeCollectionHeroColour('#FF3B30', '#0F2A3A'), '#0F2A3A');
  assert.equal(safeCollectionHeroColour('#FF9500', '#0F2A3A'), '#0F2A3A');
  assert.equal(sourceCollectionColour(collection('cyan', 'recycling', '#00FFFF')), '#00FFFF');
  assert.equal(sourceCollectionColour(collection('red', 'general', '#FF3B30')), '#FF3B30');
});

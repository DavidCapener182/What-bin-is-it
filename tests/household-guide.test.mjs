import assert from 'node:assert/strict';
import test from 'node:test';

import {
  featuredGuideItems,
  guideItems,
  searchGuide,
} from '../src/lib/household-guide.ts';

function bestMatch(query) {
  return searchGuide(query)[0];
}

test('covers a broad catalogue while keeping the empty state curated', () => {
  assert.ok(guideItems.length >= 80);
  assert.ok(featuredGuideItems.length >= 12);
  assert.ok(featuredGuideItems.length < guideItems.length);
  assert.deepEqual(searchGuide(''), featuredGuideItems);
});

test('has unique, complete household guide entries', () => {
  assert.equal(new Set(guideItems.map((item) => item.id)).size, guideItems.length);

  for (const item of guideItems) {
    assert.ok(item.name.trim(), `${item.id} needs a name`);
    assert.ok(item.aliases.length, `${item.id} needs search aliases`);
    assert.ok(item.heading.trim(), `${item.id} needs a heading`);
    assert.ok(item.detail.trim(), `${item.id} needs disposal guidance`);
    assert.ok(item.icon.trim(), `${item.id} needs an icon`);
  }
});

test('routes representative everyday items to safe destinations', () => {
  assert.equal(bestMatch('AA battery').destination, 'service');
  assert.equal(bestMatch('banana skin').destination, 'food');
  assert.equal(bestMatch('cereal box').destination, 'recycling');
  assert.equal(bestMatch('cat litter').destination, 'general');
  assert.equal(bestMatch('grass clippings').destination, 'garden');
  assert.equal(bestMatch('cooking oil').destination, 'service');
  assert.equal(bestMatch('pizza box').destination, 'check');
  assert.equal(bestMatch('mobile phone').destination, 'service');
  assert.equal(bestMatch('sofa').destination, 'service');
});

test('understands synonyms, spacing and common small spelling mistakes', () => {
  assert.equal(bestMatch('tetrapak').id, 'drink-cartons');
  assert.equal(bestMatch('e-cigarette').id, 'vapes');
  assert.equal(bestMatch('battries').id, 'batteries');
  assert.equal(bestMatch('matress').id, 'mattresses');
  assert.equal(bestMatch('hoover dust').id, 'vacuum-waste');
});

test('ranks the most direct result before incidental detail matches', () => {
  assert.equal(bestMatch('coffee cups').id, 'coffee-cups');
  assert.equal(bestMatch('paint').id, 'paint');
  assert.equal(bestMatch('glass bottle').id, 'glass');
  assert.equal(bestMatch('phone').id, 'phones-tablets');
});

test('does not invent guidance for a completely unknown query', () => {
  assert.deepEqual(searchGuide('quantum flux capacitor'), []);
});

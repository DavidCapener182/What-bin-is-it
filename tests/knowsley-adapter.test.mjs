import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseKnowsleyAddresses,
  parseKnowsleyCollections,
} from '../services/council-gateway/src/adapter-registry.ts';

test('normalises official Knowsley address-search results', () => {
  const results = parseKnowsleyAddresses(JSON.stringify([
    {
      FullAddress: '1 Gort Road, Huyton, L36 7XA',
      Postcode: 'L36 7XA',
      UPRN: '000040017128',
      Xcoord: 344098,
      Ycoord: 391262,
    },
  ]));

  assert.deepEqual(results, [{
    id: '000040017128',
    line1: '1 Gort Road, Huyton',
    postcode: 'L36 7XA',
  }]);
});

test('maps only dated official Knowsley collections', () => {
  assert.deepEqual(parseKnowsleyCollections(JSON.stringify([{
    Nextmaroon: '28/07/2026',
    Nextgrey: '04/08/2026',
    Nextblue: '',
  }])), [
    { date: '2026-07-28', wasteType: 'general' },
    { date: '2026-08-04', wasteType: 'recycling' },
  ]);
});

test('maps every dated collection from the current Knowsley Mendix response', () => {
  assert.deepEqual(parseKnowsleyCollections({
    NextMaroon: { value: 'Friday 31/07/2026' },
    NextGrey: { value: 'Friday 07/08/2026' },
    NextBlue: { value: 'Friday 07/08/2026' },
    NextFood: { value: 'Friday 31/07/2026' },
  }), [
    { date: '2026-07-31', wasteType: 'general' },
    { date: '2026-08-07', wasteType: 'recycling' },
    { date: '2026-08-07', wasteType: 'garden' },
    { date: '2026-07-31', wasteType: 'food' },
  ]);
});

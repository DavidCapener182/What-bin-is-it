import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseRecyclingMaterials,
  recyclingMaterialsLabel,
} from '../src/lib/recycling-materials.ts';

test('uses only recycling materials explicitly accepted by a map feature', () => {
  assert.deepEqual(parseRecyclingMaterials({
    'recycling:glass_bottles': 'yes',
    'recycling:paper': 'yes',
    'recycling:clothes': 'no',
    amenity: 'recycling',
  }), ['Glass bottles', 'Paper']);
});

test('explains when a recycling site has not declared accepted materials', () => {
  assert.equal(
    recyclingMaterialsLabel([]),
    'Accepted materials not listed — check before travelling.',
  );
  assert.equal(
    recyclingMaterialsLabel(['Glass bottles', 'Paper']),
    'Accepts: Glass bottles, Paper',
  );
});

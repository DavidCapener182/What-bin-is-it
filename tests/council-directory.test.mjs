import assert from 'node:assert/strict';
import test from 'node:test';

import {
  councilDirectory,
  councilDirectoryCounts,
  findCouncilByCode,
  findCouncilByName,
  searchCouncils,
} from '../src/lib/council-directory.ts';

test('contains every waste-collection authority in the documented ONS snapshot', () => {
  assert.equal(councilDirectory.length, 361);
  assert.deepEqual(councilDirectoryCounts, {
    England: 296,
    'Northern Ireland': 11,
    Scotland: 32,
    Wales: 22,
  });
  assert.equal(new Set(councilDirectory.map((council) => council.code)).size, councilDirectory.length);
});

test('uses the exact ONS district code before name matching', () => {
  const council = findCouncilByCode(' e08000003 ');
  assert.equal(council?.name, 'Manchester');
  assert.equal(council?.providerId, 'lad-e08000003');
});

test('normalises common council-name decorations without accepting empty terms', () => {
  assert.equal(findCouncilByName('Manchester City Council')?.code, 'E08000003');
  assert.equal(findCouncilByName('Bristol, City of')?.code, 'E06000023');
  assert.equal(findCouncilByName('Council'), undefined);
  assert.deepEqual(searchCouncils(''), councilDirectory);
});

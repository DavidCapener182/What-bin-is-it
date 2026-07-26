import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCollectionWidgetSnapshot,
  buildCollectionWidgetTimeline,
  widgetStateFromStoredAppData,
} from '../src/widgets/widget-data.ts';

const address = {
  id: 'home',
  label: 'Home',
  line1: '1 Test Street',
  postcode: 'L36 7XA',
  councilName: 'Knowsley Council',
  providerId: 'knowsley',
  councilAddressId: 'test-property',
  isPrimary: true,
};

const collections = [
  {
    id: 'maroon-2026-07-31',
    date: '2026-07-31',
    wasteType: 'general',
    source: 'council',
    label: 'Maroon general waste bin',
    colour: '#862640',
  },
  {
    id: 'food-2026-07-31',
    date: '2026-07-31',
    wasteType: 'food',
    source: 'council',
    label: 'Food waste caddy',
    colour: '#A96B31',
  },
  {
    id: 'grey-2026-08-07',
    date: '2026-08-07',
    wasteType: 'recycling',
    source: 'council',
    label: 'Grey recycling bin',
    colour: '#7B858A',
  },
];

test('answers bin night from verified council dates and the main bin colour', () => {
  const snapshot = buildCollectionWidgetSnapshot(
    address,
    collections,
    new Date('2026-07-30T12:00:00+01:00'),
  );

  assert.equal(snapshot.headline, 'Maroon general waste bin + Food waste caddy');
  assert.equal(snapshot.kicker, 'PUT OUT TONIGHT');
  assert.equal(snapshot.binColour, '#862640');
  assert.equal(snapshot.countdown, 'TONIGHT');
  assert.equal(snapshot.addressLabel, 'Home');
});

test('says nothing goes out tonight while still showing the next real collection', () => {
  const snapshot = buildCollectionWidgetSnapshot(
    address,
    collections,
    new Date('2026-07-26T12:00:00+01:00'),
  );

  assert.equal(snapshot.headline, 'Nothing goes out tonight');
  assert.equal(snapshot.kicker, 'WHAT BIN?');
  assert.equal(snapshot.countdown, '5 DAYS');
  assert.match(snapshot.detail, /Next: Friday 31 July/);
  assert.equal(snapshot.binColour, '#862640');
});

test('never turns non-council or malformed dates into widget collections', () => {
  const snapshot = buildCollectionWidgetSnapshot(
    address,
    [
      ...collections,
      { ...collections[0], id: 'mock', source: 'mock', date: '2026-07-27' },
      { ...collections[0], id: 'bad-date', date: '31/07/2026' },
    ],
    new Date('2026-07-26T12:00:00+01:00'),
  );

  assert.equal(snapshot.nextCollectionDate, '2026-07-31');
});

test('creates an iOS timeline that changes the answer at midnight', () => {
  const timeline = buildCollectionWidgetTimeline(
    address,
    collections,
    new Date('2026-07-29T18:00:00+01:00'),
  );

  assert.equal(timeline[0].props.headline, 'Nothing goes out tonight');
  assert.equal(timeline[1].props.headline, 'Maroon general waste bin + Food waste caddy');
  assert.equal(timeline[1].date.toISOString(), '2026-07-29T23:00:00.000Z');
});

test('reads only the active saved address and its verified schedule for Android widgets', () => {
  const stored = JSON.stringify({
    addresses: [address],
    activeAddressId: 'home',
    schedulesByAddressId: {
      home: { collections },
    },
  });

  const state = widgetStateFromStoredAppData(stored);
  assert.equal(state.address?.postcode, 'L36 7XA');
  assert.equal(state.collections.length, 3);
  assert.deepEqual(widgetStateFromStoredAppData('not-json'), {
    address: undefined,
    collections: [],
  });
});

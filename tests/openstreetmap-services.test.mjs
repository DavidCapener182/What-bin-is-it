import assert from 'node:assert/strict';
import test from 'node:test';

import { parseOpenStreetMapServices } from '../api/_gateway/openstreetmap-services.ts';

test('normalises nearby map services for the server-side gateway', () => {
  assert.deepEqual(parseOpenStreetMapServices({
    elements: [
      {
        id: 101,
        lat: 53.4,
        lon: -2.84,
        tags: {
          amenity: 'recycling',
          name: 'Community recycling point',
          'addr:street': 'High Street',
          'recycling:glass_bottles': 'yes',
          'recycling:paper': 'yes',
          'recycling:clothes': 'no',
        },
      },
      {
        id: 202,
        center: { lat: 53.41, lon: -2.85 },
        tags: {
          amenity: 'waste_transfer_station',
          name: 'Household Waste Recycling Centre',
          website: 'https://example.gov.uk/tip',
        },
      },
      { id: 303, tags: { amenity: 'recycling' } },
    ],
  }), [
    {
      id: 'osm-101',
      name: 'Community recycling point',
      type: 'recycling-point',
      address: 'High Street',
      latitude: 53.4,
      longitude: -2.84,
      source: 'openstreetmap',
      website: undefined,
      materials: ['Glass bottles', 'Paper'],
    },
    {
      id: 'osm-202',
      name: 'Household Waste Recycling Centre',
      type: 'recycling-centre',
      address: undefined,
      latitude: 53.41,
      longitude: -2.85,
      source: 'openstreetmap',
      website: 'https://example.gov.uk/tip',
      materials: [],
    },
  ]);
});

test('drops unsafe map links and bounds untrusted display fields', () => {
  const [service] = parseOpenStreetMapServices({
    elements: [{
      id: 404,
      lat: 53.4,
      lon: -2.84,
      tags: {
        amenity: 'recycling',
        name: `Unsafe${'x'.repeat(200)}`,
        website: 'javascript:alert(1)',
        operator: 'Bad\r\nOperator',
      },
    }],
  });
  assert.equal(service.name, 'Recycling point');
  assert.equal(service.website, undefined);
  assert.equal(service.operator, undefined);
});

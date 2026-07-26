import assert from 'node:assert/strict';
import test from 'node:test';

import {
  councilPartnerAdapterFor,
  councilPartnerRegistryStatus,
  createCouncilPartnerAdapter,
  parseCouncilPartnerRegistry,
} from '../api/_gateway/council-partner-adapter.ts';

const registry = JSON.stringify([
  {
    providerId: 'lad-e08000003',
    councilName: 'Manchester',
    baseUrl: 'https://waste.example.gov.uk/resident-api',
    capabilities: ['addresses', 'collections', 'services'],
    credentialEnv: 'MANCHESTER_COUNCIL_API_KEY',
  },
]);

test('validates a server-side council connector registry without exposing credentials', () => {
  const parsed = parseCouncilPartnerRegistry(registry);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].providerId, 'lad-e08000003');
  assert.equal(parsed[0].credentialEnv, 'MANCHESTER_COUNCIL_API_KEY');
  assert.deepEqual(councilPartnerRegistryStatus({ COUNCIL_PARTNER_REGISTRY_JSON: registry }), {
    configured: 1,
    providerIds: ['lad-e08000003'],
    valid: true,
  });
});

test('rejects insecure, duplicate or collections-free connector definitions', () => {
  assert.throws(
    () => parseCouncilPartnerRegistry(JSON.stringify([{
      providerId: 'lad-e08000003',
      councilName: 'Manchester',
      baseUrl: 'http://waste.example.gov.uk',
      capabilities: ['collections'],
    }])),
    /invalid council connector/,
  );
  assert.throws(
    () => parseCouncilPartnerRegistry(JSON.stringify([{
      providerId: 'lad-e08000003',
      councilName: 'Manchester',
      baseUrl: 'https://waste.example.gov.uk',
      capabilities: ['addresses'],
    }])),
    /invalid council connector/,
  );
  assert.throws(
    () => parseCouncilPartnerRegistry(JSON.stringify([
      {
        providerId: 'lad-e08000003',
        councilName: 'Manchester',
        baseUrl: 'https://one.example.gov.uk',
        capabilities: ['collections'],
      },
      {
        providerId: 'lad-e08000003',
        councilName: 'Manchester',
        baseUrl: 'https://two.example.gov.uk',
        capabilities: ['collections'],
      },
    ])),
    /duplicate council provider/,
  );
});

test('connects the normalized address, collection and services contract', async () => {
  const requests = [];
  const fetcher = async (input, init) => {
    const url = new URL(input);
    requests.push({ url: url.toString(), init });
    if (url.pathname.endsWith('/v1/addresses')) {
      return Response.json({
        addresses: [{ id: '10000000001', line1: '1 Test Street', postcode: 'M1 1AE' }],
      });
    }
    if (url.pathname.endsWith('/v1/services')) {
      return Response.json({
        services: [{
          id: 'service-1',
          name: 'Household waste centre',
          type: 'recycling-centre',
          latitude: 53.47,
          longitude: -2.24,
        }],
      });
    }
    return Response.json({
      councilName: 'Manchester',
      providerId: 'lad-e08000003',
      verifiedAt: '2026-07-26T12:00:00.000Z',
      collections: [{ date: '2026-07-31', wasteType: 'general' }],
    });
  };
  const adapter = councilPartnerAdapterFor(
    'lad-e08000003',
    {
      COUNCIL_PARTNER_REGISTRY_JSON: registry,
      MANCHESTER_COUNCIL_API_KEY: 'server-only-secret',
    },
    fetcher,
  );
  assert.ok(adapter);
  assert.equal((await adapter.getAddresses?.('M1 1AE'))?.length, 1);
  assert.equal((await adapter.getCollections({ postcode: 'M1 1AE', addressId: '10000000001' })).collections.length, 1);
  assert.equal((await adapter.getServices?.({ postcode: 'M1 1AE' }))?.length, 1);
  assert.equal(requests.length, 3);
  assert.equal(requests[0].init.headers.authorization, 'Bearer server-only-secret');
  assert.ok(!JSON.stringify(requests[0].url).includes('server-only-secret'));
});

test('requires the configured credential and exact council identity', async () => {
  const config = parseCouncilPartnerRegistry(registry)[0];
  const adapter = createCouncilPartnerAdapter(config, {}, async () => Response.json({}));
  await assert.rejects(
    () => adapter.getCollections({ postcode: 'M1 1AE', addressId: '10000000001' }),
    /credential MANCHESTER_COUNCIL_API_KEY is not configured/,
  );

  const wrongIdentity = createCouncilPartnerAdapter(
    { ...config, credentialEnv: undefined },
    {},
    async () => Response.json({
      councilName: 'Another Council',
      providerId: 'lad-e08000004',
      verifiedAt: '2026-07-26T12:00:00.000Z',
      collections: [],
    }),
  );
  await assert.rejects(
    () => wrongIdentity.getCollections({ postcode: 'M1 1AE', addressId: '10000000001' }),
    /identity did not match/,
  );
});

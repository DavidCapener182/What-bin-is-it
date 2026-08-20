import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  GatewaySecurityUnavailableError,
  gatewayNetworkIdentity,
} from '../api/_gateway/security-controls.ts';
import {
  gatewayPlatformMaximumMs,
  gatewayResponseHeadroomMs,
  gatewayWorstCaseBudgetsMs,
} from '../api/_gateway/release-budget.ts';
import { validServiceResult } from '../api/_gateway/index.ts';

function request(headers = {}, url = 'https://what-bin-is-it-tonight.vercel.app/api/v1/profile') {
  return new Request(url, { headers });
}

test('network identities use exactly the explicitly trusted ingress header', () => {
  assert.equal(gatewayNetworkIdentity(request({
    'x-forwarded-for': '203.0.113.9',
    'cf-connecting-ip': '198.51.100.4',
  }), 'vercel'), '203.0.113.9');
  assert.equal(gatewayNetworkIdentity(request({
    'x-forwarded-for': '203.0.113.9, 198.51.100.4',
    'cf-connecting-ip': '2001:db8::1',
  }), 'cloudflare'), '2001:db8::1');

  for (const headers of [
    { 'cf-connecting-ip': '198.51.100.4' },
    { 'x-forwarded-for': '203.0.113.9, 198.51.100.4', 'cf-connecting-ip': '198.51.100.4' },
    { 'x-forwarded-for': 'unknown', 'cf-connecting-ip': '198.51.100.4' },
    { 'x-forwarded-for': '203.0.113.999', 'cf-connecting-ip': '198.51.100.4' },
  ]) {
    assert.throws(
      () => gatewayNetworkIdentity(request(headers), 'vercel'),
      GatewaySecurityUnavailableError,
    );
  }
  for (const headers of [
    { 'x-forwarded-for': '203.0.113.9' },
    { 'x-forwarded-for': '203.0.113.9', 'cf-connecting-ip': '198.51.100.4, 192.0.2.1' },
    { 'x-forwarded-for': '203.0.113.9', 'cf-connecting-ip': 'bad-ip' },
  ]) {
    assert.throws(
      () => gatewayNetworkIdentity(request(headers), 'cloudflare'),
      GatewaySecurityUnavailableError,
    );
  }
  assert.equal(
    gatewayNetworkIdentity(request({}, 'http://localhost:3000/api/v1/profile')),
    'local-development',
  );
});

test('service response validation rejects bounded-but-pathological result arrays', () => {
  const service = {
    id: 'service-1',
    name: 'Household recycling centre',
    type: 'recycling-centre',
    latitude: 53.4,
    longitude: -2.8,
    source: 'council',
  };
  assert.equal(validServiceResult(Array.from({ length: 250 }, (_, index) => ({
    ...service,
    id: `service-${index}`,
  }))), true);
  assert.equal(validServiceResult(Array.from({ length: 251 }, (_, index) => ({
    ...service,
    id: `service-${index}`,
  }))), false);
});

test('every gateway provider path keeps deterministic platform response headroom', () => {
  const maximumOperationMs = gatewayPlatformMaximumMs - gatewayResponseHeadroomMs;
  const budgets = gatewayWorstCaseBudgetsMs();
  for (const [path, milliseconds] of Object.entries(budgets)) {
    assert.ok(
      milliseconds <= maximumOperationMs,
      `${path} budget ${milliseconds}ms exceeds ${maximumOperationMs}ms`,
    );
  }
  assert.deepEqual(budgets, {
    knowsley: 22_500,
    nationwide: 21_350,
    openStreetMap: 21_500,
    partner: 19_500,
  });
});

test('Nitro and Worker rate controls pin their own trusted ingress mode', async () => {
  const [nodeControls, workerControls, dataQualityRoute] = await Promise.all([
    readFile(new URL('../server/lib/gateway-security-controls.ts', import.meta.url), 'utf8'),
    readFile(new URL('../api/_gateway/security-controls.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/routes/api/data-quality/reports.post.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(nodeControls, /gatewayNetworkIdentity\(request, 'vercel'\)/);
  assert.match(workerControls, /gatewayNetworkIdentity\(request, 'cloudflare'\)/);
  assert.match(nodeControls, /statement_timeout: gatewaySecurityBudgets\.nodeStatementMs/);
  assert.match(dataQualityRoute, /scope: 'data-quality-network'/);
  assert.match(dataQualityRoute, /limit: 120/);
  assert.match(dataQualityRoute, /DATA_QUALITY_NETWORK_RATE_LIMITED/);
  assert.match(dataQualityRoute, /DATA_QUALITY_ABUSE_CONTROL_UNAVAILABLE/);
});

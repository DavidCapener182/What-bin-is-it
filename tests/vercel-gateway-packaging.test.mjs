import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gatewayPath = resolve(root, 'api/_gateway/index.ts');
const nitroRoutePath = resolve(root, 'server/routes/api/v1/[resource].ts');
const nitroConfigSource = readFileSync(resolve(root, 'nitro.config.ts'), 'utf8');
const vercelConfig = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));

function readyGatewayBootstrap() {
  return `
    const { createCouncilGateway } = await import(${JSON.stringify(gatewayPath)});
    const gateway = createCouncilGateway({
      enabled: () => true,
      ready: () => true,
      consume: async () => ({ allowed: true, retryAfterSeconds: 0 }),
      withCircuit: async (_providerKey, operation) => operation(),
    });
  `;
}

test('routes the Nitro Vercel function to the complete council gateway', () => {
  const route = readFileSync(nitroRoutePath, 'utf8');
  assert.match(route, /api\/_gateway\/index\.ts/);
  assert.match(route, /gateway\.fetch\(event\.req\)/);
  assert.match(route, /response\.headers\.get\('x-request-id'\)/);
  assert.match(route, /id: requestId/);
  assert.match(route, /void recordPilotGatewayCheck\(/);
  assert.doesNotMatch(route, /await recordPilotGatewayCheck\(/);
});

test('production CSP permits only the configured Supabase account-service origins', () => {
  const csp = vercelConfig.headers
    .flatMap((entry) => entry.headers ?? [])
    .find((header) => header.key === 'Content-Security-Policy')?.value;
  assert.ok(csp);
  assert.match(csp, /connect-src[^;]*https:\/\/wngqphzpxhderwfjjzla\.supabase\.co/);
  assert.match(csp, /connect-src[^;]*wss:\/\/wngqphzpxhderwfjjzla\.supabase\.co/);
  assert.doesNotMatch(csp, /\*\.supabase\.co/);
});

test('the council gateway still accepts the relative path used by the app', () => {
  const invoked = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `
        ${readyGatewayBootstrap()}
        const response = await gateway.fetch(new Request(
          'https://what-bin-is-it-tonight.vercel.app/api/v1/addresses?postcode=BAD&providerId=lad-e08000011'
        ));
        if (response.status !== 400) {
          throw new Error('Expected 400, received ' + response.status + ': ' + await response.text());
        }
      `,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(invoked.status, 0, invoked.stderr || invoked.stdout);
});

test('the public gateway returns stable request references without wildcard CORS', () => {
  const script = String.raw`
    import assert from 'node:assert/strict';
    ${readyGatewayBootstrap()}
    const response = await gateway.fetch(new Request(
      'https://what-bin-is-it-tonight.vercel.app/api/v1/addresses?postcode=BAD&providerId=lad-e08000011',
      { headers: { origin: 'https://what-bin-is-it-tonight.vercel.app' } },
    ));
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://what-bin-is-it-tonight.vercel.app');
    assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/i);
    assert.equal(body.errorCode, 'invalid_request');
    assert.equal(body.requestId, response.headers.get('x-request-id'));
  `;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the public gateway never copies an unvalidated provider into response headers', () => {
  const script = String.raw`
    import assert from 'node:assert/strict';
    ${readyGatewayBootstrap()}
    const response = await gateway.fetch(new Request(
      'https://what-bin-is-it-tonight.vercel.app/api/v1/profile?providerId=bad%0D%0Ax-injected%3Ayes',
    ));
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('x-council-provider-id'), null);
    assert.equal(body.errorCode, 'invalid_request');
  `;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the public gateway rejects unknown preflight origins and oversized streamed bodies', () => {
  const script = String.raw`
    import assert from 'node:assert/strict';
    ${readyGatewayBootstrap()}
    const preflight = await gateway.fetch(new Request(
      'https://what-bin-is-it-tonight.vercel.app/api/v1/collections',
      { method: 'OPTIONS', headers: { origin: 'https://example.invalid' } },
    ));
    assert.equal(preflight.status, 403);
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);

    const oversized = await gateway.fetch(new Request(
      'https://what-bin-is-it-tonight.vercel.app/api/v1/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postcode: 'M1 1AE', providerId: 'lad-e08000011', padding: 'x'.repeat(9_000) }),
      },
    ));
    const body = await oversized.json();
    assert.equal(oversized.status, 413);
    assert.equal(body.errorCode, 'request_too_large');
  `;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the public gateway rejects non-object and ambiguous collection bodies stably', () => {
  const script = String.raw`
    import assert from 'node:assert/strict';
    ${readyGatewayBootstrap()}
    for (const body of ['null', '[]', '"text"', '{"postcode":"M1 1AE","providerId":"lad-e08000011","extra":true}']) {
      const response = await gateway.fetch(new Request(
        'https://what-bin-is-it-tonight.vercel.app/api/v1/collections',
        { method: 'POST', headers: { 'content-type': 'application/json' }, body },
      ));
      const payload = await response.json();
      assert.equal(response.status, 400);
      assert.equal(payload.errorCode, 'invalid_request');
      assert.equal(payload.requestId, response.headers.get('x-request-id'));
    }
    const wrongType = await gateway.fetch(new Request(
      'https://what-bin-is-it-tonight.vercel.app/api/v1/collections',
      { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' },
    ));
    assert.equal(wrongType.status, 400);
    assert.match(wrongType.headers.get('x-request-id'), /^[0-9a-f-]{36}$/i);
  `;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the public gateway never reflects council-provider error detail', () => {
  const script = String.raw`
    import assert from 'node:assert/strict';
    ${readyGatewayBootstrap()}
    globalThis.fetch = async () => { throw new Error('SECRET_UPSTREAM_DETAILS'); };
    const response = await gateway.fetch(new Request(
      'https://what-bin-is-it-tonight.vercel.app/api/v1/collections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          postcode: 'L36 9UX',
          providerId: 'lad-e08000011',
          addressId: '10000000001',
        }),
      },
    ));
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error, 'The council source is temporarily unavailable.');
    assert.equal(body.errorCode, 'upstream_unavailable');
    assert.doesNotMatch(JSON.stringify(body), /SECRET_UPSTREAM_DETAILS/);
  `;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('the default public gateway fails closed when durable controls are not configured', () => {
  const script = String.raw`
    import assert from 'node:assert/strict';
    delete process.env.WHAT_BIN_ENABLE_PUBLIC_GATEWAY;
    const gateway = (await import(${JSON.stringify(gatewayPath)})).default;
    const response = await gateway.fetch(new Request(
      'https://what-bin-is-it-tonight.vercel.app/api/v1/addresses?postcode=M1%201AE&providerId=lad-e08000011',
    ));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.errorCode, 'service_unavailable');
    assert.equal(body.requestId, response.headers.get('x-request-id'));
  `;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('builds a refreshable all-day calendar from exact source dates', () => {
  const invoked = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `
        const { calendarResponse } = await import(${JSON.stringify(gatewayPath)});
        const response = calendarResponse({
          councilName: 'Test Council',
          providerId: 'lad-e00000001',
          collections: [{ date: '2026-07-31', wasteType: 'general', label: 'General waste' }],
        }, new Set(['general']));
        const calendar = await response.text();
        for (const expected of [
          'DTSTART;VALUE=DATE:20260731',
          'DTEND;VALUE=DATE:20260801',
          'X-PUBLISHED-TTL:PT12H',
        ]) {
          if (!calendar.includes(expected)) throw new Error('Missing ' + expected);
        }
      `,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(invoked.status, 0, invoked.stderr || invoked.stdout);
});

test('calendar text cannot inject fields through upstream control characters', () => {
  const invoked = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `
        const { calendarResponse } = await import(${JSON.stringify(gatewayPath)});
        const response = calendarResponse({
          councilName: 'Test\\r\\nX-EVIL: council',
          providerId: 'lad-e00000001',
          collections: [{
            date: '2026-07-31',
            wasteType: 'general',
            label: 'General\\rX-EVIL:1\\nWaste\\u0000',
          }],
        }, new Set(['general']));
        const calendar = await response.text();
        if (calendar.includes('\\rX-EVIL') || calendar.includes('\\nX-EVIL')) {
          throw new Error('Hostile text created a calendar field');
        }
        if (!calendar.includes('SUMMARY:General\\\\nX-EVIL:1\\\\nWaste collection')) {
          throw new Error('Line breaks were not escaped as text');
        }
        if (calendar.includes('\\u0000')) throw new Error('NUL was retained');
      `,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(invoked.status, 0, invoked.stderr || invoked.stdout);
});

test('gateway date validation rejects impossible dates and accepts leap days', () => {
  const invoked = spawnSync(
    process.execPath,
    [
      '--no-warnings',
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `
        const { isIsoDate } = await import(${JSON.stringify(gatewayPath)});
        if (!isIsoDate('2028-02-29')) throw new Error('Leap day was rejected');
        for (const value of ['2026-02-29', '2026-02-31', '2026-04-31', 'not-a-date']) {
          if (isIsoDate(value)) throw new Error('Impossible date accepted: ' + value);
        }
      `,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(invoked.status, 0, invoked.stderr || invoked.stdout);
});

test('builds a Nitro Vercel output with durable workflows and bundled Expo assets', () => {
  assert.match(nitroConfigSource, /modules:\s*\['workflow\/nitro'\]/);
  assert.match(nitroConfigSource, /preset:\s*'vercel'/);
  assert.match(nitroConfigSource, /serverDir:\s*'\.\/server'/);
  assert.match(nitroConfigSource, /dir:\s*'\.\/dist'/);
  assert.match(nitroConfigSource, /maxDuration:\s*30/);
  assert.equal(vercelConfig.buildCommand, 'npm run build');
  assert.equal(vercelConfig.outputDirectory, undefined);
  assert.equal(vercelConfig.functions, undefined);
});

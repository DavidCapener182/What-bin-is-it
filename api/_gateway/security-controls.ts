import { readBoundedUpstreamText, withUpstreamTimeout } from './upstream-response.ts';
import { gatewaySecurityBudgets } from './release-budget.ts';

const securityResponseLimitBytes = 16 * 1_024;
const securityTimeoutMs = gatewaySecurityBudgets.workerRpcMs;

export class GatewaySecurityUnavailableError extends Error {
  constructor(message = 'The public gateway security controls are unavailable.') {
    super(message);
    this.name = 'GatewaySecurityUnavailableError';
  }
}

export class GatewayCircuitOpenError extends Error {
  constructor() {
    super('The council provider circuit is temporarily open.');
    this.name = 'GatewayCircuitOpenError';
  }
}

export type GatewaySecurityControls = {
  enabled(): boolean;
  ready(): boolean;
  consume(request: Request): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  withCircuit<T>(providerKey: string, operation: () => Promise<T>): Promise<T>;
};

export function publicGatewayEnabled() {
  return process.env.WHAT_BIN_ENABLE_PUBLIC_GATEWAY === 'true';
}

function securityConfiguration() {
  if (!publicGatewayEnabled()) {
    throw new GatewaySecurityUnavailableError('The public gateway release gate is disabled.');
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const hmacSecret = process.env.WHAT_BIN_GATEWAY_RATE_LIMIT_SECRET?.trim();
  if (
    !url
    || !/^https:\/\/[A-Za-z0-9.-]+\.supabase\.co$/.test(url)
    || !serviceRoleKey
    || serviceRoleKey.length < 40
    || !hmacSecret
    || hmacSecret.length < 32
  ) {
    throw new GatewaySecurityUnavailableError();
  }
  return { url, serviceRoleKey, hmacSecret };
}

export function publicGatewayReady() {
  try {
    securityConfiguration();
    return true;
  } catch {
    return false;
  }
}

function validIpv4(value: string) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => (
    /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255
  ));
}

function validIpv6(value: string) {
  if (!value.includes(':') || value.includes('%') || /[^0-9a-f:.]/i.test(value)) return false;
  try {
    return new URL(`http://[${value}]/`).hostname.length > 2;
  } catch {
    return false;
  }
}

function validIp(value: string) {
  return validIpv4(value) || validIpv6(value);
}

export type GatewayTrustedIngress = 'vercel' | 'cloudflare';

export function gatewayNetworkIdentity(
  request: Request,
  trustedIngress: GatewayTrustedIngress = 'vercel',
) {
  // Never mix proxy trust models. Vercel overwrites X-Forwarded-For, while the
  // optional Worker is deployed behind Cloudflare and receives its protected
  // connecting-IP header. Each mode rejects lists and ignores the other header.
  const headerName = trustedIngress === 'cloudflare' ? 'cf-connecting-ip' : 'x-forwarded-for';
  const forwarded = request.headers.get(headerName)?.trim();
  if (forwarded && !forwarded.includes(',') && validIp(forwarded)) return forwarded.toLowerCase();
  const hostname = new URL(request.url).hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local-development';
  throw new GatewaySecurityUnavailableError('The gateway could not establish a trusted network identity.');
}

async function hmacSha256(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function securityRpc(name: string, body: Record<string, unknown>) {
  const { url, serviceRoleKey } = securityConfiguration();
  let response: Response;
  try {
    response = await withUpstreamTimeout(securityTimeoutMs, (signal) => fetch(
      `${url}/rest/v1/rpc/${name}`,
      {
        method: 'POST',
        signal,
        headers: {
          accept: 'application/json',
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    ));
  } catch {
    throw new GatewaySecurityUnavailableError();
  }
  let text: string;
  try {
    text = await readBoundedUpstreamText(response, securityResponseLimitBytes);
  } catch {
    throw new GatewaySecurityUnavailableError();
  }
  if (!response.ok) throw new GatewaySecurityUnavailableError();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GatewaySecurityUnavailableError();
  }
}

export async function consumePublicGatewayRateLimit(request: Request) {
  const { hmacSecret } = securityConfiguration();
  const identityHash = await hmacSha256(
    hmacSecret,
    `public-gateway:${gatewayNetworkIdentity(request, 'cloudflare')}`,
  );
  const payload = await securityRpc('bin_consume_api_rate_limit', {
    p_scope: 'public-gateway',
    p_identity_hash: identityHash,
    p_limit: 600,
    p_window_seconds: 900,
  });
  const first = Array.isArray(payload) ? payload[0] : undefined;
  if (
    !first
    || typeof first !== 'object'
    || typeof Reflect.get(first, 'allowed') !== 'boolean'
    || !Number.isInteger(Reflect.get(first, 'retry_after_seconds'))
  ) throw new GatewaySecurityUnavailableError();
  return {
    allowed: Reflect.get(first, 'allowed') as boolean,
    retryAfterSeconds: Math.max(0, Reflect.get(first, 'retry_after_seconds') as number),
  };
}

async function gatewayCircuitOpen(providerKey: string) {
  const result = await securityRpc('bin_gateway_circuit_open', {
    p_provider_key: providerKey,
  });
  if (typeof result !== 'boolean') throw new GatewaySecurityUnavailableError();
  return result;
}

async function recordGatewayUpstreamResult(providerKey: string, succeeded: boolean) {
  await securityRpc('bin_record_gateway_upstream_result', {
    p_provider_key: providerKey,
    p_succeeded: succeeded,
    p_failure_threshold: 5,
    p_open_seconds: 120,
  });
}

export async function withGatewayCircuit<T>(providerKey: string, operation: () => Promise<T>) {
  if (await gatewayCircuitOpen(providerKey)) throw new GatewayCircuitOpenError();
  try {
    const result = await operation();
    await recordGatewayUpstreamResult(providerKey, true);
    return result;
  } catch (error) {
    if (error instanceof GatewaySecurityUnavailableError || error instanceof GatewayCircuitOpenError) {
      throw error;
    }
    await recordGatewayUpstreamResult(providerKey, false).catch(() => undefined);
    throw error;
  }
}

export const workerGatewaySecurityControls: GatewaySecurityControls = {
  enabled: publicGatewayEnabled,
  ready: publicGatewayReady,
  consume: consumePublicGatewayRateLimit,
  withCircuit: withGatewayCircuit,
};

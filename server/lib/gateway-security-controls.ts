import { createHmac } from 'node:crypto';
import postgres from 'postgres';

import {
  GatewayCircuitOpenError,
  GatewaySecurityUnavailableError,
  gatewayNetworkIdentity,
  type GatewaySecurityControls,
} from '../../api/_gateway/security-controls.ts';
import { gatewaySecurityBudgets } from '../../api/_gateway/release-budget.ts';
import { binDatabaseConfigured } from './bin-database.ts';

let securitySqlClient: ReturnType<typeof postgres> | undefined;

function securityDatabase() {
  const databaseUrl = process.env.BIN_DATABASE_URL?.trim();
  if (!databaseUrl) throw new GatewaySecurityUnavailableError();
  if (!securitySqlClient) {
    securitySqlClient = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      connect_timeout: gatewaySecurityBudgets.nodeConnectMs / 1_000,
      idle_timeout: 10,
      connection: {
        statement_timeout: gatewaySecurityBudgets.nodeStatementMs,
        lock_timeout: gatewaySecurityBudgets.nodeStatementMs,
        application_name: 'what-bin-api-security',
      },
    });
  }
  return securitySqlClient;
}

function enabled() {
  return process.env.WHAT_BIN_ENABLE_PUBLIC_GATEWAY === 'true';
}

function rateSecret() {
  const secret = process.env.WHAT_BIN_GATEWAY_RATE_LIMIT_SECRET?.trim();
  if (!secret || secret.length < 32) throw new GatewaySecurityUnavailableError();
  return secret;
}

function ready() {
  try {
    return enabled() && binDatabaseConfigured() && rateSecret().length >= 32;
  } catch {
    return false;
  }
}

export function serverApiRateLimitReady() {
  try {
    return binDatabaseConfigured() && rateSecret().length >= 32;
  } catch {
    return false;
  }
}

export async function consumeServerApiRateLimit(
  request: Request,
  options: { scope: string; limit: number; windowSeconds: number },
) {
  if (!serverApiRateLimitReady()) throw new GatewaySecurityUnavailableError();
  const identityHash = createHmac('sha256', rateSecret())
    .update(`${options.scope}:${gatewayNetworkIdentity(request, 'vercel')}`, 'utf8')
    .digest('hex');
  const sql = securityDatabase();
  let rows: { allowed: boolean; retry_after_seconds: number }[];
  try {
    rows = await sql<{ allowed: boolean; retry_after_seconds: number }[]>`
      SELECT allowed, retry_after_seconds
      FROM public.bin_consume_api_rate_limit(
        ${options.scope},
        ${identityHash},
        ${options.limit},
        ${options.windowSeconds}
      )
    `;
  } catch {
    throw new GatewaySecurityUnavailableError();
  }
  const result = rows[0];
  if (!result || typeof result.allowed !== 'boolean' || !Number.isInteger(result.retry_after_seconds)) {
    throw new GatewaySecurityUnavailableError();
  }
  return {
    allowed: result.allowed,
    retryAfterSeconds: Math.max(0, result.retry_after_seconds),
  };
}

async function consume(request: Request) {
  if (!enabled()) throw new GatewaySecurityUnavailableError();
  return consumeServerApiRateLimit(request, {
    scope: 'public-gateway',
    limit: 600,
    windowSeconds: 900,
  });
}

async function withCircuit<T>(providerKey: string, operation: () => Promise<T>) {
  if (!ready()) throw new GatewaySecurityUnavailableError();
  const sql = securityDatabase();
  let circuit: { open: boolean }[];
  try {
    circuit = await sql<{ open: boolean }[]>`
      SELECT public.bin_gateway_circuit_open(${providerKey}) AS open
    `;
  } catch {
    throw new GatewaySecurityUnavailableError();
  }
  if (circuit[0]?.open) throw new GatewayCircuitOpenError();
  try {
    const result = await operation();
    try {
      await sql`
        SELECT public.bin_record_gateway_upstream_result(${providerKey}, true, 5, 120)
      `;
    } catch {
      throw new GatewaySecurityUnavailableError();
    }
    return result;
  } catch (error) {
    if (error instanceof GatewayCircuitOpenError || error instanceof GatewaySecurityUnavailableError) {
      throw error;
    }
    await sql`
      SELECT public.bin_record_gateway_upstream_result(${providerKey}, false, 5, 120)
    `.catch(() => undefined);
    throw error;
  }
}

export const serverGatewaySecurityControls: GatewaySecurityControls = {
  enabled,
  ready,
  consume,
  withCircuit,
};

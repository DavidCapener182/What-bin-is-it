import { binDatabase, binDatabaseConfigured } from './bin-database';

export type BinAccountUser = {
  id: string;
  email?: string;
};

type SupabaseUserResponse = {
  id?: unknown;
  email?: unknown;
};

function authConfiguration() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) throw new Error('Resident account verification is not configured.');
  return { url: url.replace(/\/$/, ''), key };
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match || match[1].length < 40 || match[1].length > 4096) {
    throw new Error('Sign in to continue.');
  }
  return match[1];
}

export async function requireBinAccount(request: Request): Promise<BinAccountUser> {
  const token = bearerToken(request);
  const { url, key } = authConfiguration();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      accept: 'application/json',
      apikey: key,
      authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Your sign-in has expired. Please sign in again.');
  const payload = await response.json() as SupabaseUserResponse;
  if (typeof payload.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.id)) {
    throw new Error('The signed-in account could not be verified.');
  }
  return {
    id: payload.id,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
}

export type BinEntitlementRow = {
  plan_id: string;
  source: string;
  status: string;
  product_id: string | null;
  current_period_end: string | Date | null;
};

function periodEndIso(value: string | Date | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function serverEntitlementIsPlus(row: BinEntitlementRow) {
  if (row.plan_id === 'free') return false;
  if (row.status === 'active' || row.status === 'trialing') return true;
  if (row.status !== 'cancelled' && row.status !== 'canceled') return false;
  const periodEnd = periodEndIso(row.current_period_end);
  return Boolean(periodEnd && new Date(periodEnd) > new Date());
}

export async function getOrCreateBinEntitlement(userId: string) {
  if (!binDatabaseConfigured()) throw new Error('Resident plan storage is not configured.');
  const sql = binDatabase();
  await sql`
    INSERT INTO bin_user_entitlements (
      user_id,
      plan_id,
      source,
      status
    ) VALUES (
      ${userId},
      'free',
      'free',
      'free'
    )
    ON CONFLICT (user_id) DO NOTHING
  `;
  const rows = await sql<BinEntitlementRow[]>`
    SELECT plan_id, source, status, product_id, current_period_end
    FROM bin_user_entitlements
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error('Your plan could not be loaded.');
  return {
    planId: row.plan_id,
    source: row.source,
    status: row.status,
    productId: row.product_id ?? undefined,
    currentPeriodEnd: periodEndIso(row.current_period_end),
    isPlus: serverEntitlementIsPlus(row),
  };
}

import { binDatabase, binDatabaseConfigured } from './bin-database.ts';

export const BIN_ACCOUNT_AUTH_TIMEOUT_MS = 8_000;

export type BinAccountUser = {
  id: string;
  email?: string;
  sessionId: string;
  authenticationMethods: {
    method: string;
    timestamp: number;
  }[];
};

export type BinAccountAuthenticationCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTHENTICATION_EXPIRED'
  | 'AUTHENTICATION_UNAVAILABLE';

export class BinAccountAuthenticationError extends Error {
  readonly code: BinAccountAuthenticationCode;
  readonly status: 401 | 503;

  constructor(
    code: BinAccountAuthenticationCode,
    message: string,
    status: 401 | 503,
  ) {
    super(message);
    this.name = 'BinAccountAuthenticationError';
    this.code = code;
    this.status = status;
  }
}

type SupabaseUserResponse = {
  id?: unknown;
  email?: unknown;
};

type SupabaseAccessTokenClaims = {
  sub?: unknown;
  session_id?: unknown;
  amr?: unknown;
};

function authConfiguration() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) {
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_UNAVAILABLE',
      'Resident account verification is temporarily unavailable.',
      503,
    );
  }
  return { url: url.replace(/\/$/, ''), key };
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match || match[1].length < 40 || match[1].length > 4096) {
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_REQUIRED',
      'Sign in to continue.',
      401,
    );
  }
  return match[1];
}

function verifiedAccessTokenClaims(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[1].length > 16_384) {
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_EXPIRED',
      'Your sign-in has expired. Please sign in again.',
      401,
    );
  }
  let claims: SupabaseAccessTokenClaims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as SupabaseAccessTokenClaims;
  } catch {
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_EXPIRED',
      'Your sign-in has expired. Please sign in again.',
      401,
    );
  }
  const sessionId = typeof claims.session_id === 'string' && /^[0-9a-f-]{36}$/i.test(claims.session_id)
    ? claims.session_id
    : undefined;
  if (typeof claims.sub !== 'string' || !sessionId) {
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_EXPIRED',
      'Your sign-in has expired. Please sign in again.',
      401,
    );
  }
  const authenticationMethods = Array.isArray(claims.amr)
    ? claims.amr.slice(0, 20).flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const method = Reflect.get(entry, 'method');
      const timestamp = Reflect.get(entry, 'timestamp');
      return typeof method === 'string'
        && method.length <= 40
        && typeof timestamp === 'number'
        && Number.isSafeInteger(timestamp)
        && timestamp >= 0
        ? [{ method, timestamp }]
        : [];
    })
    : [];
  return {
    subject: claims.sub,
    sessionId,
    authenticationMethods,
  };
}

export async function requireBinAccount(request: Request): Promise<BinAccountUser> {
  const token = bearerToken(request);
  const { url, key } = authConfiguration();
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/user`, {
      headers: {
        accept: 'application/json',
        apikey: key,
        authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(BIN_ACCOUNT_AUTH_TIMEOUT_MS),
    });
  } catch {
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_UNAVAILABLE',
      'Your sign-in could not be verified right now. Please try again.',
      503,
    );
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new BinAccountAuthenticationError(
        'AUTHENTICATION_EXPIRED',
        'Your sign-in has expired. Please sign in again.',
        401,
      );
    }
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_UNAVAILABLE',
      'Your sign-in could not be verified right now. Please try again.',
      503,
    );
  }
  let payload: SupabaseUserResponse;
  try {
    payload = await response.json() as SupabaseUserResponse;
  } catch {
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_UNAVAILABLE',
      'Your sign-in could not be verified right now. Please try again.',
      503,
    );
  }
  if (typeof payload.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.id)) {
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_UNAVAILABLE',
      'The signed-in account could not be verified right now.',
      503,
    );
  }
  // Supabase has already verified this exact bearer token at /auth/v1/user.
  // Only after that verification do we decode its session-bound claims.
  const claims = verifiedAccessTokenClaims(token);
  if (claims.subject !== payload.id) {
    throw new BinAccountAuthenticationError(
      'AUTHENTICATION_EXPIRED',
      'Your sign-in has expired. Please sign in again.',
      401,
    );
  }
  return {
    id: payload.id,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    sessionId: claims.sessionId,
    authenticationMethods: claims.authenticationMethods,
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
  if (row.plan_id === 'plus-lifetime') {
    return !['expired', 'payment_failed', 'refunded', 'revoked'].includes(row.status);
  }
  if (
    row.status === 'active'
    || row.status === 'trialing'
    || row.status === 'past_due'
    || row.status === 'grace'
  ) {
    const periodEnd = periodEndIso(row.current_period_end);
    return Boolean(periodEnd && new Date(periodEnd) > new Date());
  }
  if (row.status !== 'cancelled' && row.status !== 'canceled') return false;
  const periodEnd = periodEndIso(row.current_period_end);
  return Boolean(periodEnd && new Date(periodEnd) > new Date());
}

export async function getOrCreateBinEntitlement(userId: string) {
  if (!binDatabaseConfigured()) throw new Error('Resident plan storage is not configured.');
  const sql = binDatabase();
  return sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    await transaction`
      DELETE FROM bin_account_re_enrolment_intents
      WHERE user_id = ${userId}::uuid
        AND expires_at <= now()
    `;
    const suppressions = await transaction`
      SELECT user_id
      FROM bin_account_removal_suppressions
      WHERE user_id = ${userId}::uuid
      FOR UPDATE
    `;
    if (suppressions.length > 0) {
      return {
        planId: 'free',
        source: 'free',
        status: 'free',
        productId: undefined,
        currentPeriodEnd: undefined,
        isPlus: false,
      };
    }
    await transaction`
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
    const rows = await transaction<BinEntitlementRow[]>`
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
  });
}

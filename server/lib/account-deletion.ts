import { binDatabase } from './bin-database.ts';

export const ACCOUNT_DATA_REMOVAL_CONFIRMATION = 'remove-what-bin-account';
export const RECENT_INTERACTIVE_AUTH_WINDOW_MS = 15 * 60 * 1000;

export type AccountDataRemovalCode =
  | 'RECENT_SESSION_AUTHENTICATION_REQUIRED'
  | 'AUTH_SESSION_INVALID'
  | 'STAFF_ACCOUNT_ASSISTANCE_REQUIRED'
  | 'ACTIVE_BILLING_MUST_BE_RESOLVED'
  | 'HOUSEHOLD_TRANSFER_REQUIRED'
  | 'HOUSEHOLD_LEAVE_REQUIRED'
  | 'ACCOUNT_DATA_REMOVAL_UNAVAILABLE';

export class AccountDataRemovalError extends Error {
  readonly code: AccountDataRemovalCode;
  readonly status: 401 | 409 | 503;
  readonly guidance: string;
  readonly retryable: boolean;

  constructor({
    code,
    message,
    status,
    guidance,
    retryable = false,
  }: {
    code: AccountDataRemovalCode;
    message: string;
    status: 401 | 409 | 503;
    guidance: string;
    retryable?: boolean;
  }) {
    super(message);
    this.name = 'AccountDataRemovalError';
    this.code = code;
    this.status = status;
    this.guidance = guidance;
    this.retryable = retryable;
  }
}

export type AccountDataRemovalFailure = {
  removed: false;
  identityRetained: true;
  code: AccountDataRemovalCode;
  error: string;
  guidance: string;
  retryable: boolean;
};

export type AccountDataRemovalPreflight = {
  privilegedStaffIdentity: boolean;
  activePaidBilling: boolean;
  sharedOwnedHousehold: boolean;
  otherHouseholdLink: boolean;
};

type AccountDataRemovalPreflightRow = {
  privileged_staff_identity: boolean;
  active_paid_billing: boolean;
  shared_owned_household: boolean;
  other_household_link: boolean;
};

export type AccountDataRemovalDependencies = {
  removeProductData: (userId: string, sessionId: string) => Promise<void>;
};

export function recentInteractiveAuthenticationIsEligible(
  methods: { method: string; timestamp: number }[],
  now = Date.now(),
) {
  return methods.some(({ method, timestamp }) => {
    if (method !== 'otp' && method !== 'magiclink') return false;
    const age = now - (timestamp * 1000);
    return age >= -60_000 && age <= RECENT_INTERACTIVE_AUTH_WINDOW_MS;
  });
}

export function accountDataRemovalPreflightError(preflight: AccountDataRemovalPreflight) {
  if (preflight.privilegedStaffIdentity) {
    return new AccountDataRemovalError({
      code: 'STAFF_ACCOUNT_ASSISTANCE_REQUIRED',
      message: 'This shared identity also has council or platform staff access.',
      status: 409,
      guidance: 'Contact What Bin support so resident data can be removed without disrupting staff access or audit records.',
    });
  }
  if (preflight.activePaidBilling) {
    return new AccountDataRemovalError({
      code: 'ACTIVE_BILLING_MUST_BE_RESOLVED',
      message: 'This account still has paid access or billing state that must be resolved before its What Bin data is removed.',
      status: 409,
      guidance: 'Cancel recurring billing with Stripe, Apple or Google. For a lifetime purchase or remaining paid period, contact What Bin support.',
    });
  }
  if (preflight.sharedOwnedHousehold) {
    return new AccountDataRemovalError({
      code: 'HOUSEHOLD_TRANSFER_REQUIRED',
      message: 'This account owns a household that contains activity or membership belonging to another person.',
      status: 409,
      guidance: 'Transfer or close the shared household with support before removing this account data.',
    });
  }
  if (preflight.otherHouseholdLink) {
    return new AccountDataRemovalError({
      code: 'HOUSEHOLD_LEAVE_REQUIRED',
      message: 'This account is linked to a household owned by another person.',
      status: 409,
      guidance: 'Leave the household or ask its owner or What Bin support to remove the membership first.',
    });
  }
  return undefined;
}

export function accountDataRemovalFailure(error: unknown): {
  status: 401 | 409 | 503;
  body: AccountDataRemovalFailure;
} {
  const safeError = error instanceof AccountDataRemovalError
    ? error
    : new AccountDataRemovalError({
      code: 'ACCOUNT_DATA_REMOVAL_UNAVAILABLE',
      message: 'What Bin account-data removal is temporarily unavailable. No data was removed.',
      status: 503,
      guidance: 'Please try again later. If the problem continues, contact What Bin support.',
      retryable: true,
    });
  return {
    status: safeError.status,
    body: {
      removed: false,
      identityRetained: true,
      code: safeError.code,
      error: safeError.message,
      guidance: safeError.guidance,
      retryable: safeError.retryable,
    },
  };
}

function preflightFromRow(row: AccountDataRemovalPreflightRow): AccountDataRemovalPreflight {
  return {
    privilegedStaffIdentity: row.privileged_staff_identity,
    activePaidBilling: row.active_paid_billing,
    sharedOwnedHousehold: row.shared_owned_household,
    otherHouseholdLink: row.other_household_link,
  };
}

async function removeProductData(userId: string, sessionId: string) {
  const sql = binDatabase();
  await sql.begin('isolation level serializable', async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const sessions = await transaction`
      SELECT id
      FROM auth.sessions
      WHERE id = ${sessionId}::uuid
        AND user_id = ${userId}::uuid
      LIMIT 1
      FOR KEY SHARE
    `;
    if (sessions.length === 0) {
      throw new AccountDataRemovalError({
        code: 'AUTH_SESSION_INVALID',
        message: 'This sign-in session is no longer active.',
        status: 401,
        guidance: 'Sign out, use a fresh What Bin email sign-in link, then try again.',
      });
    }
    await transaction`
      SELECT id
      FROM bin_households
      WHERE owner_user_id = ${userId}::uuid
      FOR UPDATE
    `;
    await transaction`
      SELECT household.id
      FROM bin_households AS household
      INNER JOIN bin_household_members AS member ON member.household_id = household.id
      WHERE member.user_id = ${userId}::uuid
      FOR UPDATE OF household
    `;

    const rows = await transaction<AccountDataRemovalPreflightRow[]>`
      SELECT
        (
          EXISTS (
            SELECT 1
            FROM bin_council_staff
            WHERE user_id = ${userId}::uuid AND status = 'active'
          )
          OR EXISTS (
            SELECT 1
            FROM bin_council_platform_admins
            WHERE user_id = ${userId}::uuid AND status = 'active'
          )
        ) AS privileged_staff_identity,
        (
          EXISTS (
            SELECT 1
            FROM bin_supporters
            WHERE user_id = ${userId}::uuid
              AND (
                lower(status) IN ('active', 'trialing', 'past_due', 'grace', 'unpaid', 'paused')
                OR (lower(status) IN ('cancelled', 'canceled') AND current_period_end > now())
              )
          )
          OR EXISTS (
            SELECT 1
            FROM bin_entitlement_grants
            WHERE user_id = ${userId}::uuid
              AND source IN ('stripe', 'apple', 'google')
              AND (
                lower(status) IN ('active', 'trialing', 'past_due', 'grace')
                OR (lower(status) IN ('cancelled', 'canceled') AND current_period_end > now())
              )
          )
          OR EXISTS (
            SELECT 1
            FROM bin_user_entitlements
            WHERE user_id = ${userId}::uuid
              AND source IN ('stripe', 'apple', 'google')
              AND (
                lower(status) IN ('active', 'trialing', 'past_due', 'grace')
                OR (lower(status) IN ('cancelled', 'canceled') AND current_period_end > now())
              )
          )
        ) AS active_paid_billing,
        EXISTS (
          SELECT 1
          FROM bin_households AS household
          WHERE household.owner_user_id = ${userId}::uuid
            AND (
              EXISTS (
                SELECT 1 FROM bin_household_members AS member
                WHERE member.household_id = household.id AND member.user_id <> ${userId}::uuid
              )
              OR EXISTS (
                SELECT 1 FROM bin_household_collection_actions AS action
                WHERE action.household_id = household.id
                  AND (
                    action.actor_user_id <> ${userId}::uuid
                    OR (action.responsible_user_id IS NOT NULL AND action.responsible_user_id <> ${userId}::uuid)
                  )
              )
              OR EXISTS (
                SELECT 1 FROM bin_household_invites AS invite
                WHERE invite.household_id = household.id AND invite.uses > 0
              )
            )
        ) AS shared_owned_household,
        (
          EXISTS (
            SELECT 1
            FROM bin_household_members AS member
            INNER JOIN bin_households AS household ON household.id = member.household_id
            WHERE member.user_id = ${userId}::uuid AND household.owner_user_id <> ${userId}::uuid
          )
          OR EXISTS (
            SELECT 1
            FROM bin_household_collection_actions AS action
            INNER JOIN bin_households AS household ON household.id = action.household_id
            WHERE household.owner_user_id <> ${userId}::uuid
              AND (action.actor_user_id = ${userId}::uuid OR action.responsible_user_id = ${userId}::uuid)
          )
        ) AS other_household_link
    `;
    const row = rows[0];
    if (!row) throw new Error('Account-data preflight did not return a result.');
    const blocker = accountDataRemovalPreflightError(preflightFromRow(row));
    if (blocker) throw blocker;

    await transaction`
      INSERT INTO bin_account_removal_suppressions (
        user_id,
        removed_at
      ) VALUES (${userId}::uuid, now())
      ON CONFLICT (user_id) DO UPDATE SET
        removed_at = excluded.removed_at
    `;
    await transaction`
      DELETE FROM bin_account_re_enrolment_intents
      WHERE user_id = ${userId}::uuid
    `;
    await transaction`
      DELETE FROM bin_resident_support_threads
      WHERE resident_user_id = ${userId}::uuid
    `;
    await transaction`
      DELETE FROM bin_household_invites
      WHERE created_by = ${userId}::uuid
    `;
    await transaction`
      DELETE FROM bin_households
      WHERE owner_user_id = ${userId}::uuid
    `;
    await transaction`
      DELETE FROM bin_household_members
      WHERE user_id = ${userId}::uuid
    `;
    await transaction`
      UPDATE bin_supporters
      SET user_id = null, updated_at = now()
      WHERE user_id = ${userId}::uuid
    `;
    await transaction`
      UPDATE bin_revenuecat_events
      SET user_id = null
      WHERE user_id = ${userId}::uuid
    `;
    await transaction`
      DELETE FROM bin_entitlement_grants
      WHERE user_id = ${userId}::uuid
    `;
    await transaction`
      DELETE FROM bin_user_entitlements
      WHERE user_id = ${userId}::uuid
    `;
  });
}

const productionDependencies: AccountDataRemovalDependencies = { removeProductData };

export async function removeResidentAccountData(
  {
    userId,
    sessionId,
    authenticationMethods,
    now = Date.now(),
  }: {
    userId: string;
    sessionId: string;
    authenticationMethods: { method: string; timestamp: number }[];
    now?: number;
  },
  dependencies: AccountDataRemovalDependencies = productionDependencies,
) {
  if (!recentInteractiveAuthenticationIsEligible(authenticationMethods, now)) {
    throw new AccountDataRemovalError({
      code: 'RECENT_SESSION_AUTHENTICATION_REQUIRED',
      message: 'For security, account-data removal requires this session to have completed an email OTP or magic-link sign-in in the last 15 minutes.',
      status: 401,
      guidance: 'Sign out on this device, use a fresh What Bin email sign-in link, then return here and try again.',
    });
  }
  try {
    await dependencies.removeProductData(userId, sessionId);
  } catch (error) {
    if (error instanceof AccountDataRemovalError) throw error;
    throw new AccountDataRemovalError({
      code: 'ACCOUNT_DATA_REMOVAL_UNAVAILABLE',
      message: 'What Bin account-data removal is temporarily unavailable. No data was removed.',
      status: 503,
      guidance: 'Please try again later. If the problem continues, contact What Bin support.',
      retryable: true,
    });
  }
  return {
    removed: true as const,
    identityRetained: true as const,
    retained:
      'The shared Supabase sign-in identity, detached payment-provider records and a minimal What Bin removal-suppression marker are retained. The marker clears only after an explicit re-enrolment is verified by the payment provider. This device will be signed out locally.',
  };
}

import { createHash } from 'node:crypto';

import type postgres from 'postgres';

import { binDatabase } from './bin-database.ts';

import {
  chooseEffectiveGrant,
  type PaidPlanId,
  type PaidSource,
  type ProviderGrantRow,
} from '../../src/lib/entitlement-grants.ts';

export type ProviderGrant = {
  userId: string;
  source: PaidSource;
  externalKey: string;
  planId: PaidPlanId;
  status: string;
  productId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string | Date | null;
  providerEventAt: string | Date;
  providerEventId?: string;
  providerEventOrder?: number;
  reEnrolmentKey?: string;
};

export type ProviderGrantSaveResult = 'saved' | 'suppressed' | 're-enrolled';
export type WhatBinReEnrolmentSource = 'native' | 'stripe';

const activeProviderStatuses = new Set(['active', 'trialing', 'past_due', 'grace']);

export function whatBinReEnrolmentIntentKey(source: WhatBinReEnrolmentSource, value: string) {
  return createHash('sha256').update(`${source}:${value}`, 'utf8').digest('hex');
}

export function providerGrantHasRequiredPeriod(grant: ProviderGrant) {
  if (grant.planId === 'plus-lifetime' || !activeProviderStatuses.has(grant.status)) return true;
  if (!grant.currentPeriodEnd) return false;
  const periodEnd = new Date(grant.currentPeriodEnd);
  return Number.isFinite(periodEnd.getTime()) && periodEnd > new Date();
}

function safeProviderEventOrder(value: number | undefined) {
  return Number.isSafeInteger(value) && value! >= 0 && value! <= 10_000 ? value! : 0;
}

export async function reconcileUserEntitlementInTransaction(
  transaction: postgres.TransactionSql,
  userId: string,
) {
  const grants = await transaction<ProviderGrantRow[]>`
    SELECT
      user_id,
      source,
      external_key,
      plan_id,
      status,
      product_id,
      stripe_customer_id,
      stripe_subscription_id,
      current_period_end,
      provider_event_at
    FROM bin_entitlement_grants
    WHERE user_id = ${userId}::uuid
  `;
  const effective = chooseEffectiveGrant(grants);
  await transaction`
    INSERT INTO bin_user_entitlements (
      user_id,
      plan_id,
      source,
      status,
      product_id,
      stripe_customer_id,
      stripe_subscription_id,
      current_period_end,
      updated_at
    ) VALUES (
      ${userId},
      ${effective?.plan_id ?? 'free'},
      ${effective?.source ?? 'free'},
      ${effective?.status ?? 'free'},
      ${effective?.product_id ?? null},
      ${effective?.stripe_customer_id ?? null},
      ${effective?.stripe_subscription_id ?? null},
      ${effective?.current_period_end ?? null},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id = excluded.plan_id,
      source = excluded.source,
      status = excluded.status,
      product_id = excluded.product_id,
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      current_period_end = excluded.current_period_end,
      updated_at = now()
  `;
  return effective;
}

export async function recordWhatBinReEnrolmentIntent(
  userId: string,
  source: WhatBinReEnrolmentSource,
  reEnrolmentKey?: string,
) {
  if (source === 'stripe' && !reEnrolmentKey) {
    throw new Error('Stripe re-enrolment requires a checkout key.');
  }
  const sql = binDatabase();
  const intentKey = whatBinReEnrolmentIntentKey(
    source,
    source === 'native' ? 'native' : reEnrolmentKey!,
  );
  return sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    await transaction`
      DELETE FROM bin_account_re_enrolment_intents
      WHERE user_id = ${userId}::uuid
        AND expires_at <= now()
    `;
    const pending = await transaction`
      INSERT INTO bin_account_re_enrolment_intents (
        user_id,
        source,
        intent_key,
        requested_at,
        expires_at
      )
      SELECT
        suppression.user_id,
        ${source},
        ${intentKey},
        now(),
        now() + interval '30 minutes'
      FROM bin_account_removal_suppressions AS suppression
      WHERE suppression.user_id = ${userId}::uuid
      ON CONFLICT (user_id, source, intent_key) DO UPDATE SET
        requested_at = excluded.requested_at,
        expires_at = excluded.expires_at
      RETURNING user_id
    `;
    return pending.length > 0;
  });
}

export async function saveProviderGrantInTransaction(
  transaction: postgres.TransactionSql,
  grant: ProviderGrant,
  persistAccepted?: (transaction: postgres.TransactionSql) => Promise<void>,
) {
  if (!providerGrantHasRequiredPeriod(grant)) {
    throw new Error('A time-limited provider grant requires a verified future period end.');
  }
  await transaction`SELECT pg_advisory_xact_lock(hashtext(${grant.userId}))`;
  const suppressions = await transaction<{ user_id: string }[]>`
    SELECT user_id
    FROM bin_account_removal_suppressions
    WHERE user_id = ${grant.userId}::uuid
    FOR UPDATE
  `;
  const suppression = suppressions[0];
  let eligibleIntent = false;
  if (suppression && activeProviderStatuses.has(grant.status)) {
    await transaction`
      DELETE FROM bin_account_re_enrolment_intents
      WHERE user_id = ${grant.userId}::uuid
        AND expires_at <= now()
    `;
    const matchingIntentKey = grant.source === 'stripe' && grant.reEnrolmentKey
      ? whatBinReEnrolmentIntentKey('stripe', grant.reEnrolmentKey)
      : whatBinReEnrolmentIntentKey('native', 'native');
    const intents = await transaction`
      SELECT intent_key
      FROM bin_account_re_enrolment_intents
      WHERE user_id = ${grant.userId}::uuid
        AND expires_at > now()
        AND requested_at <= ${grant.providerEventAt}::timestamptz
        AND (
          (
            source = 'native'
            AND intent_key = ${matchingIntentKey}
            AND ${grant.source}::text IN ('apple', 'google')
          )
          OR (
            source = 'stripe'
            AND ${grant.source}::text = 'stripe'
            AND intent_key = ${matchingIntentKey}
          )
        )
      ORDER BY requested_at DESC
      LIMIT 1
      FOR UPDATE
    `;
    eligibleIntent = intents.length > 0;
  }
  if (suppression && !eligibleIntent) {
      // Provider ledgers may be retained for billing, fraud and legal duties,
      // but a delayed event must not reconnect them to a removed What Bin user.
      await transaction`
        UPDATE bin_supporters
        SET user_id = null, updated_at = now()
        WHERE user_id = ${grant.userId}::uuid
      `;
      await transaction`
        UPDATE bin_revenuecat_events
        SET user_id = null
        WHERE user_id = ${grant.userId}::uuid
      `;
      await transaction`
        DELETE FROM bin_entitlement_grants
        WHERE user_id = ${grant.userId}::uuid
      `;
      await transaction`
        DELETE FROM bin_user_entitlements
        WHERE user_id = ${grant.userId}::uuid
      `;
    return 'suppressed';
  }
  if (suppression) {
    await transaction`
      DELETE FROM bin_account_removal_suppressions
      WHERE user_id = ${grant.userId}::uuid
    `;
  }
  const savedGrant = await transaction`
      INSERT INTO bin_entitlement_grants (
        user_id,
        source,
        external_key,
        plan_id,
        status,
        product_id,
        stripe_customer_id,
        stripe_subscription_id,
        current_period_end,
        provider_event_at,
        provider_event_id,
        provider_event_order,
        updated_at
      ) VALUES (
        ${grant.userId},
        ${grant.source},
        ${grant.externalKey},
        ${grant.planId},
        ${grant.status},
        ${grant.productId ?? null},
        ${grant.stripeCustomerId ?? null},
        ${grant.stripeSubscriptionId ?? null},
        ${grant.currentPeriodEnd ?? null},
        ${grant.providerEventAt},
        ${grant.providerEventId ?? null},
        ${safeProviderEventOrder(grant.providerEventOrder)},
        now()
      )
      ON CONFLICT (source, external_key) DO UPDATE SET
        user_id = excluded.user_id,
        plan_id = excluded.plan_id,
        status = excluded.status,
        product_id = excluded.product_id,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        current_period_end = excluded.current_period_end,
        provider_event_at = excluded.provider_event_at,
        provider_event_id = excluded.provider_event_id,
        provider_event_order = excluded.provider_event_order,
        updated_at = now()
      WHERE excluded.provider_event_at > bin_entitlement_grants.provider_event_at
        OR (
          excluded.provider_event_at = bin_entitlement_grants.provider_event_at
          AND excluded.provider_event_order > bin_entitlement_grants.provider_event_order
        )
      RETURNING id
  `;
  if (savedGrant.length > 0) await persistAccepted?.(transaction);
  await reconcileUserEntitlementInTransaction(transaction, grant.userId);
  return suppression ? 're-enrolled' : 'saved';
}

export async function saveProviderGrant(
  grant: ProviderGrant,
  persistAccepted?: (transaction: postgres.TransactionSql) => Promise<void>,
) {
  const sql = binDatabase();
  return sql.begin<ProviderGrantSaveResult>(async (transaction) => {
    return saveProviderGrantInTransaction(transaction, grant, persistAccepted);
  });
}

import { binDatabase } from './bin-database';

import {
  chooseEffectiveGrant,
  type PaidPlanId,
  type PaidSource,
  type ProviderGrantRow,
} from '../../src/lib/entitlement-grants';

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
};

export async function saveProviderGrant(grant: ProviderGrant) {
  const sql = binDatabase();
  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${grant.userId}))`;
    await transaction`
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
        updated_at = now()
      WHERE excluded.provider_event_at >= bin_entitlement_grants.provider_event_at
    `;
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
      WHERE user_id = ${grant.userId}
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
        ${grant.userId},
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
  });
}

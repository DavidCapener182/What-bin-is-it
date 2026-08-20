export type PaidPlanId = 'plus-monthly' | 'plus-yearly' | 'plus-lifetime';
export type PaidSource = 'stripe' | 'apple' | 'google' | 'admin';

export type ProviderGrantRow = {
  user_id: string;
  source: PaidSource;
  external_key: string;
  plan_id: PaidPlanId;
  status: string;
  product_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | Date | null;
  provider_event_at: string | Date;
};

function validDate(value: string | Date | null | undefined) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function providerGrantIsActive(
  grant: Pick<ProviderGrantRow, 'plan_id' | 'status' | 'current_period_end'>,
  now = new Date(),
) {
  if (grant.plan_id === 'plus-lifetime') {
    return !['expired', 'payment_failed', 'refunded', 'revoked'].includes(grant.status);
  }
  if (['active', 'trialing', 'past_due', 'grace'].includes(grant.status)) {
    const periodEnd = validDate(grant.current_period_end);
    return Boolean(periodEnd && periodEnd > now);
  }
  if (grant.status === 'cancelled' || grant.status === 'canceled') {
    const periodEnd = validDate(grant.current_period_end);
    return Boolean(periodEnd && periodEnd > now);
  }
  return false;
}

function planRank(planId: PaidPlanId) {
  if (planId === 'plus-lifetime') return 3;
  if (planId === 'plus-yearly') return 2;
  return 1;
}

export function chooseEffectiveGrant(grants: ProviderGrantRow[], now = new Date()) {
  return grants
    .filter((grant) => providerGrantIsActive(grant, now))
    .sort((left, right) => {
      const rankDifference = planRank(right.plan_id) - planRank(left.plan_id);
      if (rankDifference) return rankDifference;
      const rightEnd = validDate(right.current_period_end)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const leftEnd = validDate(left.current_period_end)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (rightEnd !== leftEnd) return rightEnd - leftEnd;
      const rightEvent = validDate(right.provider_event_at)?.getTime() ?? 0;
      const leftEvent = validDate(left.provider_event_at)?.getTime() ?? 0;
      return rightEvent - leftEvent;
    })[0];
}

export type EntitlementPlan =
  | 'free'
  | 'plus-monthly'
  | 'plus-yearly'
  | 'plus-lifetime';

export type EntitlementSource = 'free' | 'stripe' | 'apple' | 'google' | 'admin';

export type AccountEntitlement = {
  planId: EntitlementPlan;
  source: EntitlementSource;
  status: string;
  productId?: string;
  currentPeriodEnd?: string;
  isPlus: boolean;
};

export const freeEntitlement: AccountEntitlement = {
  planId: 'free',
  source: 'free',
  status: 'free',
  isPlus: false,
};

export function isEntitlementPlan(value: unknown): value is EntitlementPlan {
  return value === 'free'
    || value === 'plus-monthly'
    || value === 'plus-yearly'
    || value === 'plus-lifetime';
}

export function entitlementLabel(planId: EntitlementPlan) {
  if (planId === 'plus-monthly') return 'Plus monthly';
  if (planId === 'plus-yearly') return 'Plus annual';
  if (planId === 'plus-lifetime') return 'Plus lifetime';
  return 'Free';
}

export function entitlementIsPlus({
  planId,
  status,
  currentPeriodEnd,
  now = new Date(),
}: {
  planId: EntitlementPlan;
  status: string;
  currentPeriodEnd?: string | null;
  now?: Date;
}) {
  if (planId === 'free') return false;
  if (planId === 'plus-lifetime') {
    return !['expired', 'payment_failed', 'refunded', 'revoked'].includes(status);
  }
  if (
    status === 'active'
    || status === 'trialing'
    || status === 'past_due'
    || status === 'grace'
  ) {
    if (!currentPeriodEnd) return false;
    const periodEnd = new Date(currentPeriodEnd);
    return Number.isFinite(periodEnd.getTime()) && periodEnd > now;
  }
  if (status !== 'cancelled' && status !== 'canceled') return false;
  if (!currentPeriodEnd) return false;
  const periodEnd = new Date(currentPeriodEnd);
  return Number.isFinite(periodEnd.getTime()) && periodEnd > now;
}

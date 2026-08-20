export type ProviderEventContext = {
  occurredAt: string;
  eventId?: string;
  providerEventOrder: number;
};

export function stripeProviderEventOrder(eventType: string, providerStatus?: string) {
  if (eventType === 'subscription.snapshot') {
    if (providerStatus === 'canceled' || providerStatus === 'incomplete_expired') return 790;
    if (providerStatus === 'unpaid') return 780;
    if (providerStatus === 'past_due') return 770;
    if (providerStatus === 'paused') return 760;
    if (providerStatus === 'incomplete') return 750;
    if (providerStatus === 'active' || providerStatus === 'trialing') return 740;
    return 730;
  }
  if (eventType === 'refund.snapshot') {
    return providerStatus === 'refunded' ? 920 : 910;
  }
  if (eventType === 'checkout.snapshot') {
    return providerStatus === 'payment_failed' ? 710 : 700;
  }
  if (
    (eventType === 'refund.updated' || eventType === 'refund.failed')
    && (providerStatus === 'failed' || providerStatus === 'canceled')
  ) return 900;
  if (
    (eventType === 'refund.created' || eventType === 'refund.updated')
    && providerStatus === 'succeeded'
  ) return 800;
  if (eventType === 'customer.subscription.deleted') return 700;
  if (eventType === 'invoice.payment_failed' || eventType === 'checkout.session.async_payment_failed') {
    return 600;
  }
  if (eventType === 'customer.subscription.updated') return 500;
  if (eventType === 'customer.subscription.created') return 400;
  if (eventType === 'checkout.session.async_payment_succeeded') return 300;
  return 200;
}

export function stripeAuthoritativeSnapshotContext(
  context: ProviderEventContext,
  snapshotType: 'subscription.snapshot' | 'refund.snapshot' | 'checkout.snapshot',
  status: string,
  observedAt = new Date(),
): ProviderEventContext {
  const observedTime = observedAt.getTime();
  if (!Number.isFinite(observedTime)) throw new TypeError('The Stripe observation time is invalid.');
  const eventTime = Date.parse(context.occurredAt);
  return {
    ...context,
    // Stripe event.created has only second precision and events are unordered.
    // A current provider read is authoritative at observation time, so never
    // order that snapshot behind the triggering webhook's coarse timestamp.
    occurredAt: new Date(Math.max(Number.isFinite(eventTime) ? eventTime : 0, observedTime)).toISOString(),
    providerEventOrder: stripeProviderEventOrder(snapshotType, status),
  };
}

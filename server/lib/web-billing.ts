import Stripe from 'stripe';

import type { BinAccountUser } from './bin-auth';
import { binDatabase, binDatabaseConfigured } from './bin-database';
import { saveProviderGrant } from './entitlement-reconciliation';

export const webSupporterPlans = {
  'plus-monthly': {
    id: 'plus-monthly',
    name: 'Web supporter',
    description: 'Support verified collection lookups and privacy-safe council coverage.',
    amountPence: 199,
    cadence: 'monthly',
    mode: 'subscription',
  },
  'plus-yearly': {
    id: 'plus-yearly',
    name: 'Annual web supporter',
    description: 'A year of support for council coverage, reminders and recycling guidance.',
    amountPence: 1499,
    cadence: 'yearly',
    mode: 'subscription',
  },
  'plus-lifetime': {
    id: 'plus-lifetime',
    name: 'Founding web supporter',
    description: 'A one-off contribution to help launch nationwide council coverage.',
    amountPence: 2999,
    cadence: 'one-time',
    mode: 'payment',
  },
} as const;

export type WebSupporterPlanId = keyof typeof webSupporterPlans;

let stripeInstance: Stripe | undefined;

export function stripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error('Secure web checkout is not configured.');
  if (!stripeInstance) stripeInstance = new Stripe(secret);
  return stripeInstance;
}

export function webBillingConfigured() {
  return Boolean(
    binDatabaseConfigured()
    && process.env.STRIPE_SECRET_KEY?.trim()
    && process.env.STRIPE_WEBHOOK_SECRET?.trim(),
  );
}

export function webBillingLive() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith('sk_live_') === true;
}

export function isWebSupporterPlanId(value: unknown): value is WebSupporterPlanId {
  return typeof value === 'string' && Object.hasOwn(webSupporterPlans, value);
}

export function safeCheckoutOrigin(requestUrl: string) {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) {
    const origin = new URL(configured);
    if (origin.protocol !== 'https:' || origin.username || origin.password) {
      throw new Error('The configured app origin is invalid.');
    }
    return origin.origin;
  }
  const requestOrigin = new URL(requestUrl);
  const local = requestOrigin.hostname === 'localhost' || requestOrigin.hostname === '127.0.0.1';
  if (!local && requestOrigin.protocol !== 'https:') throw new Error('A secure app origin is required.');
  if (
    !local
    && requestOrigin.hostname !== 'what-bin-is-it-tonight.vercel.app'
    && !requestOrigin.hostname.endsWith('.vercel.app')
  ) {
    throw new Error('The checkout origin is not allowed.');
  }
  return requestOrigin.origin;
}

export function requestHasTrustedOrigin(request: Request) {
  const supplied = request.headers.get('origin');
  if (!supplied) return false;
  try {
    return new URL(supplied).origin === safeCheckoutOrigin(request.url);
  } catch {
    return false;
  }
}

export async function createWebCheckout(
  planId: WebSupporterPlanId,
  origin: string,
  user: BinAccountUser,
) {
  const plan = webSupporterPlans[planId];
  const recurring = plan.cadence === 'monthly'
    ? { interval: 'month' as const }
    : plan.cadence === 'yearly'
      ? { interval: 'year' as const }
      : undefined;
  const metadata = { channel: 'web', planId, binUserId: user.id };
  const session = await stripeClient().checkout.sessions.create({
    mode: plan.mode,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: plan.amountPence,
        product_data: {
          name: plan.name,
          description: plan.description,
        },
        ...(recurring ? { recurring } : {}),
      },
    }],
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    client_reference_id: user.id,
    customer_email: user.email,
    customer_creation: plan.mode === 'payment' ? 'always' : undefined,
    metadata,
    payment_intent_data: plan.mode === 'payment' ? { metadata } : undefined,
    subscription_data: plan.mode === 'subscription' ? { metadata } : undefined,
    success_url: `${origin}/plus?web_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/plus?web_checkout=cancelled`,
  });
  if (!session.url) throw new Error('Stripe did not return a secure checkout URL.');
  return session.url;
}

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  return typeof value === 'string' ? value : value?.id;
}

function subscriptionId(value: string | Stripe.Subscription | null | undefined) {
  return typeof value === 'string' ? value : value?.id;
}

function planFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const planId = metadata?.planId;
  return isWebSupporterPlanId(planId) ? planId : undefined;
}

function binUserIdFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const userId = metadata?.binUserId;
  return typeof userId === 'string' && /^[0-9a-f-]{36}$/i.test(userId) ? userId : undefined;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
  return typeof itemPeriodEnd === 'number' ? new Date(itemPeriodEnd * 1000).toISOString() : null;
}

function safeEntitlementStatus(status: string) {
  if (
    status === 'active'
    || status === 'trialing'
    || status === 'past_due'
    || status === 'grace'
    || status === 'cancelled'
    || status === 'canceled'
    || status === 'expired'
    || status === 'free'
    || status === 'payment_failed'
  ) return status;
  return status === 'incomplete' || status === 'unpaid' ? 'payment_failed' : 'expired';
}

async function saveStripeEntitlement({
  userId,
  planId,
  status,
  customer,
  subscription,
  currentPeriodEnd,
  externalKey,
  providerEventAt,
  providerEventId,
}: {
  userId: string;
  planId: WebSupporterPlanId;
  status: string;
  customer: string;
  subscription?: string;
  currentPeriodEnd?: string | Date | null;
  externalKey: string;
  providerEventAt: string;
  providerEventId?: string;
}) {
  await saveProviderGrant({
    userId,
    planId,
    source: 'stripe',
    status: safeEntitlementStatus(status),
    productId: planId,
    stripeCustomerId: customer,
    stripeSubscriptionId: subscription,
    currentPeriodEnd,
    externalKey,
    providerEventAt,
    providerEventId,
  });
}

type ProviderEventContext = {
  occurredAt: string;
  eventId?: string;
};

function checkoutContext(session: Stripe.Checkout.Session): ProviderEventContext {
  return {
    occurredAt: new Date(session.created * 1000).toISOString(),
    eventId: `checkout:${session.id}`,
  };
}

async function saveCompletedCheckout(
  session: Stripe.Checkout.Session,
  expectedUserId?: string,
  context = checkoutContext(session),
) {
  const planId = planFromMetadata(session.metadata);
  const customer = customerId(session.customer);
  const userId = binUserIdFromMetadata(session.metadata) ?? session.client_reference_id ?? undefined;
  if (
    !planId
    || !customer
    || !userId
    || !/^[0-9a-f-]{36}$/i.test(userId)
    || (expectedUserId && expectedUserId !== userId)
  ) throw new Error('The completed checkout is missing its account identity.');
  const plan = webSupporterPlans[planId];
  const subscription = subscriptionId(session.subscription);
  const status = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
    ? 'active'
    : session.payment_status;
  const sql = binDatabase();
  await sql`
    INSERT INTO bin_supporters (
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      checkout_session_id,
      plan_id,
      billing_mode,
      status,
      currency,
      amount_pence,
      started_at,
      updated_at
    ) VALUES (
      ${userId},
      ${customer},
      ${subscription ?? null},
      ${session.id},
      ${planId},
      ${plan.mode},
      ${status},
      ${session.currency ?? 'gbp'},
      ${session.amount_total ?? plan.amountPence},
      now(),
      now()
    )
    ON CONFLICT (stripe_customer_id) DO UPDATE SET
      user_id = excluded.user_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      checkout_session_id = excluded.checkout_session_id,
      plan_id = excluded.plan_id,
      billing_mode = excluded.billing_mode,
      status = excluded.status,
      currency = excluded.currency,
      amount_pence = excluded.amount_pence,
      started_at = coalesce(bin_supporters.started_at, excluded.started_at),
      updated_at = now()
  `;
  await saveStripeEntitlement({
    userId,
    planId,
    status,
    customer,
    subscription,
    externalKey: subscription ? `subscription:${subscription}` : `checkout:${session.id}`,
    providerEventAt: context.occurredAt,
    providerEventId: context.eventId,
  });
}

async function saveSubscription(
  subscription: Stripe.Subscription,
  context: ProviderEventContext,
) {
  const customer = customerId(subscription.customer);
  if (!customer) throw new Error('The subscription is missing its customer.');
  const metadataPlan = planFromMetadata(subscription.metadata);
  let userId = binUserIdFromMetadata(subscription.metadata);
  const sql = binDatabase();
  if (!userId) {
    const existing = await sql<{ user_id: string | null; plan_id: WebSupporterPlanId }[]>`
      SELECT user_id, plan_id
      FROM bin_supporters
      WHERE stripe_customer_id = ${customer}
      LIMIT 1
    `;
    userId = existing[0]?.user_id ?? undefined;
  }
  if (metadataPlan) {
    if (!userId) throw new Error('The subscription is not linked to a What Bin account.');
    const plan = webSupporterPlans[metadataPlan];
    await sql`
      INSERT INTO bin_supporters (
        user_id,
        stripe_customer_id,
        stripe_subscription_id,
        plan_id,
        billing_mode,
        status,
        currency,
        amount_pence,
        started_at,
        current_period_end,
        cancelled_at,
        updated_at
      ) VALUES (
        ${userId},
        ${customer},
        ${subscription.id},
        ${metadataPlan},
        ${plan.mode},
        ${subscription.status},
        ${subscription.currency ?? 'gbp'},
        ${plan.amountPence},
        to_timestamp(${subscription.created}),
        ${subscriptionPeriodEnd(subscription)},
        ${subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null},
        now()
      )
      ON CONFLICT (stripe_customer_id) DO UPDATE SET
        user_id = excluded.user_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        plan_id = excluded.plan_id,
        billing_mode = excluded.billing_mode,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        cancelled_at = excluded.cancelled_at,
        updated_at = now()
    `;
    await saveStripeEntitlement({
      userId,
      planId: metadataPlan,
      status: subscription.status,
      customer,
      subscription: subscription.id,
      currentPeriodEnd: subscriptionPeriodEnd(subscription),
      externalKey: `subscription:${subscription.id}`,
      providerEventAt: context.occurredAt,
      providerEventId: context.eventId,
    });
    return;
  }
  await sql`
    UPDATE bin_supporters SET
      stripe_subscription_id = ${subscription.id},
      status = ${subscription.status},
      current_period_end = ${subscriptionPeriodEnd(subscription)},
      cancelled_at = ${subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null},
      updated_at = now()
    WHERE stripe_customer_id = ${customer}
  `;
  if (userId) {
    const supporters = await sql<{
      plan_id: WebSupporterPlanId;
      stripe_customer_id: string;
    }[]>`
      SELECT plan_id, stripe_customer_id
      FROM bin_supporters
      WHERE user_id = ${userId}
        AND stripe_subscription_id = ${subscription.id}
      LIMIT 1
    `;
    const supporter = supporters[0];
    if (supporter && isWebSupporterPlanId(supporter.plan_id)) {
      await saveStripeEntitlement({
        userId,
        planId: supporter.plan_id,
        status: subscription.status,
        customer: supporter.stripe_customer_id,
        subscription: subscription.id,
        currentPeriodEnd: subscriptionPeriodEnd(subscription),
        externalKey: `subscription:${subscription.id}`,
        providerEventAt: context.occurredAt,
        providerEventId: context.eventId,
      });
    }
  }
}

async function markSupporterStatus(
  customer: string | undefined,
  subscription: string | undefined,
  status: string,
  context: ProviderEventContext,
) {
  if (!customer && !subscription) return;
  const sql = binDatabase();
  await sql`
    UPDATE bin_supporters SET status = ${status}, updated_at = now()
    WHERE (${customer ?? null}::text IS NOT NULL AND stripe_customer_id = ${customer ?? null})
       OR (${subscription ?? null}::text IS NOT NULL AND stripe_subscription_id = ${subscription ?? null})
  `;
  const supporters = await sql<{
    user_id: string | null;
    plan_id: WebSupporterPlanId;
    stripe_customer_id: string;
    stripe_subscription_id: string | null;
    current_period_end: string | Date | null;
  }[]>`
    SELECT
      user_id,
      plan_id,
      stripe_customer_id,
      stripe_subscription_id,
      current_period_end
    FROM bin_supporters
    WHERE (${customer ?? null}::text IS NOT NULL AND stripe_customer_id = ${customer ?? null})
       OR (${subscription ?? null}::text IS NOT NULL AND stripe_subscription_id = ${subscription ?? null})
    LIMIT 1
  `;
  const supporter = supporters[0];
  if (supporter?.user_id && isWebSupporterPlanId(supporter.plan_id)) {
    const externalKey = supporter.stripe_subscription_id
      ? `subscription:${supporter.stripe_subscription_id}`
      : `legacy-customer:${supporter.stripe_customer_id}`;
    await saveStripeEntitlement({
      userId: supporter.user_id,
      planId: supporter.plan_id,
      status,
      customer: supporter.stripe_customer_id,
      subscription: supporter.stripe_subscription_id ?? undefined,
      currentPeriodEnd: supporter.current_period_end,
      externalKey,
      providerEventAt: context.occurredAt,
      providerEventId: context.eventId,
    });
  }
}

export function constructStripeEvent(body: string, signature: string | null) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret || !signature) throw new Error('The Stripe webhook signature is missing.');
  return stripeClient().webhooks.constructEvent(body, signature, webhookSecret);
}

export async function processStripeEvent(event: Stripe.Event) {
  const sql = binDatabase();
  const inserted = await sql`
    INSERT INTO bin_payment_events (
      stripe_event_id,
      event_type,
      livemode,
      outcome,
      occurred_at
    ) VALUES (
      ${event.id},
      ${event.type},
      ${event.livemode},
      'received',
      to_timestamp(${event.created})
    )
    ON CONFLICT (stripe_event_id) DO NOTHING
    RETURNING stripe_event_id
  `;
  if (!inserted.length) return false;

  let customer: string | undefined;
  let subscription: string | undefined;
  let planId: WebSupporterPlanId | undefined;
  const context = {
    occurredAt: new Date(event.created * 1000).toISOString(),
    eventId: event.id,
  };
  try {
    const bulkyBookingEvent = await import('./bulky-bookings')
      .then(({ processBulkyBookingStripeEvent }) => processBulkyBookingStripeEvent(event));
    if (bulkyBookingEvent) {
      await sql`
        UPDATE bin_payment_events SET outcome = 'processed'
        WHERE stripe_event_id = ${event.id}
      `;
      return true;
    }
    if (
      event.type === 'checkout.session.completed'
      || event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object;
      customer = customerId(session.customer);
      subscription = subscriptionId(session.subscription);
      planId = planFromMetadata(session.metadata);
      await saveCompletedCheckout(session, undefined, context);
    } else if (
      event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
    ) {
      const record = event.data.object;
      customer = customerId(record.customer);
      subscription = record.id;
      planId = planFromMetadata(record.metadata);
      await saveSubscription(record, context);
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object;
      customer = customerId(session.customer);
      subscription = subscriptionId(session.subscription);
      planId = planFromMetadata(session.metadata);
      await markSupporterStatus(customer, subscription, 'payment_failed', context);
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      customer = customerId(invoice.customer);
      subscription = typeof invoice.parent?.subscription_details?.subscription === 'string'
        ? invoice.parent.subscription_details.subscription
        : invoice.parent?.subscription_details?.subscription?.id;
      await markSupporterStatus(customer, subscription, 'past_due', context);
    }
    await sql`
      UPDATE bin_payment_events SET
        stripe_customer_id = ${customer ?? null},
        stripe_subscription_id = ${subscription ?? null},
        plan_id = ${planId ?? null},
        outcome = 'processed'
      WHERE stripe_event_id = ${event.id}
    `;
    return true;
  } catch (error) {
    await sql`
      UPDATE bin_payment_events SET outcome = 'failed'
      WHERE stripe_event_id = ${event.id}
    `;
    throw error;
  }
}

export async function confirmWebCheckout(sessionId: string, userId: string) {
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]{10,}$/.test(sessionId)) {
    throw new Error('The checkout session is invalid.');
  }
  const session = await stripeClient().checkout.sessions.retrieve(sessionId);
  const customer = customerId(session.customer);
  if (
    !customer
    || session.status !== 'complete'
    || (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required')
    || !planFromMetadata(session.metadata)
  ) {
    throw new Error('The supporter payment has not completed.');
  }
  await saveCompletedCheckout(session, userId);
  return true;
}

export async function createSupporterPortal(userId: string, origin: string) {
  const sql = binDatabase();
  const rows = await sql<{ stripe_customer_id: string }[]>`
    SELECT stripe_customer_id
    FROM bin_supporters
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const customer = rows[0]?.stripe_customer_id;
  if (!customer) throw new Error('No web supporter plan was found for this account.');
  const session = await stripeClient().billingPortal.sessions.create({
    customer,
    return_url: `${origin}/plus`,
  });
  return session.url;
}

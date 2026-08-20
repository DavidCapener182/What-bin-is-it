import Stripe from 'stripe';
import type postgres from 'postgres';

import type { BinAccountUser } from './bin-auth.ts';
import { binDatabase, binDatabaseConfigured } from './bin-database.ts';
import { providerGrantIsActive, type ProviderGrantRow } from '../../src/lib/entitlement-grants.ts';
import {
  recordWhatBinReEnrolmentIntent,
  saveProviderGrant,
  saveProviderGrantInTransaction,
  type ProviderGrant,
  type ProviderGrantSaveResult,
} from './entitlement-reconciliation.ts';
import {
  stripeAuthoritativeSnapshotContext,
  stripeProviderEventOrder,
  type ProviderEventContext,
} from './stripe-event-order.ts';

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
  if (!stripeInstance) stripeInstance = new Stripe(secret, {
    maxNetworkRetries: 1,
    timeout: 10_000,
  });
  return stripeInstance;
}

export function webBillingConfigured() {
  return Boolean(
    process.env.WHAT_BIN_ENABLE_WEB_PAYMENTS === 'true'
    && binDatabaseConfigured()
    && process.env.STRIPE_SECRET_KEY?.trim()
    && process.env.STRIPE_WEBHOOK_SECRET?.trim(),
  );
}

export function webBillingLive() {
  return process.env.WHAT_BIN_ENABLE_WEB_PAYMENTS === 'true'
    && process.env.STRIPE_SECRET_KEY?.trim().startsWith('sk_live_') === true;
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
  // Choosing a plan records only a short-lived, checkout-bound intent. The
  // suppression remains until Stripe verifies successful completion.
  await recordWhatBinReEnrolmentIntent(user.id, 'stripe', session.id);
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
    || status === 'refunded'
    || status === 'revoked'
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
  providerEventOrder,
  reEnrolmentKey,
  persistAccepted,
  transaction,
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
  providerEventOrder?: number;
  reEnrolmentKey?: string;
  persistAccepted?: (transaction: postgres.TransactionSql) => Promise<void>;
  transaction?: postgres.TransactionSql;
}) {
  const grant: ProviderGrant = {
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
    providerEventOrder,
    reEnrolmentKey,
  };
  return transaction
    ? saveProviderGrantInTransaction(transaction, grant, persistAccepted)
    : saveProviderGrant(grant, persistAccepted);
}

async function saveCompletedCheckout(
  session: Stripe.Checkout.Session,
  context: ProviderEventContext,
  transaction: postgres.TransactionSql,
) {
  const planId = planFromMetadata(session.metadata);
  const customer = customerId(session.customer);
  const userId = binUserIdFromMetadata(session.metadata) ?? session.client_reference_id ?? undefined;
  if (
    !planId
    || !customer
    || !userId
    || !/^[0-9a-f-]{36}$/i.test(userId)
  ) throw new Error('The completed checkout is missing its account identity.');
  const plan = webSupporterPlans[planId];
  const subscription = subscriptionId(session.subscription);
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return;
  let status = 'active';
  let currentPeriodEnd: string | null = null;
  if (plan.mode === 'subscription') {
    if (!subscription) throw new Error('The completed subscription checkout has no subscription.');
    const currentSubscription = typeof session.subscription === 'object' && session.subscription
      ? session.subscription
      : await stripeClient().subscriptions.retrieve(subscription);
    status = currentSubscription.status;
    currentPeriodEnd = subscriptionPeriodEnd(currentSubscription);
    if (!currentPeriodEnd && ['active', 'trialing', 'past_due'].includes(status)) {
      throw new Error('Stripe did not provide a verified subscription period end.');
    }
  }
  return saveStripeEntitlement({
    userId,
    planId,
    status,
    customer,
    subscription,
    currentPeriodEnd,
    externalKey: subscription ? `subscription:${subscription}` : `checkout:${session.id}`,
    providerEventAt: context.occurredAt,
    providerEventId: context.eventId,
    providerEventOrder: context.providerEventOrder,
    reEnrolmentKey: session.id,
    transaction,
    persistAccepted: async (transaction) => {
      await transaction`
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
    },
  });
}

async function saveSubscription(
  subscription: Stripe.Subscription,
  context: ProviderEventContext,
  transaction: postgres.TransactionSql,
) {
  const customer = customerId(subscription.customer);
  if (!customer) throw new Error('The subscription is missing its customer.');
  const metadataPlan = planFromMetadata(subscription.metadata);
  let userId = binUserIdFromMetadata(subscription.metadata);
  if (!userId) {
    const existing = await transaction<{ user_id: string | null; plan_id: WebSupporterPlanId }[]>`
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
    return saveStripeEntitlement({
      userId,
      planId: metadataPlan,
      status: subscription.status,
      customer,
      subscription: subscription.id,
      currentPeriodEnd: subscriptionPeriodEnd(subscription),
      externalKey: `subscription:${subscription.id}`,
      providerEventAt: context.occurredAt,
      providerEventId: context.eventId,
      providerEventOrder: context.providerEventOrder,
      transaction,
      persistAccepted: async (transaction) => {
        await transaction`
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
      },
    });
  }
  const supporters = await transaction<{
    user_id: string | null;
    plan_id: WebSupporterPlanId;
    stripe_customer_id: string;
  }[]>`
    SELECT user_id, plan_id, stripe_customer_id
    FROM bin_supporters
    WHERE stripe_customer_id = ${customer}
    LIMIT 1
    FOR UPDATE
  `;
  const supporter = supporters[0];
  if (supporter?.user_id && isWebSupporterPlanId(supporter.plan_id)) {
    return saveStripeEntitlement({
      userId: supporter.user_id,
      planId: supporter.plan_id,
      status: subscription.status,
      customer: supporter.stripe_customer_id,
      subscription: subscription.id,
      currentPeriodEnd: subscriptionPeriodEnd(subscription),
      externalKey: `subscription:${subscription.id}`,
      providerEventAt: context.occurredAt,
      providerEventId: context.eventId,
      providerEventOrder: context.providerEventOrder,
      transaction,
      persistAccepted: async (acceptedTransaction) => {
        await acceptedTransaction`
          UPDATE bin_supporters SET
            stripe_subscription_id = ${subscription.id},
            status = ${subscription.status},
            current_period_end = ${subscriptionPeriodEnd(subscription)},
            cancelled_at = ${subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null},
            updated_at = now()
          WHERE stripe_customer_id = ${customer}
        `;
      },
    });
  }
  if (supporter) {
    await transaction`
      UPDATE bin_supporters SET
        stripe_subscription_id = ${subscription.id},
        status = ${subscription.status},
        current_period_end = ${subscriptionPeriodEnd(subscription)},
        cancelled_at = ${subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null},
        updated_at = now()
      WHERE stripe_customer_id = ${customer}
        AND user_id IS NULL
    `;
  }
  return undefined;
}

async function markSupporterStatus(
  customer: string | undefined,
  subscription: string | undefined,
  status: string,
  context: ProviderEventContext,
  transaction: postgres.TransactionSql,
) {
  if (!customer && !subscription) return;
  const supporters = await transaction<{
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
    FOR UPDATE
  `;
  const supporter = supporters[0];
  if (supporter?.user_id && isWebSupporterPlanId(supporter.plan_id)) {
    const externalKey = supporter.stripe_subscription_id
      ? `subscription:${supporter.stripe_subscription_id}`
      : `legacy-customer:${supporter.stripe_customer_id}`;
    return saveStripeEntitlement({
      userId: supporter.user_id,
      planId: supporter.plan_id,
      status,
      customer: supporter.stripe_customer_id,
      subscription: supporter.stripe_subscription_id ?? undefined,
      currentPeriodEnd: supporter.current_period_end,
      externalKey,
      providerEventAt: context.occurredAt,
      providerEventId: context.eventId,
      providerEventOrder: context.providerEventOrder,
      transaction,
      persistAccepted: async (acceptedTransaction) => {
        await acceptedTransaction`
          UPDATE bin_supporters SET status = ${status}, updated_at = now()
          WHERE (${customer ?? null}::text IS NOT NULL AND stripe_customer_id = ${customer ?? null})
             OR (${subscription ?? null}::text IS NOT NULL AND stripe_subscription_id = ${subscription ?? null})
        `;
      },
    });
  }
  if (supporter) {
    await transaction`
      UPDATE bin_supporters SET status = ${status}, updated_at = now()
      WHERE user_id IS NULL
        AND (
          (${customer ?? null}::text IS NOT NULL AND stripe_customer_id = ${customer ?? null})
          OR (${subscription ?? null}::text IS NOT NULL AND stripe_subscription_id = ${subscription ?? null})
        )
    `;
  }
  return undefined;
}

function refundPaymentIntentId(refund: Stripe.Refund) {
  return typeof refund.payment_intent === 'string'
    ? refund.payment_intent
    : refund.payment_intent?.id;
}

async function reconcileLifetimeRefund(
  refund: Stripe.Refund,
  context: ProviderEventContext,
  transaction: postgres.TransactionSql,
) {
  if (!['succeeded', 'failed', 'canceled'].includes(refund.status ?? '')) return undefined;
  const paymentIntentId = refundPaymentIntentId(refund);
  if (!paymentIntentId) return undefined;
  const [paymentIntent, refunds] = await Promise.all([
    stripeClient().paymentIntents.retrieve(paymentIntentId),
    stripeClient().refunds.list({ payment_intent: paymentIntentId, limit: 100 }),
  ]);
  if (refunds.has_more) {
    throw new Error('Stripe returned an incomplete refund ledger.');
  }
  const planId = planFromMetadata(paymentIntent.metadata);
  const userId = binUserIdFromMetadata(paymentIntent.metadata);
  const customer = customerId(paymentIntent.customer);
  if (paymentIntent.metadata.channel !== 'web' || planId !== 'plus-lifetime') return undefined;
  if (!userId || !customer) throw new Error('The Stripe refund is missing its account identity.');
  const status = refunds.data.some((candidate) => candidate.status === 'succeeded')
    ? 'refunded'
    : refund.status === 'failed' || refund.status === 'canceled'
      ? 'active'
      : undefined;
  if (!status) return undefined;
  const snapshotContext = stripeAuthoritativeSnapshotContext(
    context,
    'refund.snapshot',
    status,
  );
  const supporters = await transaction<{
    user_id: string | null;
    checkout_session_id: string | null;
  }[]>`
    SELECT user_id, checkout_session_id
    FROM bin_supporters
    WHERE stripe_customer_id = ${customer}
      AND plan_id = 'plus-lifetime'
      AND billing_mode = 'payment'
    LIMIT 1
    FOR UPDATE
  `;
  const supporter = supporters[0];
  if (!supporter?.checkout_session_id) {
    throw new Error('The refunded lifetime purchase has no retained provider ledger.');
  }
  if (supporter.user_id && supporter.user_id !== userId) {
    throw new Error('The refunded lifetime purchase does not match its account.');
  }
  if (!supporter.user_id) {
    await transaction`
      UPDATE bin_supporters
      SET status = ${status}, updated_at = now()
      WHERE stripe_customer_id = ${customer}
        AND user_id IS NULL
    `;
    const suppression = await transaction`
      SELECT user_id
      FROM bin_account_removal_suppressions
      WHERE user_id = ${userId}::uuid
      LIMIT 1
    `;
    return suppression.length > 0 ? 'suppressed' as const : undefined;
  }
  return saveStripeEntitlement({
    userId,
    planId,
    status,
    customer,
    externalKey: `checkout:${supporter.checkout_session_id}`,
    providerEventAt: snapshotContext.occurredAt,
    providerEventId: snapshotContext.eventId,
    providerEventOrder: snapshotContext.providerEventOrder,
    transaction,
    persistAccepted: async (acceptedTransaction) => {
      await acceptedTransaction`
        UPDATE bin_supporters
        SET status = ${status}, updated_at = now()
        WHERE stripe_customer_id = ${customer}
      `;
    },
  });
}

export function constructStripeEvent(body: string, signature: string | null) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret || !signature) throw new Error('The Stripe webhook signature is missing.');
  return stripeClient().webhooks.constructEvent(body, signature, webhookSecret);
}

const terminalStripeEventOutcomes = new Set(['ignored', 'processed', 'suppressed']);

async function markStripeEventFailed(event: Stripe.Event) {
  const sql = binDatabase();
  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${'stripe:' + event.id}))`;
    const existing = await transaction<{ outcome: string }[]>`
      SELECT outcome
      FROM bin_payment_events
      WHERE stripe_event_id = ${event.id}
      FOR UPDATE
    `;
    if (existing[0] && terminalStripeEventOutcomes.has(existing[0].outcome)) return;
    await transaction`
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
        'failed',
        to_timestamp(${event.created})
      )
      ON CONFLICT (stripe_event_id) DO UPDATE SET
        outcome = 'failed'
    `;
  });
}

export async function processStripeEvent(event: Stripe.Event) {
  const sql = binDatabase();
  const eventObjectStatus = typeof Reflect.get(event.data.object, 'status') === 'string'
    ? Reflect.get(event.data.object, 'status') as string
    : undefined;
  const context = {
    occurredAt: new Date(event.created * 1000).toISOString(),
    eventId: event.id,
    providerEventOrder: stripeProviderEventOrder(event.type, eventObjectStatus),
  };
  try {
    const bulkyBookingEvent = await import('./bulky-bookings.ts')
      .then(({ processBulkyBookingStripeEvent }) => processBulkyBookingStripeEvent(event));
    return await sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(hashtext(${'stripe:' + event.id}))`;
      const existing = await transaction<{ outcome: string }[]>`
        SELECT outcome
        FROM bin_payment_events
        WHERE stripe_event_id = ${event.id}
        FOR UPDATE
      `;
      if (existing[0] && terminalStripeEventOutcomes.has(existing[0].outcome)) return false;
      await transaction`
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
        ON CONFLICT (stripe_event_id) DO UPDATE SET
          event_type = excluded.event_type,
          livemode = excluded.livemode,
          outcome = 'received',
          occurred_at = excluded.occurred_at
      `;

      let customer: string | undefined;
      let subscription: string | undefined;
      let planId: WebSupporterPlanId | undefined;
      let grantResult: ProviderGrantSaveResult | undefined;
      if (bulkyBookingEvent) {
        // The bulky-booking processor has its own state-machine idempotency.
      } else if (
        event.type === 'checkout.session.completed'
        || event.type === 'checkout.session.async_payment_succeeded'
        || event.type === 'checkout.session.async_payment_failed'
      ) {
        const webhookSession = event.data.object;
        const session = await stripeClient().checkout.sessions.retrieve(webhookSession.id, {
          expand: ['subscription'],
        });
        customer = customerId(session.customer);
        subscription = subscriptionId(session.subscription);
        planId = planFromMetadata(session.metadata);
        const subscriptionStatus = typeof session.subscription === 'object' && session.subscription
          ? session.subscription.status
          : undefined;
        if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
          grantResult = await saveCompletedCheckout(
            session,
            stripeAuthoritativeSnapshotContext(
              context,
              subscriptionStatus ? 'subscription.snapshot' : 'checkout.snapshot',
              subscriptionStatus ?? 'active',
            ),
            transaction,
          );
        } else if (event.type === 'checkout.session.async_payment_failed') {
          grantResult = await markSupporterStatus(
            customer,
            subscription,
            'payment_failed',
            stripeAuthoritativeSnapshotContext(
              context,
              'checkout.snapshot',
              'payment_failed',
            ),
            transaction,
          );
        }
      } else if (
        event.type === 'customer.subscription.created'
        || event.type === 'customer.subscription.updated'
        || event.type === 'customer.subscription.deleted'
      ) {
        const webhookSubscription = event.data.object;
        const record = await stripeClient().subscriptions.retrieve(webhookSubscription.id);
        customer = customerId(record.customer);
        subscription = record.id;
        planId = planFromMetadata(record.metadata);
        grantResult = await saveSubscription(
          record,
          stripeAuthoritativeSnapshotContext(
            context,
            'subscription.snapshot',
            record.status,
          ),
          transaction,
        );
      } else if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object;
        subscription = typeof invoice.parent?.subscription_details?.subscription === 'string'
          ? invoice.parent.subscription_details.subscription
          : invoice.parent?.subscription_details?.subscription?.id;
        if (!subscription) throw new Error('The failed subscription invoice has no subscription.');
        const record = await stripeClient().subscriptions.retrieve(subscription);
        customer = customerId(record.customer);
        planId = planFromMetadata(record.metadata);
        grantResult = await saveSubscription(
          record,
          stripeAuthoritativeSnapshotContext(
            context,
            'subscription.snapshot',
            record.status,
          ),
          transaction,
        );
      } else if (
        event.type === 'refund.created'
        || event.type === 'refund.updated'
        || event.type === 'refund.failed'
      ) {
        grantResult = await reconcileLifetimeRefund(event.data.object, context, transaction);
      }
      await transaction`
        UPDATE bin_payment_events SET
          stripe_customer_id = ${customer ?? null},
          stripe_subscription_id = ${subscription ?? null},
          plan_id = ${planId ?? null},
          outcome = ${grantResult === 'suppressed' ? 'suppressed' : 'processed'}
        WHERE stripe_event_id = ${event.id}
      `;
      return true;
    });
  } catch (error) {
    await markStripeEventFailed(event).catch(() => undefined);
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
  if (binUserIdFromMetadata(session.metadata) !== userId && session.client_reference_id !== userId) {
    throw new Error('The supporter payment does not match this account.');
  }
  const subscription = subscriptionId(session.subscription);
  const externalKey = subscription ? `subscription:${subscription}` : `checkout:${session.id}`;
  const sql = binDatabase();
  const grants = await sql<ProviderGrantRow[]>`
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
      AND source = 'stripe'
      AND external_key = ${externalKey}
    LIMIT 1
  `;
  if (!grants[0] || !providerGrantIsActive(grants[0])) {
    throw new Error('The verified Stripe webhook has not activated this purchase yet.');
  }
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

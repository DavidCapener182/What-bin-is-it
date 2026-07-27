import { timingSafeEqual } from 'node:crypto';

import { binDatabase, binDatabaseConfigured } from './bin-database';
import { saveProviderGrant } from './entitlement-reconciliation';

type RevenueCatEvent = {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  original_app_user_id?: unknown;
  aliases?: unknown;
  product_id?: unknown;
  entitlement_ids?: unknown;
  store?: unknown;
  environment?: unknown;
  event_timestamp_ms?: unknown;
  expiration_at_ms?: unknown;
  grace_period_expiration_at_ms?: unknown;
  original_transaction_id?: unknown;
  cancel_reason?: unknown;
};

type RevenueCatEnvelope = {
  api_version?: unknown;
  event?: RevenueCatEvent;
};

function sameSecret(expected: string, supplied: string) {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function revenueCatWebhookConfigured() {
  return Boolean(binDatabaseConfigured() && process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN?.trim());
}

export function verifyRevenueCatWebhook(request: Request) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN?.trim();
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!expected || !supplied || !sameSecret(expected, supplied)) {
    throw new Error('The native billing webhook was not authenticated.');
  }
}

function productPlan(productId: string) {
  if (productId.includes('lifetime')) return 'plus-lifetime';
  if (productId.includes('yearly') || productId.includes('annual')) return 'plus-yearly';
  return 'plus-monthly';
}

function eventStatus(type: string, expiration?: string, graceExpiration?: string) {
  if (type === 'EXPIRATION') return 'expired';
  if (type === 'CANCELLATION') return 'canceled';
  if (type === 'SUBSCRIPTION_PAUSED') return 'canceled';
  if (type === 'BILLING_ISSUE') {
    return graceExpiration || expiration ? 'grace' : 'past_due';
  }
  return 'active';
}

function isoFromMilliseconds(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function sourceFromStore(store: string) {
  return store === 'APP_STORE' || store === 'MAC_APP_STORE' ? 'apple' : 'google';
}

function uuidFromIdentity(event: RevenueCatEvent) {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
  ];
  return candidates.find(
    (value): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value),
  );
}

function laterDate(left?: string, right?: string) {
  if (!left) return right;
  if (!right) return left;
  return new Date(left) > new Date(right) ? left : right;
}

function allowedStore(store: string) {
  return store === 'APP_STORE' || store === 'MAC_APP_STORE' || store === 'PLAY_STORE';
}

function allowedEnvironment(environment: string) {
  return environment === 'PRODUCTION'
    || (
      environment === 'SANDBOX'
      && process.env.ALLOW_REVENUECAT_SANDBOX_ENTITLEMENTS === 'true'
    );
}

const lifecycleEvents = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'CANCELLATION',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'EXPIRATION',
  'REFUND_REVERSED',
]);

export async function processRevenueCatWebhook(payload: RevenueCatEnvelope) {
  const event = payload.event;
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') {
    throw new Error('The native billing event is incomplete.');
  }
  const eventId = event.id.slice(0, 255);
  const eventType = event.type.slice(0, 80);
  const userId = uuidFromIdentity(event);
  const productId = typeof event.product_id === 'string' ? event.product_id.slice(0, 160) : undefined;
  const store = typeof event.store === 'string' ? event.store.slice(0, 40) : undefined;
  const environment = typeof event.environment === 'string' ? event.environment.slice(0, 24) : undefined;
  const occurredAt = isoFromMilliseconds(event.event_timestamp_ms) ?? new Date().toISOString();
  const expiration = isoFromMilliseconds(event.expiration_at_ms);
  const graceExpiration = isoFromMilliseconds(event.grace_period_expiration_at_ms);
  const currentPeriodEnd = laterDate(expiration, graceExpiration);
  const originalTransactionId = typeof event.original_transaction_id === 'string'
    ? event.original_transaction_id.slice(0, 255)
    : undefined;
  const entitlements = Array.isArray(event.entitlement_ids) ? event.entitlement_ids : [];
  const plusEvent = entitlements.includes('plus') || eventType === 'EXPIRATION' || eventType === 'CANCELLATION';
  const processable = Boolean(
    lifecycleEvents.has(eventType)
    && userId
    && productId
    && store
    && allowedStore(store)
    && environment
    && allowedEnvironment(environment)
    && originalTransactionId
    && plusEvent,
  );
  const sql = binDatabase();
  const inserted = await sql`
    INSERT INTO bin_revenuecat_events (
      revenuecat_event_id,
      event_type,
      user_id,
      product_id,
      store,
      environment,
      outcome,
      occurred_at
    ) VALUES (
      ${eventId},
      ${eventType},
      ${userId ?? null},
      ${productId ?? null},
      ${store ?? null},
      ${environment ?? null},
      ${processable ? 'received' : 'ignored'},
      ${occurredAt}
    )
    ON CONFLICT (revenuecat_event_id) DO NOTHING
    RETURNING revenuecat_event_id
  `;
  if (!inserted.length) return false;
  if (!processable || !userId || !productId || !store || !originalTransactionId) return true;

  const planId = productPlan(productId);
  const status = eventStatus(eventType, expiration, graceExpiration);
  await saveProviderGrant({
    userId,
    planId,
    source: sourceFromStore(store),
    status,
    productId,
    currentPeriodEnd,
    externalKey: originalTransactionId,
    providerEventAt: occurredAt,
    providerEventId: eventId,
  });
  await sql`
    UPDATE bin_revenuecat_events
    SET outcome = 'processed'
    WHERE revenuecat_event_id = ${eventId}
  `;
  return true;
}

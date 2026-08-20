import { timingSafeEqual } from 'node:crypto';
import type postgres from 'postgres';

import { binDatabase, binDatabaseConfigured } from './bin-database.ts';
import {
  reconcileUserEntitlementInTransaction,
  saveProviderGrantInTransaction,
  whatBinReEnrolmentIntentKey,
} from './entitlement-reconciliation.ts';

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
  transferred_from?: unknown;
  transferred_to?: unknown;
};

function sameSecret(expected: string, supplied: string) {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function revenueCatWebhookConfigured() {
  return Boolean(
    process.env.WHAT_BIN_ENABLE_NATIVE_PLUS_WEBHOOKS === 'true'
    && binDatabaseConfigured()
    && process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN?.trim(),
  );
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

export function revenueCatEventStatus(
  type: string,
  expiration?: string,
  graceExpiration?: string,
  cancelReason?: string,
) {
  if (type === 'CANCELLATION' && cancelReason === 'CUSTOMER_SUPPORT') return 'refunded';
  if (type === 'REFUND_REVERSED') return 'active';
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidFromIdentity(event: RevenueCatEvent) {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
  ];
  return candidates.find(
    (value): value is string => typeof value === 'string' && uuidPattern.test(value),
  );
}

function uniqueUuids(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (candidate): candidate is string => typeof candidate === 'string' && uuidPattern.test(candidate),
  ).map((candidate) => candidate.toLowerCase()))].sort();
}

export function revenueCatTransferIdentities(event: RevenueCatEvent) {
  const destinations = uniqueUuids(event.transferred_to);
  const destinationUserId = destinations.length === 1 ? destinations[0] : undefined;
  const sourceUserIds = uniqueUuids(event.transferred_from)
    .filter((userId) => userId !== destinationUserId);
  return { destinationUserId, sourceUserIds };
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

export function revenueCatProviderEventOrder(type: string, cancelReason?: string) {
  if (type === 'REFUND_REVERSED' || type === 'UNCANCELLATION') return 800;
  if (type === 'EXPIRATION') return 700;
  if (type === 'CANCELLATION' && cancelReason === 'CUSTOMER_SUPPORT') return 650;
  if (type === 'SUBSCRIPTION_PAUSED') return 600;
  if (type === 'CANCELLATION') return 550;
  if (type === 'BILLING_ISSUE') return 500;
  if (type === 'SUBSCRIPTION_EXTENDED' || type === 'PRODUCT_CHANGE') return 400;
  if (type === 'RENEWAL') return 300;
  return 200;
}

const terminalRevenueCatOutcomes = new Set([
  'ignored',
  'processed',
  'suppressed',
]);

async function processRevenueCatTransferInTransaction({
  transaction,
  event,
  eventId,
  occurredAt,
}: {
  transaction: postgres.TransactionSql;
  event: RevenueCatEvent;
  eventId: string;
  occurredAt: string;
}) {
  const { destinationUserId, sourceUserIds } = revenueCatTransferIdentities(event);
  if (!destinationUserId) return 'ignored' as const;

  const lockedUsers = [...new Set([...sourceUserIds, destinationUserId])].sort();
  for (const userId of lockedUsers) {
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
  }
  await transaction`
    DELETE FROM bin_account_re_enrolment_intents
    WHERE user_id = ${destinationUserId}::uuid
      AND expires_at <= now()
  `;
  const suppressions = await transaction<{ user_id: string }[]>`
    SELECT user_id
    FROM bin_account_removal_suppressions
    WHERE user_id = ANY(${lockedUsers}::uuid[])
    ORDER BY user_id
    FOR UPDATE
  `;
  const destinationSuppressed = suppressions.some((row) => row.user_id === destinationUserId);
  let destinationAccepted = !destinationSuppressed;
  if (destinationSuppressed) {
    const intentKey = whatBinReEnrolmentIntentKey('native', 'native');
    const intents = await transaction`
      SELECT intent_key
      FROM bin_account_re_enrolment_intents
      WHERE user_id = ${destinationUserId}::uuid
        AND source = 'native'
        AND intent_key = ${intentKey}
        AND expires_at > now()
        AND requested_at <= ${occurredAt}::timestamptz
      LIMIT 1
      FOR UPDATE
    `;
    destinationAccepted = intents.length > 0;
    if (destinationAccepted) {
      await transaction`
        DELETE FROM bin_account_removal_suppressions
        WHERE user_id = ${destinationUserId}::uuid
      `;
    }
  }

  if (sourceUserIds.length > 0) {
    if (destinationAccepted) {
      await transaction`
        UPDATE bin_entitlement_grants
        SET
          user_id = ${destinationUserId}::uuid,
          provider_event_at = ${occurredAt}::timestamptz,
          provider_event_id = ${eventId},
          provider_event_order = 900,
          updated_at = now()
        WHERE user_id = ANY(${sourceUserIds}::uuid[])
          AND source IN ('apple', 'google')
          AND (
            provider_event_at < ${occurredAt}::timestamptz
            OR (
              provider_event_at = ${occurredAt}::timestamptz
              AND provider_event_order < 900
            )
          )
      `;
    } else {
      // RevenueCat has already revoked the source aliases. Do not retain stale
      // local access when the removed destination has not explicitly re-enrolled.
      await transaction`
        DELETE FROM bin_entitlement_grants
        WHERE user_id = ANY(${sourceUserIds}::uuid[])
          AND source IN ('apple', 'google')
      `;
    }
  }

  for (const sourceUserId of sourceUserIds) {
    await reconcileUserEntitlementInTransaction(transaction, sourceUserId);
  }
  if (destinationAccepted) {
    await reconcileUserEntitlementInTransaction(transaction, destinationUserId);
    await transaction`
      UPDATE bin_revenuecat_events
      SET user_id = ${destinationUserId}::uuid
      WHERE revenuecat_event_id = ${eventId}
    `;
  }
  return destinationAccepted ? 'processed' as const : 'suppressed' as const;
}

async function markRevenueCatEventFailed({
  eventId,
  eventType,
  productId,
  store,
  environment,
  occurredAt,
}: {
  eventId: string;
  eventType: string;
  productId?: string;
  store?: string;
  environment?: string;
  occurredAt: string;
}) {
  const sql = binDatabase();
  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${'revenuecat:' + eventId}))`;
    const existing = await transaction<{ outcome: string }[]>`
      SELECT outcome
      FROM bin_revenuecat_events
      WHERE revenuecat_event_id = ${eventId}
      FOR UPDATE
    `;
    if (existing[0] && terminalRevenueCatOutcomes.has(existing[0].outcome)) return;
    await transaction`
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
        null,
        ${productId ?? null},
        ${store ?? null},
        ${environment ?? null},
        'failed',
        ${occurredAt}
      )
      ON CONFLICT (revenuecat_event_id) DO UPDATE SET
        outcome = 'failed'
    `;
  });
}

export async function processRevenueCatWebhook(payload: unknown) {
  const event = payload && typeof payload === 'object'
    ? Reflect.get(payload, 'event') as RevenueCatEvent | undefined
    : undefined;
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
  const transferProcessable = eventType === 'TRANSFER'
    && Boolean(environment && allowedEnvironment(environment));
  const finalNonGrantOutcome = transferProcessable ? 'received' : 'ignored';
  try {
    return await sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(hashtext(${'revenuecat:' + eventId}))`;
      const existing = await transaction<{ outcome: string }[]>`
        SELECT outcome
        FROM bin_revenuecat_events
        WHERE revenuecat_event_id = ${eventId}
        FOR UPDATE
      `;
      if (existing[0] && terminalRevenueCatOutcomes.has(existing[0].outcome)) return false;
      await transaction`
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
          null,
          ${productId ?? null},
          ${store ?? null},
          ${environment ?? null},
          ${processable ? 'received' : finalNonGrantOutcome},
          ${occurredAt}
        )
        ON CONFLICT (revenuecat_event_id) DO UPDATE SET
          event_type = excluded.event_type,
          user_id = null,
          product_id = excluded.product_id,
          store = excluded.store,
          environment = excluded.environment,
          outcome = excluded.outcome,
          occurred_at = excluded.occurred_at
      `;
      if (transferProcessable) {
        const transferOutcome = await processRevenueCatTransferInTransaction({
          transaction,
          event,
          eventId,
          occurredAt,
        });
        await transaction`
          UPDATE bin_revenuecat_events
          SET outcome = ${transferOutcome}
          WHERE revenuecat_event_id = ${eventId}
        `;
        return true;
      }
      if (!processable || !userId || !productId || !store || !originalTransactionId) return true;

      const planId = productPlan(productId);
      let status = revenueCatEventStatus(
        eventType,
        expiration,
        graceExpiration,
        typeof event.cancel_reason === 'string' ? event.cancel_reason : undefined,
      );
      if (
        planId !== 'plus-lifetime'
        && ['active', 'trialing', 'past_due', 'grace'].includes(status)
        && currentPeriodEnd
        && new Date(currentPeriodEnd) <= new Date()
      ) status = 'expired';
      const grantResult = await saveProviderGrantInTransaction(
        transaction,
        {
          userId,
          planId,
          source: sourceFromStore(store),
          status,
          productId,
          currentPeriodEnd,
          externalKey: originalTransactionId,
          providerEventAt: occurredAt,
          providerEventId: eventId,
          providerEventOrder: revenueCatProviderEventOrder(
            eventType,
            typeof event.cancel_reason === 'string' ? event.cancel_reason : undefined,
          ),
        },
        async (acceptedTransaction) => {
          await acceptedTransaction`
            UPDATE bin_revenuecat_events
            SET user_id = ${userId}::uuid
            WHERE revenuecat_event_id = ${eventId}
          `;
        },
      );
      await transaction`
        UPDATE bin_revenuecat_events
        SET outcome = ${grantResult === 'suppressed' ? 'suppressed' : 'processed'}
        WHERE revenuecat_event_id = ${eventId}
      `;
      return true;
    });
  } catch (error) {
    await markRevenueCatEventFailed({
      eventId,
      eventType,
      productId,
      store,
      environment,
      occurredAt,
    }).catch(() => undefined);
    throw error;
  }
}

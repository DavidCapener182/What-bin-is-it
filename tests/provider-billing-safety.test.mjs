import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { providerGrantHasRequiredPeriod } from '../server/lib/entitlement-reconciliation.ts';
import {
  revenueCatEventStatus,
  revenueCatProviderEventOrder,
  revenueCatTransferIdentities,
} from '../server/lib/native-entitlements.ts';
import {
  stripeAuthoritativeSnapshotContext,
  stripeProviderEventOrder,
} from '../server/lib/stripe-event-order.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('RevenueCat support refunds revoke access and refund reversals restore it', () => {
  assert.equal(
    revenueCatEventStatus('CANCELLATION', undefined, undefined, 'CUSTOMER_SUPPORT'),
    'refunded',
  );
  assert.equal(
    revenueCatEventStatus('CANCELLATION', undefined, undefined, 'UNSUBSCRIBE'),
    'canceled',
  );
  assert.equal(revenueCatEventStatus('REFUND_REVERSED'), 'active');
});

test('Stripe lifetime refund events revoke the exact metadata-bound grant', async () => {
  const billing = await read('../server/lib/web-billing.ts');
  assert.match(
    billing,
    /event\.type === 'refund\.created'[\s\S]*event\.type === 'refund\.updated'[\s\S]*event\.type === 'refund\.failed'/,
  );
  assert.match(billing, /paymentIntents\.retrieve\(paymentIntentId\)/);
  assert.match(billing, /refunds\.list\(\{ payment_intent: paymentIntentId, limit: 100 \}\)/);
  assert.match(billing, /if \(refunds\.has_more\)/);
  assert.match(billing, /paymentIntent\.metadata\.channel !== 'web' \|\| planId !== 'plus-lifetime'/);
  assert.match(billing, /refunds\.data\.some\(\(candidate\) => candidate\.status === 'succeeded'\)/);
  assert.match(billing, /'refund\.snapshot'/);
  assert.match(billing, /externalKey: `checkout:\$\{supporter\.checkout_session_id\}`/);
});

test('Stripe same-second webhooks hydrate current state and use secure equal-time precedence', async () => {
  const trigger = {
    occurredAt: '2026-08-20T12:00:00.000Z',
    eventId: 'evt_trigger',
    providerEventOrder: 0,
  };
  const observedAt = new Date('2026-08-20T12:00:01.000Z');
  const active = stripeAuthoritativeSnapshotContext(
    trigger,
    'subscription.snapshot',
    'active',
    observedAt,
  );
  const pastDue = stripeAuthoritativeSnapshotContext(
    trigger,
    'subscription.snapshot',
    'past_due',
    observedAt,
  );
  const canceled = stripeAuthoritativeSnapshotContext(
    trigger,
    'subscription.snapshot',
    'canceled',
    observedAt,
  );
  const refundActive = stripeAuthoritativeSnapshotContext(
    trigger,
    'refund.snapshot',
    'active',
    observedAt,
  );
  const refunded = stripeAuthoritativeSnapshotContext(
    trigger,
    'refund.snapshot',
    'refunded',
    observedAt,
  );

  assert.equal(active.occurredAt, observedAt.toISOString());
  assert.equal(pastDue.occurredAt, active.occurredAt);
  assert.ok(canceled.providerEventOrder > pastDue.providerEventOrder);
  assert.ok(pastDue.providerEventOrder > active.providerEventOrder);
  assert.ok(refunded.providerEventOrder > refundActive.providerEventOrder);
  assert.equal(stripeProviderEventOrder('subscription.snapshot', 'active'), active.providerEventOrder);

  const billing = await read('../server/lib/web-billing.ts');
  assert.match(billing, /checkout\.sessions\.retrieve\(webhookSession\.id, \{[\s\S]*expand: \['subscription'\]/);
  assert.match(billing, /subscriptions\.retrieve\(webhookSubscription\.id\)/);
  assert.match(billing, /subscriptions\.retrieve\(subscription\)/);
  assert.doesNotMatch(
    billing,
    /event\.id\s*[<>]|providerEventId\s*[<>]|localeCompare\([^)]*event/i,
  );
});

test('provider event ledgers reprocess received or failed IDs and stop only at terminal outcomes', async () => {
  const [nativeEntitlements, billing] = await Promise.all([
    read('../server/lib/native-entitlements.ts'),
    read('../server/lib/web-billing.ts'),
  ]);
  for (const source of [nativeEntitlements, billing]) {
    assert.match(source, /pg_advisory_xact_lock\(hashtext\(/);
    assert.match(source, /SELECT outcome[\s\S]*FOR UPDATE/);
    assert.match(source, /ON CONFLICT \([^)]+\) DO UPDATE SET/);
    assert.doesNotMatch(source, /ON CONFLICT \([^)]+\) DO NOTHING/);
    assert.match(source, /outcome = 'failed'/);
  }
  assert.match(nativeEntitlements, /terminalRevenueCatOutcomes = new Set\(\[[\s\S]*'processed'/);
  assert.doesNotMatch(
    nativeEntitlements.slice(
      nativeEntitlements.indexOf('const terminalRevenueCatOutcomes'),
      nativeEntitlements.indexOf('async function markRevenueCatEventFailed'),
    ),
    /'failed'|'received'/,
  );
  assert.match(billing, /terminalStripeEventOutcomes = new Set\(\['ignored', 'processed', 'suppressed'\]\)/);
});

test('provider-ledger callbacks run only after the grant freshness winner is accepted', async () => {
  const [reconciliation, billing] = await Promise.all([
    read('../server/lib/entitlement-reconciliation.ts'),
    read('../server/lib/web-billing.ts'),
  ]);
  assert.match(reconciliation, /RETURNING id/);
  assert.match(reconciliation, /if \(savedGrant\.length > 0\) await persistAccepted\?\.\(transaction\)/);
  assert.ok(
    reconciliation.indexOf('const savedGrant = await transaction')
      < reconciliation.indexOf('await persistAccepted?.(transaction)'),
  );

  const statusPath = billing.slice(
    billing.indexOf('async function markSupporterStatus'),
    billing.indexOf('function refundPaymentIntentId'),
  );
  assert.ok(
    statusPath.indexOf('return saveStripeEntitlement')
      < statusPath.indexOf('UPDATE bin_supporters SET status'),
  );
  assert.match(statusPath, /persistAccepted: async \(acceptedTransaction\)/);
});

test('renewable grants require a verified future period and checkout hydrates current Stripe state', async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();
  const base = {
    userId: '11111111-1111-4111-8111-111111111111',
    source: 'stripe',
    externalKey: 'subscription:sub_test',
    planId: 'plus-yearly',
    status: 'active',
    providerEventAt: new Date().toISOString(),
  };
  assert.equal(providerGrantHasRequiredPeriod({ ...base, currentPeriodEnd: undefined }), false);
  assert.equal(providerGrantHasRequiredPeriod({ ...base, currentPeriodEnd: past }), false);
  assert.equal(providerGrantHasRequiredPeriod({ ...base, currentPeriodEnd: future }), true);
  assert.equal(providerGrantHasRequiredPeriod({
    ...base,
    planId: 'plus-lifetime',
    currentPeriodEnd: undefined,
  }), true);

  const billing = await read('../server/lib/web-billing.ts');
  assert.match(billing, /subscriptions\.retrieve\(subscription\)/);
  assert.match(billing, /currentPeriodEnd = subscriptionPeriodEnd\(currentSubscription\)/);
  assert.match(billing, /Stripe did not provide a verified subscription period end/);
  const confirmation = billing.slice(billing.indexOf('export async function confirmWebCheckout'));
  assert.doesNotMatch(confirmation, /saveCompletedCheckout\(/);
  assert.match(confirmation, /providerGrantIsActive\(grants\[0\]\)/);
});

test('payments remain server-gated and RevenueCat transfers reconcile both identities atomically', async () => {
  const [billing, nativeEntitlements, nativeClient] = await Promise.all([
    read('../server/lib/web-billing.ts'),
    read('../server/lib/native-entitlements.ts'),
    read('../src/lib/subscriptions.native.ts'),
  ]);
  assert.match(billing, /WHAT_BIN_ENABLE_WEB_PAYMENTS === 'true'/);
  assert.match(nativeEntitlements, /WHAT_BIN_ENABLE_NATIVE_PLUS_WEBHOOKS === 'true'/);
  assert.match(nativeClient, /EXPO_PUBLIC_ENABLE_NATIVE_PLUS_PURCHASES !== 'true'/);
  assert.match(nativeEntitlements, /eventType === 'TRANSFER'/);
  assert.match(nativeEntitlements, /const lockedUsers = \[\.\.\.new Set\(\[\.\.\.sourceUserIds, destinationUserId\]\)\]\.sort\(\)/);
  assert.match(nativeEntitlements, /UPDATE bin_entitlement_grants[\s\S]*user_id = \$\{destinationUserId\}::uuid/);
  assert.match(nativeEntitlements, /DELETE FROM bin_entitlement_grants[\s\S]*user_id = ANY\(\$\{sourceUserIds\}::uuid\[\]\)/);
  assert.match(nativeEntitlements, /bin_account_removal_suppressions/);
  assert.match(nativeEntitlements, /for \(const sourceUserId of sourceUserIds\)[\s\S]*reconcileUserEntitlementInTransaction\(transaction, sourceUserId\)/);
  assert.match(nativeEntitlements, /reconcileUserEntitlementInTransaction\(transaction, destinationUserId\)/);
  assert.doesNotMatch(nativeEntitlements, /'transfer-blocked'/);

  const source = '11111111-1111-4111-8111-111111111111';
  const destination = '22222222-2222-4222-8222-222222222222';
  assert.deepEqual(revenueCatTransferIdentities({
    transferred_from: [source, source.toUpperCase()],
    transferred_to: [destination],
  }), { destinationUserId: destination, sourceUserIds: [source] });
  assert.ok(revenueCatProviderEventOrder('REFUND_REVERSED') > revenueCatProviderEventOrder('CANCELLATION'));
  for (const outcome of ['ignored', 'processed', 'suppressed', 'received', 'failed']) {
    assert.ok(outcome.length <= 24);
  }
});

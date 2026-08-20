import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('product removal creates a globally write-guarded What Bin suppression marker', async () => {
  const [migration, removal] = await Promise.all([
    read('../supabase/migrations/20260819234500_what_bin_removal_suppression.sql'),
    read('../server/lib/account-deletion.ts'),
  ]);

  assert.match(migration, /create table if not exists public\.bin_account_removal_suppressions/i);
  assert.match(migration, /user_id uuid primary key references auth\.users \(id\) on delete cascade/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.bin_account_removal_suppressions from anon, authenticated/i);
  assert.match(migration, /create table if not exists public\.bin_account_re_enrolment_intents/i);
  assert.match(migration, /primary key \(user_id, source, intent_key\)/i);
  assert.match(migration, /expires_at timestamptz not null default \(now\(\) \+ interval '30 minutes'\)/i);
  assert.match(migration, /bin_purge_expired_account_re_enrolment_intents/);
  assert.match(migration, /delete from public\.bin_account_re_enrolment_intents\s+where expires_at <= now\(\)/i);
  assert.match(migration, /bin_purge_expired_account_re_enrolment_intents\(\)[\s\S]*security definer[\s\S]*set search_path = ''/i);
  assert.match(migration, /revoke all on function public\.bin_purge_expired_account_re_enrolment_intents\(\)/i);
  const guardSource = migration.slice(
    migration.indexOf('create or replace function public.bin_guard_removed_account_references'),
    migration.indexOf('revoke all on function public.bin_guard_removed_account_references'),
  );
  assert.match(guardSource, /security invoker/i);
  assert.match(guardSource, /set search_path = ''/i);
  assert.doesNotMatch(guardSource, /security definer/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\(candidate_user::text\)\)/);

  const guardedTables = [
    'bin_user_entitlements',
    'bin_entitlement_grants',
    'bin_supporters',
    'bin_revenuecat_events',
    'bin_resident_support_threads',
    'bin_resident_support_messages',
    'bin_households',
    'bin_household_members',
    'bin_household_invites',
    'bin_household_collection_actions',
  ];
  for (const table of guardedTables) {
    assert.match(migration, new RegExp(`before insert or update on public\\.${table}`));
  }

  assert.match(removal, /INSERT INTO bin_account_removal_suppressions/);
  assert.match(removal, /DELETE FROM bin_account_re_enrolment_intents/);
  assert.match(removal, /DELETE FROM bin_resident_support_threads/);
  assert.match(removal, /DELETE FROM bin_household_invites[\s\S]*WHERE created_by = \$\{userId\}::uuid/);
  assert.match(removal, /DELETE FROM bin_households[\s\S]*WHERE owner_user_id = \$\{userId\}::uuid/);
  assert.match(removal, /DELETE FROM bin_household_members[\s\S]*WHERE user_id = \$\{userId\}::uuid/);
  assert.match(removal, /UPDATE bin_supporters[\s\S]*SET user_id = null/);
  assert.match(removal, /UPDATE bin_revenuecat_events[\s\S]*SET user_id = null/);
  assert.match(removal, /DELETE FROM bin_entitlement_grants/);
  assert.match(removal, /DELETE FROM bin_user_entitlements/);
  assert.ok(removal.indexOf('DELETE FROM bin_household_invites') < removal.indexOf('DELETE FROM bin_households'));
});

test('suppression is checked before entitlement initialization or provider persistence', async () => {
  const [reconciliation, binAuth] = await Promise.all([
    read('../server/lib/entitlement-reconciliation.ts'),
    read('../server/lib/bin-auth.ts'),
  ]);

  assert.match(reconciliation, /FROM bin_account_removal_suppressions[\s\S]*FOR UPDATE/);
  assert.ok(
    reconciliation.indexOf('FROM bin_account_removal_suppressions')
      < reconciliation.indexOf('INSERT INTO bin_entitlement_grants'),
  );
  assert.match(reconciliation, /return 'suppressed'/);
  assert.match(reconciliation, /await persistAccepted\?\.\(transaction\)/);
  assert.match(reconciliation, /DELETE FROM bin_account_removal_suppressions/);

  const getEntitlement = binAuth.slice(binAuth.indexOf('export async function getOrCreateBinEntitlement'));
  assert.match(getEntitlement, /FROM bin_account_removal_suppressions/);
  assert.match(getEntitlement, /isPlus: false/);
  assert.ok(
    getEntitlement.indexOf('FROM bin_account_removal_suppressions')
      < getEntitlement.indexOf('INSERT INTO bin_user_entitlements'),
  );
});

test('purchase intent cannot clear suppression without a verified accepted provider event', async () => {
  const [route, account, subscription, billing, reconciliation] = await Promise.all([
    read('../server/routes/api/account/re-enrol.post.ts'),
    read('../src/lib/use-account.tsx'),
    read('../src/lib/use-subscription.tsx'),
    read('../server/lib/web-billing.ts'),
    read('../server/lib/entitlement-reconciliation.ts'),
  ]);

  assert.match(route, /WHAT_BIN_RE_ENROLMENT_INTENT = 'plus-purchase-or-restore'/);
  assert.match(route, /recordWhatBinReEnrolmentIntent\(user\.id, 'native'\)/);
  assert.match(route, /headers\.get\('x-bin-confirm-re-enrol'\)/);
  assert.doesNotMatch(route, /req\.json\(/);
  assert.doesNotMatch(route, /clearWhatBinRemovalSuppression/);
  assert.match(account, /'x-bin-confirm-re-enrol': 'plus-purchase-or-restore'/);
  assert.doesNotMatch(account.slice(account.indexOf('preparePlusReEnrolment')), /body: JSON\.stringify/);
  assert.match(subscription, /run\(presentSubscriptionPaywall, true\)/);
  assert.match(subscription, /run\(restoreSubscriptionPurchases, true\)/);
  assert.match(billing, /recordWhatBinReEnrolmentIntent\(user\.id, 'stripe', session\.id\)/);
  assert.match(billing, /session\.payment_status !== 'paid'[\s\S]*session\.payment_status !== 'no_payment_required'/);
  assert.match(billing, /reEnrolmentKey: session\.id/);
  assert.match(reconciliation, /INSERT INTO bin_account_re_enrolment_intents/);
  assert.match(reconciliation, /ON CONFLICT \(user_id, source, intent_key\)/);
  assert.match(reconciliation, /expires_at > now\(\)/);
  assert.match(reconciliation, /intent_key = \$\{matchingIntentKey\}/);
  assert.match(reconciliation, /createHash\('sha256'\)/);
  assert.doesNotMatch(reconciliation, /UPDATE bin_account_removal_suppressions[\s\S]{0,250}re_enrolment_key/);
  assert.ok(
    reconciliation.indexOf('DELETE FROM bin_account_removal_suppressions')
      < reconciliation.indexOf('await persistAccepted?.(transaction)'),
  );
});

test('suppressed RevenueCat and Stripe ingestion never attach provider ledgers first', async () => {
  const [nativeEntitlements, billing] = await Promise.all([
    read('../server/lib/native-entitlements.ts'),
    read('../server/lib/web-billing.ts'),
  ]);

  assert.match(nativeEntitlements, /event_type,[\s\S]*user_id,[\s\S]*VALUES \([\s\S]*\$\{eventType\},[\s\S]*null,/);
  assert.match(nativeEntitlements, /saveProviderGrantInTransaction\([\s\S]*async \(acceptedTransaction\) =>[\s\S]*SET user_id = \$\{userId\}::uuid/);
  assert.match(nativeEntitlements, /grantResult === 'suppressed' \? 'suppressed' : 'processed'/);

  const completedCheckout = billing.slice(
    billing.indexOf('async function saveCompletedCheckout'),
    billing.indexOf('async function saveSubscription'),
  );
  assert.match(completedCheckout, /persistAccepted: async \(transaction\) =>/);
  assert.ok(
    completedCheckout.indexOf('saveStripeEntitlement')
      < completedCheckout.indexOf('INSERT INTO bin_supporters'),
  );
  assert.doesNotMatch(completedCheckout, /clearWhatBinRemovalSuppression/);
});

test('multiple Stripe checkouts retain independent pending keys until one verified completion', async () => {
  const [migration, reconciliation, billing, binAuth, accountExport] = await Promise.all([
    read('../supabase/migrations/20260819234500_what_bin_removal_suppression.sql'),
    read('../server/lib/entitlement-reconciliation.ts'),
    read('../server/lib/web-billing.ts'),
    read('../server/lib/bin-auth.ts'),
    read('../server/lib/account-export.ts'),
  ]);
  assert.match(migration, /primary key \(user_id, source, intent_key\)/i);
  assert.match(reconciliation, /ON CONFLICT \(user_id, source, intent_key\) DO UPDATE/);
  assert.match(reconciliation, /intent_key = \$\{matchingIntentKey\}/);
  assert.match(billing, /recordWhatBinReEnrolmentIntent\(user\.id, 'stripe', session\.id\)/);
  assert.match(billing, /reEnrolmentKey: session\.id/);
  assert.doesNotMatch(reconciliation, /SET[\s\S]{0,120}re_enrolment_key/);
  assert.match(reconciliation, /DELETE FROM bin_account_re_enrolment_intents[\s\S]*expires_at <= now\(\)/);
  assert.match(binAuth, /DELETE FROM bin_account_re_enrolment_intents[\s\S]*expires_at <= now\(\)/);
  assert.match(accountExport, /DELETE FROM bin_account_re_enrolment_intents[\s\S]*expires_at <= now\(\)/);
});

# Authentication and billing controls

## Authentication

- Sign-in is optional for free collection information and uses a one-time email link.
- The client applies a 60-second request cooldown; Supabase project rate limits and CAPTCHA should be enabled before public promotion.
- Responses remain generic and redirect URLs are restricted to the production web origin and registered native scheme.
- Saved household addresses are not uploaded with the account.
- Account data can be exported and the app-owned plan/grant records can be removed from Account.

## Entitlement authority

The client does not grant Plus from a RevenueCat SDK snapshot or Stripe redirect. Access is granted only by the reconciled server record.

`bin_entitlement_grants` stores Apple, Google, Stripe or administrative grants separately. Each provider event carries a source timestamp and stable event/transaction identifier. Older events cannot overwrite newer provider state. A transaction and advisory lock select the highest active grant and update `bin_user_entitlements`.

This supports cancellation, refund, expiration, grace period, lifetime access, duplicate delivery and out-of-order webhooks.

## Operational requirements before payments

- Keep `WHAT_BIN_ENABLE_WEB_PAYMENTS`, `WHAT_BIN_ENABLE_NATIVE_PLUS_WEBHOOKS` and `EXPO_PUBLIC_ENABLE_NATIVE_PLUS_PURCHASES` disabled. They are explicit release gates, not ordinary configuration switches.
- Verify signed Stripe and RevenueCat webhooks in production.
- Configure production-only RevenueCat processing; sandbox events require an explicit non-production override.
- Test anonymous purchase prevention, sign-in, restore, cancellation, refund, grace, expiry and account switching on physical devices.
- Keep provider secrets server-side and public SDK keys platform-scoped.
- Reconcile webhook logs against provider dashboards and alert on processing failure.
- Keep the production launch phase in `proof` until store products and disclosures are approved.
- RevenueCat `TRANSFER` processing now locks both identities in a stable order, revokes or moves source Apple/Google grants, honours removal suppression and an eligible destination re-enrolment intent, and reconciles both sides atomically. Keep native Plus disabled until the migration is applied/read back and signed sandbox tests prove source revoke, destination grant, suppressed destination and same-event retry behavior against the real provider.
- Checkout, confirmation, portal and webhook routes now use streaming byte caps and stable server-generated request-ID envelopes without reflected provider messages. Stripe lifecycle webhooks hydrate the current subscription or complete refund ledger instead of ordering equal-second events by Stripe ID. Keep web payments disabled until signed sandbox replay, active/past-due/canceled and refund/reversal tests pass against the real provider and live migration readback is complete.
- Run signed sandbox regressions for fail-then-retry of the same Stripe and RevenueCat event ID, lifetime refunds/refund reversal, missing subscription period ends and old confirmation URLs before changing either release gate.

## Known identity limit

Account removal deletes eligible What Bin plan, grant, support and solo-household data and signs out only the current device. Active billing and households involving another person must be resolved first. A minimal `bin_account_removal_suppressions` row remains so delayed Stripe, Apple, Google or RevenueCat events cannot recreate access; retained provider ledgers are detached from the What Bin user ID. Starting a purchase or restore records a hashed, independently keyed intent with a hard 30-minute expiry; it does not clear suppression. Only a matching, successful provider event may clear suppression atomically with accepted grant persistence. Cancelled or abandoned flows leave suppression in place. Expired intent rows are removed on account reads and reconciliation, with `bin_purge_expired_account_re_enrolment_intents()` scheduled as the dormant-account backstop. The shared Supabase authentication identity is retained so deleting app data cannot remove access used by another product in the same Supabase project. Deletion of that underlying identity is assisted through Help and support; it must not become self-service until the app has a dedicated auth project or a proven product-scoped identity deletion service.

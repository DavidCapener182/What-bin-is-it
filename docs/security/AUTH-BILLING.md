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

- Verify signed Stripe and RevenueCat webhooks in production.
- Configure production-only RevenueCat processing; sandbox events require an explicit non-production override.
- Test anonymous purchase prevention, sign-in, restore, cancellation, refund, grace, expiry and account switching on physical devices.
- Keep provider secrets server-side and public SDK keys platform-scoped.
- Reconcile webhook logs against provider dashboards and alert on processing failure.
- Keep the production launch phase in `proof` until store products and disclosures are approved.

## Known identity limit

Account removal deletes What Bin plan/grant data and signs the device out. The shared Supabase authentication identity is retained so deleting app data cannot remove access used by another product in the same Supabase project. This is disclosed until the app has a dedicated auth project or a safe product-scoped identity deletion service.

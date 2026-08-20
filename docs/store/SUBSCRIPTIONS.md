# What Bin? Plus store setup

The app uses RevenueCat over Apple StoreKit and Google Play Billing for native purchases, and Stripe Checkout for optional web support. Provider events reconcile into one server-authoritative entitlement.

Do not change the `production` EAS profile from `proof` or enable any of the three explicit payment release gates until every sandbox and security check below passes. Use `subscription-development` for device development and `plus-beta` for TestFlight or Play internal testing.

## Offer and entitlement

Entitlement identifier:

```text
plus
```

Current RevenueCat offering:

```text
default
```

| Package | Store product ID | UK target price | Store type |
| --- | --- | ---: | --- |
| Monthly | `uk.whatbinistonight.plus.monthly` | £1.99 | Auto-renewing subscription |
| Annual, recommended | `uk.whatbinistonight.plus.yearly` | £14.99 | Auto-renewing subscription |
| Lifetime launch offer | `uk.whatbinistonight.plus.lifetime` | £29.99 | Non-consumable / one-time product |

Start without a free trial. Store-localised prices and renewal terms must come from StoreKit or Google Play and be displayed by the RevenueCat paywall, never from hard-coded checkout UI.

## Apple App Store Connect

1. Create a subscription group named **What Bin? Plus**.
2. Create the monthly and annual auto-renewable subscriptions using the exact product IDs above.
3. Add the lifetime product as a non-consumable in-app purchase.
4. Add en-GB display names, descriptions, UK prices and all required review screenshots.
5. Add the privacy policy and terms links to the subscription metadata.
6. Complete Paid Applications agreements, tax and banking.
7. Create an App Store Connect in-app purchase key for RevenueCat.
8. Add the products to the app version submitted for review.

## Google Play Console

1. Create the monthly and annual subscription products using the exact IDs above.
2. Add and activate a backwards-compatible base plan for each product (`monthly` and `yearly`).
3. Create the lifetime product as a one-time product and activate its purchase option.
4. Set UK prices, en-GB descriptions and required tax/category details.
5. Link a minimum-permission Play service account to RevenueCat.
6. Upload an Android App Bundle before expecting Play products to resolve.
7. Add licence testers and publish products to the internal track.

## RevenueCat

1. Create one project and add the iOS and Google Play apps with bundle/application ID `uk.whatbinistonight.app`.
2. Import all three products.
3. Create entitlement `plus` and attach all three products.
4. Create offering `default` with monthly, annual and lifetime packages; make annual the visually recommended package.
5. Build and publish a paywall with a visible close control, product duration, local price, auto-renewal wording, Terms and Privacy links.
6. Configure Customer Center with subscription management, cancellation guidance, refund guidance and restore.
7. Require password-free sign-in before purchase so the RevenueCat App User ID is the Supabase user UUID. Do not allow an anonymous SDK state to unlock Plus.
8. Configure the authenticated RevenueCat webhook at `/api/billing/revenuecat-webhook` and keep its authorization token server-only.
8. Copy only the public Apple and Google SDK keys into EAS. Never put a RevenueCat secret key in an `EXPO_PUBLIC_` variable.

```bash
npx eas-cli env:create --environment development --name EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY
npx eas-cli env:create --environment development --name EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY
```

After production approval, create the same variables in the EAS `production` environment and change the production launch phase only in the release commit.

## Stripe web billing

Configure Stripe Checkout, Customer Portal and the signed webhook at
`/api/billing/webhook`. Stripe customer metadata must carry the signed-in
Supabase user UUID. Never grant access from a success redirect: the webhook
provider grant is reconciled on the server.

## Reconciliation rules

- Apple, Google, Stripe and administrative grants are stored independently.
- Stable provider event and transaction identifiers make delivery idempotent.
- Provider timestamps prevent older events from overwriting newer state.
- Active lifetime, subscription and grace-period grants are selected in a transaction.
- Cancellation, refund and expiry remove access only when no other active grant remains.
- The client reads `bin_user_entitlements`; RevenueCat/Stripe client state alone is not authority.

## Build and sandbox sequence

```bash
npm ci
npm run verify
npm run store:check
npx eas-cli build --platform ios --profile subscription-development
npx eas-cli build --platform android --profile subscription-development
npx eas-cli build --platform all --profile plus-beta
```

Expo Go cannot test this purchase SDK. Use the development builds, TestFlight and Play internal testing.

Test every case on physical devices:

- free users can still see verified dates, one address, the standard reminder, guide, services and council report route;
- the paywall uses live store-localised product names, prices and renewal periods;
- monthly, annual and lifetime sandbox purchases unlock `plus`;
- cancelling the sheet does not unlock anything;
- **Restore purchases** is explicitly user initiated and restores on a clean install;
- Customer Center or the platform management link opens;
- an expired or refunded sandbox subscription removes Plus access;
- one Apple purchase and one Google purchase are tested independently;
- no postcode, street address or location is sent to RevenueCat;
- signing into a second device and restoring resolves to the same server entitlement;
- cancellation, refund, grace, expiry, duplicate webhook and out-of-order webhook cases reconcile correctly;
- fail-then-retry of the exact same Stripe and RevenueCat event ID reaches one terminal outcome;
- RevenueCat `TRANSFER` atomically revokes the source identity and grants only the destination while checking removal suppression for both;
- renewable grants without a verified future period end fail closed, and an old checkout confirmation cannot reactivate cancelled, expired or refunded access;
- offline launch retains the last cached entitlement state only as allowed by the SDK, then refreshes when online.

## Release gate

Only change `EXPO_PUBLIC_LAUNCH_PHASE` in the production EAS profile to `live` after:

- the Apple and Google products are active and linked to `plus`;
- RevenueCat paywall and Customer Center are published;
- public SDK keys exist in the EAS production environment;
- privacy declarations, terms, screenshots and review notes describe payments;
- all Stripe request bodies are byte-bounded and billing errors use stable request IDs without reflecting provider messages;
- both sandbox purchase/restore/cancel paths pass;
- App Review has a working reviewer path.

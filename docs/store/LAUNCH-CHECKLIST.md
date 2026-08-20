# First iOS and Android release

The first store release is a free accuracy-proving release. Do not turn on Plus until real store products, purchase restoration, subscription management and review disclosures are complete.

## Already prepared in the repository

- Expo SDK 57 app with iOS, Android and web targets;
- iOS bundle identifier and Android application ID: `uk.whatbinistonight.app`;
- iOS build number and Android version code;
- EAS development, preview, subscription-development, Plus beta, production and submit profiles;
- 1024 × 1024 store icon source;
- foreground location and notification permission copy;
- no non-exempt encryption declaration;
- privacy manifest tracking declaration;
- public privacy, terms, support and data-source routes;
- App Store and Google Play listing copy;
- App Review notes, privacy/data-safety answers and screenshot shot list;
- automated `npm run store:check`;
- production gateway and PWA.
- native StoreKit/Google Play entitlement, paywall, restore and management code via RevenueCat.
- Stripe web billing and reconciled server-side Apple/Google/Stripe entitlement records.
- account export and removal of app-owned account data.

## Account steps that cannot be completed in source control

Paid Apple Developer and Google Play Console enrolment is intentionally deferred until the free proof release has demonstrated enough value. Do not accept store agreements or start paid enrolment without a fresh go-ahead.

### Expo

- [x] Create the Expo organization `what-bin-is-it-tonight`.
- [x] Authenticate EAS as an owner of that organization.
- [x] Link the repository to `@what-bin-is-it-tonight/what-bin-is-it-tonight`.
- [x] Record EAS project ID `b99235cc-2ab4-48be-af61-1149824c542e` and owner in `app.json`.
- [ ] Confirm build credentials are owned by the intended organization, not a personal throwaway account.

### Apple

- [ ] Enrol the contracting entity in the Apple Developer Program.
- [ ] Accept current agreements, complete tax and banking.
- [ ] Register `uk.whatbinistonight.app`.
- [ ] Create the app record in App Store Connect.
- [ ] Set the primary category to Utilities.
- [ ] Add the public privacy URL and support URL.
- [ ] Complete App Privacy using [PRIVACY-DECLARATIONS.md](PRIVACY-DECLARATIONS.md).
- [ ] Create APNs credentials through EAS when prompted.
- [ ] Apply for the App Store Small Business Program if eligible.

### Google

- [ ] Create and verify the Play Console developer account for the contracting entity.
- [ ] Complete developer identity and payments profile.
- [ ] Create `uk.whatbinistonight.app`.
- [ ] Complete App access, Ads, Content rating, Target audience, News and Data safety.
- [ ] Add the public privacy URL.
- [ ] Create a Google service account with the minimum Play release permission and keep its JSON outside Git.
- [ ] Upload the first Android App Bundle manually if Play requires it before API submission.

### Optional What Bin? Plus

- [ ] Complete every step in [SUBSCRIPTIONS.md](SUBSCRIPTIONS.md).
- [ ] Create and activate the three exact Apple and Google product IDs.
- [ ] Publish RevenueCat entitlement `plus`, offering `default`, paywall and Customer Center.
- [ ] Store public RevenueCat SDK keys in EAS development/preview environments.
- [ ] Pass purchase, cancellation, expiry, management and user-triggered restore tests on physical iOS and Android devices.
- [ ] Keep the `production` profile in `proof` until the store products and disclosures are approved.
- [ ] Keep `WHAT_BIN_ENABLE_WEB_PAYMENTS`, `WHAT_BIN_ENABLE_NATIVE_PLUS_WEBHOOKS` and `EXPO_PUBLIC_ENABLE_NATIVE_PLUS_PURCHASES` false until the complete payment security gate passes.

## Build sequence

```bash
npm ci
npm run verify
npm run store:check
npx eas-cli build --platform all --profile production
```

For internal review:

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

For native subscription sandbox testing:

```bash
npx eas-cli build --platform ios --profile subscription-development
npx eas-cli build --platform android --profile subscription-development
npx eas-cli build --platform all --profile plus-beta
```

After the app records exist:

```bash
npx eas-cli submit --platform ios --profile production
npx eas-cli submit --platform android --profile production
```

The Android submit profile uses the internal track first. Promote only after physical-device testing.

## Repository and deployment security gates

- [ ] Apply and read back all four migrations in the exact order documented in [SUPABASE-RELEASE-MIGRATIONS.md](../security/SUPABASE-RELEASE-MIGRATIONS.md) before deploying server code that uses them.
- [ ] Confirm all three named `pg_cron` jobs are active and their first executions succeed: daily data-quality purge, hourly re-enrolment-intent purge and daily API-security-state purge.
- [ ] Read back the production public-gateway flag, HMAC secret and database connection, then verify the 600-per-15-minute network limiter, `Retry-After`, provider circuit and fail-closed path. Verify the data-quality route's independent 120-per-15-minute network scope and client budgets.
- [ ] Treat hosting WAF, bot and device-reputation rules as defence in depth and record their configuration if enabled; do not substitute them for the durable application controls.
- [ ] Configure `main` exactly as [BRANCH-PROTECTION.md](../security/BRANCH-PROTECTION.md) specifies and prove a failed/missing required check blocks merge.
- [ ] Retain green `Resident browser journeys`, `Council console browser journeys` and `Native journey manifests` checks. Run the manually dispatched EAS native workflow and retain its artifacts before native release.
- [ ] Confirm support can search structured server logs by every returned `x-request-id` without logging report text, addresses, tokens or upstream secrets.

## Physical-device acceptance

- [ ] Fresh install opens onboarding without a development menu.
- [ ] Denying location still leaves manual postcode entry available.
- [ ] One-time location finds a postcode and does not request background access.
- [ ] A postcode with several properties requires an exact selection.
- [ ] Real collection dates match the named source.
- [ ] Unsupported or unavailable sources do not create dates.
- [ ] Notification permission is requested only after user action.
- [ ] A bin-night reminder fires on physical iOS and Android devices.
- [ ] A remote push opens the approved route from foreground, background and terminated app states on physical iOS and Android devices.
- [ ] Android normal-schedule reminder timing is tested under battery saver and background restriction; any delay is explained honestly.
- [ ] Confirm exact-alarm permissions remain absent from the final manifest.
- [ ] Address slide-to-remove and Clear all app data work.
- [ ] Privacy, terms, support and data sources open without login.
- [ ] Cached and offline states are clearly labelled.
- [ ] iOS cold-starts with radios unavailable, keeps saved dates visible and relabels the state after reconnection.
- [ ] Dark mode, large text, VoiceOver and TalkBack are checked.
- [ ] On physical iPad, check portrait, landscape, rotation while each primary tab is open, Split View at narrow and wide widths, large text, VoiceOver and keyboard tab navigation.
- [ ] If Plus is enabled, purchase, restore, management and entitlement expiry work with sandbox accounts.
- [ ] If Plus is enabled, provider transfer, refund and reversal outcomes reconcile on signed sandbox accounts before either native payment flag changes from false.
- [ ] Password-free sign-in returns safely on web, iPhone and Android.
- [ ] A delivered password-free link creates a valid native session; expired and cancelled links fail safely without exposing credentials.
- [ ] Auth rate limits, production redirect allowlist and CAPTCHA escalation are configured.
- [ ] Account export and app-owned account removal work.
- [ ] iOS and Android widgets refresh from verified dates on physical devices.
- [ ] The optional iOS bin-night Live Activity starts, updates and ends at the intended lifecycle points on a physical device.
- [ ] Android Predictive Back shows the expected gesture animation and destination across supported API/OEM targets.
- [ ] The Android bin-night ongoing notification appears only when enabled and clears after the collection lifecycle ends.
- [ ] A missed report stores a council reference only after council confirmation and can track a recollection.
- [ ] Activity correctly groups unread council alerts, support replies, collection outcomes and open missed reports.
- [ ] Targeted council-alert test devices receive only the expected collection type/date/opaque-label audience.
- [ ] Council-sponsored Plus disappears when the selected place changes to an ineligible council.
- [ ] Hosted bulky checkout cancellation/success returns open the installed app or documented hosted fallback and reconcile the expected booking status.

## Store listing

- [ ] Capture only real product states. Never place invented collection dates in screenshots.
- [ ] Use a test address that is safe to publish and whose council source is live.
- [ ] Redact street address and postcode unless the test address is explicitly public.
- [ ] Do not claim “all councils live”; say “UK council routing” and “live dates where a verified source is connected.”
- [ ] Disclose location and notifications in the listing.
- [ ] State that the app is independent and not a council service.
- [ ] Include Plus only after in-app purchase is live.

## Review and staged release

- [ ] Put the exact test postcode/property and source instructions in review notes.
- [ ] Explain that login is optional and saved household addresses remain device-local.
- [ ] Explain why foreground location and notifications support core reminders.
- [ ] State that iPad is supported only after the physical iPad acceptance pass and required iPad screenshot set are complete.
- [ ] Use TestFlight and Play internal testing first.
- [ ] Start with manual release or a small staged rollout.
- [ ] Monitor failed lookups, crashes, notification support and source availability.
- [ ] Keep a rollback build and the PWA available.

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

## Physical-device acceptance

- [ ] Fresh install opens onboarding without a development menu.
- [ ] Denying location still leaves manual postcode entry available.
- [ ] One-time location finds a postcode and does not request background access.
- [ ] A postcode with several properties requires an exact selection.
- [ ] Real collection dates match the named source.
- [ ] Unsupported or unavailable sources do not create dates.
- [ ] Notification permission is requested only after user action.
- [ ] A bin-night reminder fires on physical iOS and Android devices.
- [ ] Android normal-schedule reminder timing is tested under battery saver and background restriction; any delay is explained honestly.
- [ ] Confirm exact-alarm permissions remain absent from the final manifest.
- [ ] Address slide-to-remove and Clear all app data work.
- [ ] Privacy, terms, support and data sources open without login.
- [ ] Cached and offline states are clearly labelled.
- [ ] Dark mode, large text, VoiceOver and TalkBack are checked.
- [ ] If Plus is enabled, purchase, restore, management and entitlement expiry work with sandbox accounts.
- [ ] Password-free sign-in returns safely on web, iPhone and Android.
- [ ] Auth rate limits, production redirect allowlist and CAPTCHA escalation are configured.
- [ ] Account export and app-owned account removal work.
- [ ] iOS and Android widgets refresh from verified dates on physical devices.
- [ ] A missed report stores a council reference only after council confirmation and can track a recollection.

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
- [ ] State that the first iOS release is iPhone-only.
- [ ] Use TestFlight and Play internal testing first.
- [ ] Start with manual release or a small staged rollout.
- [ ] Monitor failed lookups, crashes, notification support and source availability.
- [ ] Keep a rollback build and the PWA available.

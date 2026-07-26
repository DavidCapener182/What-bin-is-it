# First iOS and Android release

The first store release is a free accuracy-proving release. Do not turn on Plus until real store products, purchase restoration, subscription management and review disclosures are complete.

## Already prepared in the repository

- Expo SDK 57 app with iOS, Android and web targets;
- iOS bundle identifier and Android application ID: `uk.whatbinistonight.app`;
- iOS build number and Android version code;
- EAS development, preview, production and submit profiles;
- 1024 × 1024 store icon source;
- foreground location and notification permission copy;
- no non-exempt encryption declaration;
- privacy manifest tracking declaration;
- public privacy, terms, support and data-source routes;
- App Store and Google Play listing copy;
- App Review notes, privacy/data-safety answers and screenshot shot list;
- automated `npm run store:check`;
- production gateway and PWA.

## Account steps that cannot be completed in source control

### Expo

- [ ] Create or choose the Expo organization.
- [ ] Run `npx eas-cli login`.
- [ ] Run `npx eas-cli init` and commit the generated `extra.eas.projectId` and `owner`.
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
- [ ] Android exact-alarm behavior is tested with permission allowed and denied.
- [ ] Address slide-to-remove and Clear all app data work.
- [ ] Privacy, terms, support and data sources open without login.
- [ ] Cached and offline states are clearly labelled.
- [ ] Dark mode, large text, VoiceOver and TalkBack are checked.

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
- [ ] Explain that no login is required.
- [ ] Explain why foreground location and exact alarms support core reminders.
- [ ] Use TestFlight and Play internal testing first.
- [ ] Start with manual release or a small staged rollout.
- [ ] Monitor failed lookups, crashes, notification support and source availability.
- [ ] Keep a rollback build and the PWA available.

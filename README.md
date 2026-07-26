# What Bin Is It Tonight?

One clear answer to the most important household question: **which bin goes out next?**

What Bin Is It Tonight? is a native-feeling Expo app for iPhone and Android. It keeps a household’s saved places, surfaces the next collection at a glance, and schedules a reminder before collection day.

## What is already built

- iOS, Android, and web-preview Expo application with four polished product surfaces: Today, Schedule, Places, and Settings.
- A local-first saved-place store, with UK postcode validation and a postcode lookup through the public Postcodes.io service.
- A searchable, plain-English guide for common household items, with local-rule caveats built in rather than misleading universal answers.
- A local-services finder for recycling points and household-waste sites. It uses a council adapter when one exists and otherwise offers clearly-labelled OpenStreetMap nearby-place results.
- A normalised `CouncilProvider` client contract for collection dates; no screen code is coupled to a specific council website.
- Local collection reminders with per-bin choices and configurable evening reminder time.
- A companion, deployable Cloudflare Worker skeleton under `services/council-gateway`, designed to keep council-specific logic off users’ phones.
- Apple and Android application identifiers, EAS build profiles, notification plugin configuration, and an environment template.
- A UK council directory of all 361 local-authority districts in the ONS December 2024 boundary snapshot: 296 England, 32 Scotland, 22 Wales, and 11 Northern Ireland. A postcode is matched to this directory before its council adapter is selected.

## Run the app

```bash
npm install
npm run start
```

Then press `i` for the iOS Simulator, `a` for Android, or `w` for the web preview. You can also use:

```bash
npm run ios
npm run android
npm run web
```

The app opens with clearly marked sample collection dates so the UI can be explored immediately. They are intentionally not presented as council data.

## Connect live council collection data

The client expects a single national gateway URL rather than trying to scrape a different council site from every phone:

```bash
cp .env.example .env
```

Set `EXPO_PUBLIC_COUNCIL_API_BASE` to the deployed gateway, then restart Expo. The app POSTs to:

```text
POST /v1/collections
{ "postcode": "M1 1AE", "addressId": "...", "providerId": "gateway" }
```

and expects this stable response:

```json
{
  "councilName": "Example Council",
  "providerId": "example-council",
  "verifiedAt": "2026-07-26T12:00:00.000Z",
  "collections": [
    { "date": "2026-07-28", "wasteType": "recycling" }
  ]
}
```

The worker is where each local authority gets its curated API, data-feed, or approved extraction adapter. This is the honest route to UK-wide coverage: council collection data is not published through one consistent national API, and it must not be fabricated. Add a tested adapter per source, cache results in the gateway, and return the normalised contract above.

The council directory is not a claim that every collection schedule is live. It establishes complete address-to-authority coverage; each authority still requires its own verified source adapter before the app can show its real collection dates.

## Notifications

Local reminders work on device once the user opts in. Remote push needs an EAS development/production build plus Apple/FCM credentials and an Expo project ID; Expo Go cannot test Android remote push. The app’s local scheduled notifications are independent of that remote-push setup.

## Build for the stores

Install and authenticate EAS CLI, then create the relevant build:

```bash
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform android --profile preview
```

Before App Store / Play submission, replace the starter artwork under `assets/images/`, register the bundle IDs in the relevant developer accounts, deploy the gateway, and complete notification credentials.

## Web deployment

Vercel is configured to publish the Expo web build from `dist/` using [vercel.json](vercel.json). Preview deployments are safe for reviewing the web experience; the native iOS and Android builds remain handled through EAS.

## Quality checks

```bash
npm run typecheck
npm run lint
```

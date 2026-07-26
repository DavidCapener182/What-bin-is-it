# What Bin Is It Tonight?

One clear answer to the most important household question: **which bin goes out next?**

What Bin Is It Tonight? is an Expo 57 app for iPhone, Android, and the web. Its web build is an installable Progressive Web App (PWA), so it can live on a phone’s Home Screen and receive bin reminders even when the app is closed.

## What is already built

- iOS, Android, and installable web application with five polished product surfaces: Today, Schedule, Find, Places, and Settings.
- A local-first saved-place store, with UK postcode validation and a postcode lookup through the public Postcodes.io service.
- A searchable, plain-English guide for common household items, with local-rule caveats built in rather than misleading universal answers.
- A local-services finder for recycling points and household-waste sites. It uses a council adapter when one exists and otherwise offers clearly-labelled OpenStreetMap nearby-place results.
- A normalised `CouncilProvider` client contract for collection dates; no screen code is coupled to a specific council website.
- Collection reminders for every saved address, with per-bin choices and a configurable evening reminder time. Native builds use Expo local notifications; the PWA uses standards-based Web Push.
- A server-side council gateway packaged with Nitro, with a companion Cloudflare Worker entry under `services/council-gateway`, designed to keep council-specific logic off users’ phones.
- A generated web manifest, branded icons, offline service worker, install controls, notification status, and a push test action in Settings.
- Durable reminder scheduling on Vercel Workflow. A workflow sleeps until each verified reminder time and then delivers a push notification to that app installation.
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

The app never creates example collection dates. A date is displayed and scheduled for reminders only after it has been returned by a connected council source for the selected property.

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

The gateway is where each local authority gets its curated API, data-feed, or approved extraction adapter. This is the honest route to UK-wide coverage: council collection data is not published through one consistent national API, and it must not be fabricated. Add a tested adapter per source, cache results in the gateway, and return the normalised contract above.

The council directory is not a claim that every collection schedule is live. It establishes complete address-to-authority coverage; each authority still requires its own verified source adapter before the app can show its real collection dates.

## Install the web app

Open the production website in Safari on iPhone or Chrome on Android:

1. On iPhone, tap **Share → Add to Home Screen**. On Android, use **Install app**.
2. Open the new app icon.
3. In **Settings**, turn on **Never miss bin day** and allow notifications.
4. Use **Send a test notification** to verify the full push path.

The PWA keeps its last loaded shell available offline. Live council-date refreshes still need a network connection.

## Notifications

Native iOS and Android builds schedule local reminders through `expo-notifications`. The installed PWA uses Web Push plus Vercel Workflow so future reminders still arrive after the browser has closed.

Create one VAPID key pair for the production app and set both values as Vercel environment variables:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

The private key is a server-only secret. The public key is returned by `/api/push/config` so the browser can create a push subscription. `/api/health` reports whether push is configured without exposing either key.

## Build for the stores

Install and authenticate EAS CLI, then create the relevant build:

```bash
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform android --profile preview
```

Before App Store / Play submission, register the configured bundle IDs in the relevant developer accounts, deploy the gateway, complete notification credentials, and run store builds on those accounts.

## Web deployment

`npm run build` exports the Expo static site, generates the versioned service worker, and packages both the council API and durable reminder workflow into Vercel Build Output API files. [vercel.json](vercel.json) is configured to publish that result. Native iOS and Android builds remain handled through EAS.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx expo-doctor
```

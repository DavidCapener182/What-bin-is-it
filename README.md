# What Bin Is It Tonight?

One clear answer to the most important household question: **which bin goes out next?**

What Bin Is It Tonight? is an Expo 57 app for iPhone, iPad, Android, and the web. Its web build is an installable Progressive Web App (PWA), so it can live on a device’s Home Screen and receive bin reminders even when the app is closed.

## What is already built

- iPhone, iPad, Android, and installable web application with four persistent destinations: Today, Schedule, Guide, and Activity. Activity consolidates collection history, open missed-bin reports, council notices and support replies; address management, account, reminders, privacy, and app controls live in Settings.
- Private in-app support conversations let signed-in residents message their selected council and the What Bin platform team without leaving the app or exposing a saved address or postcode. Council staff are server-scoped to their own authority; the platform superadmin can see the complete cross-council inbox.
- A local-first saved-place store, with UK postcode validation and a postcode lookup through the public Postcodes.io service.
- Privacy-minimised council reach metrics: every saved place automatically links a random installation ID to its public council provider ID so the authority can see aggregate active, currently linked and all-time reach. The count never receives the resident’s postcode, address, property reference, account or email and is separate from optional app-improvement analytics.
- A searchable, plain-English guide for common household items, with saved and recent items, preparation instructions, route confidence, council-local rules where published, and honest general-guidance caveats everywhere else.
- A local-services finder for recycling points and household-waste sites. It uses a council adapter when one exists and otherwise offers clearly-labelled OpenStreetMap nearby-place results.
- A privacy-safe bulky-collection marketplace foundation. The official council route is always first and never commissionable, reuse options remain ahead of paid services, and only approved partners can offer tracked referrals or Stripe Connect checkout. Booking value and What Bin fees appear in the council console only after a signed Stripe event or a provider confirmation reference; clicks are not counted as bookings.
- A normalised `CouncilProvider` client contract for collection dates; no screen code is coupled to a specific council website.
- Collection reminders for every saved address, with per-bin choices and a configurable evening reminder time. Native builds use Expo local notifications; the PWA uses standards-based Web Push. Councils can publish in-app service alerts and optionally push them to consented installations by privacy-safe council, collection type, scheduled date, round/ward token, or open-report audience. The console shows an estimated audience and exact resident-surface previews before queueing a broadcast.
- A server-side council gateway packaged with Nitro, with a companion Cloudflare Worker entry under `services/council-gateway`, designed to keep council-specific logic off users’ phones.
- A generated web manifest, branded icons, offline service worker, install controls, notification status, and a push test action in Settings.
- Durable reminder scheduling on Vercel Workflow. A workflow sleeps until each verified reminder time and then delivers a push notification to that app installation.
- Apple and Android application identifiers, EAS build profiles, notification plugin configuration, and an environment template.
- A UK council directory of all 361 local-authority districts in the ONS December 2024 boundary snapshot: 296 England, 32 Scotland, 22 Wales, and 11 Northern Ireland. A postcode is matched to this directory before its council adapter is selected.
- A council partner connector registry that can switch an authority to an approved HTTPS feed without exposing credentials to the app or waiting for a new mobile release.
- A server-driven council profile registry for coverage status, capability labels, local links, bin names, colours, accepted items, rejected items, and preparation guidance.
- A complete resident collection lifecycle: “I’ve put it out”, “Was it collected?”, council eligibility and delay checks, official missed-bin handoff, report references, local history, expected recollection dates, and recollection reminders.
- Optional password-free resident accounts that store only identity and plan access. Saved household addresses remain on the resident’s device. Plus households can opt into a council-scoped shared household nickname, member display names, bin responsibility and collection outcomes; no address, postcode or council property reference is copied into the shared record.
- Native Apple/Google subscription foundations through RevenueCat and web billing foundations through Stripe. Provider events reconcile into one server-authoritative entitlement; proof builds keep payment prompts disabled.
- Native iOS and Android Home Screen widgets driven by the selected address and verified collection dates, plus an optional bin-night iOS Live Activity and Android collection-status notification that exists only around a verified collection.
- A generated 361-council outreach pipeline, pilot offer, integration contract, assurance pack, success measures and property pilot.
- App Store and Google Play listing copy, privacy declarations, review notes, screenshot plan and automated repository-readiness checks.
- A free-first commercial stage with stable future Plus product IDs and tested guardrails that keep essential council services outside a paywall.
- A separately deployed private council console with tenant-scoped staff roles, privacy-safe targeted announcements and disruption alerts, message previews, local guidance, missed-collection policy, partner campaigns, aggregate outcome evidence, onboarding checklist, per-council feature flags and an immutable audit trail.
- A council-scoped bulky-booking evidence ledger showing pseudonymous official handoffs, referral starts, provider confirmations, signed payment outcomes, gross booking value and evidenced platform fees without resident names, contact details, postcodes or addresses.
- A platform-superadmin layer split into Commercial, Operations and Governance workspaces: relationship CRM, council-demand funnel, support case management, sponsorship programmes, connector/status oversight, permissions and audit. A council user never receives the cross-council view.
- Server-authoritative resident entitlement states for Free, Trial, Plus, council-sponsored, housing-sponsored and Lifetime access. Sponsorship is recalculated for the selected council and suppresses a consumer paywall when the active authority provides Plus.
- A public status and coverage route backed by real gateway checks and explicitly recorded incidents. It reports missing feeds as missing rather than manufacturing availability.
- A published-content bridge through the council gateway. The resident app never connects to the back-office database and the back-office has no resident route or navigation entry.

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

The council directory is not a claim that every collection schedule is live. It establishes complete address-to-authority routing; each authority still requires its own verified source adapter before the app can show real collection dates. Published status uses six explicit levels: `live-direct`, `partner-connected`, `public-feed`, `experimental-adapter`, `council-link-only`, and `unsupported`. See [the coverage register](docs/councils/COVERAGE.md).

### Connect an approved council feed

Council partners can implement the normalized address, collection and services contract in [docs/councils/INTEGRATION.md](docs/councils/INTEGRATION.md). Add connector metadata to the server-only `COUNCIL_PARTNER_REGISTRY_JSON` variable and keep its credential in the separately named secret referenced by that entry.

The gateway validates connector identity, HTTPS configuration, timeouts and response shape. An invalid registry makes the health check fail rather than silently presenting a council as connected.

Council-owned guidance and capability metadata can be changed without a mobile release through `COUNCIL_PROFILE_REGISTRY_JSON`. The app reads it from `GET /v1/profile?providerId=...`.

Knowsley is the complete reference integration: exact address discovery, live dated collections and local bin guidance are connected; missed-bin checking and submission use the council’s official route and are recorded only after the resident confirms the council’s response. Other directory authorities remain explicitly experimental until their source and end-to-end journey are verified.

## Install the web app

Open the production website in Safari on iPhone or Chrome on Android:

1. On iPhone, tap **Share → Add to Home Screen**. On Android, use **Install app**.
2. Open the new app icon.
3. In **Settings**, turn on **Never miss bin day** and allow notifications.
4. Use **Send a test notification** to verify the full push path.

The PWA keeps its last loaded shell available offline. Live council-date refreshes still need a network connection.

## Notifications

Native iOS and Android builds schedule local reminders through `expo-notifications`. The installed PWA uses Web Push plus Vercel Workflow so future reminders still arrive after the browser has closed. Published council announcements and disruptions appear in Activity without notification permission. When a resident has enabled reminders and service alerts, the app privately registers only an opaque installation ID, saved council provider IDs, bounded collection types/dates, optional council-issued opaque area labels and the provider delivery token. It does not register the address, postcode, property reference, account or email. A council broadcast can target only consented registrations for that signed-in council and requires a final audience confirmation.

Create one VAPID key pair for the production app and set both values as Vercel environment variables:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
COUNCIL_BROADCAST_SECRET
```

The VAPID private key and council broadcast secret are server-only. Use the same broadcast secret in the separately deployed council console. The VAPID public key is returned by `/api/push/config` so the browser can create a push subscription. `/api/health` reports whether web push is configured without exposing either key.

## Build for the stores

Install and authenticate EAS CLI, then create the relevant build:

```bash
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform android --profile preview
```

Before App Store / Play submission, register the configured bundle IDs in the relevant developer accounts, deploy the gateway, complete notification credentials, and run store builds on those accounts. iPad support and adaptive portrait/landscape layouts are enabled; physical iPad, rotation, Split View and large-text acceptance remain required before submission.

The complete account, privacy, review and physical-device sequence is in [docs/store/LAUNCH-CHECKLIST.md](docs/store/LAUNCH-CHECKLIST.md). The first release stays in `proof` mode and does not show resident payment prompts.

Check the repository-owned submission material:

```bash
npm run store:check
```

This separates source-control failures from Apple, Google and Expo account actions that must be completed by the account holder.

## Start council outreach

Open [docs/README.md](docs/README.md), then work from [operations/councils/pipeline.csv](operations/councils/pipeline.csv). The sheet is generated from the same 361-authority directory used by postcode routing:

```bash
npm run councils:sync
```

The sync preserves contact, stage, next-action and notes columns. Authorities without a directly audited source remain labelled `nationwide-routing-unverified`.

The council-facing SaaS architecture, trust rules and channel-readiness boundaries are documented in [the platform brief](docs/councils/PLATFORM.md). The private app lives in [council-backoffice](council-backoffice/README.md) and must be deployed as a separate Vercel project. Pilot claims should use the definitions in [the measurement plan](docs/councils/PILOT-MEASUREMENT.md).

## Web deployment

`npm run build` exports the Expo static site, generates the versioned service worker, and packages both the council API and durable reminder workflow into Vercel Build Output API files. [vercel.json](vercel.json) is configured to publish that result. Native iOS and Android builds remain handled through EAS.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run audit:production
npx expo-doctor
npm run store:check
```

Architecture, current limitations, security controls, coverage truth, and release evidence are indexed in [docs/README.md](docs/README.md).

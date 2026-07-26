# Store privacy and permission declarations

These answers describe version 1.1.0 in the `proof` phase. Reassess them before every submission, especially after analytics, accounts, direct council reporting, payments or a property dashboard are added.

## Product facts

- No advertising SDK.
- No tracking SDK or cross-app tracking.
- No resident account.
- Saved addresses, dates, outcomes, reports and preferences are device-local.
- A user-initiated lookup transmits postcode, council provider ID and an opaque property reference to the gateway and relevant source.
- Foreground location is requested only after the user taps the location action; it is converted to a postcode and is not continuously tracked.
- Native reminders are scheduled on the device.
- The installed web app can store a browser push subscription and reminder delivery plan on the server.
- The native store app does not sell or share address/location data.
- Support opens an external GitHub issue only after the user chooses it.

## Apple App Privacy

Use the most conservative answer supported by the final production logging configuration.

### Tracking

- Data used to track the user: **No**
- Data linked with third-party data for advertising: **No**

### Data collection

If gateway request values are immediately used for the lookup and not retained in readable logs, Apple’s guidance may allow them to be treated as not collected. Confirm Vercel and upstream retention before selecting that answer.

If any request value or derived value is retained, declare at least:

- **Coarse Location** — postcode/council area; not linked to identity; App Functionality.
- **Device ID** — only if a native push token or installation identifier is introduced; App Functionality.
- **Other User Content** — only if in-app support text is transmitted to and retained by the operator.

Do not declare precise location if the production design immediately converts it to a postcode and does not store coordinates. If coordinates are retained or logged, update the answer.

Privacy policy: `https://what-bin-is-it-tonight.vercel.app/privacy`

Privacy choices: the same route explains local data removal; a separate account-deletion route is not required while the app has no accounts.

## Google Play Data safety

Complete the form even if the final answer is “no data collected.”

Review:

- whether Vercel or a council connector retains request IP addresses, postcodes or property references;
- whether any SDK collects diagnostics by default;
- whether the future native push implementation stores a token server-side;
- encryption in transit: HTTPS;
- deletion: local data can be removed by deleting an address or using Clear all app data;
- no accounts in the first release;
- no data sale;
- no advertising.

Privacy policy: `https://what-bin-is-it-tonight.vercel.app/privacy`

## Location permission

Purpose shown to the user:

> Allow What Bin Is It Tonight? to use your location once to find your postcode and local council.

Behavior:

- foreground only;
- user initiated;
- manual postcode entry remains available;
- no background location;
- no advertising or analytics use.

Play Console may require a location declaration. Describe the one-time postcode lookup and attach a video showing the user tapping the location button, the system prompt and the resulting postcode.

## Notifications and exact alarms

Purpose:

- bin-night reminders from verified dates;
- optional collection-morning and follow-up reminders;
- verified date-change and service-disruption notices.

The Android app declares `SCHEDULE_EXACT_ALARM`, not the more restricted auto-granted `USE_EXACT_ALARM`. Access can be denied by the user. Explain that scheduled collection reminders are the core app function and verify degraded behavior when exact access is unavailable.

## Encryption

The app uses standard HTTPS/TLS and does not implement non-exempt proprietary encryption. `ios.config.usesNonExemptEncryption` is `false`. Reassess if cryptographic functionality changes.

## Future Plus

Before enabling payments, update:

- Purchases / purchase history declarations where applicable;
- subscription terms and management links;
- account and purchase restoration flow;
- any third-party billing SDK data practices;
- privacy manifest and store privacy answers;
- review notes and screenshots.

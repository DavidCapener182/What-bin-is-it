# Store privacy and permission declarations

These answers describe the current `proof` phase. Reassess them before every submission, especially after analytics, direct council reporting, payments or a property dashboard changes.

## Product facts

- No advertising SDK.
- No tracking SDK or cross-app tracking.
- Optional password-free resident account. Supabase stores email identity and the minimum Free/Plus plan record; saved household addresses remain device-local.
- Saved addresses, dates, outcomes, reports and preferences are device-local. Optional Plus household coordination stores a household nickname, public council provider ID, member display names and explicitly recorded bin responsibilities/outcomes; it never stores the address, postcode or council property reference.
- A user-initiated lookup transmits postcode, council provider ID and an opaque property reference to the gateway and relevant source.
- Saving a place automatically sends a random installation identifier and its public council provider identifiers for aggregate active, currently linked and all-time council reach. It does not send a postcode, address, property reference, coordinates, account or email in that resident-count request.
- “Help improve local bin services” is a separate opt-in stream of allow-listed app-improvement events and is not required for the council resident count.
- Foreground location is requested only after the user taps the location action; it is converted to a postcode and is not continuously tracked.
- Native reminders are scheduled on the device.
- With notification consent, the installed web or native app stores an opaque installation identifier, council provider identifiers, bounded collection types/dates, optional council-issued opaque round/ward labels and a private browser/Expo push credential so verified council service alerts can be delivered. No postcode, address, property reference, account or email is stored in that registration.
- The native store app does not sell or share address/location data.
- Account export and removal of What Bin-owned plan/grant records are available in Account.
- Support opens an external GitHub issue only after the user chooses it.
- Native Plus builds use RevenueCat to read Apple/Google purchase status. RevenueCat receives an anonymous app user ID, product/transaction and entitlement status, and basic platform/app information. The app disables automatic device-identifier collection and does not send a postcode, street address or location to RevenueCat.

## Apple App Privacy

Use the most conservative answer supported by the final production logging configuration.

### Tracking

- Data used to track the user: **No**
- Data linked with third-party data for advertising: **No**

### Data collection

If gateway request values are immediately used for the lookup and not retained in readable logs, Apple’s guidance may allow them to be treated as not collected. Confirm Vercel and upstream retention before selecting that answer.

The random council resident-count identifier is retained, so declare at least:

- **Coarse Location** — postcode/council area; not linked to identity; App Functionality.
- **Device ID** — opaque resident-count installation identifier and, when enabled, native push token; not linked to identity; App Functionality.
- **Other User Content** — only if in-app support text is transmitted to and retained by the operator.

For a Plus-enabled build, also declare conservatively:

- **Purchases / Purchase History** — product, transaction and subscription status; App Functionality; not used for tracking.
- **User ID** — RevenueCat anonymous app user ID; App Functionality; not used for tracking.

Do not declare precise location if the production design immediately converts it to a postcode and does not store coordinates. If coordinates are retained or logged, update the answer.

Privacy policy: `https://what-bin-is-it-tonight.vercel.app/privacy`

Privacy choices: the app explains local-data removal separately from Account export and removal of What Bin account data. The shared Supabase authentication identity is retained so this app cannot delete another product’s access.

## Google Play Data safety

Complete the form even if the final answer is “no data collected.”

Review:

- whether Vercel or a council connector retains request IP addresses, postcodes or property references;
- whether any SDK collects diagnostics by default;
- the current server-side native/browser push registration and its 30-day disabled / 180-day stale retention limits;
- encryption in transit: HTTPS;
- deletion: local data can be removed by deleting an address or using Clear all app data;
- automatic council reach uses only a random installation identifier and public council provider IDs; Clear all app data requests deletion of that resident record;
- optional app-improvement events require a separate opt-in choice;
- optional account identifiers and plan access;
- no data sale;
- no advertising.

For a Plus-enabled build, include purchase history and the anonymous RevenueCat app user ID in the Data safety answers. Confirm RevenueCat’s current SDK disclosure before submission.

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

## Notifications

Purpose:

- bin-night reminders from verified dates;
- optional collection-morning and follow-up reminders;
- verified date-change and service-disruption notices.

The Android app blocks both exact-alarm permissions. Collection reminders use normal operating-system scheduling; disclose that battery and background restrictions can affect exact delivery time.

## Encryption

The app uses standard HTTPS/TLS and does not implement non-exempt proprietary encryption. `ios.config.usesNonExemptEncryption` is `false`. Reassess if cryptographic functionality changes.

## Plus release gate

The repository includes the native purchase layer, but the `production` profile remains in `proof`. Before enabling payments:

- Purchases / purchase history declarations where applicable;
- subscription terms and management links;
- RevenueCat public SDK keys, paywall, entitlement, Customer Center and user-triggered restore must be sandbox tested;
- verify RevenueCat’s then-current SDK data practices against both store forms;
- privacy manifest and store privacy answers;
- review notes and screenshots.

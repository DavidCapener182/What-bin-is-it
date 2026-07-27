# Technical architecture

## Resident clients

One Expo 57 codebase produces the iPhone, Android and installable web apps. The four persistent destinations are Today, Schedule, Guide and Reports. Settings contains addresses, account, reminders, privacy and application controls.

Verified schedules and saved addresses are local-first. Native notifications are scheduled on device; installed-web reminders use Web Push and Vercel Workflow. Native widgets read the selected address and verified schedule from the app’s shared widget state.

## Council gateway

Clients send postcode, provider ID and an opaque property reference to the Nitro gateway. The gateway selects either an approved partner connector or a curated server adapter and normalises addresses, dated collections, services, profiles and source metadata.

Screens do not know council-specific URLs or credentials. `COUNCIL_PARTNER_REGISTRY_JSON` configures approved feeds; `COUNCIL_PROFILE_REGISTRY_JSON` configures coverage, capability status, local links and item guidance. Invalid connector configuration fails visibly.

## Resident lifecycle

```text
exact property -> verified dated collection -> reminder -> put out
  -> collection-window check -> collected
  -> or eligibility/delay check -> official council handoff
  -> confirmed reference/status -> local report history -> recollection reminder
```

The app never treats its own local tracking ID as a council reference. Direct submission is enabled only where an approved council response can confirm acceptance.

## Identity and billing

Supabase provides optional password-free identity. Household addresses remain on the device. Stripe handles web billing; Apple/Google handle native payment and RevenueCat relays native entitlement events.

Provider events are stored separately in `bin_entitlement_grants`. A server transaction rejects older provider events and reconciles them into one `bin_user_entitlements` record. Only that server record unlocks Plus.

## Operational data

Council resident reach is counted automatically with a separate random installation identifier and only the public provider IDs represented by locally saved places. This supports aggregate active, currently linked and all-time installation measures without uploading a postcode, address, property reference, account or email.

Pilot app-improvement analytics remain opt-in, pseudonymous, minimised, retained for a bounded period and erasable separately from the resident count. Tables owned by this product use the `bin_` prefix.

## Deployment

Vercel serves the exported web app, Nitro API and durable reminder workflows. EAS produces native development, preview and production builds. Apple/Google signing, physical-device tests and store review remain external account-holder gates.

# Technical architecture

## Resident clients

One Expo 57 codebase produces the iPhone, Android and installable web apps. The four persistent destinations are Today, Schedule, Guide and Activity. Activity combines collection history, missed-bin state, council messages and support replies. Settings contains addresses, account, reminders, privacy and application controls.

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

Council and housing sponsorship programmes issue the same server-authoritative Plus entitlement with a bounded provider, start and end window. The resident app recalculates sponsorship against the selected council and does not display a consumer paywall where that council is actively funding access.

Opt-in household coordination stores only a household nickname, public council provider ID, member display names and explicit date/bin actions. The place address, postcode, property reference and collection-round token stay on each member’s device.

## Operational data

Council resident reach is counted automatically with a separate random installation identifier and only the public provider IDs represented by locally saved places. This supports aggregate active, currently linked and all-time installation measures without uploading a postcode, address, property reference, account or email.

Pilot app-improvement analytics remain opt-in, pseudonymous, minimised, retained for a bounded period and erasable separately from the resident count. Tables owned by this product use the `bin_` prefix.

Council service broadcasts use opaque, bounded audience attributes: council ID, collection type/date and optional council-issued round or ward labels. The console sees estimated recipient counts, not resident or address lists. Support messages are separate case records: council staff are server-scoped to their authority and internal notes are never returned to resident clients.

Partner conversion evidence distinguishes impressions, outbound actions and provider-confirmed bookings. Opening a website is never reported as a booking, and commercial placement cannot outrank a suitable free council or charity route.

Bulky-waste bookings add a separate `bin_bulky_bookings` evidence ledger. Official council handoffs, external referrals and Stripe Connect checkouts share a pseudonymous `WB-` reference, but only provider-confirmed or signed-payment outcomes contribute to booking value or platform-fee totals. Stripe or the selected provider owns the fulfilment contact and collection address; those fields are deliberately absent from the What Bin ledger. Row-level security is enabled and resident roles have no table access.

## Deployment

Vercel serves the exported web app, Nitro API and durable reminder workflows. EAS produces native development, preview and production builds. Apple/Google signing, physical-device tests and store review remain external account-holder gates.

## Platform topology

```text
Resident app (local addresses and verified schedules)
  |-- collection gateway requests --------------------------+
  |-- pseudonymous council/audience registration --------+  |
  |-- optional account, support and household actions ---|--|----> Bin Supabase
  |-- Activity receives published council content <------|--+
  |                                                       |
Council back office                                       |
  |-- Commercial: CRM, pipeline, sponsorship and demand   |
  |-- Operations: tenants, support, alerts, reports ------+
  |-- Governance: staff, permissions, audit and retention
  |-- selected council portal enforces organisation scope
  |
  +--> Vercel/Nitro gateway --> approved council/public sources
  +--> Expo/Web Push providers (opaque device delivery only)
  +--> public status and coverage evidence
```

The resident, council and commercial products share bounded identifiers and audited server actions, not a general-purpose resident profile. Council staff cannot traverse into another authority; partners cannot see residents; platform commercial contacts never enter resident-service records.

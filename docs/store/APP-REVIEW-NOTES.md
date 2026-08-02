# App Review notes — version 1.1.0

What Bin Is It Tonight? is an independent UK household utility. It is not a council service and does not generate collection schedules.

No account or payment is required for free collection information. Optional password-free sign-in stores identity and plan access only; saved household addresses remain on the device.

The repository also contains a disabled Plus purchase path. The submitted `proof` build does not configure RevenueCat or show a resident payment prompt.

## Review path

1. Open **Settings → Manage places** from onboarding or Settings.
2. Enter the supplied review postcode.
3. Choose the exact property from the returned council address list.
4. Refresh collection dates.
5. Open **Today** and **Schedule** to see the source name and last verification time.
6. Open **Settings** and enable reminders.
7. Open **Guide** to search household items and nearby services.
8. After a due collection window, use **Today → No, it was missed** to review eligibility, official council handoff and report tracking.
9. Open **Activity** to see collection outcomes, council alerts, missed-report progress and support replies in one destination.

Before submission, replace this section with a verified, publication-safe review address:

- Postcode: `[ADD REVIEW POSTCODE]`
- Property: `[ADD EXACT PROPERTY]`
- Expected next collections: `[CHECK ON SUBMISSION DAY]`
- Source: `[ADD NAMED SOURCE]`

Do not submit until those values have been checked on the same production build. Collection dates change and must not be copied from an old review note.

## Permissions

- **Location:** requested only when the reviewer taps “Use my current location”; it finds a postcode and council. Manual entry is always available. There is no background location.
- **Notifications:** requested only after the reviewer enables a reminder. Native reminders are scheduled from verified collection dates.
- **Android alarms:** exact-alarm permissions are blocked. Reminders use normal operating-system scheduling and may be delivered approximately when battery or background restrictions apply.

## Data

Saved addresses, schedules, preferences, local report history and collection outcomes are stored on the device. Postcode, council provider ID and selected opaque property reference are sent only for a requested live lookup. Optional accounts keep email identity and plan/grant records in Supabase. Opt-in household sharing stores a nickname, public council identifier, member display names and explicit bin actions without uploading the address or postcode. Account export and What Bin account-data removal are available from Account. There is no third-party advertising or behavioural-tracking SDK. Relevant sponsored service listings, when a council has approved and enabled them, are labelled and can be hidden; pseudonymous listing/open events are recorded by the first-party gateway.

If a council has enabled and approved a bulky-waste partner, the app always shows the official council route and reuse guidance before that paid option. The first-party ledger stores a random installation ID, public council ID, partner, item, quantity, amount, platform fee, pseudonymous booking reference and status. Stripe Checkout or the selected provider collects the fulfilment contact and collection address. What Bin does not copy those details into its ledger and does not report a click or checkout start as revenue.

The first Apple release is iPhone-only. `supportsTablet` remains disabled until adaptive iPad layouts pass testing.

## Missed collections

The app guides eligibility and opens the official council route. It does not tell the user that a council report was submitted until the council confirms it. A local tracking ID is not shown as a council reference.

## Support

- Support: `https://what-bin-is-it-tonight.vercel.app/support`
- Privacy: `https://what-bin-is-it-tonight.vercel.app/privacy`
- Terms: `https://what-bin-is-it-tonight.vercel.app/terms`
- Data sources: `https://what-bin-is-it-tonight.vercel.app/data-sources`

## Replace this section for a Plus-enabled submission

- Explain that Apple/Google process payment and RevenueCat reads entitlement status.
- Provide the location of **Settings → What Bin? Plus → Restore purchases**.
- Provide the location of subscription management/Customer Center.
- State the exact products attached to entitlement `plus`.
- Confirm that one address, verified dates, the standard reminder, guide, services and basic missed-bin route remain free.
- Include working sandbox products and any review-account instructions required by the stores.

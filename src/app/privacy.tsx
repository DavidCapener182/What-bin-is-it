import { LegalScreen } from '@/components/legal-screen';

export default function PrivacyScreen() {
  return (
    <LegalScreen
      description="How What Bin Is It Tonight? handles accounts, addresses, council data, alerts, household sharing and local activity."
      path="/privacy"
      sections={[
        {
          title: 'Who operates this app',
          body: 'What Bin Is It Tonight? is operated by the publisher named on its App Store or Google Play listing. Use Help and support in the app for privacy questions. The app is independent and is not operated by a council.',
        },
        {
          title: 'Data stored on this device',
          body: 'Saved places, verified collection dates, preferences, collection outcomes, activity history and local report tracking are stored on this device. Clearing app data removes them.',
        },
        {
          title: 'Optional account',
          body: 'You can use the free bin-day features without signing in. If you create an account, Supabase stores your email address, account identifier and sign-in security records. What Bin stores the minimum Free or Plus entitlement linked to that identifier so access can be restored on another device. Saved addresses, postcodes and collection schedules are not uploaded to the account.',
        },
        {
          title: 'Council lookups',
          body: 'When you ask for live data, the postcode, council identifier and selected opaque property reference are sent over HTTPS to the app gateway and the relevant council-data provider. The experimental Bin Day nationwide fallback also receives the selected street address and postcode because its collection endpoint requires them; Bin Day may cache or retain lookup data under its own privacy policy. The gateway uses these details to answer the request and does not write full addresses to an app database. After a successful match, the public council identifier alone can prepare that authority’s empty council workspace; it is not linked to an account, installation, postcode or address. Infrastructure and upstream services may keep limited security logs under their own retention policies. The app does not create estimated collection dates.',
        },
        {
          title: 'Anonymous council resident count',
          body: 'When you save a place, the app automatically counts a random installation identifier against that council so the authority can see aggregate active, currently linked and all-time resident reach. This resident count sends only the random installation identifier and council provider identifier; it never sends your postcode, address, property reference, coordinates, account, search words or report notes. Removing or changing a place updates the current link but retains the historical council reach; uninstall cannot be detected and ages out only from the rolling active count. Clearing all app data requests deletion of this resident record.',
        },
        {
          title: 'Optional app-improvement evidence',
          body: '“Help improve local bin services” is separate from the automatic council resident count. If you enable it, the app sends structured, allow-listed events such as whether a postcode or collection lookup succeeded, reminder adoption and guide-result outcomes. It does not send the postcode, address, property reference, coordinates, account, search words or report notes. You can erase these optional events from Settings without removing saved places.',
        },
        {
          title: 'Location',
          body: 'Location is requested only when you tap “Use my current location”. It is used in the foreground to find a nearby postcode and council. The app does not request background location or continuously track you, and manual postcode entry remains available.',
        },
        {
          title: 'Notifications',
          body: 'If enabled, the installed app stores a random installation identifier and device or browser notification subscription. It schedules reminders from verified dates and can receive service alerts published by councils represented by your saved places. For relevant targeting, the registration can include bounded collection types and dates plus an opaque round or ward label only when an approved council source supplies it. The server stores no postcode, street address, property reference, account or email for push delivery. The platform notification service receives the message needed for delivery. You can mute council alerts for a place without disabling collection reminders.',
        },
        {
          title: 'Optional household sharing',
          body: 'Plus users can create or join an opt-in household to coordinate who puts a bin out and record collection outcomes. Supabase stores the household nickname, public council provider identifier, member account identifiers and display names, invitation records, collection date, waste type, action and time. It does not store the household address, postcode, coordinates or council property reference. Members of that household can see its shared members and actions. Leaving or archiving the household stops future sharing; device-local saved places remain separate.',
        },
        {
          title: 'Activity, reports and support',
          body: 'Collection outcomes, alerts and missed-bin progress appear together in Activity. Missed-bin reports are tracked locally unless a council integration clearly says it submits directly. Opening an official council service does not mean the app submitted a report. If you send an incorrect-information report, the app first shows the exact private payload: issue, your bounded report text, optional expected value, public council provider identifier, displayed collection date, last verification time, app version, network state, a random request ID and a separate pseudonymous data-quality-only client reference. That client reference is not reused for council resident counting, analytics, accounts or other features. Postcodes typed into these boxes are removed before preview and rejected by the server. Other address or place-name text cannot always be detected, so the preview tells you to remove it before sending. The app does not automatically attach your saved address, postcode, property reference or place label. The raw data-quality-only reference is immediately stored as a one-way hash for rate limiting; private reports have a 24-month deletion deadline. Authorised staff see only their organisation’s reports, while the platform superadmin can see the cross-council queue. If you sign in and message support, the account reference, message text, timestamps and selected council identifier are stored so authorised staff can reply inside the app. Council staff can see only conversations tagged to their authority; the What Bin platform superadmin can see the cross-council inbox. Case priority, status, assigned staff, service deadlines, topic tags, internal notes and satisfaction responses may be stored. Internal notes are never shown to residents. Your saved address, postcode and account email are not copied into the support conversation.',
        },
        {
          title: 'Optional purchases',
          body: 'For web support, Stripe processes payment and payer contact details and returns customer, product and billing-status identifiers; What Bin never receives card details. For iPhone or Android Plus, Apple or Google processes payment and RevenueCat provides purchase and entitlement status. When signed in, the account identifier is used to restore the entitlement across supported devices. An active council or housing sponsorship can provide Plus for the currently selected council without a consumer purchase; the server checks the public council identifier and sponsorship period. The app does not send your postcode, street address or location to Stripe, RevenueCat, Apple or Google.',
        },
        {
          title: 'Local and partner services',
          body: 'The Guide lists an appropriate free council service before reuse and any relevant sponsored option. If you start a bulky collection, What Bin may record a random installation identifier, public council identifier, selected service, item type, quantity, amount, fee, a pseudonymous WB booking reference and its status. A website open or booking start is not counted as a completed booking. Confirmation requires a signed Stripe event or a provider confirmation reference. For in-app partner payment, Stripe collects the name, phone, billing and collection address needed to fulfil the booking; those details are not copied into the What Bin booking ledger. Partner organisations do not receive your What Bin account identity, saved app address or postcode through the tracking record. Sponsored placements are labelled and can be hidden in Settings.',
        },
        {
          title: 'Service providers',
          body: 'The app uses Postcodes.io for postcode and council resolution, named council or approved collection sources for live dates, Bin Day for an explicitly experimental nationwide lookup, OpenStreetMap data for some nearby services, Vercel for the public web app and gateway, Supabase for optional account, plan and in-app support records, Stripe for web billing, platform notification services when enabled, and RevenueCat in native builds where Plus purchasing is enabled. The Data sources screen explains which source supports each collection feature.',
        },
        {
          title: 'Retention and deletion',
          body: 'Remove an individual saved place from Manage places, or use Clear all app data in Settings to delete local addresses, schedules, preferences, history and reports and request deletion of the random council resident record. Removing or changing one place updates its current council link while retaining aggregate all-time reach. Turning reminders or service alerts off disables their notification registration; disabled registrations are removed after 30 days and registrations not refreshed for 180 days are removed. Expired provider tokens are disabled when detected. Account can export complete app-owned plan, support and currently authorised household records or remove eligible What Bin account data, then sign out this device. Self-service removal stops with cancellation or transfer guidance when paid billing is active or a household involves another person. A minimal What Bin removal-suppression marker linked to the shared account identifier remains, preventing delayed Stripe, Apple, Google or RevenueCat updates from recreating removed access. Starting a Plus purchase or restore creates a short-lived pending intent; closing or cancelling it does not clear suppression. The marker clears only when the provider verifies successful access. The shared Supabase authentication identity is retained so this app cannot remove access used by another product. Deleting that underlying identity requires an assisted request through Help and support. Payment providers may retain detached transaction records required for billing, fraud prevention or legal obligations.',
        },
        {
          title: 'Your choices and rights',
          body: 'You can use manual postcode entry instead of location, decline notifications, remove addresses, clear local data, export account data and remove eligible What Bin account records. Choosing a new Plus purchase or Restore purchases records a short-lived re-enrolment intent, but does not itself clear the What Bin removal suppression. Suppression clears only after Stripe, Apple, Google or RevenueCat verifies successful access; cancelling or closing the flow leaves it in place. Use Help and support for access, correction, objection or deletion requests about the retained shared sign-in identity or other information held by the publisher. A shared household may require transfer or removal by its owner, and active billing must be resolved with the payment provider first. Detached payment-provider records and council records remain subject to the relevant provider’s or council’s own privacy and legal process.',
        },
        {
          title: 'Children',
          body: 'This is a general household utility and is not designed to collect information from children. It does not use child-directed advertising or behavioral profiling.',
        },
      ]}
      title="Privacy"
      updated="20 August 2026"
    />
  );
}

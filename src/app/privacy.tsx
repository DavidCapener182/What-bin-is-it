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
          body: 'When you ask for live data, the postcode, council identifier and selected opaque property reference are sent over HTTPS to the app gateway and the relevant council-data provider. The gateway uses them to answer the request and does not write full addresses to an app database. After a successful match, the public council identifier alone can prepare that authority’s empty council workspace; it is not linked to an account, installation, postcode or address. Infrastructure and upstream services may keep limited security logs under their own retention policies. The app does not create estimated collection dates.',
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
          body: 'Collection outcomes, alerts and missed-bin progress appear together in Activity. Missed-bin reports are tracked locally unless a council integration clearly says it submits directly. Opening an official council service does not mean the app submitted a report. If you sign in and message support, the account reference, message text, timestamps and selected council identifier are stored so authorised staff can reply inside the app. Council staff can see only conversations tagged to their authority; the What Bin platform superadmin can see the cross-council inbox. Case priority, status, assigned staff, service deadlines, topic tags, internal notes and satisfaction responses may be stored. Internal notes are never shown to residents. Your saved address, postcode and account email are not copied into the support conversation.',
        },
        {
          title: 'Optional purchases',
          body: 'For web support, Stripe processes payment and payer contact details and returns customer, product and billing-status identifiers; What Bin never receives card details. For iPhone or Android Plus, Apple or Google processes payment and RevenueCat provides purchase and entitlement status. When signed in, the account identifier is used to restore the entitlement across supported devices. An active council or housing sponsorship can provide Plus for the currently selected council without a consumer purchase; the server checks the public council identifier and sponsorship period. The app does not send your postcode, street address or location to Stripe, RevenueCat, Apple or Google.',
        },
        {
          title: 'Local and partner services',
          body: 'The Guide lists an appropriate free council service before any relevant sponsored option. If you choose a partner listing, What Bin may record a pseudonymous event such as listing viewed, website opened, telephone tapped, directions requested or booking started. A booking is recorded as confirmed only after separate partner callback or referral evidence. Partner organisations do not receive your account identity, saved address or postcode through this tracking. Sponsored placements are labelled and can be hidden in Settings.',
        },
        {
          title: 'Service providers',
          body: 'The app uses Postcodes.io for postcode and council resolution, named council or approved collection sources for live dates, OpenStreetMap data for some nearby services, Vercel for the public web app and gateway, Supabase for optional account, plan and in-app support records, Stripe for web billing, platform notification services when enabled, and RevenueCat in native builds where Plus purchasing is enabled. The Data sources screen explains which source supports each collection feature.',
        },
        {
          title: 'Retention and deletion',
          body: 'Remove an individual saved place from Manage places, or use Clear all app data in Settings to delete local addresses, schedules, preferences, history and reports and request deletion of the random council resident record. Removing or changing one place updates its current council link while retaining aggregate all-time reach. Turning reminders or service alerts off disables their notification registration; disabled registrations are removed after 30 days and registrations not refreshed for 180 days are removed. Expired provider tokens are disabled when detected. Account can export the app-owned plan, support and household records available to it or remove app-owned plan and purchase-grant records, then sign out the device. Household records shared with other members follow the household retention controls. Because authentication is currently shared with other products in the same Supabase project, that action does not delete the underlying Supabase sign-in identity. Payment providers retain transaction records where required by law.',
        },
        {
          title: 'Your choices and rights',
          body: 'You can use manual postcode entry instead of location, decline notifications, remove addresses, clear local data, export account data and remove What Bin account records. For a question, correction, objection or deletion request about other information held by the publisher, use Help and support. Council records remain subject to the council’s own privacy process.',
        },
        {
          title: 'Children',
          body: 'This is a general household utility and is not designed to collect information from children. It does not use child-directed advertising or behavioral profiling.',
        },
      ]}
      title="Privacy"
      updated="2 August 2026"
    />
  );
}

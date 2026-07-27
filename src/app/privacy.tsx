import { LegalScreen } from '@/components/legal-screen';

export default function PrivacyScreen() {
  return (
    <LegalScreen
      description="How What Bin Is It Tonight? stores accounts, addresses, council data, notifications and local reports."
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
          body: 'When you ask for live data, the postcode, council identifier and selected opaque property reference are sent over HTTPS to the app gateway and the relevant council-data provider. The gateway uses them to answer the request and does not write full addresses to an app database. Infrastructure and upstream services may keep limited security logs under their own retention policies. The app does not create estimated collection dates.',
        },
        {
          title: 'Optional anonymous service evidence',
          body: 'If you choose “Help improve local bin services”, the app creates a random installation identifier and sends structured, allow-listed service events. To evidence council reach, it also sends only the council provider identifiers represented by your locally saved places. It never sends your postcode, address, property reference, coordinates, account, search words or report notes for this purpose. Council dashboards show aggregate active, currently linked and all-time participating installations. Removing or changing a place updates the current link but retains the historical council reach; uninstall cannot be detected and ages out only from the rolling active count. Erasing anonymous app evidence deletes the pseudonymous installation records.',
        },
        {
          title: 'Location',
          body: 'Location is requested only when you tap “Use my current location”. It is used in the foreground to find a nearby postcode and council. The app does not request background location or continuously track you, and manual postcode entry remains available.',
        },
        {
          title: 'Notifications',
          body: 'If enabled, the installed app stores a device or browser notification subscription and schedules messages from verified dates. The notification service receives the reminder text and delivery time, not your full street address.',
        },
        {
          title: 'Reports and support',
          body: 'Missed-bin reports are tracked locally unless a future council integration clearly says it submits directly. Opening an official council service does not mean the app submitted a report. Support or feedback leaves the app only when you choose an external email or GitHub issue route; information you publish there is handled by that service.',
        },
        {
          title: 'Optional purchases',
          body: 'For web support, Stripe processes payment and payer contact details and returns customer, product and billing-status identifiers; What Bin never receives card details. For iPhone or Android Plus, Apple or Google processes payment and RevenueCat provides purchase and entitlement status. When signed in, the account identifier is used to restore the entitlement across supported devices. The app does not send your postcode, street address or location to Stripe, RevenueCat, Apple or Google.',
        },
        {
          title: 'Service providers',
          body: 'The app uses Postcodes.io for postcode and council resolution, named council or approved collection sources for live dates, OpenStreetMap data for some nearby services, Vercel for the public web app and gateway, Supabase for optional account and plan records, Stripe for web billing, platform notification services when enabled, and RevenueCat in native builds where Plus purchasing is enabled. The Data sources screen explains which source supports each collection feature.',
        },
        {
          title: 'Retention and deletion',
          body: 'Remove an individual saved place from Manage places, or use Clear all app data in Settings to delete local addresses, schedules, preferences, history and reports. Account can export your What Bin plan record or remove the app-owned plan and purchase-grant records, then sign out the device. Because authentication is currently shared with other products in the same Supabase project, that action does not delete the underlying Supabase sign-in identity. Payment providers retain transaction records where required by law. Browser notification subscriptions are removed when notifications are disabled or expire.',
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
      updated="27 July 2026"
    />
  );
}

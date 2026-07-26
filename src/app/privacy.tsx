import { LegalScreen } from '@/components/legal-screen';

export default function PrivacyScreen() {
  return (
    <LegalScreen
      description="How What Bin Is It Tonight? stores addresses, council data, notifications and local reports."
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
          title: 'Council lookups',
          body: 'When you ask for live data, the postcode, council identifier and selected opaque property reference are sent over HTTPS to the app gateway and the relevant council-data provider. The gateway uses them to answer the request and does not write full addresses to an app database. Infrastructure and upstream services may keep limited security logs under their own retention policies. The app does not create estimated collection dates.',
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
          body: 'When What Bin? Plus is enabled in an iPhone or Android build, Apple or Google processes the payment and RevenueCat provides the app with purchase and entitlement status. RevenueCat receives an anonymous app user ID, the purchased product and transaction or subscription status, plus basic app and platform information. The app disables automatic device-identifier collection and does not send your postcode, street address or location to RevenueCat.',
        },
        {
          title: 'Service providers',
          body: 'The app uses Postcodes.io for postcode and council resolution, named council or approved collection sources for live dates, OpenStreetMap data for some nearby services, Vercel for the public web app and gateway, platform notification services when enabled, and RevenueCat only in native builds where Plus purchasing is enabled. The Data sources screen explains which source supports each collection feature.',
        },
        {
          title: 'Retention and deletion',
          body: 'Remove an individual saved place from Places, or use Clear all app data in Settings to delete local addresses, schedules, preferences, history and reports. Browser notification subscriptions are removed when notifications are disabled or expire. There is no resident account in this release.',
        },
        {
          title: 'Your choices and rights',
          body: 'You can use manual postcode entry instead of location, decline notifications, remove addresses and clear local data. For a question, correction, objection or deletion request about information held by the publisher, use Help and support. Council records remain subject to the council’s own privacy process.',
        },
        {
          title: 'Children',
          body: 'This is a general household utility and is not designed to collect information from children. It does not use child-directed advertising or behavioral profiling.',
        },
      ]}
      title="Privacy"
      updated="26 July 2026"
    />
  );
}

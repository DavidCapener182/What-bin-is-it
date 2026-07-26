import { LegalScreen } from '@/components/legal-screen';

export default function PrivacyScreen() {
  return (
    <LegalScreen
      description="How What Bin Is It Tonight? stores addresses, council data, notifications and local reports."
      path="/privacy"
      sections={[
        {
          title: 'Data stored on this device',
          body: 'Saved places, verified collection dates, preferences, collection outcomes, activity history and local report tracking are stored on this device. Clearing app data removes them.',
        },
        {
          title: 'Council lookups',
          body: 'When you ask for live data, the postcode, council identifier and selected property reference are sent to the app gateway and the relevant council-data provider. The app does not create estimated collection dates.',
        },
        {
          title: 'Location',
          body: 'Location is requested only when you tap “Use my current location”. It is used to find a nearby postcode and is not continuously tracked.',
        },
        {
          title: 'Notifications',
          body: 'If enabled, the installed app stores a device or browser notification subscription and schedules messages from verified dates. The notification service receives the reminder text and delivery time, not your full street address.',
        },
        {
          title: 'Reports and support',
          body: 'Missed-bin reports are tracked locally. Opening an official council service does not mean the app submitted a report. Support or feedback leaves the app only when you choose an external email or issue route.',
        },
      ]}
      title="Privacy"
      updated="26 July 2026"
    />
  );
}

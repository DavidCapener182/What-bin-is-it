import { LegalScreen } from '@/components/legal-screen';

export default function TermsScreen() {
  return (
    <LegalScreen
      description="Terms for using What Bin Is It Tonight? as a household collection utility."
      path="/terms"
      sections={[
        {
          title: 'Use of the app',
          body: 'The app helps you view collection information returned by connected council sources, plan reminders and keep local household records. It is not a council service.',
        },
        {
          title: 'Check important information',
          body: 'Councils can change dates, accepted materials and reporting rules. Check the named official council source when a collection or disposal decision is time-critical.',
        },
        {
          title: 'Missed collection reports',
          body: 'A report is submitted only when the council confirms it. A local tracking ID is not a council reference. If the app opens a website, telephone route or email, complete that council process separately.',
        },
        {
          title: 'Safe disposal',
          body: 'Do not place batteries, electricals, chemicals, pressurised containers, sharps or clinical waste in a household bin unless the council explicitly permits it. Use the linked specialist service.',
        },
        {
          title: 'Availability',
          body: 'Live lookups depend on third-party council systems and may be temporarily unavailable. Saved verified dates can remain visible offline, but the app labels cached data clearly.',
        },
      ]}
      title="Terms"
      updated="26 July 2026"
    />
  );
}

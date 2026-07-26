import { LegalScreen } from '@/components/legal-screen';

export default function TermsScreen() {
  return (
    <LegalScreen
      description="Terms for using What Bin Is It Tonight? as a household collection utility."
      path="/terms"
      sections={[
        {
          title: 'Use of the app',
          body: 'The app helps you view collection information returned by connected council sources, plan reminders and keep local household records. It is independent and is not a council service. You may use it for personal household purposes while following these terms.',
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
        {
          title: 'Free first release',
          body: 'No resident subscription or in-app purchase is offered in this release. Essential collection information, basic reminders, recycling guidance, local services and the basic missed-bin route are intended to remain free if optional convenience plans are introduced later.',
        },
        {
          title: 'External services',
          body: 'Council pages, map providers, email and GitHub are separate services with their own terms and privacy practices. A link does not mean the publisher controls or endorses every item on the external page.',
        },
        {
          title: 'Fair use',
          body: 'Do not attempt to overload, bypass, reverse engineer or gain unauthorized access to the app gateway or a connected council source. Automated use must be separately agreed.',
        },
        {
          title: 'Changes and support',
          body: 'Features and connected sources may change as councils update their services. Material changes to these terms will be dated on this page. Use Help and support for app questions; contact the council for decisions about its own collection or report.',
        },
      ]}
      title="Terms"
      updated="26 July 2026"
    />
  );
}

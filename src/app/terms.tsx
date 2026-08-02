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
          title: 'Free essentials and optional Plus',
          body: 'Verified collection information, one saved address, the standard reminder, recycling guidance, local services, council alerts and the basic missed-bin route remain free. Where What Bin Plus is enabled, it adds optional multi-address, reminder, history, calendar, household-sharing, widget and support conveniences without restricting those essentials.',
        },
        {
          title: 'Accounts',
          body: 'An account is optional for free collection information but required to buy, restore or sync Plus access. New accounts start on the Free plan. Keep access to the email address used for sign-in and do not share a sign-in link. Saved household addresses remain on the device and are not part of the account.',
        },
        {
          title: 'Subscriptions and purchases',
          body: 'Web Plus purchases are processed by Stripe; native purchases are processed by Apple App Store or Google Play. The checkout or store shows the current price and billing period before you confirm. Monthly and annual subscriptions renew automatically unless cancelled through the relevant billing portal or store account, subject to the terms shown at purchase. A lifetime product, if offered, is a one-time purchase. Sign in and use Restore purchases where available to recover eligible access. Refunds, billing and cancellation are handled under the applicable payment-provider rules. Trial, council-sponsored or housing-sponsored access can start, change or end under the dates and features of that programme. The app does not show a consumer paywall for a currently selected council while an eligible sponsorship is active.',
        },
        {
          title: 'Household sharing',
          body: 'Household sharing is optional. The owner can invite members to a council-scoped household so they can coordinate responsibility and collection outcomes. Invite links should be shared only with intended household members. Members are responsible for the names and actions they add. A shared household does not transfer or restore the saved address or council property reference, which remain on each device.',
        },
        {
          title: 'Council and partner messages',
          body: 'Council alerts are operational messages for the selected authority. Delivery can depend on collection type, date or an approved opaque area label supplied by that authority. Do not rely on a push notification as the sole warning for an emergency. Relevant sponsored services are clearly labelled, remain below appropriate free council and reuse options, and can be hidden. Opening a listing is not a guarantee of availability, price or service quality.',
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
      updated="2 August 2026"
    />
  );
}

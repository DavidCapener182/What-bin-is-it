export type CommercialLaunchPhase = 'proof' | 'plus-beta' | 'live';

export type ResidentFeature =
  | 'one-address'
  | 'verified-schedule'
  | 'standard-reminder'
  | 'bank-holiday-changes'
  | 'recycling-guide'
  | 'local-services'
  | 'missed-bin-route'
  | 'service-alerts'
  | 'five-addresses'
  | 'advanced-reminders'
  | 'report-history'
  | 'calendar-subscription'
  | 'household-sharing'
  | 'widgets'
  | 'priority-support';

export type CommercialPlan = {
  id: string;
  name: string;
  audience: 'resident' | 'property' | 'council';
  price: string;
  cadence: 'monthly' | 'yearly' | 'one-time' | 'quote';
  description: string;
  features: readonly string[];
  recommended?: boolean;
  storeProductId?: string;
};

const configuredPhase = process.env.EXPO_PUBLIC_LAUNCH_PHASE;

export const commercialLaunchPhase: CommercialLaunchPhase = (
  configuredPhase === 'plus-beta' || configuredPhase === 'live'
) ? configuredPhase : 'proof';

/**
 * These services remain free even after Plus launches. They are the trusted
 * public-utility core and must never be used as a paywall lever.
 */
export const permanentlyFreeFeatures: readonly ResidentFeature[] = [
  'one-address',
  'verified-schedule',
  'standard-reminder',
  'bank-holiday-changes',
  'recycling-guide',
  'local-services',
  'missed-bin-route',
  'service-alerts',
];

export const plusFeatures: readonly ResidentFeature[] = [
  'five-addresses',
  'advanced-reminders',
  'report-history',
  'calendar-subscription',
  'household-sharing',
  'widgets',
  'priority-support',
];

export const residentPlans: readonly CommercialPlan[] = [
  {
    id: 'free',
    name: 'Free',
    audience: 'resident',
    price: '£0',
    cadence: 'yearly',
    description: 'The collection-day essentials stay free.',
    features: [
      'One saved address',
      'Verified schedule and standard reminder',
      'Bank-holiday and service changes',
      'Recycling guide and nearby services',
      'Basic missed-bin reporting route',
    ],
  },
  {
    id: 'plus-monthly',
    name: 'What Bin? Plus',
    audience: 'resident',
    price: '£1.99',
    cadence: 'monthly',
    description: 'Flexible access to household convenience features.',
    storeProductId: 'uk.whatbinistonight.plus.monthly',
    features: [
      'Up to five addresses',
      'Advanced reminder sequence',
      'Report history and saved references',
      'Calendar subscription and household sharing',
    ],
  },
  {
    id: 'plus-yearly',
    name: 'What Bin? Plus',
    audience: 'resident',
    price: '£14.99',
    cadence: 'yearly',
    description: 'The recommended plan for households.',
    recommended: true,
    storeProductId: 'uk.whatbinistonight.plus.yearly',
    features: [
      'Everything in monthly Plus',
      'Best-value annual billing',
      'Widgets and advanced service alerts',
      'Priority support',
    ],
  },
  {
    id: 'plus-lifetime',
    name: 'Lifetime launch offer',
    audience: 'resident',
    price: '£29.99',
    cadence: 'one-time',
    description: 'An optional early-adopter product, available only during launch.',
    storeProductId: 'uk.whatbinistonight.plus.lifetime',
    features: ['Lifetime access to the Plus feature set on the purchasing platform'],
  },
];

export const councilPlans: readonly CommercialPlan[] = [
  {
    id: 'council-starter',
    name: 'Starter',
    audience: 'council',
    price: '£7,500',
    cadence: 'yearly',
    description: 'A trusted collection-information and education layer for residents.',
    features: [
      'Council-branded area',
      'Exact-address collection lookup',
      'Push notifications',
      'Local recycling guide and council links',
    ],
  },
  {
    id: 'council-resident-services',
    name: 'Resident Services',
    audience: 'council',
    price: '£15,000',
    cadence: 'yearly',
    description: 'Adds reporting, disruption publishing and service insight.',
    recommended: true,
    features: [
      'Everything in Starter',
      'Missed-bin workflows',
      'Service disruptions and scheduled announcements',
      'Reporting dashboard and privacy-preserving analytics',
      'Basic integrations',
    ],
  },
  {
    id: 'council-integrated',
    name: 'Integrated',
    audience: 'council',
    price: '£25,000–£40,000',
    cadence: 'yearly',
    description: 'Direct resident-service integration with agreed support levels.',
    features: [
      'Direct CRM and report submission',
      'Resident status updates',
      'Multiple waste-service workflows',
      'Custom connectors, service levels and white-labelling',
    ],
  },
];

export const propertyPlans: readonly CommercialPlan[] = [
  {
    id: 'property-50',
    name: 'Property 50',
    audience: 'property',
    price: '£49',
    cadence: 'monthly',
    description: 'For landlords and managers with up to 50 properties.',
    features: ['Multi-property reminders', 'Resident share links', 'Missed-collection log'],
  },
  {
    id: 'property-250',
    name: 'Property 250',
    audience: 'property',
    price: '£99',
    cadence: 'monthly',
    description: 'For portfolios with up to 250 properties.',
    features: ['Portfolio alerts', 'Caretaker reminders', 'Exportable reporting'],
  },
  {
    id: 'property-large',
    name: 'Property Pro',
    audience: 'property',
    price: '£249',
    cadence: 'monthly',
    description: 'For larger portfolios and operational teams.',
    features: ['Repeated-failure insight', 'Team workflows', 'Priority onboarding'],
  },
];

export const commercialGuardrails = [
  'Do not paywall collection dates, the basic reminder, recycling guidance, local services, service disruptions or the basic missed-bin route.',
  'Do not sell or trade address, postcode, location or notification data.',
  'Show free council and charity options before clearly labelled paid partners.',
  'Do not enable resident payment prompts during the proof phase.',
] as const;

export function residentPaymentsEnabled() {
  return commercialLaunchPhase !== 'proof';
}

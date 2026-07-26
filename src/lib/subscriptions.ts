export const plusEntitlementIdentifier = 'plus';

export type SubscriptionSnapshot = {
  available: boolean;
  configured: boolean;
  isPlus: boolean;
  productIdentifier?: string;
  expirationDate?: string;
  managementUrl?: string;
  message?: string;
};

export type SubscriptionListener = (snapshot: SubscriptionSnapshot) => void;

export const unavailableSubscriptionSnapshot: SubscriptionSnapshot = {
  available: false,
  configured: false,
  isPlus: false,
  message: 'Subscriptions are available in the installed iPhone and Android apps.',
};

export async function configureSubscriptionClient(): Promise<SubscriptionSnapshot> {
  return unavailableSubscriptionSnapshot;
}

export async function getSubscriptionSnapshot(): Promise<SubscriptionSnapshot> {
  return unavailableSubscriptionSnapshot;
}

export async function presentSubscriptionPaywall(): Promise<SubscriptionSnapshot> {
  return unavailableSubscriptionSnapshot;
}

export async function restoreSubscriptionPurchases(): Promise<SubscriptionSnapshot> {
  return unavailableSubscriptionSnapshot;
}

export async function presentSubscriptionManagement(): Promise<SubscriptionSnapshot> {
  return unavailableSubscriptionSnapshot;
}

export function listenForSubscriptionChanges(_listener: SubscriptionListener) {
  return () => undefined;
}

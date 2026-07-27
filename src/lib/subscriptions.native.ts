import { Linking, Platform } from 'react-native';
import Purchases, { CustomerInfo, CustomerInfoUpdateListener } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import { residentPaymentsEnabled } from '@/lib/commercial-offer';

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
  message: 'Store purchases are not available in this build.',
};

let configured = false;

function platformApiKey() {
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
  if (Platform.OS === 'android') return process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY;
  return undefined;
}

function snapshotFromCustomerInfo(customerInfo: CustomerInfo): SubscriptionSnapshot {
  const entitlement = customerInfo.entitlements.active[plusEntitlementIdentifier];
  return {
    available: true,
    configured: true,
    isPlus: Boolean(entitlement?.isActive),
    productIdentifier: entitlement?.productIdentifier,
    expirationDate: entitlement?.expirationDate ?? undefined,
    managementUrl: customerInfo.managementURL ?? undefined,
  };
}

function ensureConfigured() {
  if (!configured) {
    throw new Error('Store purchases are not configured in this build yet.');
  }
}

export async function configureSubscriptionClient(): Promise<SubscriptionSnapshot> {
  if (!residentPaymentsEnabled()) {
    return {
      ...unavailableSubscriptionSnapshot,
      message: 'What Bin? Plus is not enabled in this release.',
    };
  }

  const apiKey = platformApiKey();
  if (!apiKey) {
    return {
      ...unavailableSubscriptionSnapshot,
      available: true,
      message: 'The App Store or Google Play connection is not configured in this build yet.',
    };
  }

  if (!configured) {
    Purchases.configure({
      apiKey,
      automaticDeviceIdentifierCollectionEnabled: false,
    });
    configured = true;
  }

  return getSubscriptionSnapshot();
}

export async function getSubscriptionSnapshot(): Promise<SubscriptionSnapshot> {
  ensureConfigured();
  return snapshotFromCustomerInfo(await Purchases.getCustomerInfo());
}

export async function presentSubscriptionPaywall(): Promise<SubscriptionSnapshot> {
  ensureConfigured();
  await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: plusEntitlementIdentifier,
    displayCloseButton: true,
  });
  return getSubscriptionSnapshot();
}

export async function restoreSubscriptionPurchases(): Promise<SubscriptionSnapshot> {
  ensureConfigured();
  return snapshotFromCustomerInfo(await Purchases.restorePurchases());
}

export async function presentSubscriptionManagement(): Promise<SubscriptionSnapshot> {
  ensureConfigured();
  const before = await getSubscriptionSnapshot();
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (error) {
    if (!before.managementUrl) throw error;
    await Linking.openURL(before.managementUrl);
  }
  return getSubscriptionSnapshot();
}

export async function identifySubscriptionUser(userId?: string): Promise<SubscriptionSnapshot> {
  if (!configured) return unavailableSubscriptionSnapshot;
  if (userId) {
    const { customerInfo } = await Purchases.logIn(userId);
    return snapshotFromCustomerInfo(customerInfo);
  }
  if (await Purchases.isAnonymous()) return getSubscriptionSnapshot();
  return snapshotFromCustomerInfo(await Purchases.logOut());
}

export function listenForSubscriptionChanges(listener: SubscriptionListener) {
  if (!configured) return () => undefined;
  const revenueCatListener: CustomerInfoUpdateListener = (customerInfo) => {
    listener(snapshotFromCustomerInfo(customerInfo));
  };
  Purchases.addCustomerInfoUpdateListener(revenueCatListener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(revenueCatListener);
  };
}

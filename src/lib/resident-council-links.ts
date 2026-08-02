import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const storageKey = '@what-bin-is-it-tonight/resident-installation-v1';
const legacyAnalyticsStorageKey = '@what-bin-is-it-tonight/pilot-analytics-v1';
const councilDemandStorageKey = '@what-bin-is-it-tonight/council-demand-v1';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const councilIdPattern = /^lad-[ensw][0-9]{8}$/;
const configuredApiBase = process.env.EXPO_PUBLIC_COUNCIL_API_BASE?.replace(/\/$/, '');
const apiBase = configuredApiBase
  || (Platform.OS === 'web' && typeof globalThis.location?.origin === 'string'
    ? `${globalThis.location.origin}/api`
    : 'https://what-bin-is-it-tonight.vercel.app/api');

let installationIdPromise: Promise<string> | undefined;

export async function residentInstallationId() {
  installationIdPromise ??= AsyncStorage.getItem(storageKey).then(async (stored) => {
    if (stored && uuidPattern.test(stored)) return stored;
    const legacyAnalytics = await AsyncStorage.getItem(legacyAnalyticsStorageKey)
      .then((value) => value ? JSON.parse(value) as { participantId?: unknown } : undefined)
      .catch(() => undefined);
    const installationId = typeof legacyAnalytics?.participantId === 'string'
      && uuidPattern.test(legacyAnalytics.participantId)
      ? legacyAnalytics.participantId
      : Crypto.randomUUID();
    await AsyncStorage.setItem(storageKey, installationId);
    return installationId;
  });
  return installationIdPromise;
}

export async function syncResidentCouncilLinks(councilIds: string[]) {
  const normalisedCouncilIds = [...new Set(
    councilIds.filter((councilId) => councilIdPattern.test(councilId)),
  )].sort().slice(0, 10);
  const installationId = await residentInstallationId();
  const response = await fetch(`${apiBase}/councils/resident-links`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ installationId, councilIds: normalisedCouncilIds }),
  });
  if (!response.ok) {
    throw new Error('The anonymous council resident count could not be updated.');
  }
}

export async function eraseResidentCouncilRecord() {
  const installationId = await AsyncStorage.getItem(storageKey);
  if (!installationId || !uuidPattern.test(installationId)) {
    await AsyncStorage.removeItem(storageKey);
    installationIdPromise = undefined;
    return;
  }
  const response = await fetch(`${apiBase}/councils/resident-links`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ installationId }),
  });
  if (!response.ok) {
    throw new Error('The anonymous council resident record could not be erased.');
  }
  await AsyncStorage.removeItem(storageKey);
  await AsyncStorage.removeItem(councilDemandStorageKey);
  installationIdPromise = undefined;
}

type StoredCouncilDemand = Record<string, { notifyRequested: boolean; requestedAt: string }>;

export async function requestedCouncilConnections() {
  return AsyncStorage.getItem(councilDemandStorageKey)
    .then((value) => value ? JSON.parse(value) as StoredCouncilDemand : {})
    .catch((): StoredCouncilDemand => ({}));
}

export async function requestCouncilConnection(councilId: string, notifyRequested = true) {
  if (!councilIdPattern.test(councilId)) throw new Error('The selected council is invalid.');
  const installationId = await residentInstallationId();
  const response = await fetch(`${apiBase}/councils/demand`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ installationId, councilId, notifyRequested }),
  });
  if (!response.ok) throw new Error('Your council request could not be saved.');
  const stored = await requestedCouncilConnections();
  stored[councilId] = {
    notifyRequested: stored[councilId]?.notifyRequested || notifyRequested,
    requestedAt: stored[councilId]?.requestedAt ?? new Date().toISOString(),
  };
  await AsyncStorage.setItem(councilDemandStorageKey, JSON.stringify(stored));
  return stored[councilId];
}

export type PartnerConversionEvent = 'listing-viewed' | 'website-opened' | 'phone-tapped' | 'directions-requested' | 'booking-initiated';

export async function recordPartnerConversion(partnerId: string, eventName: PartnerConversionEvent) {
  if (!uuidPattern.test(partnerId)) return;
  try {
    const installationId = await residentInstallationId();
    await fetch(`${apiBase}/partners/conversion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId, partnerId, eventName }),
    });
  } catch {
    // Partner evidence must never block disposal guidance or opening a service.
  }
}

export const residentCouncilStorageKey = storageKey;

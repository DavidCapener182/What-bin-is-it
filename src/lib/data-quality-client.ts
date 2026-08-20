import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { createDataQualityClientIdCoordinator } from '@/lib/data-quality-client-coordinator';

const storageKey = '@what-bin-is-it-tonight/data-quality-client-v1';
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const coordinator = createDataQualityClientIdCoordinator({
  createId: () => Crypto.randomUUID(),
  isValid: (value) => uuidV4Pattern.test(value),
  storage: AsyncStorage,
  storageKey,
});

export async function dataQualityClientId() {
  return coordinator.get();
}

export async function eraseDataQualityClientId() {
  await coordinator.erase();
}

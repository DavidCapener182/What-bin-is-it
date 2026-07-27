import { Platform } from 'react-native';

const configuredApiBase = process.env.EXPO_PUBLIC_COUNCIL_API_BASE?.replace(/\/$/, '');

export const apiBase = configuredApiBase
  || (Platform.OS === 'web' && typeof globalThis.location?.origin === 'string'
    ? `${globalThis.location.origin}/api`
    : 'https://what-bin-is-it-tonight.vercel.app/api');
